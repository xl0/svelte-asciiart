<script lang="ts">
	import { AsciiArt } from 'svelte-asciiart';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Check, Copy } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { codeToHtml } from 'shiki';

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
			family:
				'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
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
				return `${unit * 3} ${unit * 2}`;
			case 'dotted':
				return `${unit} ${unit}`;
			case 'dashdot':
				return `${unit * 3} ${unit} ${unit} ${unit}`;
			default:
				return 'none';
		}
	}

	const defaultArt = `+----------+	   _o<
|  Hello   |	  \`\\\,_
|  World!  |	(_)/ (_)
+----------+`;

	let text = $state(defaultArt);
	let frame = $state(true);
	let showGrid = $state(true);
	let rows = $state(4);
	let cols = $state(22);
	let cellAspect = $state(0.6);
	let marginTop = $state(1);
	let marginRight = $state(2);
	let marginBottom = $state(1);
	let marginLeft = $state(2);
	let fontKey = $state<(typeof monoFonts)[number]['key']>(defaultFontKey);
	const fontClass = $derived(`ascii-font-${fontKey}`);

	let gridStroke = $state('#87CEFA');
	let gridStrokeWidth = $state(0.03);
	let gridOpacity = $state(0.5);
	let frameStroke = $state('#FFB366');
	let frameStrokeWidth = $state(0.05);
	let frameLineStyle = $state('solid');
	let gridLineStyle = $state('solid');
	let bindSvg = $state(false);
	let svg = $state<SVGSVGElement | null>(null);
	let copiedSvg = $state(false);
	let copiedSvgTimeout: ReturnType<typeof setTimeout> | undefined;

	const frameMargin = $derived([marginTop, marginRight, marginBottom, marginLeft] as [
		number,
		number,
		number,
		number
	]);

	const gridDashArray = $derived(getDashArray(gridLineStyle, gridStrokeWidth));
	const frameDashArray = $derived(getDashArray(frameLineStyle, frameStrokeWidth));

	function buildMarginProp(): string {
		const hasMargin = marginTop > 0 || marginRight > 0 || marginBottom > 0 || marginLeft > 0;
		if (!hasMargin) return '';
		if (marginTop === marginBottom && marginLeft === marginRight) {
			if (marginTop === marginLeft) return `\n  margin={${marginTop}}`;
			return `\n  margin={[${marginTop}, ${marginLeft}]}`;
		}
		return `\n  margin={[${marginTop}, ${marginRight}, ${marginBottom}, ${marginLeft}]}`;
	}

	function buildClassProp(): string {
		if (fontKey === defaultFontKey) return '';
		return `\n  class="ascii-font-${fontKey}"`;
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
		return props.join('; ');
	}

	function buildFontCss(): string {
		if (fontKey === defaultFontKey) return '';
		const family = monoFonts.find((f) => f.key === fontKey)?.family;
		if (!family) return '';
		return [`.ascii-font-${fontKey} {`, `  --ascii-font-family: ${family};`, `}`].join('\n');
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
		lines.push('<script>');
		if (bindSvg) {
			lines.push('  let svg = $state<SVGSVGElement>();');
		}
		lines.push(`  const text = \`${escapedText}\`;`);
		lines.push('</\\/script>');
		lines.push('');
		lines.push('<AsciiArt');
		if (bindSvg) lines.push('  bind:svg');
		lines.push('  {text}');
		lines.push(`  rows={${rows}}`);
		lines.push(`  cols={${cols}}`);
		if (cellAspect !== 0.6) lines.push(`  cellAspect={${cellAspect}}`);
		if (showGrid) lines.push('  grid');
		if (frame) lines.push('  frame');
		if (marginProp) lines.push(marginProp.slice(1));
		if (classProp) lines.push(classProp.slice(1));
		if (showGrid) lines.push('  gridClass="ascii-grid"');
		if (frame) lines.push('  frameClass="ascii-frame"');
		lines.push('/>');
		if (bindSvg) {
			lines.push('');
			lines.push('{#if svg}');
			lines.push(
				'  <button type="button" on:click={() => navigator.clipboard.writeText(svg.outerHTML)}>Copy SVG</button>'
			);
			lines.push('{/if}');
		}
		lines.push('');
		if (showGrid || frame || fontCss) {
			lines.push('<style>');
			if (fontCss) lines.push(`  ${fontCss.replaceAll('\n', '\n  ')}`);
			if (showGrid) {
				lines.push('  :global(.ascii-grid) {');
				lines.push(`    stroke: ${gridStroke};`);
				lines.push(`    stroke-width: ${gridStrokeWidth};`);
				lines.push(`    opacity: ${gridOpacity};`);
				if (gridDashArray !== 'none') lines.push(`    stroke-dasharray: ${gridDashArray};`);
				lines.push('  }');
			}
			if (frame) {
				lines.push('  :global(.ascii-frame) {');
				lines.push(`    stroke: ${frameStroke};`);
				lines.push(`    stroke-width: ${frameStrokeWidth};`);
				if (frameDashArray !== 'none') lines.push(`    stroke-dasharray: ${frameDashArray};`);
				lines.push('  }');
			}
			lines.push('</style>');
		}
		return lines.join('\n').trimEnd();
	});

	let highlightedCode = $state('');
	let highlightedInstall = $state('');

	$effect(() => {
		const code = codePreview;
		codeToHtml(code, { lang: 'svelte', theme: 'github-dark' }).then((html) => {
			highlightedCode = html;
		});
		codeToHtml('npm install svelte-asciiart', { lang: 'bash', theme: 'github-dark' }).then(
			(html) => {
				highlightedInstall = html;
			}
		);
	});

	let exampleCodeEl: HTMLDivElement | null = null;
	let copied = $state(false);
	let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

	async function copySvg() {
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
		copiedSvg = true;
		if (copiedSvgTimeout) clearTimeout(copiedSvgTimeout);
		copiedSvgTimeout = setTimeout(() => {
			copiedSvg = false;
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

<div class="mx-auto max-w-6xl p-6">
	<div class="mb-6 flex items-center justify-between gap-4">
		<h1 class="text-3xl font-bold">AsciiArt Demo</h1>
		<Button variant="outline" href="https://github.com/xl0/svelte-asciiart">GitHub</Button>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Content class="space-y-6">
				<div class="space-y-2">
					<Label for="ascii-input">ASCII Art</Label>
					<Textarea id="ascii-input" bind:value={text} rows={6} class="font-mono text-sm" />
				</div>

				<div class="grid grid-cols-4 gap-4">
					<div class="flex items-center gap-2">
						<Switch id="grid-toggle" bind:checked={showGrid} />
						<Label for="grid-toggle">Show Grid</Label>
					</div>
					<div class="flex items-center gap-2">
						<Switch id="frame-toggle" bind:checked={frame} />
						<Label for="frame-toggle">Frame</Label>
					</div>
					<div class="flex items-center gap-2">
						<Switch id="bind-svg-toggle" bind:checked={bindSvg} />
						<Label for="bind-svg-toggle">Bind SVG</Label>
					</div>
					<div class="flex flex-wrap gap-2">
						{#if bindSvg}
							<Button variant="outline" onclick={copySvg} disabled={!svg}>
								{copiedSvg ? 'Copied' : 'Copy SVG'}
							</Button>
						{/if}
					</div>
				</div>

				<div class="space-y-2">
					<Label>Cell aspect: {cellAspect.toFixed(2)}</Label>
					<Slider type="single" bind:value={cellAspect} min={0.35} max={1} step={0.01} />
				</div>

				<div class="space-y-2">
					<Label class="text-sm font-medium">Font</Label>
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

				<div class="space-y-4">
					<div class="space-y-2">
						<Label>Rows: {rows}</Label>
						<Slider type="single" bind:value={rows} min={1} max={20} step={1} />
					</div>
					<div class="space-y-2">
						<Label>Cols: {cols}</Label>
						<Slider type="single" bind:value={cols} min={1} max={30} step={1} />
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
								<Slider
									type="single"
									bind:value={gridStrokeWidth}
									min={0.01}
									max={0.1}
									step={0.01}
								/>
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
								<Slider
									type="single"
									bind:value={frameStrokeWidth}
									min={0.01}
									max={0.2}
									step={0.01}
								/>
							</div>
						</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<div class="space-y-6">
			<div
				class="w-full resize overflow-auto rounded-sm border border-border bg-card"
				style={buildWrapperStyle()}
			>
				<AsciiArt
					bind:svg
					{text}
					{rows}
					{cols}
					grid={showGrid}
					{cellAspect}
					{frame}
					margin={frameMargin}
					gridClass={showGrid ? 'ascii-grid' : ''}
					frameClass={frame ? 'ascii-frame' : ''}
					class={fontKey !== 'system' ? `ascii-font-${fontKey}` : ''}
				/>
			</div>

			<Card.Root>
				<Card.Content>
					<div
						class="overflow-auto rounded-sm text-sm [&_pre]:p-4 [&_pre]:break-words [&_pre]:whitespace-pre-wrap"
					>
						{@html highlightedInstall}
					</div>
				</Card.Content>
				<Card.Content>
					<div
						class="group relative overflow-auto rounded-sm text-sm [&_pre]:p-4 [&_pre]:break-words [&_pre]:whitespace-pre-wrap"
					>
						<button
							type="button"
							class="absolute top-2 right-2 rounded border border-border bg-background/80 p-1.5 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
							onclick={copyExampleCode}
							title={copied ? 'Copied' : 'Copy'}
						>
							{#if copied}
								<Check class="h-4 w-4" />
							{:else}
								<Copy class="h-4 w-4" />
							{/if}
						</button>
						<div
							bind:this={exampleCodeEl}
							role="textbox"
							tabindex="0"
							aria-label="Example code"
							onkeydown={onExampleKeydown}
						>
							{@html highlightedCode}
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
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
</style>
