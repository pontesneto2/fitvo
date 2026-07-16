/**
 * Icone PROVISORIO do Logo (design-system.md §9 / §20), espelhado de
 * `packages/ui-web/src/logo-art.ts` — MESMA arte (fonte: `icon-fitvo-provisional.svg`
 * em `packages/brand-tokens/assets/logo/`), so o meio de renderizar muda (web:
 * `dangerouslySetInnerHTML`; mobile: `SvgXml` do `react-native-svg`, ja peer do
 * pacote via `lucide-react-native`, §19). Antes do §19 o mobile desenhava um "V"
 * de texto como aproximacao — essa mudanca renderiza o SVG real, igual a web.
 *
 * TODO(icone): trocar o simbolo definitivo = substituir o arquivo em assets/logo +
 * regerar esta constante e a de `ui-web`, sem tocar no componente `Logo`.
 */
export const LOGO_ICON_PROVISIONAL =
  '<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <path d="M136 140 L256 372 L376 140" fill="none" stroke="#0FA678" stroke-width="76" stroke-linecap="round" stroke-linejoin="round"/>\n  <circle cx="376" cy="140" r="34" fill="#00E676"/>\n</svg>';
