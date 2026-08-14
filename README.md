# lovely-ansi-svg

[![](https://alexey.work/badge/)](https://alexey.work?ref=ascii-md)

Render ASCII/ANSI terminal text as crisp, scalable SVG. A small family of packages:

- **[`lovely-ansi-svg`](https://github.com/xl0/svelte-asciiart/tree/master/packages/lovely-ansi-svg)** — the framework-agnostic core: `text → SVG string`. Parses ANSI SGR escapes (16-color, 256-color, truecolor, attributes), lays glyphs out on a monospace cell grid (CJK/emoji width aware), and serializes themeable SVG. No DOM required — works in Node, SSR, workers, CI.
- **[`svelte-asciiart`](https://github.com/xl0/svelte-asciiart/tree/master/packages/svelte-asciiart)** — a thin Svelte 5 component over the core, with live font measurement and CSS-variable theming.
- **[`lovely-svg-png`](https://github.com/xl0/svelte-asciiart/tree/master/packages/lovely-svg-png)** — browser-side SVG-string → PNG rasterization with webfonts embedded as `data:` URIs (follows `@import` chains, e.g. Google Fonts). Not ansi-specific.

**[Live demo](https://xl0.github.io/svelte-asciiart/)**

## Quick start

Standalone SVG from any JS:

```ts
import { exportSvg } from 'lovely-ansi-svg';

const svg = exportSvg('\x1b[36mHello \x1b[1;33mANSI\x1b[0m world', {
	frame: true,
	margin: 1,
	background: '#1e1e1e'
});
```

Svelte component:

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

PNG in the browser:

```ts
import { exportSvg } from 'lovely-ansi-svg';
import { collectFontCss, svgStringToPng } from 'lovely-svg-png';

const svg = exportSvg(text, { fontFamily: '"JetBrains Mono", monospace' });
const fontCss = await collectFontCss('"JetBrains Mono"');
const blob = await svgStringToPng(svg, { fontCss, scale: 2, output: 'blob' });
```

See each package's README for the full API.

## License

MIT
