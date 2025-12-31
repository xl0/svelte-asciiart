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
| `text`       | `string`                                                         | required | The ASCII art text to render                                  |
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

