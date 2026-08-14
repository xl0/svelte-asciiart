# lovely-ansi-svg

Convert ASCII/ANSI terminal text into a crisp, styleable SVG character grid. Framework-agnostic and DOM-free — works in the browser, Node, SSR, workers and CI.

```sh
npm install lovely-ansi-svg
```

## Usage

```ts
import { exportSvg } from 'lovely-ansi-svg';

const svg = exportSvg('\x1b[36mHello \x1b[1;33mANSI\x1b[0m world', {
	frame: true,
	margin: 1,
	background: '#1e1e1e'
});
```

`exportSvg(text, options)` returns a standalone SVG string.

A fuller example — fixed frame, styled grid and frame via classes, a custom
font and theme:

```ts
import { exportSvg, defaultTheme } from 'lovely-ansi-svg';

const svg = exportSvg(text, {
	rows: 12,
	cols: 40,
	margin: [1, 2], // [vertical, horizontal] cells
	grid: 'grid', // string = CSS class, styled below
	frame: 'frame',
	fontFamily: '"JetBrains Mono", monospace',
	background: '#1e1e1e', // painted rect; also what dim/inverse mix toward
	theme: { ...defaultTheme, foreground: '#d4d4d4' },
	extraCss: `
		.grid { stroke: #333; stroke-width: 0.02 }
		.frame { stroke: #888; stroke-width: 0.04 }
	`
});
```

### Options

| Option       | Type                            | Default     | Description                                                             |
| ------------ | ------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `rows`       | `number`                        | auto        | Frame height in cells (content may overflow, clipped at the viewBox)    |
| `cols`       | `number`                        | auto        | Frame width in cells (display columns)                                  |
| `margin`     | `number \| [v, h] \| [t,r,b,l]` | `0`         | Margin around the frame, in cells                                       |
| `grid`       | `boolean \| string`             | `false`     | Cell grid lines: `true` = default faint stroke, string = CSS class      |
| `frame`      | `boolean \| string`             | `false`     | Border around the frame: `true` = default stroke, string = CSS class    |
| `cellAspect` | `number`                        | `0.6`       | Cell width:height ratio (typical monospace)                             |
| `baseline`   | `number`                        | `0.8`       | Baseline position within the cell, 0–1 from the top                     |
| `glyphScale` | `number`                        | `1`         | Glyph size as a fraction of cell height (1 = box-drawing tiles)         |
| `cellSize`   | `number`                        | `50`        | Pixels per cell for the intrinsic `width`/`height` attributes           |
| `fontFamily` | `string`                        | mono stack  | `font-family` for the text (named, not embedded)                        |
| `theme`      | `Theme`                         | VS Code-ish | 16-color palette + default fg/bg the ANSI colors resolve through        |
| `background` | `string`                        | —           | Solid background rect; doubles as `theme.background` unless that is set |
| `extraCss`   | `string`                        | —           | CSS emitted in a `<style>` block (`@font-face`, grid/frame classes…)    |

### ANSI support

16-color, 256-color (`38;5;n`) and truecolor (`38;2;r;g;b`) foregrounds and backgrounds; bold, dim, italic, underline, strikethrough, inverse; per-attribute resets (blink is parsed but not rendered). Style state persists across lines. Unknown codes are consumed; non-SGR escapes (cursor movement, OSC hyperlinks, DCS/sixel payloads — even spanning newlines) are stripped. Tabs expand to 8-column stops. CJK and emoji occupy two cells; grapheme clusters (ZWJ emoji, combining marks) are never torn apart, even by escapes.

### Theming

```ts
interface Theme {
	/** Default text color; unset → `currentColor` inherits from the embedding. */
	foreground?: string;
	/** Color inverse and dim mix toward; unset → `Canvas`. */
	background?: string;
	/**
	 * The 16 base ANSI colors, in standard order: 0–7 normal (black, red,
	 * green, yellow, blue, magenta, cyan, white), 8–15 their bright variants.
	 */
	palette: string[];
}
```

All colors resolve through the theme once, at parse time — the output carries concrete values as inline styles, no CSS classes or custom properties. Re-theming means re-rendering with a different theme. The 16 base colors (and `38;5;n` with n < 16) index the palette positionally: SGR 30–37/40–47 → entries 0–7, 90–97/100–107 → 8–15. The extended 256-color palette (the 6×6×6 cube and the grayscale ramp) and truecolor have spec-fixed RGB values and bypass the theme entirely.

`theme.foreground` sets the SVG root's `color`; unstyled text fills with `currentColor`, so an inline-embedded SVG with no `foreground` simply inherits the page's text color.

**Two background knobs, on purpose.** `theme.background` and the `background` option answer different questions:

- `theme.background` is an _assumption_: "this is the color behind the art." Inverse-without-foreground glyphs paint in it and dim mixes toward it — the color math is meaningless without knowing the backdrop. It paints nothing.
- `background` (option) is an _action_: paint a solid backdrop rect into the file. Export-only — a standalone file has no page behind it.

In practice you set one of them. Painting a backdrop implies it's the backdrop, so `exportSvg` defaults `theme.background` to the `background` option — `exportSvg(text, { background: '#1e1e1e' })` paints dark _and_ dims/inverts against dark. Set `theme.background` alone for the transparent case: an SVG destined for a page that's already dark should compute dim/inverse against that page color without painting over it. Setting both only makes sense when they genuinely disagree, and then the explicit `theme.background` wins the color math.

Dim is a solid `color-mix()` of the glyph color toward its backdrop rather than opacity — overlapping full-cell glyphs (box drawing) would double-composite into stripes.

`defaultTheme` (exported) is a VS Code-ish palette.

## Lower-level API

`exportSvg` is a thin serializer over an exposed three-stage pipeline. Each stage can be used on its own — to inspect styled text, to build a custom renderer over the geometry model, or to reuse the width machinery:

```ts
import { parseAnsi, layout, render } from 'lovely-ansi-svg';

const parsed = parseAnsi(text); // ParsedRow[]  — styled text, no geometry
const laid = layout(parsed); // LayoutRow[]  — column-grid runs
const model = render(laid, { frame: true }); // RenderModel — SVG-ready geometry
```

### `parseAnsi(text, theme?): ParsedRow[]`

Parses ANSI SGR escapes into escape-stripped row text plus style breakpoints, with all colors resolved through the theme (default: `defaultTheme`). No geometry yet — styles are ranges over the text:

```ts
interface ParsedRow {
	/** The row with escapes stripped. */
	text: string;
	/** Sorted by offset; empty for unstyled text. */
	breaks: { offset: number; style: Style }[];
}

interface Style {
	/** Resolved foreground color; unset → `currentColor` (inherits the default text color). Dim is baked in as a `color-mix()` toward the backdrop. */
	fill?: string;
	/** Resolved background color, painted as a full-cell rect behind the text. */
	bgFill?: string;
	/** Font attributes; `blink` is parsed but not rendered. */
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strike?: boolean;
	blink?: boolean;
}
```

A break's style applies from its `offset` (in code units) to the next break or the end of the row:

```ts
parseAnsi('\x1b[1;31mred\x1b[0m ok');
// [{ text: 'red ok', breaks: [
//   { offset: 0, style: { fill: '#cd3131', bold: true } },
//   { offset: 3, style: {} }
// ]}]
```

Style state persists across rows until reset, like in a terminal. Escapes are matched over the whole input, so control-string payloads (OSC hyperlinks, sixel) containing newlines don't split rows; tabs expand to 8-column stops; other C0 controls are dropped.

### `layout(rows): LayoutRow[]`

The grapheme-segmentation pass (per-row: `layoutRow`), mapping parsed text onto the column grid. Everything is in display-column units — CJK and wide emoji occupy two columns:

```ts
interface LayoutRow {
	runs: GlyphRun[];
	bgs: BgRun[];
	/** Total display columns. */
	width: number;
}

/** A run of glyphs sharing one foreground style (fill + the Style font flags). */
interface GlyphRun {
	fill?: string;
	bold?: boolean; // + italic, underline, strike, blink
	/** Starting column of each grapheme cluster in `text`. */
	cols: number[];
	text: string;
}

/** Full-cell background columns `[start, end)` sharing one color. */
interface BgRun {
	fill: string;
	start: number;
	end: number;
}
```

```ts
layout(parseAnsi('\x1b[43;30mwarn\x1b[0m'));
// [{
//   runs: [{ fill: '#000000', cols: [0, 1, 2, 3], text: 'warn' }],
//   bgs: [{ fill: '#b58900', start: 0, end: 4 }],
//   width: 4
// }]
```

Runs break on foreground style changes; background runs are merged independently, on background color only, so colored blocks stay solid across foreground changes. A multi-code-point cluster (ZWJ emoji, combining marks) always becomes a run of its own with a single `cols` entry, so a per-glyph `x` list can never tear it apart.

### `render(layoutRows, options): RenderModel`

Turns laid-out rows into SVG geometry. Takes the geometry subset of the options table above (`rows`, `cols`, `margin`, `grid`, `frame`, `cellAspect`, `baseline`, `glyphScale`, `cellSize`). Every number is pre-formatted as an attribute string — the model maps 1:1 onto SVG elements with no further math:

```ts
interface RenderModel {
	viewBox: string;
	/** Intrinsic pixel size (`cellSize` px per cell height). */
	width: string;
	height: string;
	fontSize: string;
	rows: RenderedRow[];
	/** Present when requested; unclassed ones carry default stroke attributes. */
	grid?: { d: string; class?: string; stroke?: string; strokeOpacity?: string; strokeWidth?: string };
	frame?: { x: string; y: string; width: string; height: string; class?: string; stroke?: string; strokeWidth?: string };
}

interface RenderedRow {
	/** Text baseline y. */
	y: string;
	runs: RenderedRun[];
	bgs: RenderedBg[];
}

interface RenderedRun {
	/** Inline CSS (fill, font-weight, …); absent for default-styled text. */
	style?: string;
	/** Space-separated x list, one per code point. */
	x: string;
	text: string;
}

interface RenderedBg {
	/** Inline CSS (the background fill). */
	style: string;
	x: string;
	y: string;
	width: string;
	height: string;
}
```

```ts
render(layout(parseAnsi('\x1b[1;31mred\x1b[0m ok')), { frame: true, margin: 1 });
// {
//   viewBox: '0 0 4.8 3', width: '240', height: '150', fontSize: '1',
//   rows: [{
//     y: '1.8',
//     runs: [
//       { style: 'fill: #cd3131; font-weight: bold', x: '0.6 1.2 1.8', text: 'red' },
//       { x: '2.4 3 3.6', text: ' ok' }
//     ],
//     bgs: []
//   }],
//   frame: { x: '0.6', y: '1', width: '3.6', height: '1', stroke: 'currentColor', strokeWidth: '0.02' }
// }
```

Cell height is 1 viewBox unit and cells are `cellAspect` units wide; the frame is `rows`×`cols` (or the content size), the viewBox is frame + margin, and overflowing content is meant to be clipped with `overflow="hidden"`.

To consume the model, emit one `<rect>` per background, the grid `<path>` and frame `<rect>` if present, and one `<text y font-size xml:space="preserve">` per non-empty row containing one `<tspan style x>` per run — all styling rides as inline `style`, so host CSS can't accidentally override it. That is exactly what `exportSvg` does — and what the [`svelte-asciiart`](https://www.npmjs.com/package/svelte-asciiart) component template does with the same model, which is what keeps its live render and the exported file identical.

### Width machinery

```ts
import { clusters, clusterWidth, displayWidth } from 'lovely-ansi-svg';

displayWidth('abc'); // 3
displayWidth('日本'); // 4 — CJK is two columns
clusterWidth('👍'); // 2
[...clusters('a日👍')]; // ['a', '日', '👍']
```

`clusters` segments into grapheme clusters (`Intl.Segmenter`); `clusterWidth` is a compact wide-character detection (East Asian wide ranges, emoji presentation, variation selectors, flag pairs — deliberately not a full Unicode width table) returning 0 for zero-width clusters, 2 for wide ones.

Also exported: `defaultTheme`, `DEFAULT_FONT_STACK` (the fallback monospace stack), and `fmt` (the shared number → attribute-string formatter, if you build strings that must match the model's).

Fonts are referenced by name, not embedded. To make a file font-standalone (or to rasterize to PNG), see [`lovely-svg-png`](https://www.npmjs.com/package/lovely-svg-png). For a Svelte component over this core, see [`svelte-asciiart`](https://www.npmjs.com/package/svelte-asciiart).

## License

MIT
