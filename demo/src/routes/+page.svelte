<script lang="ts">
	import { AsciiArt } from 'svelte-asciiart';
	import { defaultTheme, fmt } from 'lovely-ansi-svg';
	import { codeToHtml } from 'shiki';
	import type { PageData } from './$types';
	import { monoFonts, defaultFontKey, boxArt, ansiArt } from '$lib/demo';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Check, Copy } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';

	let { data }: { data: PageData } = $props();

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
				return `${fmt(unit * 3)} ${fmt(unit * 2)}`;
			case 'dotted':
				return `${fmt(unit)} ${fmt(unit)}`;
			case 'dashdot':
				return `${fmt(unit * 3)} ${fmt(unit)} ${fmt(unit)} ${fmt(unit)}`;
			default:
				return 'none';
		}
	}

	let text = $state(boxArt);
	let showGrid = $state(true);
	let frame = $state(true);
	let autoRows = $state(false);
	let autoCols = $state(false);
	let rows = $state<number>(4);
	let cols = $state<number>(22);
	let autoAspect = $state(true);
	let cellAspect = $state(0.6);
	let glyphScale = $state(1);
	let marginTop = $state(1);
	let marginRight = $state(2);
	let marginBottom = $state(1);
	let marginLeft = $state(2);
	let fontKey = $state(defaultFontKey);

	let gridStroke = $state('#87CEFA');
	let gridStrokeWidth = $state(0.03);
	let gridOpacity = $state(0.5);
	let gridLineStyle = $state('solid');
	let frameStroke = $state('#FFB366');
	let frameStrokeWidth = $state(0.05);
	let frameLineStyle = $state('solid');

	// theme: off = component default (VS Code-ish palette, transparent, inherits text color)
	let themeOn = $state(false);
	let fgColor = $state('#111827');
	let bgColor = $state('#f3f4f6');
	let palette = $state([...defaultTheme.palette]);

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
	const theme = $derived(themeOn ? { foreground: fgColor, background: bgColor, palette } : undefined);

	const wrapperStyle = $derived(
		[
			`--ascii-grid-stroke: ${gridStroke}`,
			`--ascii-grid-stroke-width: ${gridStrokeWidth}`,
			`--ascii-grid-opacity: ${gridOpacity}`,
			`--ascii-grid-dasharray: ${gridDashArray}`,
			`--ascii-frame-stroke: ${frameStroke}`,
			`--ascii-frame-stroke-width: ${frameStrokeWidth}`,
			`--ascii-frame-dasharray: ${frameDashArray}`,
			`--ascii-font-family: ${fontFamily}`,
			// the page paints the backdrop the theme assumes
			`background: ${themeOn ? bgColor : '#f3f4f6'}`
		].join('; ')
	);

	function marginLiteral(): string | null {
		if (!(marginTop || marginRight || marginBottom || marginLeft)) return null;
		if (marginTop === marginBottom && marginLeft === marginRight) {
			if (marginTop === marginLeft) return fmt(marginTop);
			return `[${fmt(marginTop)}, ${fmt(marginLeft)}]`;
		}
		return `[${fmt(marginTop)}, ${fmt(marginRight)}, ${fmt(marginBottom)}, ${fmt(marginLeft)}]`;
	}

	const codePreview = $derived.by(() => {
		// escape everything a template literal interprets: \, ` and ${
		const esc = (s: string) => s.replace(/[\\`]|\$\{/g, (m) => '\\' + m);
		const paletteChanged = palette.some((c, i) => c !== defaultTheme.palette[i]);
		const margin = marginLiteral();
		const lines: string[] = [];
		lines.push('<script lang="ts">');
		lines.push("  import { AsciiArt } from 'svelte-asciiart';");
		if (themeOn && !paletteChanged) lines.push("  import { defaultTheme } from 'lovely-ansi-svg';");
		lines.push('');
		lines.push(`  const text = \`${esc(text)}\`;`);
		if (themeOn) {
			if (paletteChanged) {
				lines.push('  const theme = {');
				lines.push(`    foreground: '${fgColor}',`);
				lines.push(`    background: '${bgColor}',`);
				lines.push(`    palette: [${palette.map((c) => `'${c}'`).join(', ')}]`);
				lines.push('  };');
			} else {
				lines.push(`  const theme = { ...defaultTheme, foreground: '${fgColor}', background: '${bgColor}' };`);
			}
		}
		lines.push('<\/script>');
		lines.push('');
		lines.push('<AsciiArt');
		lines.push('  {text}');
		if (rowsProp !== undefined) lines.push(`  rows={${fmt(rowsProp)}}`);
		if (colsProp !== undefined) lines.push(`  cols={${fmt(colsProp)}}`);
		if (margin) lines.push(`  margin={${margin}}`);
		if (showGrid) lines.push('  grid="ascii-grid"');
		if (frame) lines.push('  frame="ascii-frame"');
		if (!autoAspect) lines.push(`  cellAspect={${fmt(cellAspect)}}`);
		if (glyphScale !== 1) lines.push(`  glyphScale={${fmt(glyphScale)}}`);
		if (themeOn) lines.push('  {theme}');
		if (fontKey !== defaultFontKey) lines.push(`  style='--ascii-font-family: ${fontFamily}'`);
		lines.push('/>');
		if (showGrid || frame) {
			lines.push('');
			lines.push('<style>');
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
		return lines.join('\n');
	});

	// debounce the shiki re-highlight off per-keystroke recomputation
	let debouncedPreview = $state<string | null>(null);
	$effect(() => {
		const code = codePreview;
		const timeout = setTimeout(() => (debouncedPreview = code), 150);
		return () => clearTimeout(timeout);
	});
	const highlightedCode = $derived(await codeToHtml(debouncedPreview ?? codePreview, { lang: 'svelte', theme: 'github-dark' }));
	const highlightedInstall = $derived(await codeToHtml('npm install svelte-asciiart', { lang: 'bash', theme: 'github-dark' }));

	let copied = $state(false);
	let copiedTimeout: ReturnType<typeof setTimeout> | undefined;
	async function copyExampleCode() {
		try {
			await navigator.clipboard.writeText(codePreview);
		} catch (e) {
			console.error('Failed to copy code:', e);
			return;
		}
		copied = true;
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => (copied = false), 1000);
	}
</script>

<div class="p-6">
	<div class="mx-auto mb-6 max-w-6xl">
		<h1 class="text-xl font-bold">svelte-asciiart</h1>
		<p class="text-sm text-muted-foreground">Svelte 5 component rendering ASCII/ANSI art as a crisp SVG character grid.</p>
	</div>

	<div class="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 xl:grid-cols-2">
		<Card.Root>
			<Card.Content class="space-y-6">
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label for="ascii-input">ASCII Art</Label>
						<div class="flex gap-1">
							<Button variant="ghost" size="sm" onclick={() => (text = boxArt)}>Box art</Button>
							<Button variant="ghost" size="sm" onclick={() => (text = ansiArt)}>ANSI</Button>
						</div>
					</div>
					<Textarea
						id="ascii-input"
						bind:value={text}
						rows={6}
						class="overflow-x-scroll overflow-y-auto font-mono text-sm whitespace-nowrap" />
				</div>

				<div class="flex flex-wrap gap-4">
					<div class="flex min-w-fit items-center gap-2">
						<Switch id="grid-toggle" bind:checked={showGrid} />
						<Label for="grid-toggle" class="whitespace-nowrap">Grid</Label>
					</div>
					<div class="flex min-w-fit items-center gap-2">
						<Switch id="frame-toggle" bind:checked={frame} />
						<Label for="frame-toggle" class="whitespace-nowrap">Frame</Label>
					</div>
					<div class="flex min-w-fit items-center gap-2">
						<Switch id="theme-toggle" bind:checked={themeOn} />
						<Label for="theme-toggle" class="whitespace-nowrap">Custom theme</Label>
					</div>
				</div>

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
								rows = s.trim() === '' ? Number.NaN : Number(s);
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
								cols = s.trim() === '' ? Number.NaN : Number(s);
							}}
							disabled={autoCols} />
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<Label>Cell aspect: {autoAspect ? 'auto' : cellAspect.toFixed(2)}</Label>
							<div class="flex items-center gap-1.5">
								<Switch id="aspect-auto" bind:checked={autoAspect} />
								<Label for="aspect-auto" class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Auto</Label>
							</div>
						</div>
						<Slider type="single" bind:value={cellAspect} min={0.35} max={1} step={0.01} disabled={autoAspect} />
					</div>
					<div class="space-y-2">
						<Label>Glyph scale: {glyphScale.toFixed(2)}</Label>
						<Slider type="single" bind:value={glyphScale} min={0.5} max={1} step={0.05} />
					</div>
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

				{#if themeOn}
					<div class="space-y-4">
						<Label class="text-sm font-medium">Theme</Label>
						<div class="flex flex-wrap items-end gap-4">
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Foreground</Label>
								<Input type="color" bind:value={fgColor} class="h-9 w-12 cursor-pointer p-0" />
							</div>
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Background</Label>
								<Input type="color" bind:value={bgColor} class="h-9 w-12 cursor-pointer p-0" />
							</div>
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Palette (0–7 normal, 8–15 bright)</Label>
								<div class="grid grid-cols-8 gap-1">
									{#each palette as _, i}
										<input
											type="color"
											bind:value={palette[i]}
											class="h-7 w-7 cursor-pointer rounded-sm border border-border p-0"
											title="palette[{i}]" />
									{/each}
								</div>
							</div>
							<Button variant="ghost" size="sm" onclick={() => (palette = [...defaultTheme.palette])}>Reset palette</Button>
						</div>
					</div>
				{/if}

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

		<div class="space-y-6">
			<div class="ascii-surface w-full resize overflow-auto rounded-sm border border-border" style={wrapperStyle}>
				<AsciiArt
					{text}
					{...sizeProps}
					grid={showGrid ? 'ascii-grid' : false}
					frame={frame ? 'ascii-frame' : false}
					cellAspect={autoAspect ? 'auto' : cellAspect}
					{glyphScale}
					margin={frameMargin}
					{theme} />
			</div>

			<Card.Root>
				<Card.Content class="space-y-4">
					<div class="overflow-auto rounded-sm text-sm [&_pre]:p-4 [&_pre]:break-words [&_pre]:whitespace-pre-wrap">
						{@html highlightedInstall}
					</div>
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
						{@html highlightedCode}
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
</style>
