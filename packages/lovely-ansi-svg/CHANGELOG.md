# Changelog

## [Unreleased]

### Added

- Initial release: framework-agnostic ANSI/ASCII → SVG core, extracted from `svelte-asciiart`.
- `exportSvg(text, options)`: standalone themeable SVG string from plain or ANSI SGR text, no DOM needed — usable in Node, SSR, workers and CI.
- ANSI SGR parsing: 16-color, 256-color and truecolor foregrounds and backgrounds; bold, dim, italic, underline, blink, strikethrough, inverse; per-attribute resets; state persisting across lines; robust escape stripping (CSI, OSC/DCS/APC/PM/SOS payloads even spanning newlines), tab expansion and C0 handling.
- Segment-first layout: grapheme clusters (ZWJ emoji, combining marks) can never be torn by an escape; CJK and emoji occupy two cells.
- Theme-as-data: a 16-color palette plus default foreground/background resolved into the emitted CSS, with every color kept behind a `var(--ansi-*, <resolved>)` fallback for CSS-variable re-theming.
- Dim renders as a solid `color-mix()` toward `--ansi-default-bg` instead of opacity — overlapping full-cell glyphs no longer double-composite into stripes.
- Public pipeline: `parseAnsi` → `layout` → `render` → serialize, plus `displayWidth`/`clusterWidth`/`clusters` and `themeCss`.
