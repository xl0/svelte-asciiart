# svelte-asciiart

## Goal

Publish a Svelte 5 component (`AsciiArt`) that renders ASCII art as scalable SVG (optional grid + frame), plus a SvelteKit demo app in `demo/`.

## Plan

- [x] Monorepo layout: thin root + `demo/` app + `packages/svelte-asciiart` library package
- [x] Implement `AsciiArt` (`packages/svelte-asciiart/src/lib/AsciiArt.svelte`)
- [x] Export `AsciiArt` from `packages/svelte-asciiart/src/lib/index.ts`
- [x] Package unit tests: component (`AsciiArt.test.ts`) + export utils (`utils.test.ts`), 24 tests
- [x] Demo page (`demo/src/routes/+page.svelte`)
- [x] SVG/PNG export utilities (`exportSvg`, `exportSvgToPng`, `svgStringToPng`)

- [x] ANSI colors: pure-SVG rendering (Option A, run-based tspans); text-only API (spans prop considered and dropped — styling is CSS-only via `--ansi-fg-*`); unit tests; README docs
- [x] ANSI colors: demo page example
- [x] ANSI backgrounds (full-cell rect runs), inverse as fg/bg swap; `fontSize` (full-cell default) + `cellSize` fixed-scale props; optional `text`; `role="img"` (grok-mermaid demo feedback)

## Component API

```svelte
<script lang="ts">
	import { AsciiArt } from 'svelte-asciiart';
	const text = `...`;
</script>

<AsciiArt {text} />
<AsciiArt text={ansiColoredText} />
<AsciiArt {text} rows={4} cols={22} />
<AsciiArt {text} grid frame margin={[1, 2]} gridClass="ascii-grid" frameClass="ascii-frame" />
<AsciiArt bind:svg {text} />
```

## Notes

- `rows`/`cols` default to content dimensions in display columns (CJK/emoji = 2).
- viewBox is computed from `rows`/`cols` plus `margin`; frame is offset by the margin.
- Rendering is grid-based: one `<text>` per row, one `<tspan>` per styled run with per-code-point x list; cell width uses `cellAspect`.
- `grid` draws a single `<path>`; `frame` draws a `<rect>`; other SVG attrs are forwarded via `...rest`.
- ANSI: SGR fg+bg (16/256/truecolor), bold/dim/italic/underline/strike, inverse as fg/bg swap; 16-color via `ansi-*` classes themeable with `--ansi-fg-*`/`--ansi-bg-*` vars; bg = full-cell rect runs behind the text.
