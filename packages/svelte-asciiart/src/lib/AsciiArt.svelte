<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';
	import { ansiToSpans, type Span } from './ansi.js';
	import { clusters, clusterWidth } from './width.js';
	import { fmt } from './utils.js';

	type Margin = number | [number, number] | [number, number, number, number];

	// Props
	interface Props extends SVGAttributes<SVGSVGElement> {
		/** Plain text, or text with ANSI SGR escapes. */
		text?: string;
		rows?: number;
		cols?: number;
		grid?: boolean;
		cellAspect?: number;
		gridClass?: string;
		frame?: boolean;
		margin?: Margin;
		frameClass?: string;
		svg?: SVGSVGElement | null;
		/** Pixels per viewBox unit for intrinsic size. Default: 50 */
		baseSize?: number;
		/** Glyph size as a fraction of cell height. Default: 1 (full cell — box-drawing lines tile seamlessly) */
		fontSize?: number;
		/** Pixels per cell (height). When set, the svg renders at that fixed scale instead of stretching to its container. */
		cellSize?: number;
	}

	let {
		text = '',
		rows,
		cols,
		grid = false,
		// Width:Height ratio for monospace is typically ~0.6 and getting the exact number dynamically is a hassle.
		cellAspect = 0.6,
		gridClass = '',
		frame = false,
		margin = 0,
		frameClass = '',
		svg = $bindable(),
		baseSize = 50,
		fontSize = 1,
		cellSize,
		...rest
	}: Props = $props();

	function parseMargin(m: Margin): { top: number; right: number; bottom: number; left: number } {
		if (typeof m === 'number') return { top: m, right: m, bottom: m, left: m };
		if (m.length === 2) return { top: m[0], right: m[1], bottom: m[0], left: m[1] };
		return { top: m[0], right: m[1], bottom: m[2], left: m[3] };
	}

	const parsedMargin = $derived(parseMargin(margin));

	// Parse into styled rows; on plain text ansiToSpans degenerates to
	// one unstyled span per line
	const spanRows = $derived(ansiToSpans(text));

	// Accessible-name fallback for role="img": the escape-stripped text
	const plainText = $derived(spanRows.map((row) => row.map((s) => s.text).join('')).join('\n'));

	const role = $derived((rest.role as string | undefined) ?? (plainText ? 'img' : 'presentation'));
	// ARIA prohibits naming presentational elements — an aria-label there would
	// revoke the role and get the element announced anyway
	const ariaLabel = $derived(
		role === 'presentation' || role === 'none'
			? undefined
			: (rest['aria-label'] ?? (rest['aria-labelledby'] || !plainText ? undefined : plainText))
	);

	// Derive rows/cols (display columns, not code units) from content if not
	// provided. Consumer rows/cols are clamped to non-negative integers —
	// negative or fractional values would corrupt the viewBox and array sizes.
	const clampDim = (n: number | undefined) =>
		n === undefined || !Number.isFinite(n) ? undefined : Math.max(0, Math.floor(n));
	const builtRows = $derived(spanRows.map(buildRuns));
	const contentRows = $derived(spanRows.length);
	const contentCols = $derived(builtRows.reduce((m, b) => Math.max(m, b.width), 0));
	const frameRows = $derived(clampDim(rows) ?? contentRows);
	const frameCols = $derived(clampDim(cols) ?? contentCols);
	const renderRows = $derived(Math.max(frameRows, contentRows));

	// Character dimensions for monospace font (approximate ratio)
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

	// Intrinsic size: px per viewBox unit (cellSize pins the on-screen scale too)
	const unitPx = $derived(cellSize ?? baseSize);
	const intrinsicWidth = $derived(fmt(viewBoxWidth * unitPx));
	const intrinsicHeight = $derived(fmt(viewBoxHeight * unitPx));

	// One <tspan> per styled run, with an absolute x per code point so glyphs sit
	// on the cell grid regardless of font metrics. Multi-code-point clusters
	// (ZWJ emoji etc.) get their own tspan — an x list would tear them apart.
	// Backgrounds are separate full-cell <rect> runs painted behind the text,
	// merged independently of foreground style changes so blocks stay solid.
	//
	// Runs are built in column units (the expensive segmentation pass, depends
	// only on the text) and mapped to coordinates in a separate derived, so
	// geometry-only prop changes (margin, fontSize, cellAspect) skip the
	// rebuild. The build also yields each row's display width, so the text is
	// segmented exactly once.
	interface ColRun {
		class?: string;
		fill?: string;
		cols: number[];
		text: string;
	}
	interface ColBg {
		class?: string;
		fill?: string;
		start: number;
		end: number;
	}
	interface Run {
		class?: string;
		fill?: string;
		xs: string;
		text: string;
	}
	interface BgRun {
		class?: string;
		fill?: string;
		x: string;
		width: string;
	}

	// center glyphs that are smaller than the cell: horizontal inset per cell,
	// and the baseline (0.8 within a full cell) shifted into the centered band
	const glyphInset = $derived(((1 - fontSize) / 2) * cellAspect);
	const baselineY = $derived(((1 - fontSize) / 2 + 0.8 * fontSize) * cellHeight);

	function buildRuns(rowSpans: Span[]): { runs: ColRun[]; bgs: ColBg[]; width: number } {
		const runs: ColRun[] = [];
		const bgs: ColBg[] = [];
		let col = 0;
		let cur: ColRun | null = null;
		let bgCur: { class?: string; fill?: string; start: number } | null = null;
		const flush = () => {
			if (cur && cur.text) runs.push(cur);
			cur = null;
		};
		const bgFlush = () => {
			if (bgCur && col > bgCur.start)
				bgs.push({ class: bgCur.class, fill: bgCur.fill, start: bgCur.start, end: col });
			bgCur = null;
		};
		const put = (cls: string | undefined, fill: string | undefined, cluster: string, w: number) => {
			if ([...cluster].length > 1) {
				flush();
				runs.push({ class: cls, fill, cols: [col], text: cluster });
			} else {
				if (!cur || cur.class !== cls || cur.fill !== fill) {
					flush();
					cur = { class: cls, fill, cols: [], text: '' };
				}
				cur.cols.push(col);
				cur.text += cluster;
			}
			col += w;
		};
		for (const span of rowSpans) {
			const hasBg = span.bgClass !== undefined || span.bgFill !== undefined;
			if (bgCur && (!hasBg || bgCur.class !== span.bgClass || bgCur.fill !== span.bgFill))
				bgFlush();
			if (hasBg && !bgCur) bgCur = { class: span.bgClass, fill: span.bgFill, start: col };
			for (const cl of clusters(span.text)) {
				const w = clusterWidth(cl);
				if (w === 0) continue;
				put(span.class, span.fill, cl, w);
			}
		}
		bgFlush();
		flush();
		return { runs, bgs, width: col };
	}

	const renderRuns = $derived.by(() => {
		const cellX = (c: number) => fmt(offsetX + c * cellAspect + glyphInset);
		return Array.from({ length: renderRows }, (_, r) => {
			const built = builtRows[r];
			if (!built) return { runs: [] as Run[], bgs: [] as BgRun[] };
			return {
				runs: built.runs.map((run) => ({
					class: run.class,
					fill: run.fill,
					xs: run.cols.map(cellX).join(' '),
					text: run.text
				})),
				bgs: built.bgs.map((b) => ({
					class: b.class,
					fill: b.fill,
					x: fmt(offsetX + b.start * cellAspect),
					width: fmt((b.end - b.start) * cellAspect)
				}))
			};
		});
	});
</script>

<!-- component attributes first, {...rest} after: consumer-passed viewBox /
     width / height / overflow / preserveAspectRatio override the computed
     ones; role, aria-label and style merge the consumer values explicitly -->
<svg
	bind:this={svg}
	{viewBox}
	width={intrinsicWidth}
	height={intrinsicHeight}
	overflow="hidden"
	preserveAspectRatio="xMinYMin meet"
	xmlns="http://www.w3.org/2000/svg"
	{...rest}
	{role}
	aria-label={ariaLabel}
	style="{cellSize === undefined
		? 'width: 100%; height: 100%; '
		: ''}font-family: var(--ascii-font-family, {defaultFontStack});{rest.style
		? ` ${rest.style}`
		: ''}"
>
	{#each renderRuns as row, r}
		{#each row.bgs as b}
			<rect
				class={b.class}
				style:fill={b.fill}
				x={b.x}
				y={fmt(offsetY + r * cellHeight)}
				width={b.width}
				height={fmt(cellHeight)}
			/>
		{/each}
	{/each}

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

	{#each renderRuns as row, r}
		<text
			y={fmt(offsetY + r * cellHeight + baselineY)}
			font-size={fmt(fontSize * cellHeight)}
			fill="currentColor"
			xml:space="preserve"
		>
			{#each row.runs as run}
				<tspan class={run.class} style:fill={run.fill} x={run.xs}>{run.text}</tspan>
			{/each}
		</text>
	{/each}
</svg>

<style>
	/* ANSI 16-color palette, themeable per host via --ansi-fg-* custom properties */
	svg :global(.ansi-bold) {
		font-weight: bold;
	}
	svg :global(.ansi-dim) {
		opacity: 0.6;
	}
	svg :global(.ansi-italic) {
		font-style: italic;
	}
	svg :global(.ansi-underline) {
		text-decoration: underline;
	}
	svg :global(.ansi-strike) {
		text-decoration: line-through;
	}
	svg :global(.ansi-underline.ansi-strike) {
		text-decoration: underline line-through;
	}
	/* inverse with no explicit fg: glyph paints in the default background color
	   (host overrides --ansi-default-bg to match its page) */
	svg :global(.ansi-inverse) {
		fill: var(--ansi-default-bg, Canvas);
	}
	/* inverse with no explicit colors: the block paints in the default text color */
	svg :global(.ansi-bg-inverse) {
		fill: currentColor;
	}
	/* .ansi-blink is emitted but unstyled by default — hosts opt in */
	svg :global(.ansi-fg-30) {
		fill: var(--ansi-fg-30, #000000);
	}
	svg :global(.ansi-fg-31) {
		fill: var(--ansi-fg-31, #cd3131);
	}
	svg :global(.ansi-fg-32) {
		fill: var(--ansi-fg-32, #00a600);
	}
	svg :global(.ansi-fg-33) {
		fill: var(--ansi-fg-33, #b58900);
	}
	svg :global(.ansi-fg-34) {
		fill: var(--ansi-fg-34, #0451a5);
	}
	svg :global(.ansi-fg-35) {
		fill: var(--ansi-fg-35, #bc05bc);
	}
	svg :global(.ansi-fg-36) {
		fill: var(--ansi-fg-36, #0598bc);
	}
	svg :global(.ansi-fg-37) {
		fill: var(--ansi-fg-37, #a5a5a5);
	}
	svg :global(.ansi-fg-90) {
		fill: var(--ansi-fg-90, #666666);
	}
	svg :global(.ansi-fg-91) {
		fill: var(--ansi-fg-91, #f14c4c);
	}
	svg :global(.ansi-fg-92) {
		fill: var(--ansi-fg-92, #23d18b);
	}
	svg :global(.ansi-fg-93) {
		fill: var(--ansi-fg-93, #f5f543);
	}
	svg :global(.ansi-fg-94) {
		fill: var(--ansi-fg-94, #3b8eea);
	}
	svg :global(.ansi-fg-95) {
		fill: var(--ansi-fg-95, #d670d6);
	}
	svg :global(.ansi-fg-96) {
		fill: var(--ansi-fg-96, #29b8db);
	}
	svg :global(.ansi-fg-97) {
		fill: var(--ansi-fg-97, #ffffff);
	}
	svg :global(.ansi-bg-40) {
		fill: var(--ansi-bg-40, #000000);
	}
	svg :global(.ansi-bg-41) {
		fill: var(--ansi-bg-41, #cd3131);
	}
	svg :global(.ansi-bg-42) {
		fill: var(--ansi-bg-42, #00a600);
	}
	svg :global(.ansi-bg-43) {
		fill: var(--ansi-bg-43, #b58900);
	}
	svg :global(.ansi-bg-44) {
		fill: var(--ansi-bg-44, #0451a5);
	}
	svg :global(.ansi-bg-45) {
		fill: var(--ansi-bg-45, #bc05bc);
	}
	svg :global(.ansi-bg-46) {
		fill: var(--ansi-bg-46, #0598bc);
	}
	svg :global(.ansi-bg-47) {
		fill: var(--ansi-bg-47, #a5a5a5);
	}
	svg :global(.ansi-bg-100) {
		fill: var(--ansi-bg-100, #666666);
	}
	svg :global(.ansi-bg-101) {
		fill: var(--ansi-bg-101, #f14c4c);
	}
	svg :global(.ansi-bg-102) {
		fill: var(--ansi-bg-102, #23d18b);
	}
	svg :global(.ansi-bg-103) {
		fill: var(--ansi-bg-103, #f5f543);
	}
	svg :global(.ansi-bg-104) {
		fill: var(--ansi-bg-104, #3b8eea);
	}
	svg :global(.ansi-bg-105) {
		fill: var(--ansi-bg-105, #d670d6);
	}
	svg :global(.ansi-bg-106) {
		fill: var(--ansi-bg-106, #29b8db);
	}
	svg :global(.ansi-bg-107) {
		fill: var(--ansi-bg-107, #ffffff);
	}
</style>
