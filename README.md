# svelte-asciiart

[![](https://alexey.work/badge/)](https://alexey.work?ref=ascii-md)

A Svelte 5 component for rendering ASCII art as scalable SVG with optional grid overlay and frame.

## Installation

```sh
npm install svelte-asciiart
```

## Usage

```svelte
<script>
	import { AsciiArt } from 'svelte-asciiart';

	const text = `+----------+
|  Hello   |
|  World!  |
+----------+`;
</script>

<AsciiArt {text} />
```

## Props

| Prop         | Type                                                             | Default  | Description                                                   |
| ------------ | ---------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| `text`       | `string`                                                         | `''`     | The ASCII art text to render; may contain ANSI SGR escapes    |
| `fontSize`   | `number`                                                         | `1`      | Glyph size as a fraction of the cell height                   |
| `cellSize`   | `number`                                                         | -        | Pixels per cell; renders at fixed scale instead of stretching |
| `rows`       | `number`                                                         | auto     | Frame rows (content can overflow into the margin)             |
| `cols`       | `number`                                                         | auto     | Frame columns (content can overflow into the margin)          |
| `grid`       | `boolean`                                                        | `false`  | Draw grid lines for the full viewBox (frame + margin)         |
| `cellAspect` | `number`                                                         | `0.6`    | Character cell width/height ratio                             |
| `gridClass`  | `string`                                                         | `''`     | CSS class for the grid lines `<path>`                         |
| `frame`      | `boolean`                                                        | `false`  | Draw a frame `<rect>` around the frame area                   |
| `margin`     | `number \| [number, number] \| [number, number, number, number]` | `0`      | Margin around the frame in grid cells (top/right/bottom/left) |
| `frameClass` | `string`                                                         | `''`     | CSS class for the frame `<rect>`                              |
| `svg`        | `SVGSVGElement \| null`                                          | bindable | Optionally bind the underlying `<svg>` element                |
| `baseSize`   | `number`                                                         | `50`     | Pixels per viewBox unit for intrinsic SVG size (for exports)  |
| `...rest`    | `SVGAttributes<SVGSVGElement>`                                   | -        | All other SVG attributes are forwarded to the `<svg>` element |

## Grid Mode

Grid mode renders text character-by-character in a precise grid, useful for ASCII art that needs exact alignment:

```svelte
<AsciiArt {text} grid frame margin={[1, 2]} gridClass="ascii-grid" frameClass="ascii-frame" />

<style>
	.ascii-grid {
		stroke: #90ee90;
		stroke-width: 0.03;
		opacity: 0.5;
	}
	.ascii-frame {
		stroke: #ffb366;
		stroke-width: 0.05;
	}
</style>
```

## Colors

`text` containing ANSI SGR escapes is parsed automatically — supported: 16-color, 256-color (`38;5;n`/`48;5;n`) and truecolor (`38;2;r;g;b`/`48;2;r;g;b`) foregrounds and backgrounds; bold, dim, italic, underline, strikethrough, inverse; resets. Style state persists across lines, unknown codes and non-SGR escapes are stripped. Blink emits an `ansi-blink` class with no default styling — style it from the host if you want it.

Backgrounds paint as full-cell `<rect>`s behind the text, so adjacent runs and rows tile into solid blocks like a terminal. Inverse video swaps foreground and background; with no explicit foreground the glyphs paint in `--ansi-default-bg` (defaults to the `Canvas` system color) — set it to your page background.

The 16 base colors render as CSS classes (`ansi-fg-31`, `ansi-bg-41`, `ansi-bold`, `ansi-dim`, …) backed by custom properties, so the host page can theme them:

```css
.my-terminal {
	--ansi-fg-31: #ff5f56; /* red */
	--ansi-fg-36: #4cd4e0; /* cyan */
	--ansi-bg-41: #8b1a10; /* red background */
	--ansi-default-bg: #1e1e1e;
}
```

256-color and truecolor values are applied as inline `fill` styles.

Character widths are display-based: CJK and emoji occupy two cells and stay aligned with box-drawing art.

The svg has `role="img"`; pass `aria-label` to describe the art to screen readers.

## Exporting

The package provides utilities to export styled SVGs and PNGs:

```ts
import { exportSvg, exportSvgToPng } from 'svelte-asciiart';

// Export SVG with computed styles embedded as a <style> block
const svgMarkup = exportSvg(svgElement, {
	includeBackground: true,
	backgroundColor: '#f3f4f6'
});

// Export to PNG (returns data URL by default)
const pngDataUrl = await exportSvgToPng(svgElement, {
	includeBackground: true,
	backgroundColor: '#f3f4f6',
	scale: 2 // retina scale factor
});

// Export to PNG as Blob
const pngBlob = await exportSvgToPng(svgElement, { output: 'blob' });
```

The `exportSvg` function extracts computed styles from classed elements (e.g., `gridClass`, `frameClass`) and embeds them in the SVG, making it standalone and portable.

## License

MIT
