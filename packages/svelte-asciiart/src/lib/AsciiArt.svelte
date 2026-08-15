<script lang="ts">
	import {
		DEFAULT_FONT_STACK,
		layout,
		parseAnsi,
		render,
		type Margin,
		type Theme
	} from 'lovely-ansi-svg';
	import type { SVGAttributes } from 'svelte/elements';
	import { measureCellMetrics } from './metrics.js';

	interface Props extends SVGAttributes<SVGSVGElement> {
		/** Plain text, or text with ANSI SGR escapes. */
		text?: string;
		/** Frame height in cells; default: content height. */
		rows?: number;
		/** Frame width in cells; default: content width (display columns). */
		cols?: number;
		/** Margin around the frame, in cells: uniform, [v, h] or [t, r, b, l]. */
		margin?: Margin;
		/** Cell grid lines: `true` for a default faint stroke, a string for a CSS class. */
		grid?: boolean | string;
		/** Border around the frame: `true` for a default stroke, a string for a CSS class. */
		frame?: boolean | string;
		/** Cell width:height ratio; 'auto' (default) measures the rendered font once loaded. */
		cellAspect?: number | 'auto';
		/** Glyph size as a fraction of cell height. Default: 1 (full cell — box-drawing lines tile seamlessly). */
		glyphScale?: number;
		/** Pixels per cell (height) for the intrinsic size. Default: 50. For a fixed on-screen scale pass style="width: auto; height: auto". */
		cellSize?: number;
		/** Color theme the ANSI escapes resolve through: 16-color palette + default fg/bg. */
		theme?: Theme;
		/** Draw box-drawing/block chars (U+2500–U+259F) as exact-cell shapes instead of font glyphs; default true. */
		customGlyphs?: boolean;
	}

	let {
		text = '',
		rows,
		cols,
		margin = 0,
		grid = false,
		frame = false,
		cellAspect = 'auto',
		glyphScale = 1,
		cellSize = 50,
		theme,
		customGlyphs = true,
		...rest
	}: Props = $props();

	let svgEl: SVGSVGElement | undefined = $state();
	let probeEl: SVGTextElement | undefined = $state();

	// font metrics, canvas-measured from the mounted svg's font when
	// cellAspect is 'auto'; null until measured (render() falls back to 0.6/0.8)
	let measured = $state<{ cellAspect: number; baseline: number } | null>(null);

	$effect(() => {
		if (cellAspect !== 'auto' || !svgEl || !probeEl) return;
		const el = svgEl;
		const measure = () => {
			const m = measureCellMetrics(getComputedStyle(el).fontFamily);
			if (m && (m.cellAspect !== measured?.cellAspect || m.baseline !== measured?.baseline))
				measured = m;
		};
		// the hidden probe glyph's bounding box tracks the resolved font, so the
		// observer fires on anything that changes it: --ascii-font-family flips on
		// ancestors, consumer style/class changes, webfont loads (and once on
		// observe, for the initial measurement)
		const ro = new ResizeObserver(measure);
		ro.observe(probeEl);
		return () => ro.disconnect();
	});

	// the segmentation pass depends only on text and theme; geometry-only prop
	// changes reuse it
	const layoutRows = $derived(layout(parseAnsi(text, theme)));
	const model = $derived(
		render(layoutRows, {
			rows,
			cols,
			margin,
			grid,
			frame,
			cellAspect: cellAspect === 'auto' ? measured?.cellAspect : cellAspect,
			baseline: cellAspect === 'auto' ? measured?.baseline : undefined,
			glyphScale,
			cellSize,
			customGlyphs
		})
	);

	// no auto accessible name: a labelled svg is an image, an unlabelled one is
	// decorative (ARIA prohibits naming presentational elements)
	const role = $derived(
		(rest.role as string | undefined) ??
			(rest['aria-label'] || rest['aria-labelledby'] ? 'img' : 'presentation')
	);
</script>

<!-- component attributes first, {...rest} after: consumer-passed viewBox /
     width / height / overflow / preserveAspectRatio override the computed
     ones; role and style merge the consumer values explicitly -->
<svg
	bind:this={svgEl}
	viewBox={model.viewBox}
	width={model.width}
	height={model.height}
	overflow="hidden"
	preserveAspectRatio="xMinYMin meet"
	xmlns="http://www.w3.org/2000/svg"
	{...rest}
	{role}
	style="width: 100%; height: 100%; font-family: var(--ascii-font-family, {DEFAULT_FONT_STACK});{theme?.foreground
		? ` color: ${theme.foreground};`
		: ''}{rest.style ? ` ${rest.style}` : ''}"
>
	{#if cellAspect === 'auto'}
		<!-- hidden font probe: its bounding box changes whenever the resolved
		     font does, which is what triggers re-measurement -->
		<text bind:this={probeEl} visibility="hidden" font-size="100" aria-hidden="true">M</text>
	{/if}

	{#each model.rows as row}
		{#each row.bgs as b}
			<rect style={b.style} x={b.x} y={b.y} width={b.width} height={b.height} />
		{/each}
	{/each}

	{#if model.grid}
		<path
			class={model.grid.class}
			d={model.grid.d}
			fill="none"
			stroke={model.grid.stroke}
			stroke-opacity={model.grid.strokeOpacity}
			stroke-width={model.grid.strokeWidth}
		/>
	{/if}

	{#if model.frame}
		<rect
			class={model.frame.class}
			x={model.frame.x}
			y={model.frame.y}
			width={model.frame.width}
			height={model.frame.height}
			fill="none"
			stroke={model.frame.stroke}
			stroke-width={model.frame.strokeWidth}
		/>
	{/if}

	{#each model.rows as row}
		{#each row.shapes as s}
			<path style={s.style} d={s.d} />
		{/each}
	{/each}

	{#each model.rows as row}
		{#if row.runs.length}
			<text y={row.y} font-size={model.fontSize} fill="currentColor" xml:space="preserve">
				{#each row.runs as run}
					{#if run.href}
						<a href={run.href}><tspan style={run.style} x={run.x}>{run.text}</tspan></a>
					{:else}
						<tspan style={run.style} x={run.x}>{run.text}</tspan>
					{/if}
				{/each}
			</text>
		{/if}
	{/each}
</svg>
