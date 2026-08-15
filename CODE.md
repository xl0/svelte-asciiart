# CODE.md

Monorepo (bun workspaces): three publishable packages under `packages/` plus a SvelteKit demo in `demo/`.

- `packages/lovely-ansi-svg` — framework-agnostic ANSI/ASCII → SVG core (no DOM).
- `packages/lovely-svg-png` — browser-only SVG-string → PNG with webfont embedding (not ansi-specific).
- `packages/svelte-asciiart` — thin Svelte 5 component over the core (depends on it via `workspace:^`).
- `demo/` — SvelteKit demo app; `kit.alias` maps all three package names to their `src` (live source, not dist) for vite and svelte-check alike.

Root scripts: `dev`/`build`/`build:demo`/`preview` delegate to demo; `check`/`test` run per-package in dependency order (the core's `build` runs first — the wrapper's check/test resolve `lovely-ansi-svg` from its `dist`); `release`; `format`/`lint` (prettier + plugins are root devDeps).

`typescript` is pinned to `^5.9` (not 7.x): kit's `$types` generation needs the full TS syntax API, which the TS 7 native compiler lacks — with TS 7 hoisted, `PageServerData` silently becomes `unknown`. Svelte must stay ≥ 5.56: 5.46's experimental-async runtime infinite-loops the page on HMR updates (`$derived(await …)` in the demo).

## Core (`packages/lovely-ansi-svg`)

Pure TS, built with `tsc` (`tsconfig.build.json` → `dist/`), node-environment vitest. Pipeline: `parseAnsi` → `layout` → `render` → `exportSvg`.

### `src/ansi.ts`

- `parseAnsi(text, theme?): ParsedRow[]` where `ParsedRow = { text, breaks: {offset, style}[] }` — escape-stripped row text with style breakpoints (code-unit offsets). `Style = {fill?, bgFill?, bold?, italic?, underline?, strike?, blink?}` — fully resolved, no CSS classes/vars anywhere: colors resolve through the theme at parse time (re-theming = re-parsing). Segment-first design: styles are overlaid as ranges and grapheme segmentation happens later in layout over the whole row, so an escape can never tear a cluster — no reattachment patching.
- SGR state machine, state persists across lines. 16-color codes (incl. `38/48;5;n` with n<16) index the theme palette; 256/truecolor are spec-fixed concrete values. `styleOf` resolves inverse as a fg/bg swap (missing bg → `currentColor` block, missing fg → theme background) and bakes dim as `color-mix(… DIM_PCT, backdrop)` where backdrop = bgFill ?? theme background — solid mix, NOT opacity (overlapping full-cell glyphs double-composite into stripes). Blink is a parsed flag, never rendered. Extended-color params bounds-checked; unknown codes consumed, incl. colon-subparam (T.416) forms and underline-color (58) sub-params. Escapes matched over the whole text — control-string payloads (OSC/DCS/APC/PM/SOS, BEL/ST-terminated) may span newlines without row breaks; rows split on `\r?\n` in plain chunks only. Tabs expand to 8-column stops (lazy col tracking), other C0 dropped. A break that received no text is rewritten in place (or dropped if undone), so same-style stretches never fragment.

### `src/layout.ts`

- `layout(rows): LayoutRow[]` / `layoutRow` — the single segmentation pass. `LayoutRow = { runs: GlyphRun[], bgs: BgRun[], width }` in display-column units: `GlyphRun = {fill?, <font flags>, cols[], text}` (one col per cluster; multi-code-point clusters get their own single-col run so an x list can't tear them), `BgRun = {fill, start, end}` merged on bg color only, independent of fg breaks. Cluster style = style at its first code unit. Zero-width clusters (stray marks) dropped.

### `src/width.ts`

- `clusters()` (Intl.Segmenter graphemes), `clusterWidth()` — compact wide detection (coarse EAW ranges + `\p{Emoji_Presentation}` + VS16 + flag pairs), 0 for pure combining/zero-width; `displayWidth()`. Deliberately not a full Unicode table. CAUTION: the regexes contain `\u`-escaped zero-width ranges — editing tools have swapped them for literal invisible characters; verify with `cat -A` after edits.

### `src/theme.ts`

- `Theme = { foreground?, background?, palette: string[16] }`, `defaultTheme` (VS Code-ish), `DIM_PCT`. Pure data — all resolution happens in `parseAnsi`'s `styleOf`. `foreground` → root `color` (unstyled text fills `currentColor`); `background` ?? `Canvas` is the inverse/dim backdrop.

### `src/svg.ts`

- `render(layoutRows, RenderOptions): RenderModel` — geometry: cell height 1 viewBox unit, `cellAspect` (0.6) wide; frame = clamped `rows`/`cols` or content size; viewBox = frame + margin; content may overflow (clipped by `overflow="hidden"`); `glyphScale` centers glyphs (inset + baseline shift, `baseline` default 0.8); `cellSize` (50) px/cell → intrinsic width/height. All numbers pre-formatted via `fmt`; run/bg styling pre-formatted as one inline-CSS `style` string per run (`runStyle`: fill, font-weight/style, text-decoration) — the model is directly consumable by the Svelte template and the serializer. Grid/frame default stroke attributes (string option = class, `true` = currentColor stroke) live on the model so both consumers stay in sync.
- `exportSvg(text, ExportSvgOptions): string` — standalone SVG: `extraCss` (if any) in `<defs><style>`, optional background rect (which also becomes `theme.background` — the dim/inverse backdrop — unless the theme sets its own), bg rects, grid/frame straight from the model, one `<text>` per non-empty row with per-code-point-x tspans; all run styling inline (host CSS can't override). `theme.foreground` → `style="color: …"` + `fill="currentColor"`. XML-escaped throughout.

## PNG (`packages/lovely-svg-png`)

Pure TS + DOM lib, tsc build, browser vitest (playwright chromium). Browser-only.

- `svgStringToPng(str, {scale, output: 'dataUrl'|'blob', fontCss})`: blob URL → `Image` → canvas; dimensions from `naturalWidth/Height` × scale; `fontCss` injected as `<defs><style>` after the `<svg>` root tag before rasterizing.
- `collectFontCss(families)`: async; `@font-face` rules for the given families (string list or array), font files fetched and inlined as data: URIs. Cross-origin sheets (Google Fonts) block CSSOM and are re-fetched as text and parsed in a constructed stylesheet; constructed sheets drop @import, so imports are re-extracted from the raw text; chains followed to depth 3. Sheet text and font data module-cached.

## Svelte wrapper (`packages/svelte-asciiart`)

Published Svelte 5 component (peer dep svelte ^5, dep `lovely-ansi-svg`). Built with `svelte-package`; `prepack` copies the root `LICENSE` and runs publint (its own README is committed). Browser vitest via vitest-browser-svelte.

### `src/lib/AsciiArt.svelte`

- Props: `text`, `rows`, `cols`, `margin`, `grid: boolean | string`, `frame: boolean | string`, `cellAspect: number | 'auto'` (default `'auto'`), `glyphScale` (default 1), `cellSize` (default 50), `theme` (ANSI colors resolve through it; `theme.foreground` → inline `color`), plus forwarded `SVGAttributes<SVGSVGElement>` (spread after the computed viewBox/width/height/overflow/preserveAspectRatio so consumer values win; consumer `style` appended after the component's own).
- Renders straight from the core model: `layout(parseAnsi(text, theme))` in one derived (text/theme-only dependency), `render(...)` in a second — geometry-only prop changes skip segmentation. Template maps `RenderModel` 1:1 (bg rects, grid path, frame rect, text rows with pre-formatted inline `style` per run; empty rows skipped).
- `cellAspect: 'auto'`: canvas-measures the mounted svg's computed font — advance/em → aspect, `fontBoundingBoxAscent/(asc+desc)` → baseline (≈0.8 for typical monos). Re-measure trigger is a ResizeObserver on a hidden probe `<text>M</text>` inside the svg: its bounding box changes whenever the resolved font does (ancestor `--ascii-font-family` flips, consumer style/class, webfont loads), which the older event-based triggers missed. `measured` starts null (render() falls back to 0.6/0.8) and is only reassigned on actual metric change. The measurement itself is `measureCellMetrics(fontFamily)` (`src/lib/metrics.ts`, exported; null on no canvas / rejected font shorthand / zero advance) — consumers pass its result to `exportSvg` so exports match the live auto-aspect render.
- No CSS injection: all ANSI styling arrives pre-resolved on the model as inline styles. Hosts set the font via `--ascii-font-family` and colors via the `theme` prop.
- Accessibility: no auto label. Consumer `aria-label`/`aria-labelledby` → `role="img"`, else `role="presentation"`; explicit `role` prop wins.
- The svg always stretches (`width/height: 100%` inline); fixed scale = consumer `style="width: auto; height: auto"` against the `cellSize`-based intrinsic size.

## Releases

- Per-package changelogs (`packages/*/CHANGELOG.md`, Keep-a-Changelog-ish, pi-mono style); demo changes get no entries. `/cl` audits each `[Unreleased]` against commits since the last `v*` tag.
- Packages are versioned in lockstep under one `v<ver>` tag. `bun run release [patch|minor|major|x.y.z] [--no-push]` (`scripts/release.ts`) discovers non-private `packages/*/package.json`, verifies each (check/test/prepack/pack) _before_ touching files — a failure leaves the worktree clean — then rolls each changelog that has `[Unreleased]` entries (others left as is; at least one must have entries), bumps all versions, commits, tags, then pauses with a release summary for inspection and asks before pushing (`--no-push` stops there without asking; declining prints manual push/approve/abandon commands). On push: waits for CI to stage each package on npm and approves each with a 2FA prompt (that approval publishes). Requires an npm login up front.
- Tag push triggers `.github/workflows/publish.yml`: verify tag matches every package version, check/test/prepack per package (alphabetical glob order = dependency order: the core's prepack builds its dist before the wrapper's check needs it), `npm stage publish` per package (trusted publishing + provenance; skips already published/staged), then GitHub Release concatenating each package's changelog section under a `## <name>` heading.

## Demo app (`demo/`)

- Three pages, one per package, under a shared nav `+layout.svelte`; each `+page.server.ts` renders its package's README via `src/lib/readme.ts` (remark/rehype + shiki). Shared demo data (mono font list incl. Google Fonts slugs, sample art) in `src/lib/demo.ts`; the webfonts themselves load globally from `app.html`.
- `/` (`+page.svelte`): component playground — controls for the AsciiArt props incl. a theme editor (fg/bg + 16 palette swatches; wrapper background painted from `theme.background` so the backdrop assumption holds), grid/frame styling through `.ascii-grid`/`.ascii-frame` classes fed by wrapper CSS vars, and a generated `<AsciiArt>` snippet (shiki, debounced 150 ms, theme literal spreads `defaultTheme` unless the palette changed).
- `/lovely-ansi-svg`: static ANSI feature gallery (`exportSvg` strings via `{@html}`, escape literals shown capped) + pipeline playground — ANSI textarea with tabbed views: rendered SVG, the SVG string, and `parseAnsi`/`layout`/`render` JSON.
- `/lovely-svg-png`: editable SVG source (sample regenerable from `exportSvg`, any pasted SVG works), webfont select + embed toggle + scale; debounced auto-rasterize guarded by a generation token; `collectFontCss` output surfaced (size + truncated preview); copy/download PNG.
- Static adapter; `build` first builds the core dist + wrapper prepack; `build:demo` sets `BASE_PATH=/svelte-asciiart`; Pages workflow uploads `demo/build`.
- Tailwind 4; shared styles in `src/routes/layout.css`.
