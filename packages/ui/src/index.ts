/**
 * @suture/ui — UI kit.
 *
 * Reusable, framework-light pieces shared by the screens: the virtual window
 * math (long lists) and the locale-aware formatting of cell values.
 */
export { formatAmount, formatValue, GROUP_SEPARATOR, type UiLang } from "./format";
export {
  computeVirtualWindow,
  type VirtualWindow,
  type VirtualWindowInput,
} from "./virtual-window";
