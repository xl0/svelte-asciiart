<script lang="ts">
	import { AsciiArt, measureCellMetrics } from 'svelte-asciiart';
	import { exportSvg, fmt } from 'lovely-ansi-svg';
	import { collectFontCss, svgStringToPng } from 'lovely-svg-png';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Check, Copy, ChevronDown } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { codeToHtml } from 'shiki';

	let { data }: { data: PageData } = $props();

	const lineStyles = [
		{ value: 'solid', label: 'Solid ———' },
		{ value: 'dashed', label: 'Dashed - - -' },
		{ value: 'dotted', label: 'Dotted · · ·' },
		{ value: 'dashdot', label: 'Dash-dot -·-·-' }
	] as const;

	interface MonoFont {
		key: string;
		label: string;
		family: string;
		/** Google Fonts css2 family slug — set for fonts loaded from Google Fonts */
		gf?: string;
	}

	const monoFonts: MonoFont[] = [
		{
			key: 'system',
			label: 'System',
			family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
		},
		{
			key: 'jetbrains',
			label: 'JetBrains Mono',
			family: '"JetBrains Mono", ui-monospace, monospace',
			gf: 'JetBrains+Mono:wght@400;600'
		},
		{
			key: 'fira',
			label: 'Fira Code',
			family: '"Fira Code", ui-monospace, monospace',
			gf: 'Fira+Code:wght@400;600'
		},
		{
			key: 'source',
			label: 'Source Code Pro',
			family: '"Source Code Pro", ui-monospace, monospace',
			gf: 'Source+Code+Pro:wght@400;600'
		},
		{
			key: 'plex',
			label: 'IBM Plex Mono',
			family: '"IBM Plex Mono", ui-monospace, monospace',
			gf: 'IBM+Plex+Mono:wght@400;600'
		},
		{ key: 'courier', label: 'Courier New', family: '"Courier New", Courier, monospace' },
		{ key: 'consolas', label: 'Consolas', family: 'Consolas, "Liberation Mono", monospace' },
		{ key: 'menlo', label: 'Menlo', family: 'Menlo, Monaco, monospace' },
		{ key: 'monaco', label: 'Monaco', family: 'Monaco, monospace' }
	];

	const defaultFontKey = monoFonts[0].key;

	function getDashArray(style: string, width: number): string {
		const unit = width * 4;
		switch (style) {
			case 'dashed':
				return `${fmt(unit * 3)} ${fmt(unit * 2)}`;
			case 'dotted':
				return `${fmt(unit)} ${fmt(unit)}`;
			case 'dashdot':
				return `${fmt(unit * 3)} ${fmt(unit)} ${fmt(unit)} ${fmt(unit)}`;
			default:
				return 'none';
		}
	}

	const defaultArt = `+----------+	   _o<
|  Hello   |	  \`\\\,_
|  World!  |	(_)/ (_)
+----------+`;

	const ansiArt = [
		'\x1b[36m┌────────────────┐\x1b[0m',
		'\x1b[36m│\x1b[0m  \x1b[1;33m★\x1b[0m \x1b[1mANSI art\x1b[0m \x1b[1;33m★\x1b[0m  \x1b[36m│\x1b[0m',
		'\x1b[36m│\x1b[0m \x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m \x1b[94mblue\x1b[0m \x1b[36m│\x1b[0m',
		'\x1b[36m│\x1b[0m \x1b[38;5;208m256\x1b[0m \x1b[38;2;255;105;180mtruecolor\x1b[0m  \x1b[36m│\x1b[0m',
		'\x1b[36m│\x1b[0m \x1b[43;30mbg\x1b[0m \x1b[7minverse\x1b[0m     \x1b[36m│\x1b[0m',
		'\x1b[36m└────────────────┘\x1b[0m'
	].join('\n');

	let text = $state(defaultArt);
	let frame = $state(true);
	let showGrid = $state(true);
	let autoRows = $state(false);
	let autoCols = $state(false);
	let rows = $state<number>(4);
	let cols = $state<number>(22);
	let autoAspect = $state(true);
	let cellAspect = $state(0.6);
	let marginTop = $state(1);
	let marginRight = $state(2);
	let marginBottom = $state(1);
	let marginLeft = $state(2);
	let fontKey = $state(defaultFontKey);

	let gridStroke = $state('#87CEFA');
	let gridStrokeWidth = $state(0.03);
	let gridOpacity = $state(0.5);
	let frameStroke = $state('#FFB366');
	let frameStrokeWidth = $state(0.05);
	let frameLineStyle = $state('solid');
	let gridLineStyle = $state('solid');
	let copiedSvg = $state(false);
	let copiedPng = $state(false);
	let copiedSvgTimeout: ReturnType<typeof setTimeout> | undefined;
	let copiedPngTimeout: ReturnType<typeof setTimeout> | undefined;
	let bgColor = $state('#f3f4f6');
	let fillColor = $state('#111827');
	let strokeColor = $state('#111827');
	let strokeWidth = $state(0);
	let bold = $state(false);
	let showExport = $state(false);
	let cellSize = $state(50);
	const fontFamily = $derived(monoFonts.find((f) => f.key === fontKey)?.family ?? monoFonts[0].family);

	const frameMargin = $derived([marginTop, marginRight, marginBottom, marginLeft] as [number, number, number, number]);

	const rowsProp = $derived(!autoRows && Number.isFinite(rows) ? rows : undefined);
	const colsProp = $derived(!autoCols && Number.isFinite(cols) ? cols : undefined);
	const sizeProps = $derived({
		...(rowsProp === undefined ? {} : { rows: rowsProp }),
		...(colsProp === undefined ? {} : { cols: colsProp })
	});

	const gridDashArray = $derived(getDashArray(gridLineStyle, gridStrokeWidth));
	const frameDashArray = $derived(getDashArray(frameLineStyle, frameStrokeWidth));

	const exportOn = $derived(showExport);

	// Measure the selected font like the component does, so the export matches
	// the live render when the aspect is on auto
	let measured = $state<{ cellAspect: number; baseline: number } | null>(null);
	$effect(() => {
		const family = fontFamily;
		let stale = false;
		const run = () => {
			if (stale) return;
			// only assign on change: a fresh object would re-trigger the export
			// views on every unrelated font load
			const m = measureCellMetrics(family);
			if (m?.cellAspect !== measured?.cellAspect || m?.baseline !== measured?.baseline) measured = m;
		};
		run();
		document.fonts.ready.then(run);
		document.fonts.addEventListener('loadingdone', run);
		return () => {
			stale = true;
			document.fonts.removeEventListener('loadingdone', run);
		};
	});

	// The export is model-based (exportSvg(text, options)) — the demo styling
	// that lives in host CSS for the live render goes in via extraCss instead.
	function buildExportCss(): string {
		const rules: string[] = [];
		if (showGrid) {
			rules.push(
				`.ascii-grid { stroke: ${gridStroke}; stroke-width: ${fmt(gridStrokeWidth)}; opacity: ${fmt(gridOpacity)};${
					gridDashArray !== 'none' ? ` stroke-dasharray: ${gridDashArray};` : ''
				} fill: none }`
			);
		}
		if (frame) {
			rules.push(
				`.ascii-frame { stroke: ${frameStroke}; stroke-width: ${fmt(frameStrokeWidth)};${
					frameDashArray !== 'none' ? ` stroke-dasharray: ${frameDashArray};` : ''
				} fill: none }`
			);
		}
		rules.push(
			`text, tspan { fill: ${fillColor}; stroke: ${strokeColor}; stroke-width: ${fmt(strokeWidth)}; font-weight: ${bold ? 700 : 400}; paint-order: stroke fill }`
		);
		return rules.join('\n');
	}

	function exportOptions() {
		return {
			...(rowsProp === undefined ? {} : { rows: rowsProp }),
			...(colsProp === undefined ? {} : { cols: colsProp }),
			margin: frameMargin,
			// exportSvg cannot measure fonts itself (no DOM) — pass the measured
			// metrics so the export matches the live auto-aspect render
			...(autoAspect ? (measured ?? {}) : { cellAspect }),
			grid: showGrid ? ('ascii-grid' as const) : false,
			frame: frame ? ('ascii-frame' as const) : false,
			cellSize,
			fontFamily,
			background: bgColor,
			extraCss: buildExportCss()
		};
	}

	// Debounced trigger shared by all export views: codePreview reads every
	// control that affects the render, so its debounced copy (set below, after
	// codePreview is defined) doubles as the invalidation signal — no
	// hand-maintained dependency list.
	let debouncedPreview = $state<string | null>(null);

	// Auto-generate the PNG preview on the debounced trigger
	let pngPreviewUrl = $state<string | null>(null);
	let pngGen = 0;
	$effect(() => {
		if (!exportOn) {
			if (pngPreviewUrl) URL.revokeObjectURL(pngPreviewUrl);
			pngPreviewUrl = null;
			return;
		}
		void debouncedPreview;
		// measurement lands async and isn't in the snippet — depend on it
		// directly (it only changes on font change/load, no debounce needed)
		void measured;
		// untrack: every other input already arrives via debouncedPreview; direct
		// dependencies would regenerate undebounced on every slider tick
		const [svgStr, family] = untrack(() => [exportSvg(text, exportOptions()), fontFamily]);
		// export duration varies (font fetches) — the generation token keeps a
		// slow older render from overwriting a newer one
		const gen = ++pngGen;
		void (async () => {
			try {
				const fontCss = await collectFontCss(family);
				const blob = await svgStringToPng(svgStr, { fontCss, output: 'blob' });
				if (gen !== pngGen) return;
				if (pngPreviewUrl) URL.revokeObjectURL(pngPreviewUrl);
				pngPreviewUrl = URL.createObjectURL(blob);
			} catch (e) {
				console.error('Failed to generate PNG:', e);
				if (gen !== pngGen) return;
				if (pngPreviewUrl) URL.revokeObjectURL(pngPreviewUrl);
				pngPreviewUrl = null;
			}
		})();
	});

	// The exported SVG string for display, on the same debounced trigger
	const svgExported = $derived.by(() => {
		if (!exportOn) return null;
		void debouncedPreview;
		void measured;
		return untrack(() => exportSvg(text, exportOptions()));
	});

	function marginLiteral(): string | null {
		const hasMargin = marginTop > 0 || marginRight > 0 || marginBottom > 0 || marginLeft > 0;
		if (!hasMargin) return null;
		if (marginTop === marginBottom && marginLeft === marginRight) {
			if (marginTop === marginLeft) return fmt(marginTop);
			return `[${fmt(marginTop)}, ${fmt(marginLeft)}]`;
		}
		return `[${fmt(marginTop)}, ${fmt(marginRight)}, ${fmt(marginBottom)}, ${fmt(marginLeft)}]`;
	}

	function buildClassProp(): string {
		const classes: string[] = [];
		if (fontKey !== defaultFontKey) classes.push(`ascii-font-${fontKey}`);
		if (bold) classes.push('ascii-bold');
		if (hasCustomBg()) classes.push('ascii-bg');
		if (hasCustomPaint()) classes.push('ascii-paint');
		if (!classes.length) return '';
		return `\n  class="${classes.join(' ')}"`;
	}

	function buildWrapperStyle(): string {
		const props: string[] = [];
		props.push(`--ascii-grid-stroke: ${gridStroke}`);
		props.push(`--ascii-grid-stroke-width: ${gridStrokeWidth}`);
		props.push(`--ascii-grid-opacity: ${gridOpacity}`);
		props.push(`--ascii-grid-dasharray: ${gridDashArray}`);
		props.push(`--ascii-frame-stroke: ${frameStroke}`);
		props.push(`--ascii-frame-stroke-width: ${frameStrokeWidth}`);
		props.push(`--ascii-frame-dasharray: ${frameDashArray}`);
		props.push(`background: ${bgColor}`);
		props.push(`--ascii-font-family: ${fontFamily}`);
		props.push(`--ascii-font-weight: ${bold ? 700 : 400}`);
		props.push(`--ascii-text-fill: ${fillColor}`);
		props.push(`--ascii-text-stroke: ${strokeColor}`);
		props.push(`--ascii-text-stroke-width: ${strokeWidth}`);
		return props.join('; ');
	}

	function hasCustomBg(): boolean {
		return bgColor !== '#f3f4f6';
	}

	function hasCustomPaint(): boolean {
		return fillColor !== '#111827' || strokeColor !== '#111827' || strokeWidth !== 0;
	}

	function buildFontCss(): string {
		if (fontKey === defaultFontKey) return '';
		const family = monoFonts.find((f) => f.key === fontKey)?.family;
		if (!family) return '';
		return [
			`:global(svg.ascii-font-${fontKey} text),`,
			`:global(svg.ascii-font-${fontKey} tspan) {`,
			`  font-family: ${family};`,
			`}`
		].join('\n');
	}

	function buildFontHead(): string {
		const gfFamily = monoFonts.find((f) => f.key === fontKey)?.gf;
		if (!gfFamily) return '';
		return [
			'<svelte:head>',
			'  <link rel="preconnect" href="https://fonts.googleapis.com" />',
			'  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
			'  <link',
			'    rel="stylesheet"',
			`    href="https://fonts.googleapis.com/css2?family=${gfFamily}&display=swap"`,
			'  />',
			'</svelte:head>'
		].join('\n');
	}

	// options literal for the example snippet, mirroring exportOptions()
	function buildOptsLiteral(): string[] {
		const parts: string[] = [];
		if (rowsProp !== undefined) parts.push(`rows: ${fmt(rowsProp)}`);
		if (colsProp !== undefined) parts.push(`cols: ${fmt(colsProp)}`);
		const margin = marginLiteral();
		if (margin) parts.push(`margin: ${margin}`);
		if (!autoAspect) parts.push(`cellAspect: ${fmt(cellAspect)}`);
		else parts.push('...measureCellMetrics(fontFamily)');
		if (showGrid) parts.push(`grid: 'ascii-grid'`);
		if (frame) parts.push(`frame: 'ascii-frame'`);
		if (cellSize !== 50) parts.push(`cellSize: ${cellSize}`);
		parts.push('fontFamily');
		parts.push(`background: '${bgColor}'`);
		parts.push('extraCss');
		return parts;
	}

	let codePreview = $derived.by(() => {
		// escape everything a template literal interprets: \, ` and ${
		const esc = (s: string) => s.replace(/[\\`]|\$\{/g, (m) => '\\' + m);
		const escapedText = esc(text);
		const margin = marginLiteral();
		const classProp = buildClassProp();
		const fontCss = buildFontCss();
		const fontHead = buildFontHead();
		const lines: string[] = [];
		if (fontHead) {
			lines.push(fontHead);
			lines.push('');
		}
		lines.push('<script lang="ts">');
		lines.push(
			exportOn && autoAspect
				? "  import { AsciiArt, measureCellMetrics } from 'svelte-asciiart';"
				: "  import { AsciiArt } from 'svelte-asciiart';"
		);
		if (exportOn) {
			lines.push("  import { exportSvg } from 'lovely-ansi-svg';");
			lines.push("  import { collectFontCss, svgStringToPng } from 'lovely-svg-png';");
		}
		lines.push(`  const text = \`${escapedText}\`;`);
		if (exportOn) {
			lines.push('');
			lines.push('  // model-based export: same options as the component props');
			lines.push(`  const fontFamily = ${JSON.stringify(fontFamily)};`);
			lines.push(`  const extraCss = \`${esc(buildExportCss())}\`;`);
			lines.push(`  const opts = { ${buildOptsLiteral().join(', ')} };`);
		}
		lines.push('<\/script>');
		lines.push('');
		lines.push('<AsciiArt');
		lines.push('  {text}');
		if (rowsProp !== undefined) lines.push(`  rows={${fmt(rowsProp)}}`);
		if (colsProp !== undefined) lines.push(`  cols={${fmt(colsProp)}}`);
		if (!autoAspect) lines.push(`  cellAspect={${fmt(cellAspect)}}`);
		if (showGrid) lines.push('  grid="ascii-grid"');
		if (frame) lines.push('  frame="ascii-frame"');
		if (margin) lines.push(`  margin={${margin}}`);
		if (classProp) lines.push(classProp.slice(1));
		if (exportOn && cellSize !== 50) lines.push(`  cellSize={${cellSize}}`);
		lines.push('/>');
		if (exportOn) {
			lines.push('');
			lines.push('<button type="button" onclick={async () => {');
			lines.push('  await navigator.clipboard.writeText(exportSvg(text, opts));');
			lines.push('}}>Copy SVG</button>');
			lines.push('<button type="button" onclick={async () => {');
			lines.push('  const fontCss = await collectFontCss(opts.fontFamily);');
			lines.push('  const blob = await svgStringToPng(exportSvg(text, opts), { fontCss, output: "blob" });');
			lines.push('  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);');
			lines.push('}}>Copy PNG</button>');
		}
		lines.push('');
		if (showGrid || frame || fontCss || bold || hasCustomBg() || hasCustomPaint()) {
			lines.push('<style>');
			if (fontCss) lines.push(`  ${fontCss.replaceAll('\n', '\n  ')}`);
			if (bold) {
				lines.push('  :global(.ascii-bold) {');
				lines.push('    font-weight: 700;');
				lines.push('  }');
			}
			if (hasCustomBg()) {
				lines.push('  :global(.ascii-bg) {');
				lines.push(`    background: ${bgColor};`);
				lines.push('  }');
			}
			if (hasCustomPaint()) {
				lines.push('  :global(svg.ascii-paint text),');
				lines.push('  :global(svg.ascii-paint tspan) {');
				lines.push(`    fill: ${fillColor};`);
				lines.push(`    stroke: ${strokeColor};`);
				lines.push(`    stroke-width: ${fmt(strokeWidth)};`);
				lines.push('    paint-order: stroke fill;');
				lines.push('  }');
			}
			if (showGrid) {
				lines.push('  :global(.ascii-grid) {');
				lines.push(`    stroke: ${gridStroke};`);
				lines.push(`    stroke-width: ${fmt(gridStrokeWidth)};`);
				lines.push(`    opacity: ${fmt(gridOpacity)};`);
				if (gridDashArray !== 'none') lines.push(`    stroke-dasharray: ${gridDashArray};`);
				lines.push('  }');
			}
			if (frame) {
				lines.push('  :global(.ascii-frame) {');
				lines.push(`    stroke: ${frameStroke};`);
				lines.push(`    stroke-width: ${fmt(frameStrokeWidth)};`);
				if (frameDashArray !== 'none') lines.push(`    stroke-dasharray: ${frameDashArray};`);
				lines.push('  }');
			}
			lines.push('</style>');
		}
		return lines.join('\n').trimEnd();
	});

	// Set the shared debounced trigger: gates the Shiki re-highlight and all
	// export views off per-keystroke/slider-tick recomputation
	$effect(() => {
		const code = codePreview;
		const timeout = setTimeout(() => (debouncedPreview = code), 150);
		return () => clearTimeout(timeout);
	});
	let highlightedCode = $derived(await codeToHtml(debouncedPreview ?? codePreview, { lang: 'svelte', theme: 'github-dark' }));
	let highlightedInstall = $derived(await codeToHtml('npm install svelte-asciiart', { lang: 'bash', theme: 'github-dark' }));

	let exampleCodeEl: HTMLDivElement | null = null;
	let copied = $state(false);
	let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

	async function copySvg() {
		try {
			await navigator.clipboard.writeText(exportSvg(text, exportOptions()));
		} catch (e) {
			console.error('Failed to copy SVG:', e);
			return;
		}
		copiedSvg = true;
		if (copiedSvgTimeout) clearTimeout(copiedSvgTimeout);
		copiedSvgTimeout = setTimeout(() => {
			copiedSvg = false;
		}, 800);
	}

	async function copyPng() {
		try {
			const fontCss = await collectFontCss(fontFamily);
			const blob = await svgStringToPng(exportSvg(text, exportOptions()), { fontCss, output: 'blob' });
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		} catch (e) {
			console.error('Failed to copy PNG:', e);
			return;
		}
		copiedPng = true;
		if (copiedPngTimeout) clearTimeout(copiedPngTimeout);
		copiedPngTimeout = setTimeout(() => {
			copiedPng = false;
		}, 800);
	}

	async function copyExampleCode() {
		try {
			await navigator.clipboard.writeText(codePreview);
		} catch (e) {
			console.error('Failed to copy code:', e);
			return;
		}
		copied = true;
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copied = false;
		}, 1000);
	}

	function onExampleKeydown(e: KeyboardEvent) {
		if (e.key.toLowerCase() !== 'a' || !(e.metaKey || e.ctrlKey) || !exampleCodeEl) return;
		e.preventDefault();
		const sel = window.getSelection();
		if (!sel) return;
		const range = document.createRange();
		range.selectNodeContents(exampleCodeEl);
		sel.removeAllRanges();
		sel.addRange(range);
	}
</script>

<div class="p-6">
	<div class="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-4">
		<h1 class="text-xl font-bold">svelte-asciiart</h1>
		<Button variant="outline" href="https://github.com/xl0/svelte-asciiart">GitHub</Button>
	</div>

	<div class="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
		<div class="mx-auto flex h-full max-w-2xl flex-col xl:mr-0 xl:ml-auto">
			<Card.Root class="flex h-full flex-col">
				<Card.Content class="space-y-6">
					<div class="grow space-y-2">
						<Label for="ascii-input">ASCII Art</Label>
						<Textarea
							id="ascii-input"
							bind:value={text}
							rows={6}
							class="overflow-x-scroll overflow-y-auto font-mono text-sm whitespace-nowrap" />
					</div>

					<div class="flex flex-wrap gap-4">
						<div class="flex min-w-fit items-center gap-2">
							<Switch id="grid-toggle" bind:checked={showGrid} />
							<Label for="grid-toggle" class="whitespace-nowrap">Show Grid</Label>
						</div>
						<div class="flex min-w-fit items-center gap-2">
							<Switch id="frame-toggle" bind:checked={frame} />
							<Label for="frame-toggle" class="whitespace-nowrap">Frame</Label>
						</div>
						<div class="flex min-w-fit items-center gap-2">
							<Switch id="export-toggle" bind:checked={showExport} />
							<Label for="export-toggle" class="whitespace-nowrap">Demo Export</Label>
						</div>
					</div>

					<div class="flex items-end gap-4 w-full">
						<div class="flex-1 space-y-2">
							<div class="flex items-center justify-between gap-2">
								<Label>Cell aspect: {autoAspect ? 'auto (measured)' : cellAspect.toFixed(2)}</Label>
								<div class="flex items-center gap-1.5">
									<Switch id="aspect-auto" bind:checked={autoAspect} />
									<Label for="aspect-auto" class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Auto</Label>
								</div>
							</div>
							<Slider type="single" bind:value={cellAspect} min={0.35} max={1} step={0.01} disabled={autoAspect} />
						</div>

						{#if exportOn}
							<div class="w-fit space-y-2">
								<Label for="cell-size" class="text-xs whitespace-nowrap text-muted-foreground">Cell Size</Label>
								<Input
									id="cell-size"
									type="number"
									min={10}
									max={200}
									value={String(cellSize)}
									oninput={(e) => {
										const v = Number((e.currentTarget as HTMLInputElement).value);
										if (Number.isFinite(v) && v > 0) cellSize = v;
									}}
									class="h-9 w-20" />
							</div>
						{/if}
					</div>

					<div class="space-y-4">
						<Label class="text-sm font-medium">Canvas Size</Label>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<div class="flex items-center justify-between gap-2">
									<Label class="text-xs text-muted-foreground" for="rows-enabled">Rows</Label>
									<div class="flex items-center gap-1.5">
										<Switch id="rows-enabled" bind:checked={autoRows} />
										<Label for="rows-enabled" class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Auto</Label>
									</div>
								</div>
								<Input
									type="number"
									inputmode="numeric"
									step="any"
									value={String(rows)}
									oninput={(e) => {
										const s = (e.currentTarget as HTMLInputElement).value;
										const v = s.trim() === '' ? Number.NaN : Number(s);
										rows = v;
									}}
									disabled={autoRows} />
							</div>
							<div class="space-y-2">
								<div class="flex items-center justify-between gap-2">
									<Label class="text-xs text-muted-foreground" for="cols-enabled">Cols</Label>
									<div class="flex items-center gap-1.5">
										<Switch id="cols-enabled" bind:checked={autoCols} />
										<Label for="cols-enabled" class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Auto</Label>
									</div>
								</div>
								<Input
									type="number"
									inputmode="numeric"
									step="any"
									value={String(cols)}
									oninput={(e) => {
										const s = (e.currentTarget as HTMLInputElement).value;
										const v = s.trim() === '' ? Number.NaN : Number(s);
										cols = v;
									}}
									disabled={autoCols} />
							</div>
						</div>
					</div>

					<div class="space-y-2">
						<Label class="text-sm font-medium">Font</Label>
						<div class="flex flex-wrap items-end gap-3">
							<div class="min-w-fit flex-1">
								<Select.Root type="single" bind:value={fontKey}>
									<Select.Trigger class="w-full">
										{monoFonts.find((f) => f.key === fontKey)?.label ?? 'System'}
									</Select.Trigger>
									<Select.Content>
										{#each monoFonts as f}
											<Select.Item value={f.key}>{f.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>

							<div class="min-w-fit space-y-2">
								<Label class="text-xs text-muted-foreground" for="bold-toggle">Bold</Label>
								<div class="flex h-9 items-center">
									<Switch id="bold-toggle" bind:checked={bold} />
								</div>
							</div>

							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Fill</Label>
								<Input type="color" bind:value={fillColor} class="h-9 w-12 cursor-pointer p-0" />
							</div>

							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Stroke</Label>
								<Input type="color" bind:value={strokeColor} class="h-9 w-12 cursor-pointer p-0" />
							</div>

							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Width</Label>
								<Input
									type="number"
									min={0}
									step={0.1}
									value={String(strokeWidth)}
									oninput={(e) => {
										const s = (e.currentTarget as HTMLInputElement).value;
										strokeWidth = s.trim() === '' ? 0 : Number(s);
									}}
									class="h-9 w-20" />
							</div>

							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">BG</Label>
								<Input type="color" bind:value={bgColor} class="h-9 w-12 cursor-pointer p-0" />
							</div>
						</div>
					</div>

					<div class="space-y-4">
						<Label class="text-sm font-medium">Margin</Label>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Top: {marginTop}</Label>
								<Slider type="single" bind:value={marginTop} min={0} max={5} step={1} />
							</div>
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Right: {marginRight}</Label>
								<Slider type="single" bind:value={marginRight} min={0} max={5} step={1} />
							</div>
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Bottom: {marginBottom}</Label>
								<Slider type="single" bind:value={marginBottom} min={0} max={5} step={1} />
							</div>
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Left: {marginLeft}</Label>
								<Slider type="single" bind:value={marginLeft} min={0} max={5} step={1} />
							</div>
						</div>
					</div>

					{#if showGrid}
						<div class="space-y-4">
							<Label class="text-sm font-medium">Grid Style</Label>
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label class="text-xs text-muted-foreground">Color</Label>
									<Input type="color" bind:value={gridStroke} class="h-9 w-full" />
								</div>
								<div class="space-y-2">
									<Label class="text-xs text-muted-foreground">Line Style</Label>
									<Select.Root type="single" bind:value={gridLineStyle}>
										<Select.Trigger class="w-full">
											{lineStyles.find((s) => s.value === gridLineStyle)?.label ?? 'Solid'}
										</Select.Trigger>
										<Select.Content>
											{#each lineStyles as style}
												<Select.Item value={style.value}>{style.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<div class="space-y-2">
									<Label class="text-xs text-muted-foreground">Width: {gridStrokeWidth}</Label>
									<Slider type="single" bind:value={gridStrokeWidth} min={0.01} max={0.1} step={0.01} />
								</div>
								<div class="space-y-2">
									<Label class="text-xs text-muted-foreground">Opacity: {gridOpacity}</Label>
									<Slider type="single" bind:value={gridOpacity} min={0} max={1} step={0.05} />
								</div>
							</div>
						</div>
					{/if}

					{#if frame}
						<div class="space-y-4">
							<Label class="text-sm font-medium">Frame Style</Label>
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label class="text-xs text-muted-foreground">Color</Label>
									<Input type="color" bind:value={frameStroke} class="h-9 w-full" />
								</div>
								<div class="space-y-2">
									<Label class="text-xs text-muted-foreground">Line Style</Label>
									<Select.Root type="single" bind:value={frameLineStyle}>
										<Select.Trigger class="w-full">
											{lineStyles.find((s) => s.value === frameLineStyle)?.label ?? 'Solid'}
										</Select.Trigger>
										<Select.Content>
											{#each lineStyles as style}
												<Select.Item value={style.value}>{style.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<div class="space-y-2">
									<Label class="text-xs text-muted-foreground">Width: {frameStrokeWidth}</Label>
									<Slider type="single" bind:value={frameStrokeWidth} min={0.01} max={0.2} step={0.01} />
								</div>
							</div>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<div class="mx-auto flex h-full w-fit max-w-2xl flex-col space-y-6 xl:mr-auto xl:ml-0">
			<div class="ascii-surface w-full resize overflow-auto rounded-sm border border-border" style={buildWrapperStyle()}>
				<AsciiArt
					{text}
					{...sizeProps}
					grid={showGrid ? 'ascii-grid' : false}
					frame={frame ? 'ascii-frame' : false}
					cellAspect={autoAspect ? 'auto' : cellAspect}
					margin={frameMargin}
					cellSize={exportOn ? cellSize : undefined} />
			</div>

			{#if exportOn}
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={copySvg} size="sm">
						{copiedSvg ? 'Copied!' : 'Copy SVG'}
					</Button>
					<Button variant="outline" onclick={copyPng} size="sm">
						{copiedPng ? 'Copied!' : 'Copy PNG'}
					</Button>
				</div>

				{#if pngPreviewUrl}
					<div class="space-y-2">
						<Label class="text-sm font-medium text-muted-foreground">PNG Export Preview</Label>
						<div class="overflow-auto rounded-sm border border-border bg-muted/50 p-2">
							<img src={pngPreviewUrl} alt="PNG preview" class="max-w-full" />
						</div>
					</div>
				{/if}

				{#if svgExported}
					<Collapsible.Root class="space-y-2">
						<Collapsible.Trigger class="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
							<ChevronDown class="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
							Exported SVG
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Textarea value={svgExported} readonly rows={6} class="font-mono text-xs" />
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}
			{/if}

			<Card.Root class="flex flex-1 flex-col">
				<Card.Content class="space-y-4">
					<div class="overflow-auto rounded-sm text-sm [&_pre]:p-4 [&_pre]:break-words [&_pre]:whitespace-pre-wrap">
						{@html highlightedInstall}
					</div>
				</Card.Content>
				<Card.Content>
					<div class="group relative overflow-auto rounded-sm text-sm [&_pre]:p-4 [&_pre]:break-words [&_pre]:whitespace-pre-wrap">
						<button
							type="button"
							class="absolute top-2 right-2 rounded border border-border bg-background/80 p-1.5 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
							onclick={copyExampleCode}
							title={copied ? 'Copied' : 'Copy'}>
							{#if copied}
								<Check class="h-4 w-4" />
							{:else}
								<Copy class="h-4 w-4" />
							{/if}
						</button>
						<div bind:this={exampleCodeEl} role="textbox" tabindex="0" aria-label="Example code" onkeydown={onExampleKeydown}>
							{@html highlightedCode}
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>

	<div class="mt-12 flex justify-center">
		<Card.Root class="w-full max-w-6xl">
			<Card.Content class="space-y-4 p-6 sm:p-10">
				<h2 class="text-lg font-semibold">ANSI colors</h2>
				<p class="text-sm text-muted-foreground">
					Text with ANSI SGR escapes is parsed automatically — 16-color (themeable via
					<code>--ansi-fg-*</code>
					CSS variables), 256-color and truecolor.
				</p>
				<div class="mx-auto max-w-sm">
					<AsciiArt text={ansiArt} />
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	{#if data.renderedReadme}
		<div class="mt-12 flex justify-center pb-24">
			<Card.Root class="w-full max-w-6xl">
				<Card.Content class="prose max-w-none p-6 prose-neutral sm:p-10 dark:prose-invert">
					{@html data.renderedReadme}
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>

<style>
	:global(.ascii-grid) {
		stroke: var(--ascii-grid-stroke);
		stroke-width: var(--ascii-grid-stroke-width);
		opacity: var(--ascii-grid-opacity);
		stroke-dasharray: var(--ascii-grid-dasharray);
		fill: none;
	}
	:global(.ascii-frame) {
		stroke: var(--ascii-frame-stroke);
		stroke-width: var(--ascii-frame-stroke-width);
		stroke-dasharray: var(--ascii-frame-dasharray);
		fill: none;
	}
	:global(.ascii-surface svg text),
	:global(.ascii-surface svg tspan) {
		fill: var(--ascii-text-fill, currentColor);
		stroke: var(--ascii-text-stroke, none);
		stroke-width: var(--ascii-text-stroke-width, 0);
		font-weight: var(--ascii-font-weight, 400);
		paint-order: stroke fill;
	}
</style>
