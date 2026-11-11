# Fils de travail (web workers) — SUT-N-03

> « Analyse et comparaison dans des fils de travail ; l'interface ne se fige
> jamais plus de 100 ms. »

Tout ce qui lit, compare ou écrit un classeur s'exécute désormais dans un
worker. Le fil principal ne fait plus que du rendu, du stockage et des
téléchargements.

## Ce qui tourne dans le worker

| Opération du port `Engines` | Où | Pourquoi |
|---|---|---|
| `readWorkbook` | **worker** | Décompression ZIP + parcours XML : le plus gros du temps sur un classeur réel. |
| `deriveCanonical` | **worker** | Dérivation `cells/*.tsv` de chaque feuille. |
| `compare` | **worker** | Alignement des lignes/colonnes, matrice LCS : quadratique. |
| `planMerge` | **worker** | Plan de réunion à trois versions. |
| `resolveMerge` | **worker** | Application des décisions de l'utilisateur. |
| `patchWorkbook` | **worker** | Écriture XML dans le classeur porteur. |
| `zipParts` | **worker** | Recompression du fichier réuni. |
| `openStore` | **fil principal** | Voir ci-dessous. |

## Ce qui reste sur le fil principal, et pourquoi

- **`openStore`** : le magasin de versions s'appuie sur `isomorphic-git` et
  `@isomorphic-git/lightning-fs` sur IndexedDB. Une seconde instance dans le
  worker ouvrirait un second cache sur la même base, avec deux sources de
  vérité pour l'index et les refs, pour aucun gain visible : les opérations du
  magasin sont dominées par les entrées/sorties, pas par le calcul. Le worker
  ne stocke donc rien ; il ne reçoit que des octets et des vues canoniques.
- **Le rendu, les téléchargements, la traduction, le registre des classeurs** :
  ce sont les frontières du navigateur (`HostPorts`), elles n'ont pas leur
  place hors du fil qui possède le DOM.

## Contrat de messages (`src/workers/protocol.ts`)

```ts
// requête
{ id: number, kind: OperationKind, payload: unknown }
// réponse
{ id: number, ok: true, result: unknown }
{ id: number, ok: false, error: { code?: string, message: string } }
```

- **Plusieurs appels en vol** : chaque requête porte un identifiant, les
  réponses sont appariées par identifiant — le worker peut donc répondre dans
  le désordre (`src/workers/workerQueue.ts`).
- **Octets transférés** : les `ArrayBuffer` de la requête et du résultat sont
  listés dans le second argument de `postMessage`
  (`transferablesOf`). Ils changent de fil sans copie ; c'est ce qui rend le
  worker intéressant sur un classeur de plusieurs mégaoctets. Corollaire : les
  octets passés au worker ne sont plus utilisables côté appelant — les moteurs
  allouent toujours de nouveaux tampons pour leurs résultats.
- **Refus typés** : un `SutureFileError` (« classeur chiffré », « archive
  piégée »…) est sérialisé en `{ code, message }` puis **reconstruit** côté
  appelant (`deserializeError`), pour que l'utilisateur voie toujours la bonne
  explication et jamais « erreur générique ».

## Repli (critère d'acceptation)

`createWorkerEngines()` vérifie que `Worker` existe et que la construction
réussit. Sinon — vieux navigateur, `Worker` désactivé, politique de sécurité —
il retombe entièrement sur `createBrowserEngines()` et journalise un
avertissement. L'application reste fonctionnelle partout ; elle est simplement
moins fluide. Même repli si un worker meurt en cours de route : les requêtes en
vol sont rejetées avec la raison, jamais laissées suspendues.

## Choix d'architecture : le port est asynchrone

Un worker ne répond que par événement : impossible de renvoyer une valeur
« sur place ». Garder le port synchrone aurait signifié appeler deux fois les
moteurs, ou laisser le travail lourd sur le fil principal — auquel cas le
worker n'apportait rien. Le port `Engines` (`src/store/ports.ts`) est donc
entièrement `Promise`-based, et le magasin `await` chaque appel. Les paquets
moteurs, eux, n'ont pas changé : l'asynchronie vit à la couture.

## Mesurer le gain

1. **Non-blocage de l'interface** (le critère du cahier) : dans l'onglet
   *Performance* des DevTools, enregistrez un import de classeur puis une
   comparaison. Comptez la plus longue tâche du fil principal : elle doit
   rester sous 100 ms. Sans worker, on observe des tâches de plusieurs
   secondes (décompression, alignement).
2. **Comparaison des deux implémentations** : `createWorkerEngines()` et
   `createBrowserEngines()` exposent le même port. Mesurez au même endroit
   (`performance.mark` / `performance.measure` autour de l'appel) :
   - avec le worker : durée totale plus longue d'un aller-retour (~1 ms) mais
     fil principal libre ;
   - sans worker : durée totale plus courte, fil principal occupé — c'est
     précisément la mesure qui dépasse les 100 ms sur les gros classeurs.
3. **Banc reproductible** : `bench/` fournit le classeur de référence
   (200 000 cellules). `pnpm build && npx serve apps/web/dist` puis y charger
   ce fichier donne les chiffres comparables d'une exécution à l'autre.

## Fichiers

| Fichier | Rôle |
|---|---|
| `protocol.ts` | Types des messages, sérialisation des erreurs, liste des tampons à transférer. |
| `analysis-handler.ts` | Logique pure : une requête → une réponse (testée sans worker). |
| `analysisEngines.ts` | Câblage unique des paquets moteurs, partagé par les deux fils. |
| `analysis.worker.ts` | Point d'entrée du worker (`?worker`) : écoute, appelle le handler, répond. |
| `spawn.ts` | Construction du worker derrière une interface étroite (remplaçable en test). |
| `workerQueue.ts` | File de requêtes par identifiant, erreurs et arrêt propre. |
| `../store/workerEngines.ts` | Le port `Engines` servi par le worker, avec repli et `dispose()`. |

## Limites connues

- Le transfert déplace les octets : ne réutilisez pas un `Uint8Array` après
  l'avoir passé au port worker (le port synchrone, lui, ne le consommait pas).
  Deux appels **simultanés** ne doivent donc pas partager les mêmes octets ;
  un tampon déjà cédé est refusé bruyamment par `postMessage` (la promesse est
  rejetée, jamais laissée pendante) plutôt que de renvoyer des données vides.
- Un seul worker : les appels s'exécutent en série dans le worker. Un pool
  serait le prochain pas si un classeur devait être analysé pendant qu'un autre
  se compare — hors périmètre de cette édition.
