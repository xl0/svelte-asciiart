# svelte-asciiart

## Goal

Publish a Svelte 5 component (`AsciiArt`) that renders ASCII art as scalable SVG (optional grid + frame), plus a SvelteKit demo app in the repo root.

## Plan

- [x] Monorepo layout: thin root + `demo/` app + `packages/svelte-asciiart` library package
- [x] Implement `AsciiArt` (`packages/svelte-asciiart/src/lib/AsciiArt.svelte`)
- [x] Export `AsciiArt` from `packages/svelte-asciiart/src/lib/index.ts`
- [x] Package unit tests (`packages/svelte-asciiart/src/lib/AsciiArt.test.ts`, 14 tests)
- [x] Demo page (`demo/src/routes/+page.svelte`)
- [x] SVG/PNG export utilities (`exportSvg`, `exportSvgToPng`, `svgStringToPng`)

- [ ] ANSI colors: decide scope + pick implementation option
- [ ] ANSI colors: implement parsing + rendering
- [ ] ANSI colors: add unit tests
- [ ] ANSI colors: update demo + docs

## Component API

```svelte
<script lang="ts">
	import { AsciiArt } from 'svelte-asciiart';
	const text = `...`;
</script>

<AsciiArt {text} />
<AsciiArt {text} rows={4} cols={22} />
<AsciiArt {text} grid frame margin={[1, 2]} gridClass="ascii-grid" frameClass="ascii-frame" />
<AsciiArt bind:svg {text} />
```

## Notes

- `rows`/`cols` default to text dimensions (lines + max line length).
- viewBox is computed from `rows`/`cols` plus `margin`; frame is offset by the margin.
- Rendering is grid-based: one `<text>` per row and a `<tspan>` per character; cell width uses `cellAspect`.
- `grid` draws a single `<path>`; `frame` draws a `<rect>`; other SVG attrs are forwarded via `...rest`.

## Feature: ANSI colors

### Scope questions (decide before coding)

- **Color depth**: 16-color only vs 256-color (`38;5;n`) vs truecolor (`38;2;r;g;b`)
- **Background colors**: support `48;...`? (requires rects/HTML/canvas)
- **Attributes**: bold (`1`), faint (`2`), italic (`3`), underline (`4`), inverse (`7`), reset (`0`)
- **Input handling**: treat ANSI escape sequences as zero-width for `rows`/`cols` calculation

### Implementation options

#### Option A: Pure SVG (style per cell)

- **Approach**
  - Parse `text` into a 2D grid of cells, tracking active SGR state (fg/bg/bold/etc.).
  - Use existing `<text>` + per-character `<tspan>` rendering; set `fill` (and optionally `font-weight`, `text-decoration`) per cell.
  - If background is supported, render background as `<rect>` elements under the text (ideally batched into runs to reduce node count).
- **API sketch**
  - `ansi?: boolean`
  - `ansiBg?: boolean`
  - `ansiDefaultFg?: string`, `ansiDefaultBg?: string`
  - `ansiPalette?: { [k: number]: string }` (override 16-color mapping)
- **Pros**
  - Stays “real SVG” (portable, scalable, `bind:svg` still works).
- **Cons**
  - More DOM nodes; backgrounds add more nodes unless batched.

#### Option B: `foreignObject` HTML renderer (CSS spans)

- **Approach**
  - Parse SGR into styled runs.
  - Render `<foreignObject>` containing HTML `<pre>` with `<span style="color:...; background:...">`.
  - Let SVG viewBox scaling scale the HTML.
- **API sketch**
  - `ansi?: boolean`
  - `ansiRenderer?: 'svg' | 'foreignObject'` (default `'svg'`)
- **Pros**
  - Easiest path to full SGR feature set (bg/underline/etc.) with fewer nodes.
- **Cons**
  - `foreignObject` is less portable (some SVG consumers drop it); “export SVG” use-cases can break.

#### Option C: Rasterize to bitmap and embed as `<image>`

- **Approach**
  - Parse SGR, draw into a `<canvas>` at a chosen scale, and embed as `<image href="data:image/png;base64,...">`.
  - Keep the same viewBox math so the bitmap scales with the component.
- **API sketch**
  - `ansi?: boolean`
  - `ansiRenderer?: 'svg' | 'bitmap'`
  - `bitmapScale?: number` (control sharpness vs size)
- **Pros**
  - Lowest DOM complexity; background + full styling are straightforward.
- **Cons**
  - Not vector text (not selectable); can look blurry if scale isn’t handled carefully.
