import { useState, type FormEvent } from "react";
import type { StoreAdapter } from "../../store";

/**
 * Author name of screen 6: the name written on the versions the user creates
 * from now on. An empty name is refused with an explanation.
 */
export function AuthorPanel(props: {
  readonly store: StoreAdapter;
  readonly t: (key: string) => string;
  readonly onSaved: () => void;
  readonly onRefused: () => void;
}) {
  const { store, t } = props;
  const [name, setName] = useState(store.authorName);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") {
      props.onRefused();
      return;
    }
    store.setAuthorName(trimmed);
    props.onSaved();
  };

  return (
    <section className="settings-panel" aria-labelledby="author-title">
      <h3 id="author-title">{t("author.title")}</h3>
      <form onSubmit={save}>
        <label htmlFor="author-name">{t("author.label")}</label>
        <input
          id="author-name"
          name="author-name"
          type="text"
          value={name}
          placeholder={t("author.placeholder")}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit">{t("author.save")}</button>
      </form>
    </section>
  );
}
