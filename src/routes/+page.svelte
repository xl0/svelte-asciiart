<script lang="ts">
	import { AsciiArt } from 'svelte-asciiart';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { codeToHtml } from 'shiki';

	const lineStyles = [
		{ value: 'solid', label: 'Solid ———' },
		{ value: 'dashed', label: 'Dashed - - -' },
		{ value: 'dotted', label: 'Dotted · · ·' },
		{ value: 'dashdot', label: 'Dash-dot -·-·-' }
	] as const;

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

	const defaultArt = `+----------+
|  Hello   |
|  World!  |
+----------+`;

	let text = $state(defaultArt);
	let frame = $state(true);
	let showGrid = $state(true);
	let rows = $state(4);
	let cols = $state(12);
	let marginTop = $state(1);
	let marginRight = $state(2);
	let marginBottom = $state(1);
	let marginLeft = $state(2);

	let gridStroke = $state('#87CEFA');
	let gridStrokeWidth = $state(0.03);
	let gridOpacity = $state(0.5);
	let frameStroke = $state('#FFB366');
	let frameStrokeWidth = $state(0.05);
	let frameLineStyle = $state('solid');
	let gridLineStyle = $state('solid');

	const frameMargin = $derived([marginTop, marginRight, marginBottom, marginLeft] as [
		number,
		number,
		number,
		number
	]);

	const gridDashArray = $derived(getDashArray(gridLineStyle, gridStrokeWidth));
	const frameDashArray = $derived(getDashArray(frameLineStyle, frameStrokeWidth));

	const gridStyle = $derived(
		showGrid
			? `stroke: ${gridStroke}; stroke-width: ${gridStrokeWidth}; opacity: ${gridOpacity}; stroke-dasharray: ${gridDashArray};`
			: 'display: none;'
	);
	const frameStyle = $derived(
		`stroke: ${frameStroke}; stroke-width: ${frameStrokeWidth}; stroke-dasharray: ${frameDashArray};`
	);

	function buildGridCss(): string {
		const props: string[] = [];
		props.push(`stroke: ${gridStroke}`);
		props.push(`stroke-width: ${gridStrokeWidth}`);
		props.push(`opacity: ${gridOpacity}`);
		if (gridDashArray !== 'none') props.push(`stroke-dasharray: ${gridDashArray}`);
		if (!showGrid) props.push('display: none');
		return props.join(';\n\t\t');
	}

	function buildFrameCss(): string {
		const props: string[] = [];
		props.push(`stroke: ${frameStroke}`);
		props.push(`stroke-width: ${frameStrokeWidth}`);
		if (frameDashArray !== 'none') props.push(`stroke-dasharray: ${frameDashArray}`);
		return props.join(';\n\t\t');
	}

	function buildMarginProp(): string {
		const hasMargin = marginTop > 0 || marginRight > 0 || marginBottom > 0 || marginLeft > 0;
		if (!hasMargin) return '';
		if (marginTop === marginBottom && marginLeft === marginRight) {
			if (marginTop === marginLeft) return `\n  frameMargin={${marginTop}}`;
			return `\n  frameMargin={[${marginTop}, ${marginLeft}]}`;
		}
		return `\n  frameMargin={[${marginTop}, ${marginRight}, ${marginBottom}, ${marginLeft}]}`;
	}

	let codePreview = $derived.by(() => {
		const escapedText = text.replace(/`/g, '\\`');
		const marginProp = buildMarginProp();
		const lines: string[] = [];
		lines.push('<script>');
		lines.push(`  const text = \`${escapedText}\`;`);
		lines.push('</\\/script>');
		lines.push('');
		lines.push('<AsciiArt');
		lines.push('  {text}');
		lines.push(`  rows={${rows}}`);
		lines.push(`  cols={${cols}}`);
		lines.push('  grid');
		if (frame) lines.push('  frame');
		if (marginProp) lines.push(marginProp.slice(1));
		if (showGrid) lines.push('  gridClass="ascii-grid"');
		if (frame) lines.push('  frameClass="ascii-frame"');
		lines.push('/>');
		lines.push('');
		if (showGrid || frame) {
			lines.push('<style>');
			if (showGrid) {
				lines.push('  .ascii-grid {');
				lines.push(`    ${buildGridCss()};`);
				lines.push('  }');
			}
			if (frame) {
				lines.push('  .ascii-frame {');
				lines.push(`    ${buildFrameCss()};`);
				lines.push('  }');
			}
			lines.push('</style>');
		}
		return lines.join('\n').trimEnd();
	});

	let highlightedCode = $state('');

	$effect(() => {
		const code = codePreview;
		codeToHtml(code, { lang: 'svelte', theme: 'github-dark' }).then((html) => {
			highlightedCode = html;
		});
	});
</script>

<div class="mx-auto max-w-6xl p-8">
	<h1 class="mb-8 text-3xl font-bold">AsciiArt Demo</h1>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Controls</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-6">
				<div class="space-y-2">
					<Label for="ascii-input">ASCII Art</Label>
					<Textarea id="ascii-input" bind:value={text} rows={6} class="font-mono text-sm" />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="flex items-center gap-2">
						<Switch id="grid-toggle" bind:checked={showGrid} />
						<Label for="grid-toggle">Show Grid</Label>
					</div>
					<div class="flex items-center gap-2">
						<Switch id="frame-toggle" bind:checked={frame} />
						<Label for="frame-toggle">Frame</Label>
					</div>
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

		<div class="space-y-8">
			<Card.Root>
				<Card.Header>
					<Card.Title>Preview</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="aspect-square w-full rounded border border-border bg-card">
						<AsciiArt {text} {rows} {cols} grid {frame} {frameMargin} {gridStyle} {frameStyle} />
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Code</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="overflow-x-auto rounded text-sm [&_pre]:p-4">
						{@html highlightedCode}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
