# CODE.md

Monorepo: SvelteKit demo app at the root, publishable library in `packages/svelte-asciiart` (bun workspaces, demo depends on `svelte-asciiart: workspace:*`).

## Library (`packages/svelte-asciiart`)

Published to npm as `svelte-asciiart` (v0.0.5). Svelte 5 only (peer dep). Built with `svelte-package`; `prepack` copies the root `README.md` into the package and runs publint.

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

`src/lib/AsciiArt.test.ts` — 14 vitest browser tests (playwright via `@vitest/browser-playwright`). `bun run test` from root delegates to the package.

## Demo app (root)

- `src/routes/+page.svelte`: single-page demo/playground (~860 lines) — interactive controls (shadcn-svelte/bits-ui components in `src/lib/components/ui/`), export buttons.
- `src/routes/+page.server.ts`: renders the root `README.md` to HTML via remark/rehype + shiki, strips the badge line.
- Static adapter; `build:demo` sets `BASE_PATH=/svelte-asciiart` (GitHub Pages).
- Tailwind 4; shared styles in `src/routes/layout.css`.
- `src/routes/test/` is an empty leftover directory.
