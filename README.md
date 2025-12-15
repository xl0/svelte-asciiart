# svelte-asciiart

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

| Prop                | Type                                                             | Default              | Description                                      |
| ------------------- | ---------------------------------------------------------------- | -------------------- | ------------------------------------------------ |
| `text`              | `string`                                                         | required             | The ASCII art text to render                     |
| `rows`              | `number`                                                         | auto                 | Number of rows (derived from text if not set)    |
| `cols`              | `number`                                                         | auto                 | Number of columns (derived from text if not set) |
| `grid`              | `boolean`                                                        | `false`              | Enable grid mode with cell-based layout          |
| `cellAspect`        | `number`                                                         | `0.6`                | Width/height ratio of grid cells                 |
| `measureCellAspect` | `boolean`                                                        | `false`              | Measure actual font aspect ratio                 |
| `gridClass`         | `string`                                                         | `''`                 | CSS class for grid lines                         |
| `gridStyle`         | `string`                                                         | `''`                 | Inline styles for grid lines                     |
| `fontFamily`        | `string`                                                         | `'Courier New', ...` | Font family for text                             |
| `frame`             | `boolean`                                                        | `false`              | Show frame around content (grid mode only)       |
| `frameMargin`       | `number \| [number, number] \| [number, number, number, number]` | `0`                  | Margin around frame in grid cells                |
| `frameClass`        | `string`                                                         | `''`                 | CSS class for frame                              |
| `frameStyle`        | `string`                                                         | `''`                 | Inline styles for frame                          |

## Grid Mode

Grid mode renders text character-by-character in a precise grid, useful for ASCII art that needs exact alignment:

```svelte
<AsciiArt {text} grid frame frameMargin={[1, 2]} gridClass="ascii-grid" frameClass="ascii-frame" />

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
