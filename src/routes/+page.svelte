<script lang="ts">
	import { AsciiArt, exportSvg, exportSvgToPng } from 'svelte-asciiart';
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

	const monoFonts = [
		{
			key: 'system',
			label: 'System',
			family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
		},
		{
			key: 'jetbrains',
			label: 'JetBrains Mono',
			family: '"JetBrains Mono", ui-monospace, monospace'
		},
		{ key: 'fira', label: 'Fira Code', family: '"Fira Code", ui-monospace, monospace' },
		{
			key: 'source',
			label: 'Source Code Pro',
			family: '"Source Code Pro", ui-monospace, monospace'
		},
		{ key: 'plex', label: 'IBM Plex Mono', family: '"IBM Plex Mono", ui-monospace, monospace' },
		{ key: 'courier', label: 'Courier New', family: '"Courier New", Courier, monospace' },
		{ key: 'consolas', label: 'Consolas', family: 'Consolas, "Liberation Mono", monospace' },
		{ key: 'menlo', label: 'Menlo', family: 'Menlo, Monaco, monospace' },
		{ key: 'monaco', label: 'Monaco', family: 'Monaco, monospace' }
	] as const;

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

	function fmt(n: number, digits = 3): string {
		if (!Number.isFinite(n)) return String(n);
		if (Math.abs(n) < 1e-12) return '0';
		const s = n.toFixed(digits);
		return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
	}

	const defaultArt = `+----------+	   _o<
|  Hello   |	  \`\\\,_
|  World!  |	(_)/ (_)
+----------+`;

	let text = $state(defaultArt);
	let frame = $state(true);
	let showGrid = $state(true);
	let autoRows = $state(false);
	let autoCols = $state(false);
	let rows = $state<number>(4);
	let cols = $state<number>(22);
	let cellAspect = $state(0.6);
	let marginTop = $state(1);
	let marginRight = $state(2);
	let marginBottom = $state(1);
	let marginLeft = $state(2);
	let fontKey = $state<(typeof monoFonts)[number]['key']>(defaultFontKey);

	let gridStroke = $state('#87CEFA');
	let gridStrokeWidth = $state(0.03);
	let gridOpacity = $state(0.5);
	let frameStroke = $state('#FFB366');
	let frameStrokeWidth = $state(0.05);
	let frameLineStyle = $state('solid');
	let gridLineStyle = $state('solid');
	let bindSvg = $state(false);
	let svg = $state<SVGSVGElement | null>(null);
	let copiedSvgRaw = $state(false);
	let copiedSvgStyles = $state(false);
	let copiedPng = $state(false);
	let copiedSvgRawTimeout: ReturnType<typeof setTimeout> | undefined;
	let copiedSvgStylesTimeout: ReturnType<typeof setTimeout> | undefined;
	let copiedPngTimeout: ReturnType<typeof setTimeout> | undefined;
	let bgColor = $state('#f3f4f6');
	let fillColor = $state('#111827');
	let strokeColor = $state('#111827');
	let strokeWidth = $state(0);
	let bold = $state(false);
	let showExport = $state(false);
	let baseSize = $state(50);
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

	// Auto-generate PNG preview when showExport is on and SVG or styles change (debounced)
	let pngPreviewUrl = $state<string | null>(null);
	$effect(() => {
		if (!svg || !showExport) {
			if (pngPreviewUrl) URL.revokeObjectURL(pngPreviewUrl);
			pngPreviewUrl = null;
			return;
		}
		// Touch reactive deps
		void [
			text,
			showGrid,
			frame,
			cellAspect,
			frameMargin,
			gridStroke,
			gridStrokeWidth,
			gridOpacity,
			frameStroke,
			frameStrokeWidth,
			gridDashArray,
			frameDashArray,
			bgColor,
			fillColor,
			strokeColor,
			strokeWidth,
			bold,
			fontFamily,
			rowsProp,
			colsProp,
			baseSize
		];

		// Capture values before timeout
		const svgEl = svg;
		const bg = bgColor;

		const timeout = setTimeout(async () => {
			try {
				const blob = await exportSvgToPng(svgEl, { includeBackground: true, backgroundColor: bg, output: 'blob' });
				if (pngPreviewUrl) URL.revokeObjectURL(pngPreviewUrl);
				pngPreviewUrl = URL.createObjectURL(blob);
			} catch (e) {
				console.error('Failed to generate PNG:', e);
				if (pngPreviewUrl) URL.revokeObjectURL(pngPreviewUrl);
				pngPreviewUrl = null;
			}
		}, 200);

		return () => clearTimeout(timeout);
	});

	// Derived SVG exports for display
	const svgRaw = $derived.by(() => {
		if (!svg || !showExport) return null;
		return svg.outerHTML;
	});

	const svgStyled = $derived.by(() => {
		if (!svg || !showExport) return null;
		return exportSvg(svg, { includeBackground: true, backgroundColor: bgColor });
	});

	function buildMarginProp(): string {
		const hasMargin = marginTop > 0 || marginRight > 0 || marginBottom > 0 || marginLeft > 0;
		if (!hasMargin) return '';
		if (marginTop === marginBottom && marginLeft === marginRight) {
			if (marginTop === marginLeft) return `\n  margin={${fmt(marginTop)}}`;
			return `\n  margin={[${fmt(marginTop)}, ${fmt(marginLeft)}]}`;
		}
		return `\n  margin={[${fmt(marginTop)}, ${fmt(marginRight)}, ${fmt(marginBottom)}, ${fmt(marginLeft)}]}`;
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
		let gfFamily = '';
		switch (fontKey) {
			case 'jetbrains':
				gfFamily = 'JetBrains+Mono:wght@400;600';
				break;
			case 'fira':
				gfFamily = 'Fira+Code:wght@400;600';
				break;
			case 'source':
				gfFamily = 'Source+Code+Pro:wght@400;600';
				break;
			case 'plex':
				gfFamily = 'IBM+Plex+Mono:wght@400;600';
				break;
		}
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

	let codePreview = $derived.by(() => {
		const escapedText = text.replace(/`/g, '\\`');
		const marginProp = buildMarginProp();
		const classProp = buildClassProp();
		const fontCss = buildFontCss();
		const fontHead = buildFontHead();
		const lines: string[] = [];
		if (fontHead) {
			lines.push(fontHead);
			lines.push('');
		}
		lines.push('<script lang="ts">');
		if (bindSvg && showExport) {
			lines.push("  import { AsciiArt, exportSvg, exportSvgToPng } from 'svelte-asciiart';");
		} else {
			lines.push("  import { AsciiArt } from 'svelte-asciiart';");
		}
		if (bindSvg) {
			lines.push('  let svg = $state<SVGSVGElement>();');
		}
		lines.push(`  const text = \`${escapedText}\`;`);
		lines.push('<\/script>');
		lines.push('');
		lines.push('<AsciiArt');
		if (bindSvg) lines.push('  bind:svg');
		lines.push('  {text}');
		if (rowsProp !== undefined) lines.push(`  rows={${fmt(rowsProp)}}`);
		if (colsProp !== undefined) lines.push(`  cols={${fmt(colsProp)}}`);
		if (cellAspect !== 0.6) lines.push(`  cellAspect={${fmt(cellAspect)}}`);
		if (showGrid) lines.push('  grid');
		if (frame) lines.push('  frame');
		if (marginProp) lines.push(marginProp.slice(1));
		if (classProp) lines.push(classProp.slice(1));
		if (showGrid) lines.push('  gridClass="ascii-grid"');
		if (frame) lines.push('  frameClass="ascii-frame"');
		if (showExport && baseSize !== 50) lines.push(`  baseSize={${baseSize}}`);
		lines.push('/>');
		if (bindSvg && !showExport) {
			lines.push('');
			lines.push('{#if svg}');
			lines.push('  <button type="button" onclick={() => navigator.clipboard.writeText(svg.outerHTML)}>Copy SVG</button>');
			lines.push('{/if}');
		}
		if (bindSvg && showExport) {
			lines.push('');
			lines.push('{#if svg}');
			lines.push('  <button type="button" onclick={() => navigator.clipboard.writeText(svg.outerHTML)}>Copy SVG</button>');
			lines.push('  <button type="button" onclick={async () => {');
			lines.push('    const markup = exportSvg(svg, { includeBackground: true, backgroundColor: "#f3f4f6" });');
			lines.push('    await navigator.clipboard.writeText(markup);');
			lines.push('  }}>Copy SVG + Styles</button>');
			lines.push('  <button type="button" onclick={async () => {');
			lines.push('    const dataUrl = await exportSvgToPng(svg, { includeBackground: true, backgroundColor: "#f3f4f6" });');
			lines.push('    const response = await fetch(dataUrl);');
			lines.push('    const blob = await response.blob();');
			lines.push('    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);');
			lines.push('  }}>Copy PNG</button>');
			lines.push('{/if}');
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

	let highlightedCode = $derived(await codeToHtml(codePreview, { lang: 'svelte', theme: 'github-dark' }));
	let highlightedInstall = $derived(await codeToHtml('npm install svelte-asciiart', { lang: 'bash', theme: 'github-dark' }));

	let exampleCodeEl: HTMLDivElement | null = null;
	let copied = $state(false);
	let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

	async function copySvgRaw() {
		if (!svg) return;
		const markup = svg.outerHTML;
		try {
			await navigator.clipboard.writeText(markup);
		} catch {
			const ta = document.createElement('textarea');
			ta.value = markup;
			ta.style.position = 'fixed';
			ta.style.left = '-99999px';
			document.body.append(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
		}
		copiedSvgRaw = true;
		if (copiedSvgRawTimeout) clearTimeout(copiedSvgRawTimeout);
		copiedSvgRawTimeout = setTimeout(() => {
			copiedSvgRaw = false;
		}, 800);
	}

	async function copySvgWithStyles() {
		if (!svg) return;
		const markup = exportSvg(svg, { includeBackground: true, backgroundColor: bgColor });
		try {
			await navigator.clipboard.writeText(markup);
		} catch {
			const ta = document.createElement('textarea');
			ta.value = markup;
			ta.style.position = 'fixed';
			ta.style.left = '-99999px';
			document.body.append(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
		}
		copiedSvgStyles = true;
		if (copiedSvgStylesTimeout) clearTimeout(copiedSvgStylesTimeout);
		copiedSvgStylesTimeout = setTimeout(() => {
			copiedSvgStyles = false;
		}, 800);
	}

	async function copyPng() {
		if (!svg) return;
		try {
			const blob = await exportSvgToPng(svg, { includeBackground: true, backgroundColor: bgColor, output: 'blob' });
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
		} catch {
			const ta = document.createElement('textarea');
			ta.value = codePreview;
			ta.style.position = 'fixed';
			ta.style.left = '-99999px';
			document.body.append(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
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
							<Switch id="bind-svg-toggle" bind:checked={bindSvg} />
							<Label for="bind-svg-toggle" class="whitespace-nowrap">Bind SVG</Label>
						</div>
						{#if bindSvg}
							<div class="flex min-w-fit items-center gap-2">
								<Switch id="export-toggle" bind:checked={showExport} />
								<Label for="export-toggle" class="whitespace-nowrap">Demo Export</Label>
							</div>
						{/if}
					</div>

					<div class="flex items-end gap-4 w-full">
						<div class="flex-1 space-y-2">
							<Label>Cell aspect: {cellAspect.toFixed(2)}</Label>
							<Slider type="single" bind:value={cellAspect} min={0.35} max={1} step={0.01} />
						</div>

						{#if showExport}
							<div class="w-fit space-y-2">
								<Label for="base-size" class="text-xs whitespace-nowrap text-muted-foreground">Base Size</Label>
								<Input
									id="base-size"
									type="number"
									min={10}
									max={200}
									value={String(baseSize)}
									oninput={(e) => {
										const v = Number((e.currentTarget as HTMLInputElement).value);
										if (Number.isFinite(v) && v > 0) baseSize = v;
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
					bind:svg
					{text}
					{...sizeProps}
					grid={showGrid}
					{cellAspect}
					{frame}
					margin={frameMargin}
					gridClass={showGrid ? 'ascii-grid' : ''}
					frameClass={frame ? 'ascii-frame' : ''}
					baseSize={showExport ? baseSize : undefined} />
			</div>

			{#if bindSvg}
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={copySvgRaw} disabled={!svg} size="sm">
						{copiedSvgRaw ? 'Copied!' : 'Copy SVG'}
					</Button>
					{#if showExport}
						<Button variant="outline" onclick={copySvgWithStyles} disabled={!svg} size="sm">
							{copiedSvgStyles ? 'Copied!' : 'Copy SVG + Styles'}
						</Button>
						<Button variant="outline" onclick={copyPng} size="sm">
							{copiedPng ? 'Copied!' : 'Copy PNG'}
						</Button>
					{/if}
				</div>
			{/if}

			{#if showExport}
				{#if pngPreviewUrl}
					<div class="space-y-2">
						<Label class="text-sm font-medium text-muted-foreground">PNG Export Preview</Label>
						<div class="overflow-auto rounded-sm border border-border bg-muted/50 p-2">
							<img src={pngPreviewUrl} alt="PNG preview" class="max-w-full" />
						</div>
					</div>
				{/if}

				{#if svgRaw}
					<Collapsible.Root class="space-y-2">
						<Collapsible.Trigger class="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
							<ChevronDown class="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
							Raw SVG
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Textarea value={svgRaw} readonly rows={6} class="font-mono text-xs" />
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}

				{#if svgStyled}
					<Collapsible.Root class="space-y-2">
						<Collapsible.Trigger class="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
							<ChevronDown class="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
							SVG with Embedded Styles
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Textarea value={svgStyled} readonly rows={6} class="font-mono text-xs" />
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
