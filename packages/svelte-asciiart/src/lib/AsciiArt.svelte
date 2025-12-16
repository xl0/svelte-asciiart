<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	type Margin = number | [number, number] | [number, number, number, number];

	// Props
	interface Props extends SVGAttributes<SVGSVGElement> {
		text: string;
		rows?: number;
		cols?: number;
		grid?: boolean;
		cellAspect?: number;
		gridClass?: string;
		frame?: boolean;
		margin?: Margin;
		frameClass?: string;
		svg?: SVGSVGElement | null;
	}

	let {
		text,
		rows,
		cols,
		grid = false,
		cellAspect = 0.6,
		gridClass = '',
		frame = false,
		margin = 0,
		frameClass = '',
		svg = $bindable(),
		...rest
	}: Props = $props();

	function parseMargin(m: Margin): { top: number; right: number; bottom: number; left: number } {
		if (typeof m === 'number') return { top: m, right: m, bottom: m, left: m };
		if (m.length === 2) return { top: m[0], right: m[1], bottom: m[0], left: m[1] };
		return { top: m[0], right: m[1], bottom: m[2], left: m[3] };
	}

	function fmt(n: number, digits = 3): string {
		if (!Number.isFinite(n)) return String(n);
		if (Math.abs(n) < 1e-12) return '0';
		const s = n.toFixed(digits);
		return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
	}

	const parsedMargin = $derived(parseMargin(margin));

	// Derive rows/cols from text if not provided
	const lines = $derived(text.split('\n'));
	const contentRows = $derived(lines.length);
	const contentCols = $derived(Math.max(0, ...lines.map((l) => l.length)));
	const frameRows = $derived(rows ?? contentRows);
	const frameCols = $derived(cols ?? contentCols);
	const renderRows = $derived(Math.max(frameRows, contentRows));
	const renderCols = $derived(Math.max(frameCols, contentCols));

	const paddedLines = $derived(lines.map((l) => l.padEnd(renderCols, ' ')).slice(0, renderRows));
	const gridRows = $derived(Array.from({ length: renderRows }, (_, r) => r));
	const gridCols = $derived(Array.from({ length: renderCols }, (_, c) => c));
	const charAt = (r: number, c: number) => (paddedLines[r] ?? '').charAt(c) || ' ';

	// Character dimensions for monospace font (approximate ratio)
	// Width:Height ratio for monospace is typically ~0.6
	const cellHeight = 1;
	const defaultFontStack =
		'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

	// Calculate viewBox dimensions (frame + margin). Content may overflow the frame into the margin.
	const totalCols = $derived(frameCols + parsedMargin.left + parsedMargin.right);
	const totalRows = $derived(frameRows + parsedMargin.top + parsedMargin.bottom);
	const viewBoxWidth = $derived(totalCols * cellAspect);
	const viewBoxHeight = $derived(totalRows * cellHeight);
	const totalGridCols = $derived(Array.from({ length: totalCols + 1 }, (_, c) => c));
	const totalGridRows = $derived(Array.from({ length: totalRows + 1 }, (_, r) => r));

	// Offsets for content
	const offsetX = $derived(parsedMargin.left * cellAspect);
	const offsetY = $derived(parsedMargin.top * cellHeight);

	const viewBox = $derived(`0 0 ${fmt(viewBoxWidth)} ${fmt(viewBoxHeight)}`);
</script>

<svg
	bind:this={svg}
	{...rest}
	{viewBox}
	overflow="hidden"
	preserveAspectRatio="xMinYMin meet"
	xmlns="http://www.w3.org/2000/svg"
	style="width: 100%; height: 100%; font-family: var(--ascii-font-family, {defaultFontStack});"
>
	{#if grid}
		<path
			class={gridClass}
			d={[
				...totalGridCols.map((c) => `M ${fmt(c * cellAspect)} 0 V ${fmt(totalRows * cellHeight)}`),
				...totalGridRows.map((r) => `M 0 ${fmt(r * cellHeight)} H ${fmt(totalCols * cellAspect)}`)
			].join(' ')}
			fill="none"
		/>
	{/if}

	{#if frame}
		<rect
			class={frameClass}
			x={fmt(offsetX)}
			y={fmt(offsetY)}
			width={fmt(frameCols * cellAspect)}
			height={fmt(frameRows * cellHeight)}
			fill="none"
		/>
	{/if}

	{#each gridRows as r}
		<text
			y={fmt(offsetY + r * cellHeight + 0.8 * cellHeight)}
			font-size={fmt(0.9 * cellHeight)}
			fill="currentColor"
			xml:space="preserve"
		>
			{#each gridCols as c}
				<tspan x={fmt(offsetX + c * cellAspect + 0.1 * cellAspect)}>{charAt(r, c)}</tspan>
			{/each}
		</text>
	{/each}
</svg>
