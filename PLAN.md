# svelte-asciiart → lovely-ansi-svg

## Commander's intent

Reposition for 0.1.0 (breaking): the center of gravity moves to a
**framework-agnostic ANSI/ASCII → SVG core** (`packages/lovely-ansi-svg`),
with `svelte-asciiart` surviving as a thin reactive wrapper and the generic
PNG path extracted into `packages/lovely-svg-png`. The core is a pure
`text + options → SVG` pipeline usable from Node/SSR/CI and any framework —
first customer: lovely-mermaid. Nobody depends on the current API (verified
via GitHub search), so the breaking window is free.

## Plan

### [x] Per-package changelogs (pi-mono style)

- `packages/*/CHANGELOG.md` (no demo changelog); release script and publish
  workflow discover non-private packages, lockstep version, one tag;
  GitHub Release notes concatenate per-package sections.

### [x] Core package `packages/lovely-ansi-svg`

- Moved ansi/width with all hardened behaviors; segment-first parsing
  (style breakpoints over row text, clusters styled by first code unit);
  public pipeline parse → layout → render → exportSvg; theme-as-data with
  `var(--ansi-*, <resolved>)` emission; metrics `{cellAspect, baseline}`
  as plain inputs (0.6/0.8 defaults); model-based `exportSvg(text, options)`
  — no DOM. tsc build, node vitest (63 tests).

### [x] PNG package `packages/lovely-svg-png`

- `svgStringToPng` (+ `fontCss` injection) and `collectFontCss(families)`
  with @import recursion; nothing ansi-specific; browser vitest.

### [x] Svelte wrapper 0.1.0

- Renders from the core RenderModel; props consolidated to 9
  (`grid`/`frame: boolean | string`, `glyphScale`, `cellSize` absorbs
  baseSize, `cellAspect: number | 'auto'` canvas-measured); dropped
  `bind:svg` and the auto aria-label (label→img, none→presentation);
  theme CSS inlined from core `themeCss()`.

### [x] Follow-through

- Demo on the new API (model-based export panels, auto-aspect toggle);
  root README core-first + per-package READMEs (wrapper no longer copies
  the root one); Breaking Changes changelog; CODE.md restructured.

## Next

- [ ] Release 0.1.0: `/cl` audit, then `bun run release minor` (user runs it
      — the 2FA prompt needs a TTY).
- [ ] Point lovely-mermaid at `lovely-ansi-svg` (separate repo/session) —
      their `scripts/gen-demo-svg.ts` collapses to `toAnsi()` + `exportSvg()`.
- [ ] Custom-drawn box/block glyphs (xterm `customGlyphs` approach): draw
      U+2500–U+259F as exact-cell rects/paths instead of font glyphs — the
      structural fix for glyph overshoot/overlap (mermaid feedback; measured
      baseline helps placement but doesn't remove it).

## Notes

- Rejected simplifications (deliberate): dropping `rows`/`cols`/`frame`/
  `margin` (fixed 80×24 canvases are a real terminal-fidelity need);
  merging `rows`/`cols` into a tuple; dropping PNG export (kept knowingly —
  "Copy PNG" is the headline demo feature, now isolated in its own package).
- TS stays pinned `^5.9` (TS 7 breaks kit `$types`); svelte ≥ 5.56.
- `exportSvg` cannot measure fonts (no DOM) — `cellAspect` falls back to 0.6
  unless passed explicitly.
