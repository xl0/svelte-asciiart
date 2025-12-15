<script lang="ts">
	import { onMount } from 'svelte';

	type Margin = number | [number, number] | [number, number, number, number];

	// Props
	interface Props {
		text: string;
		rows?: number;
		cols?: number;
		grid?: boolean;
		cellAspect?: number;
		measureCellAspect?: boolean;
		gridClass?: string;
		gridStyle?: string;
		fontFamily?: string;
		frame?: boolean;
		frameMargin?: Margin;
		frameClass?: string;
		frameStyle?: string;
	}

	let {
		text,
		rows,
		cols,
		grid = false,
		cellAspect = 0.6,
		measureCellAspect = false,
		gridClass = '',
		gridStyle = '',
		fontFamily = "'Courier New', Consolas, 'Liberation Mono', monospace",
		frame = false,
		frameMargin = 0,
		frameClass = '',
		frameStyle = ''
	}: Props = $props();

	function parseMargin(m: Margin): { top: number; right: number; bottom: number; left: number } {
		if (typeof m === 'number') return { top: m, right: m, bottom: m, left: m };
		if (m.length === 2) return { top: m[0], right: m[1], bottom: m[0], left: m[1] };
		return { top: m[0], right: m[1], bottom: m[2], left: m[3] };
	}

	const margin = $derived(parseMargin(frameMargin));

	// Derive rows/cols from text if not provided
	const lines = $derived(text.split('\n'));
	const derivedRows = $derived(rows ?? lines.length);
	const derivedCols = $derived(cols ?? Math.max(...lines.map((l) => l.length)));

	const paddedLines = $derived(lines.map((l) => l.padEnd(derivedCols, ' ')).slice(0, derivedRows));
	const gridRows = $derived(Array.from({ length: derivedRows }, (_, r) => r));
	const gridCols = $derived(Array.from({ length: derivedCols }, (_, c) => c));
	const charAt = (r: number, c: number) => (paddedLines[r] ?? '').charAt(c) || ' ';

	let measuredCellAspect = $state(0.6);
	$effect(() => {
		measuredCellAspect = cellAspect;
	});

	onMount(async () => {
		if (!grid || !measureCellAspect) return;
		try {
			const fonts = (document as any).fonts;
			if (fonts?.ready) await fonts.ready;

			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
			svg.style.position = 'fixed';
			svg.style.left = '-99999px';
			svg.style.top = '0';
			svg.style.width = '1px';
			svg.style.height = '1px';
			svg.style.overflow = 'hidden';

			const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			textEl.setAttribute('font-family', fontFamily);
			textEl.setAttribute('font-size', '100');
			textEl.setAttribute('xml:space', 'preserve');
			textEl.textContent = 'M';
			svg.append(textEl);
			document.body.append(svg);
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			const bbox = textEl.getBBox();
			svg.remove();

			if (bbox.height > 0) measuredCellAspect = bbox.width / bbox.height;
		} catch {
			measuredCellAspect = cellAspect;
		}
	});

	// Character dimensions for monospace font (approximate ratio)
	// Width:Height ratio for monospace is typically ~0.6
	const charWidth = 0.6;
	const charHeight = 1;
	const lineHeight = 1.2;

	// Calculate viewBox dimensions (include margin for grid mode)
	const totalCols = $derived(grid ? derivedCols + margin.left + margin.right : derivedCols);
	const totalRows = $derived(grid ? derivedRows + margin.top + margin.bottom : derivedRows);
	const viewBoxWidth = $derived(grid ? totalCols * measuredCellAspect : derivedCols * charWidth);
	const viewBoxHeight = $derived(grid ? totalRows : derivedRows * lineHeight);

	// Offsets for content in grid mode
	const offsetX = $derived(grid ? margin.left * measuredCellAspect : 0);
	const offsetY = $derived(grid ? margin.top : 0);
</script>

<svg
	viewBox="0 0 {viewBoxWidth} {viewBoxHeight}"
	preserveAspectRatio="xMinYMin meet"
	xmlns="http://www.w3.org/2000/svg"
	style="width: 100%; height: 100%;"
>
	{#if grid}
		{@const totalGridCols = Array.from({ length: totalCols + 1 }, (_, c) => c)}
		{@const totalGridRows = Array.from({ length: totalRows + 1 }, (_, r) => r)}
		<path
			class={gridClass}
			style={gridStyle}
			d={[
				...totalGridCols.map((c) => `M ${c * measuredCellAspect} 0 V ${totalRows}`),
				...totalGridRows.map((r) => `M 0 ${r} H ${totalCols * measuredCellAspect}`)
			].join(' ')}
			fill="none"
		/>

		{#if frame}
			<rect
				class={frameClass}
				style={frameStyle}
				x={offsetX}
				y={offsetY}
				width={derivedCols * measuredCellAspect}
				height={derivedRows}
				fill="none"
			/>
		{/if}

		{#each lines as line, r}
			<text
				y={offsetY + r + 0.8}
				font-family={fontFamily}
				font-size="0.9"
				fill="currentColor"
				xml:space="preserve"
			>
				{#each line.split('') as ch, c}
					<tspan x={offsetX + c * measuredCellAspect + 0.1 * measuredCellAspect}>{ch}</tspan>
				{/each}
			</text>
		{/each}
	{:else}
		<text
			font-family={fontFamily}
			font-size="1"
			fill="currentColor"
			dominant-baseline="text-before-edge"
			xml:space="preserve"
		>
			{#each lines as line, i}
				<tspan x="0" y={i * lineHeight}>{line}</tspan>
			{/each}
		</text>
	{/if}
</svg>
