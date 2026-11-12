/**
 * The real store adapter hook: binds the core to `useSyncExternalStore` so
 * that any state update re-renders the active screen immediately.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { translateCommon } from "../i18n/common";
import type { Lang } from "../i18n/lang";
import type { StoreAdapter } from "./index";
import { createCore, type Core } from "./core";
import type { AdapterDeps } from "./actions";
import { buildSnapshot } from "./snapshot";

/**
 * Creates the store adapter. The core is created once for the lifetime of
 * `deps`; a ref carries the active language so switching languages translates
 * future messages without resetting the open workbook.
 */
export function useRealStore(deps: AdapterDeps, lang: Lang): StoreAdapter {
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const core = useMemo<Core>(
    () => createCore(deps, (target) => buildSnapshot(target, (key) => translateCommon(langRef.current, key))),
    [deps],
  );

  return useSyncExternalStore(
    core.subscribe,
    () => core.snapshot(),
    () => core.snapshot(),
  );
}
