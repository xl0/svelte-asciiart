# Changelog

## [Unreleased]

### Breaking Changes

- The rendering core moved to the new framework-agnostic `lovely-ansi-svg` package; `svelte-asciiart` now exports only the `AsciiArt` component.
- Removed the `exportSvg`, `exportSvgToPng`, `svgStringToPng`, `collectFontCss` and `fmt` exports — export standalone SVG with `exportSvg(text, options)` from `lovely-ansi-svg` (model-based, no mounted element needed) and rasterize with `svgStringToPng`/`collectFontCss` from `lovely-svg-png`.
- Removed `bind:svg` — the export path no longer needs the element.
- Renamed `fontSize` to `glyphScale`.
- Removed `baseSize`; `cellSize` now sets the intrinsic size (pixels per cell, default 50). The svg always stretches to its container — pass `style="width: auto; height: auto"` for a fixed on-screen scale.
- Merged `gridClass`/`frameClass` into `grid`/`frame` (`boolean | string`, the string being the CSS class); `grid`/`frame` without a class now draw with a default currentColor stroke instead of invisibly.
- `cellAspect` defaults to `'auto'`: the aspect and baseline are canvas-measured from the rendered font, re-measured whenever the resolved font changes (ancestor `--ascii-font-family` flips, style/class changes, webfont loads). Pass a number to pin the previous fixed 0.6 geometry.
- ANSI colors resolve through the new `theme` prop (16-color palette + default fg/bg, VS Code-ish default). The `ansi-*` CSS classes and `--ansi-*` custom properties are gone — re-theme by passing a theme instead; blink is parsed but no longer styleable.
- The svg no longer takes its accessible name from the art text: pass `aria-label` yourself for `role="img"`; without a label the svg renders as `role="presentation"`.

### Added

- `measureCellMetrics(fontFamily)` export: the canvas measurement the component uses for `cellAspect: 'auto'`; its `{cellAspect, baseline}` result spreads straight into `exportSvg` options so exports match the live auto-aspect render.
- `theme` prop: the color theme ANSI escapes resolve through; `theme.foreground` sets the default text color.

### Changed

- Dim renders as a solid `color-mix()` toward the theme background instead of `opacity: 0.6` — overlapping full-cell glyphs no longer double-composite into stripes.

## [0.0.6] - 2026-08-13

### Added

- ANSI color support: `text` containing SGR escapes is parsed automatically (16-color, 256-color, truecolor foregrounds **and backgrounds**; bold, dim, italic, underline, strikethrough, inverse; state persists across lines). 16-color codes map to `ansi-*` CSS classes themeable via `--ansi-fg-*`/`--ansi-bg-*` custom properties. Backgrounds render as full-cell rects behind the text; inverse swaps fg/bg (`--ansi-default-bg` fills in for a missing side); blink emits a class without default styling.
- `fontSize` prop (glyph size as fraction of cell height; default 1 so box-drawing lines tile seamlessly) and `cellSize` prop (px per cell — fixed scale instead of stretching to the container).
- Accessibility: the svg carries `role="img"`; describe the art via `aria-label`.
- MIT `LICENSE`, shipped in the npm package alongside the README.
- Package metadata: `description`, `license`, `author`.
- `fmt` export: the number formatter the component uses for SVG attributes (fixed precision, trailing zeros trimmed).
- `collectFontCss` export: `@font-face` CSS for the SVG's fonts with the files inlined as data: URIs — embedded automatically in PNG export, and usable via `exportSvg`'s new `extraCss` option for font-standalone SVG exports.

### Changed

- Default glyph metrics: glyphs fill the full cell height (previously 0.9 with a horizontal inset), so existing renders come out ~11% larger. Pass `fontSize={0.9}` to restore the old look.
- Rendering emits one `<tspan>` per styled run (with per-code-point `x` positions) instead of one per character — much lighter DOM.
- Grid metrics use display width: CJK and emoji occupy two cells; multi-code-point clusters (ZWJ emoji) are kept whole.
- Tabs in `text` expand to 8-column stops; other C0 controls (bare `\r`, BEL, backspace) are dropped.
- Underline-color SGR sequences (58/59) and DCS/APC/PM/SOS string sequences are consumed cleanly instead of leaking into the output.
- `rows`/`cols` clamp to non-negative integers.
- `aria-label` is omitted when the effective role is `presentation`/`none`.

### Fixed

- SVG attributes passed to the component (`width`, `height`, `viewBox`, `preserveAspectRatio`, `overflow`) override the computed defaults, as documented.
- Very long texts (~100k+ lines) no longer crash the component in V8-based browsers.
- Combining marks separated from their base glyph by an ANSI escape render correctly instead of being dropped.
- `exportSvg` keeps styling that reaches elements through host tag selectors and unclassed shapes in the standalone export.
- `exportSvg` escapes CSS metacharacters in class names, so Tailwind-style classes (`stroke-red-500/50`) survive in the exported styles.

## [0.0.5] - 2025-12-31

### Added

- Added SVG/PNG export utilities: `exportSvg`, `exportSvgToPng`, `svgStringToPng`.

### Changed

- Export `scale` defaults to 1.
- Better handling of SVG size: intrinsic `width`/`height` from `baseSize`, responsive via inline style.
