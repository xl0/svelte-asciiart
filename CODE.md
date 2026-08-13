# CODE.md

Monorepo (bun workspaces): thin root, publishable library in `packages/svelte-asciiart`, SvelteKit demo app in `demo/` (depends on `svelte-asciiart: workspace:*`). Root package.json delegates `dev`/`build`/`build:demo`/`preview` to demo, `check` to both workspaces, and `test` to the package; root-local: `release` (scripts/release.ts), `format`/`lint` (prettier + plugins are root devDeps, shared by the workspaces via hoisting).

`typescript` is pinned to `^5.9` (not 7.x): kit's `$types` generation needs the full TS syntax API, which the TS 7 native compiler lacks — with TS 7 hoisted, `PageServerData` silently becomes `unknown`. Svelte must stay ≥ 5.56: 5.46's experimental-async runtime infinite-loops the page on HMR updates (`$derived(await …)` in the demo).

## Library (`packages/svelte-asciiart`)

Published to npm as `svelte-asciiart` (v0.0.5). Svelte 5 only (peer dep). Built with `svelte-package`; `prepack` copies the root `README.md` and `LICENSE` into the package and runs publint. MIT licensed.

### `src/lib/AsciiArt.svelte`

Renders ASCII/ANSI text as an SVG character grid.

- Props: `text?` (default `''`; plain or ANSI SGR — always fed through `ansiToSpans`, a no-op on plain text), `rows?`, `cols?` (clamped to non-negative integers; non-finite → auto), `grid?`, `frame?`, `margin?` (number | [v,h] | [t,r,b,l]), `cellAspect?` (default 0.6 — monospace width:height), `fontSize?` (glyph size in cell-height fractions, default 1 — full-cell so box-drawing tiles; smaller values center in the cell), `cellSize?` (px per cell — fixed scale, disables the 100% stretch), `gridClass?`, `frameClass?`, `baseSize?` (px per viewBox unit, default 50, sets intrinsic width/height for export; `cellSize` overrides), `bind:svg`, plus forwarded `SVGAttributes<SVGSVGElement>` (`{...rest}` is spread after the computed `viewBox`/`width`/`height`/`overflow`/`preserveAspectRatio`, so consumer values win; svg has `role="img"` — or `presentation` when the text is empty, so there's never an unnamed img role; overridable; `aria-label` defaults to the escape-stripped text, omitted if empty, if `aria-labelledby` is passed, or when the effective role is `presentation`/`none` (ARIA prohibits naming presentational elements); a consumer `style` is appended after the component's own inline style).
- Input normalizes to `Span[][]`; `rows`/`cols` default to content dimensions in display columns (CJK/emoji = 2 cells, via `width.ts`). Content may exceed the frame — render grid is `max(frame, content)`, but viewBox is frame + margin, so overflow is clipped (`overflow="hidden"`).
- One `<text>` per row, one `<tspan>` per styled run with a per-code-point `x` list (keeps cell alignment regardless of font metrics). Multi-code-point clusters (ZWJ emoji) get their own single-x tspan so the x list can't tear the ligature. Backgrounds: full-cell `<rect>` runs painted before grid/frame/text, merged on bg style only (independent of fg run breaks) so blocks stay solid. Dim stays as tspan opacity — the bg rect is a sibling, so only glyphs fade. Grid is a single `<path>`; frame a `<rect>`. All numbers go through `fmt()` (3-decimal trim).
- Runs are built in column units in one derived (the only segmentation pass — it also yields each row's width for `contentCols`) and mapped to formatted x/width strings in a second derived, so geometry-only prop changes (margin, fontSize, cellAspect) skip the rebuild.
- Span `fill` (256/truecolor) is applied as inline _style_ (not attr) so exported `<style>` rules can't override it. Component `<style>` defines `svg :global(.ansi-bold/.ansi-dim/.ansi-fg-N)` — fills come from `var(--ansi-fg-N, default)` so hosts can theme the 16 colors.
- Font via `--ascii-font-family` CSS var, falling back to a monospace stack. Inline `style="width:100%; height:100%"` makes it responsive despite intrinsic width/height attrs.

### `src/lib/ansi.ts` (internal)

- `Span` = `{ text, class?, fill?, bgClass?, bgFill? }` (internal model); `ansiToSpans(text): Span[][]` — SGR state machine, state persists across lines. Fg and bg each split class-vs-fill: 16-color codes (incl. `38/48;5;n` with n<16) → `ansi-fg-N`/`ansi-bg-N` classes, 256/truecolor → concrete fills. Attribute flags bold/dim/italic/underline/blink/strike (`ATTR_ON`/`ATTR_OFF` tables, per-attr resets + 0). Inverse is a fg/bg swap in `styleOf`: missing bg → `ansi-bg-inverse` class (CSS: `currentColor` — class, not inline fill, so exports resolve it to a concrete color); missing fg → `ansi-inverse` class (CSS: `var(--ansi-default-bg, Canvas)`). Extended-color params are bounds-checked (0-255, all three rgb components) — malformed sequences dropped. Unknown codes consumed, incl. colon-subparam (T.416) forms and underline-color (58) with its sub-params; non-SGR escapes stripped, incl. CSI with intermediates and OSC/DCS/APC/PM/SOS payloads (BEL/ST-terminated). Lines split on `\r?\n`; tabs expand to 8-column stops (column tracking only paid on lines containing a tab), other C0 controls dropped. Combining marks/joiners split off their base by an escape are reattached to the previous span so the grapheme stays one cluster. Adjacent same-style chunks stay separate spans — the renderer's run merge is the single merge algorithm. Blink emits a class with no default CSS (host-opt-in). Styling is CSS-only by design: hosts theme via `--ansi-fg-*` vars, no structured-spans input (removed by decision — ANSI text is the sole API).

### `src/lib/width.ts` (internal)

- `clusters()` (Intl.Segmenter graphemes), `clusterWidth()` — compact wide detection (coarse EAW ranges + `\p{Emoji_Presentation}` + VS16 + flag pairs), 0 for pure combining/zero-width. Deliberately not a full Unicode table.

### `src/lib/utils.ts` — SVG/PNG export

- `exportSvg(svgEl, {includeBackground, backgroundColor, extraCss})`: clones the mounted SVG, inlines computed styles (fixed prop list `SVG_STYLE_PROPS`) into a `<defs><style>` block, optional background rect. One rule per class _combination_ (`.a.b`, names CSS.escaped — Tailwind-style metacharacters survive) carrying the full computed values — no probe-diffing, so host tag-selector styling survives; inline-styled props skipped (would leak one element's inline value onto same-class siblings). Unclassed rects/paths get their computed paint props inlined on the clone; `text, tspan` rule sampled from `<text>`, plus a `tspan` delta rule from a bare tspan when host CSS styles them differently. `extraCss` is prepended verbatim (for @font-face). Requires the SVG to be mounted (uses `getComputedStyle`).
- `collectFontCss(svgEl)`: async; `@font-face` rules for the families the svg's text uses, font files fetched and inlined as data: URIs (cross-origin sheets like Google Fonts are re-fetched as text and parsed via a constructed stylesheet; sheet text and font data are module-cached). Unreachable faces are skipped.
- `svgStringToPng(str, {scale, output: 'dataUrl'|'blob'})`: blob URL → `Image` → canvas; dimensions from `naturalWidth/Height` (i.e., the intrinsic width/height attrs).
- `exportSvgToPng(svgEl, opts)`: composition of the two, with `collectFontCss` embedded automatically — the rasterizing `Image` document can't load external fonts.
- `fmt(n, digits=3)`: shared number formatter (trailing zeros trimmed) — also used by the component and the demo.

### Tests

Vitest browser tests (playwright via `@vitest/browser-playwright`, rendering via `vitest-browser-svelte`); `bun run test` from root delegates to the package.

- `src/lib/AsciiArt.test.ts` — component markup (viewBox math, run tspans, ANSI/spans/width, grid/frame).
- `src/lib/ansi.test.ts` — `ansiToSpans` state machine.
- `src/lib/utils.test.ts` — export path: style inlining into `<defs><style>`, background rect, PNG dimensions/scale/blob, end-to-end pixel check.

## Releases

- `CHANGELOG.md` (root, Keep-a-Changelog-ish) covers the published package only; `/cl` audits `[Unreleased]` against commits since the last `v*` tag.
- `bun run release [patch|minor|major|x.y.z] [--no-push]` (`scripts/release.ts`): verifies (check/test/prepack/pack) _before_ touching files — a failure leaves the worktree clean — then rolls changelog, bumps package version, commits, tags `v<ver>`, pushes, waits for CI to stage the version on npm, and approves it with a 2FA prompt (that approval publishes). Requires an npm login up front.
- Tag push triggers `.github/workflows/publish.yml`: verify tag==version, check/test/prepack, `npm stage publish` (trusted publishing + provenance; skips if already published/staged), then GitHub Release from the changelog section.

## Demo app (`demo/`)

- `src/routes/+page.svelte`: single-page demo/playground (~860 lines) — interactive controls (shadcn-svelte/bits-ui components in `src/lib/components/ui/`), export buttons. The export views (PNG preview, Raw SVG, SVG+Styles, Shiki highlight) all key off one debounced copy of `codePreview`, which reads every render-affecting control — no hand-maintained dependency list; the PNG effect guards against out-of-order async completions with a generation token.
- `src/routes/+page.server.ts`: renders the root `README.md` (`resolve('..', 'README.md')` — cwd is `demo/`) to HTML via remark/rehype + shiki, strips the badge line.
- `kit.alias` maps `svelte-asciiart` to `../packages/svelte-asciiart/src/lib/index.ts` (live source, not dist) — applies to both vite and svelte-check, so `check` works without a built dist.
- Static adapter; `build:demo` sets `BASE_PATH=/svelte-asciiart`; Pages workflow uploads `demo/build`.
- Tailwind 4; shared styles in `src/routes/layout.css`.
