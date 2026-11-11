/**
 * The real store adapter hook: binds the core to `useSyncExternalStore` so
 * that any state update re-renders the active screen immediately.
 */
import { useMemo, useSyncExternalStore } from "react";
import { translateCommon } from "../i18n/common";
import { useLang } from "../i18n/lang";
import type { StoreAdapter } from "./index";
import { createCore, type Core } from "./core";
import type { AdapterDeps } from "./actions";
import { buildSnapshot } from "./snapshot";

/**
 * Creates the store adapter. The core is cached for the lifetime of the hook;
 * the translation function is refreshed whenever the user changes language.
 */
export function useRealStore(deps: AdapterDeps): StoreAdapter {
  const { lang } = useLang();
  const translate = (key: string) => translateCommon(lang, key);
  const core = useMemo<Core>(
    () => createCore(deps, (target) => buildSnapshot(target, translate)),
    [deps],
  );

  return useSyncExternalStore(
    core.subscribe,
    () => core.snapshot(),
    () => core.snapshot(),
  );
}
