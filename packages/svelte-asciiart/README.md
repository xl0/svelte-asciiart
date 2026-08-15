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

| Prop           | Type                                                             | Default     | Description                                                                |
| -------------- | ---------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `text`         | `string`                                                         | `''`        | The art to render; may contain ANSI SGR escapes                            |
| `rows`         | `number`                                                         | auto        | Frame rows (content can overflow into the margin)                          |
| `cols`         | `number`                                                         | auto        | Frame columns (content can overflow into the margin)                       |
| `margin`       | `number \| [number, number] \| [number, number, number, number]` | `0`         | Margin around the frame in grid cells (top/right/bottom/left)              |
| `grid`         | `boolean \| string`                                              | `false`     | Cell grid lines: `true` = default faint stroke, string = CSS class         |
| `frame`        | `boolean \| string`                                              | `false`     | Border around the frame: `true` = default stroke, string = CSS class       |
| `cellAspect`   | `number \| 'auto'`                                               | `'auto'`    | Cell width/height ratio; `'auto'` measures the rendered font               |
| `glyphScale`   | `number`                                                         | `1`         | Glyph size as a fraction of the cell height                                |
| `cellSize`     | `number`                                                         | `50`        | Pixels per cell for the intrinsic SVG size (exports, fixed scale)          |
| `theme`        | `Theme`                                                          | VS Code-ish | Color theme ANSI escapes resolve through (palette + default fg/bg)         |
| `customGlyphs` | `boolean`                                                        | `true`      | Draw box/block chars (U+2500–U+259F) as exact-cell shapes, not font glyphs |
| `...rest`      | `SVGAttributes<SVGSVGElement>`                                   | -           | All other SVG attributes are forwarded to the `<svg>` element              |

The svg stretches to its container by default; for a fixed on-screen scale pass `style="width: auto; height: auto"` (the intrinsic size is `cellSize` px per cell).

With `cellAspect: 'auto'` the component canvas-measures the active font — glyph advance → aspect, bounding-box ascent → baseline — and re-measures whenever the resolved font changes (an ancestor's `--ascii-font-family`, the component's `style`/`class`, webfont loads). The same measurement is exported as `measureCellMetrics(fontFamily)`; its result spreads straight into export options — `exportSvg(text, { ...measureCellMetrics(family), ... })` — to make exports match the live render (`exportSvg` cannot measure itself — no DOM).

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

`text` containing ANSI SGR escapes is parsed automatically — supported: 16-color, 256-color (`38;5;n`/`48;5;n`) and truecolor (`38;2;r;g;b`/`48;2;r;g;b`) foregrounds and backgrounds; bold, dim, italic, underline, strikethrough, inverse; resets (blink is parsed but not rendered). OSC 8 hyperlinks render as clickable anchors (web-safe schemes only). Style state persists across lines, unknown codes and other non-SGR escapes are stripped.

Backgrounds paint as full-cell `<rect>`s behind the text, so adjacent runs and rows tile into solid blocks like a terminal. Inverse video swaps foreground and background; with no explicit foreground the glyphs paint in the theme background (default: the `Canvas` system color).

Note that `theme.background` paints nothing — the component is transparent and the host page supplies the actual backdrop. It's the _assumption_ the color math runs on: what inverse glyphs fill with and what dim fades toward. If your page behind the component isn't `Canvas`-colored, set `theme.background` to match it or dim/inverse will mix toward the wrong color.

The 16 base colors resolve through the `theme` prop (VS Code-ish default) as inline styles; changing the theme re-renders:

```svelte
<script>
	import { AsciiArt } from 'svelte-asciiart';
	import { defaultTheme } from 'lovely-ansi-svg';

	const theme = { ...defaultTheme, foreground: '#d4d4d4', background: '#1e1e1e' };
</script>

<AsciiArt {text} {theme} />
```

256-color and truecolor values are spec-fixed and render as-is.

Character widths are display-based: CJK and emoji occupy two cells and stay aligned with box-drawing art.

Box-drawing and block characters (U+2500–U+259F) are drawn as exact-cell shapes instead of font glyphs, so lines and blocks tile seamlessly whatever the font or cell aspect; pass `customGlyphs={false}` to render them as text.

Pass `aria-label` to describe the art — the svg then has `role="img"`; without a label it renders as `role="presentation"` (decorative).

## Font

The font comes from the `--ascii-font-family` CSS variable, falling back to a generic monospace stack. Set it on the component itself or any ancestor:

```svelte
<div class="terminal">
	<AsciiArt {text} />
</div>

<style>
	.terminal {
		--ascii-font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
</style>
```

or inline: `<AsciiArt {text} style="--ascii-font-family: Menlo, monospace" />`.

Webfonts load however the page loads them (a `<link>` to Google Fonts, `@font-face` rules); with the default `cellAspect: 'auto'` the grid re-measures itself when the font arrives or the variable changes, so no coordination is needed. Non-monospace fonts won't break the grid — glyphs are pinned to cells by per-character `x` positions — they just look off.

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
