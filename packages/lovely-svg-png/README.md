# lovely-svg-png

Rasterize SVG strings to PNG in the browser, with webfonts embedded as `data:` URIs. Not tied to any framework or SVG flavor.

```sh
npm install lovely-svg-png
```

Browser-only: needs `Image`, canvas, `document.styleSheets` and `fetch`.

## Usage

```ts
import { collectFontCss, svgStringToPng } from 'lovely-svg-png';

const dataUrl = await svgStringToPng(svgString); // data:image/png;base64,…
const blob = await svgStringToPng(svgString, { scale: 2, output: 'blob' });
```

Rasterization happens via blob URL → `Image` → canvas; dimensions come from the SVG's intrinsic size (its `width`/`height` attributes) times `scale`.

### Webfonts

The rasterizing `Image` lives in an isolated document that cannot load external fonts — text silently falls back to a default font. `collectFontCss(families)` fixes that: it walks the document's stylesheets for `@font-face` rules matching the given families (a `font-family` list string or an array of names), fetches the font files and inlines them as `data:` URIs. Cross-origin stylesheets (e.g. Google Fonts) that block CSSOM access are re-fetched as text; `@import` chains are followed up to 3 levels either way. Results are cached per page.

```ts
const blob = await svgStringToPng(svg, {
	fontCss: await collectFontCss('"JetBrains Mono", monospace'),
	output: 'blob'
});
```

`fontCss` is injected into the SVG as a `<style>` block before rasterizing. The same CSS can be embedded in an SVG file to make it font-standalone (e.g. via `exportSvg`'s `extraCss` option in [`lovely-ansi-svg`](https://www.npmjs.com/package/lovely-ansi-svg)).

## License

MIT
