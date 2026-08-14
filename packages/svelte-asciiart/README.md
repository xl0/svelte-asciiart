# svelte-asciiart

Render ASCII/ANSI art as a crisp, styleable SVG character grid in Svelte 5. A thin component wrapper around [`lovely-ansi-svg`](https://www.npmjs.com/package/lovely-ansi-svg) — for standalone SVG/PNG export or non-Svelte use, reach for the core directly.

**[Live demo](https://xl0.github.io/svelte-asciiart/)**

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

| Prop         | Type                                                             | Default  | Description                                                          |
| ------------ | ---------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `text`       | `string`                                                         | `''`     | The art to render; may contain ANSI SGR escapes                      |
| `rows`       | `number`                                                         | auto     | Frame rows (content can overflow into the margin)                    |
| `cols`       | `number`                                                         | auto     | Frame columns (content can overflow into the margin)                 |
| `margin`     | `number \| [number, number] \| [number, number, number, number]` | `0`      | Margin around the frame in grid cells (top/right/bottom/left)        |
| `grid`       | `boolean \| string`                                              | `false`  | Cell grid lines: `true` = default faint stroke, string = CSS class   |
| `frame`      | `boolean \| string`                                              | `false`  | Border around the frame: `true` = default stroke, string = CSS class |
| `cellAspect` | `number \| 'auto'`                                               | `'auto'` | Cell width/height ratio; `'auto'` measures the rendered font         |
| `glyphScale` | `number`                                                         | `1`      | Glyph size as a fraction of the cell height                          |
| `cellSize`   | `number`                                                         | `50`     | Pixels per cell for the intrinsic SVG size (exports, fixed scale)    |
| `...rest`    | `SVGAttributes<SVGSVGElement>`                                   | -        | All other SVG attributes are forwarded to the `<svg>` element        |

The svg stretches to its container by default; for a fixed on-screen scale pass `style="width: auto; height: auto"` (the intrinsic size is `cellSize` px per cell).

With `cellAspect: 'auto'` the component canvas-measures the active font after `document.fonts.ready` — glyph advance → aspect, bounding-box ascent → baseline — and re-measures when webfonts finish loading or the component's `style`/`class` change. The same measurement is exported as `measureCellMetrics(fontFamily)`; its result spreads straight into export options — `exportSvg(text, { ...measureCellMetrics(family), ... })` — to make exports match the live render (`exportSvg` cannot measure itself — no DOM).

## Grid Mode

```svelte
<AsciiArt {text} grid="ascii-grid" frame="ascii-frame" margin={[1, 2]} />

<style>
	:global(.ascii-grid) {
		stroke: #90ee90;
		stroke-width: 0.03;
		opacity: 0.5;
	}
	:global(.ascii-frame) {
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

256-color and truecolor values are applied as inline `fill` styles. The font comes from the `--ascii-font-family` CSS variable, falling back to a generic monospace stack.

Character widths are display-based: CJK and emoji occupy two cells and stay aligned with box-drawing art.

Pass `aria-label` to describe the art — the svg then has `role="img"`; without a label it renders as `role="presentation"` (decorative).

## Exporting

Export is model-based and lives in the core — no DOM element needed:

```ts
import { exportSvg } from 'lovely-ansi-svg';
import { collectFontCss, svgStringToPng } from 'lovely-svg-png';

const svg = exportSvg(text, { frame: true, background: '#f3f4f6' });
const png = await svgStringToPng(svg, { fontCss: await collectFontCss('monospace'), scale: 2 });
```

## License

MIT
