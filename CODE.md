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

- `parseAnsi(text): ParsedRow[]` where `ParsedRow = { text, breaks: {offset, style}[] }` — escape-stripped row text with style breakpoints (code-unit offsets; `Style = {class?, fill?, bgClass?, bgFill?}`). Segment-first design: styles are overlaid as ranges and grapheme segmentation happens later in layout over the whole row, so an escape can never tear a cluster — no reattachment patching.
- SGR state machine, state persists across lines. Fg and bg each split class-vs-fill: 16-color codes (incl. `38/48;5;n` with n<16) → `ansi-fg-N`/`ansi-bg-N` classes, 256/truecolor → concrete fills. Attribute flags bold/dim/italic/underline/blink/strike; inverse is a fg/bg swap in `styleOf` (missing bg → `ansi-bg-inverse`, missing fg → `ansi-inverse`). Extended-color params bounds-checked; unknown codes consumed, incl. colon-subparam (T.416) forms and underline-color (58) sub-params. Escapes matched over the whole text — control-string payloads (OSC/DCS/APC/PM/SOS, BEL/ST-terminated) may span newlines without row breaks; rows split on `\r?\n` in plain chunks only. Tabs expand to 8-column stops (lazy col tracking), other C0 dropped. A break that received no text is rewritten in place (or dropped if undone), so same-style stretches never fragment.

### `src/layout.ts`

- `layout(rows): LayoutRow[]` / `layoutRow` — the single segmentation pass. `LayoutRow = { runs: GlyphRun[], bgs: BgRun[], width }` in display-column units: `GlyphRun = {class?, fill?, cols[], text}` (one col per cluster; multi-code-point clusters get their own single-col run so an x list can't tear them), `BgRun = {class?, fill?, start, end}` merged on bg style only, independent of fg breaks. Cluster style = style at its first code unit. Zero-width clusters (stray marks) dropped.

### `src/width.ts`

- `clusters()` (Intl.Segmenter graphemes), `clusterWidth()` — compact wide detection (coarse EAW ranges + `\p{Emoji_Presentation}` + VS16 + flag pairs), 0 for pure combining/zero-width; `displayWidth()`. Deliberately not a full Unicode table. CAUTION: the regexes contain `\u`-escaped zero-width ranges — editing tools have swapped them for literal invisible characters; verify with `cat -A` after edits.

### `src/theme.ts`

- `Theme = { foreground?, background?, palette: string[16] }`, `defaultTheme` (VS Code-ish), `themeCss(theme, scope?)` — rules for the `ansi-*` classes with `var(--ansi-*, <resolved>)` fallbacks; `scope` (e.g. `svg.asciiart`) prefixes every rule for document-scoped injection. `.ansi-blink` deliberately unstyled; `.ansi-inverse` uses `var(--ansi-default-bg, <theme.background ?? Canvas>)`. Dim is a solid `color-mix(… DIM_PCT, --ansi-default-bg)`, NOT opacity (overlapping full-cell glyphs double-composite into stripes): a bare `.ansi-dim` rule, 16 `.ansi-dim.ansi-fg-N` combos plus `.ansi-dim.ansi-inverse` (class fill rules would beat the single class); concrete 256/truecolor fills get the mix baked into the inline fill by `styleOf` (inline beats any class rule) — the parser doesn't know the theme, so the bake targets `var(--ansi-default-bg, var(--_ansi-default-bg, Canvas))` and `themeCss` defines `--_ansi-default-bg: <resolved bg>` on the scope (host `--ansi-default-bg` still wins).

### `src/svg.ts`

- `render(layoutRows, RenderOptions): RenderModel` — geometry: cell height 1 viewBox unit, `cellAspect` (0.6) wide; frame = clamped `rows`/`cols` or content size; viewBox = frame + margin; content may overflow (clipped by `overflow="hidden"`); `glyphScale` centers glyphs (inset + baseline shift, `baseline` default 0.8); `cellSize` (50) px/cell → intrinsic width/height. All numbers pre-formatted via `fmt` — the model is directly consumable by the Svelte template and the serializer. Grid/frame default stroke attributes (string option = class, `true` = currentColor stroke) live on the model so both consumers stay in sync.
- `exportSvg(text, ExportSvgOptions): string` — standalone SVG: theme CSS + `extraCss` in `<defs><style>`, optional background rect (which also becomes `theme.background` — the dim/inverse backdrop — unless the theme sets its own), bg rects, grid/frame straight from the model, one `<text>` per non-empty row with per-code-point-x tspans, concrete fills as inline style (so `<style>` rules can't override). `theme.foreground` → `style="color: …"` + `fill="currentColor"`. XML-escaped throughout.

## PNG (`packages/lovely-svg-png`)

Pure TS + DOM lib, tsc build, browser vitest (playwright chromium). Browser-only.

- `svgStringToPng(str, {scale, output: 'dataUrl'|'blob', fontCss})`: blob URL → `Image` → canvas; dimensions from `naturalWidth/Height` × scale; `fontCss` injected as `<defs><style>` after the `<svg>` root tag before rasterizing.
- `collectFontCss(families)`: async; `@font-face` rules for the given families (string list or array), font files fetched and inlined as data: URIs. Cross-origin sheets (Google Fonts) block CSSOM and are re-fetched as text and parsed in a constructed stylesheet; constructed sheets drop @import, so imports are re-extracted from the raw text; chains followed to depth 3. Sheet text and font data module-cached.

## Svelte wrapper (`packages/svelte-asciiart`)

Published Svelte 5 component (peer dep svelte ^5, dep `lovely-ansi-svg`). Built with `svelte-package`; `prepack` copies the root `LICENSE` and runs publint (its own README is committed). Browser vitest via vitest-browser-svelte.

### `src/lib/AsciiArt.svelte`

- Props: `text`, `rows`, `cols`, `margin`, `grid: boolean | string`, `frame: boolean | string`, `cellAspect: number | 'auto'` (default `'auto'`), `glyphScale` (default 1), `cellSize` (default 50), plus forwarded `SVGAttributes<SVGSVGElement>` (spread after the computed viewBox/width/height/overflow/preserveAspectRatio so consumer values win; consumer `style` appended after the component's own).
- Renders straight from the core model: `layout(parseAnsi(text))` in one derived (text-only dependency), `render(...)` in a second — geometry-only prop changes skip segmentation. Template maps `RenderModel` 1:1 (bg rects, grid path, frame rect, text rows; empty rows skipped). Unclassed grid/frame get the same default strokes as the core serializer.
- `cellAspect: 'auto'`: canvas-measures the mounted svg's computed font — advance/em → aspect, `fontBoundingBoxAscent/(asc+desc)` → baseline (≈0.8 for typical monos). Re-measure trigger is a ResizeObserver on a hidden probe `<text>M</text>` inside the svg: its bounding box changes whenever the resolved font does (ancestor `--ascii-font-family` flips, consumer style/class, webfont loads), which the older event-based triggers missed. `measured` starts null (render() falls back to 0.6/0.8) and is only reassigned on actual metric change. The measurement itself is `measureCellMetrics(fontFamily)` (`src/lib/metrics.ts`, exported; null on no canvas / rejected font shorthand / zero advance) — consumers pass its result to `exportSvg` so exports match the live auto-aspect render.
- Theme CSS comes from the core's `themeCss(undefined, 'svg.asciiart')` injected as an inline `<style>` via `<svelte:element this={'style'}>` (Svelte reserves literal `<style>` tags for component CSS); `<style>` inside inline SVG is document-scoped, so the rules are scoped under the `asciiart` class the component always merges onto its svg — unscoped they'd restyle the host page, and the scope's extra specificity is what lets ansi classes beat host element-level rules. Single source of truth for the palette; hosts theme via `--ansi-*` vars, font via `--ascii-font-family`.
- Accessibility: no auto label. Consumer `aria-label`/`aria-labelledby` → `role="img"`, else `role="presentation"`; explicit `role` prop wins.
- The svg always stretches (`width/height: 100%` inline); fixed scale = consumer `style="width: auto; height: auto"` against the `cellSize`-based intrinsic size.

## Releases

- Per-package changelogs (`packages/*/CHANGELOG.md`, Keep-a-Changelog-ish, pi-mono style); demo changes get no entries. `/cl` audits each `[Unreleased]` against commits since the last `v*` tag.
- Packages are versioned in lockstep under one `v<ver>` tag. `bun run release [patch|minor|major|x.y.z] [--no-push]` (`scripts/release.ts`) discovers non-private `packages/*/package.json`, verifies each (check/test/prepack/pack) _before_ touching files — a failure leaves the worktree clean — then rolls each changelog that has `[Unreleased]` entries (others left as is; at least one must have entries), bumps all versions, commits, tags, pushes, waits for CI to stage each package on npm, and approves each with a 2FA prompt (that approval publishes). Requires an npm login up front.
- Tag push triggers `.github/workflows/publish.yml`: verify tag matches every package version, check/test/prepack per package (alphabetical glob order = dependency order: the core's prepack builds its dist before the wrapper's check needs it), `npm stage publish` per package (trusted publishing + provenance; skips already published/staged), then GitHub Release concatenating each package's changelog section under a `## <name>` heading.

## Demo app (`demo/`)

- `src/routes/+page.svelte`: single-page demo/playground (~700 lines) — interactive controls (shadcn-svelte/bits-ui in `src/lib/components/ui/`), model-based export. The export views (PNG preview, exported-SVG view, Shiki-highlighted snippet) key off one debounced copy of `codePreview`, which reads every render-affecting control — no hand-maintained dependency list; export generation untracks everything else. The PNG effect guards out-of-order async completions with a generation token. Export options mirror the live props (`exportOptions()`), demo styling goes in via `extraCss` (`buildExportCss()`), fonts via `collectFontCss(fontFamily)`; on auto aspect the demo measures the font itself (`measureCellMetrics`) and passes `cellAspect`/`baseline`, surfacing them in the snippet's opts literal — which also makes the debounced views regenerate when measurement lands.
- `src/routes/+page.server.ts`: renders the root `README.md` to HTML via remark/rehype + shiki, strips the badge line.
- Static adapter; `build` first builds the core dist + wrapper prepack; `build:demo` sets `BASE_PATH=/svelte-asciiart`; Pages workflow uploads `demo/build`.
- Tailwind 4; shared styles in `src/routes/layout.css`.
