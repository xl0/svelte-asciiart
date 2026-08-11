# CODE.md

Monorepo (bun workspaces): thin root, publishable library in `packages/svelte-asciiart`, SvelteKit demo app in `demo/` (depends on `svelte-asciiart: workspace:*`). Root package.json delegates `dev`/`build`/`build:demo`/`preview` to demo, `check` to both workspaces, and `test` to the package; root-local: `release` (scripts/release.ts), `format`/`lint` (prettier + plugins are root devDeps, shared by the workspaces via hoisting).

## Library (`packages/svelte-asciiart`)

Published to npm as `svelte-asciiart` (v0.0.5). Svelte 5 only (peer dep). Built with `svelte-package`; `prepack` copies the root `README.md` and `LICENSE` into the package and runs publint. MIT licensed.

### `src/lib/AsciiArt.svelte`

Renders ASCII text as an SVG character grid.

- Props: `text`, `rows?`, `cols?`, `grid?`, `frame?`, `margin?` (number | [v,h] | [t,r,b,l]), `cellAspect?` (default 0.6 — monospace width:height), `gridClass?`, `frameClass?`, `baseSize?` (px per viewBox unit, default 50, sets intrinsic width/height for export), `bind:svg`, plus forwarded `SVGAttributes<SVGSVGElement>`.
- `rows`/`cols` default to text dimensions; content may exceed the frame — render grid is `max(frame, content)`, but viewBox is frame + margin, so overflow is clipped (`overflow="hidden"`).
- One `<text>` per row, one `<tspan>` per character (absolute x per cell). Grid is a single `<path>`; frame a `<rect>`. All numbers go through `fmt()` (3-decimal trim).
- Font via `--ascii-font-family` CSS var, falling back to a monospace stack. Inline `style="width:100%; height:100%"` makes it responsive despite intrinsic width/height attrs.

### `src/lib/utils.ts` — SVG/PNG export

- `exportSvg(svgEl, {includeBackground, backgroundColor})`: clones the mounted SVG, inlines computed styles (fixed prop list `SVG_STYLE_PROPS`) for classed elements and `text/tspan` into a `<defs><style>` block, optional background rect. Requires the SVG to be mounted (uses `getComputedStyle`).
- `svgStringToPng(str, {scale, output: 'dataUrl'|'blob'})`: blob URL → `Image` → canvas; dimensions from `naturalWidth/Height` (i.e., the intrinsic width/height attrs).
- `exportSvgToPng(svgEl, opts)`: composition of the two.

### Tests

Vitest browser tests (playwright via `@vitest/browser-playwright`, rendering via `vitest-browser-svelte`); `bun run test` from root delegates to the package.
- `src/lib/AsciiArt.test.ts` — component markup (viewBox math, tspans, grid/frame).
- `src/lib/utils.test.ts` — export path: style inlining into `<defs><style>`, background rect, PNG dimensions/scale/blob, end-to-end pixel check.

## Releases

- `CHANGELOG.md` (root, Keep-a-Changelog-ish) covers the published package only; `/cl` audits `[Unreleased]` against commits since the last `v*` tag.
- `bun run release [patch|minor|major|x.y.z] [--no-push]` (`scripts/release.ts`): rolls changelog, bumps package version, verifies (check/test/prepack/pack), commits, tags `v<ver>`, pushes.
- Tag push triggers `.github/workflows/publish.yml`: verify tag==version, check/test/prepack, `npm stage publish` (trusted publishing + provenance; skips if already published/staged), then GitHub Release from the changelog section.
- The staged version goes live only after `npm stage approve` (2FA) by a maintainer.

## Demo app (`demo/`)

- `src/routes/+page.svelte`: single-page demo/playground (~860 lines) — interactive controls (shadcn-svelte/bits-ui components in `src/lib/components/ui/`), export buttons.
- `src/routes/+page.server.ts`: renders the root `README.md` (`resolve('..', 'README.md')` — cwd is `demo/`) to HTML via remark/rehype + shiki, strips the badge line.
- `kit.alias` maps `svelte-asciiart` to `../packages/svelte-asciiart/src/lib/index.ts` (live source, not dist) — applies to both vite and svelte-check, so `check` works without a built dist.
- Static adapter; `build:demo` sets `BASE_PATH=/svelte-asciiart`; Pages workflow uploads `demo/build`.
- Tailwind 4; shared styles in `src/routes/layout.css`.
