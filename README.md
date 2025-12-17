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

## License

MIT
