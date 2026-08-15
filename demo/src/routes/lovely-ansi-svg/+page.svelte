<script lang="ts">
	import { defaultTheme, exportSvg, layout, parseAnsi, render } from 'lovely-ansi-svg';
	import type { PageData } from './$types';
	import { ansiArt, monoFonts, defaultFontKey } from '$lib/demo';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Check, Copy } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';

	let { data }: { data: PageData } = $props();

	const E = '\x1b';

	// ---- feature gallery (static) ----
	const blocks = (codes: number[], glyph = '██') => codes.map((c) => `${E}[${c}m${glyph}`).join('') + `${E}[0m`;
	const ramp256 = (from: number, count: number) => Array.from({ length: count }, (_, i) => `${E}[38;5;${from + i}m█`).join('') + `${E}[0m`;
	const rainbow = (count: number) =>
		Array.from({ length: count }, (_, i) => {
			const h = (i / count) * 360;
			const f = (n: number) => {
				const k = (n + h / 30) % 12;
				return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
			};
			return `${E}[38;2;${f(0)};${f(8)};${f(4)}m█`;
		}).join('') + `${E}[0m`;

	const samples: { label: string; text: string }[] = [
		{ label: '16 colors', text: `${blocks([30, 31, 32, 33, 34, 35, 36, 37])}\n${blocks([90, 91, 92, 93, 94, 95, 96, 97])}` },
		{ label: '256-color', text: `${ramp256(196, 6)}${ramp256(46, 6)}${ramp256(21, 6)}\n${ramp256(232, 18)}` },
		{ label: 'Truecolor', text: `${rainbow(18)}\n${rainbow(18)}` },
		{
			label: 'Attributes',
			text: [`${E}[1mbold${E}[0m ${E}[2mdim${E}[0m ${E}[3mitalic${E}[0m`, `${E}[4munderline${E}[0m ${E}[9mstrike${E}[0m`].join('\n')
		},
		{
			label: 'Backgrounds & inverse',
			text: [`${E}[43;30m warn ${E}[0m ${E}[41;97m error ${E}[0m`, `${E}[7m inverse ${E}[0m ${E}[2;7m dim inverse ${E}[0m`].join('\n')
		},
		{ label: 'Wide chars & clusters', text: '日本語 👍 👨‍👩‍👧 é\n|吾輩は猫である|' },
		{
			label: 'Custom-drawn box glyphs',
			text: ['┏━┳━┓╔═╦═╗╭─┬─╮', '┃ ┣━┫╠═╬═╣├─┼─┤', '┗━┻━┛╚═╩═╝╰─┴─╯', '▁▂▃▄▅▆▇█ ░▒▓ ▖▚▜'].join('\n')
		},
		{ label: 'Tabs (8-column stops)', text: 'name\tqty\nspam\t42\neggs\t7' },
		{
			label: 'Dim vs backdrop',
			text: [`${E}[31mnormal red${E}[0m`, `${E}[2;31mdim red${E}[0m`, `${E}[2;31;44mdim on blue${E}[0m`].join('\n')
		}
	];

	// escapes in printable form, same as the playground textarea — a gallery
	// sample pastes straight into it
	const showEsc = (s: string) => s.replaceAll('\x1b', '\\x1b');

	const gallery = samples.map((s) => {
		const lit = showEsc(s.text);
		return {
			...s,
			svg: exportSvg(s.text, { background: '#f8f8f8', margin: [0.5, 1], cellSize: 20 }),
			literal: lit.length > 140 ? lit.slice(0, 140) + ' …' : lit
		};
	});

	// ---- pipeline playground ----
	// the textarea holds escapes in printable form (\x1b) so they render and
	// can be edited; raw ESC bytes (e.g. pasted from a terminal) are converted
	let text = $state(showEsc(ansiArt));
	let frame = $state(false);
	let bgOn = $state(true);
	let bgColor = $state('#1e1e1e');
	let fgColor = $state('#d4d4d4');
	let fontKey = $state(defaultFontKey);

	$effect(() => {
		if (text.includes('\x1b')) text = showEsc(text);
	});

	let debouncedText = $state(showEsc(ansiArt));
	$effect(() => {
		const t = text;
		const timeout = setTimeout(() => (debouncedText = t), 150);
		return () => clearTimeout(timeout);
	});
	// \x1b and \033 read as ESC in the pipeline input (no \e — it would eat
	// ordinary backslash text like C:\example)
	const rawText = $derived(debouncedText.replace(/\\x1b|\\033/g, '\x1b'));

	const fontFamily = $derived(monoFonts.find((f) => f.key === fontKey)?.family ?? monoFonts[0].family);

	// with a painted background the inline-embedded svg must not inherit the
	// page's text color — set the default foreground explicitly
	const svgString = $derived(
		exportSvg(rawText, {
			margin: 1,
			frame,
			fontFamily,
			...(bgOn ? { background: bgColor, theme: { ...defaultTheme, foreground: fgColor } } : {})
		})
	);
	const parsed = $derived(parseAnsi(rawText));
	const laid = $derived(layout(parsed));
	const model = $derived(render(laid, { margin: 1, frame }));

	type View = 'rendered' | 'svg' | 'parsed' | 'layout' | 'model';
	const views: { key: View; label: string }[] = [
		{ key: 'rendered', label: 'Rendered' },
		{ key: 'svg', label: 'SVG' },
		{ key: 'parsed', label: 'parseAnsi →' },
		{ key: 'layout', label: 'layout →' },
		{ key: 'model', label: 'render →' }
	];
	let view = $state<View>('rendered');

	let copied = $state(false);
	let copiedTimeout: ReturnType<typeof setTimeout> | undefined;
	async function copySvg() {
		try {
			await navigator.clipboard.writeText(svgString);
		} catch (e) {
			console.error('Failed to copy SVG:', e);
			return;
		}
		copied = true;
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => (copied = false), 1000);
	}
</script>

<div class="p-6">
	<div class="mx-auto mb-6 max-w-6xl">
		<h1 class="text-xl font-bold">lovely-ansi-svg</h1>
		<p class="text-sm text-muted-foreground">
			Framework-agnostic ANSI/ASCII → SVG core. No DOM — everything below is a string from
			<code class="font-mono">exportSvg(text, options)</code>
			.
		</p>
	</div>

	<div class="mx-auto max-w-6xl space-y-6">
		<Card.Root>
			<Card.Content class="space-y-4">
				<Label class="text-sm font-medium">ANSI feature gallery</Label>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{#each gallery as g}
						<div class="space-y-2 rounded-sm border border-border p-3">
							<div class="text-xs font-medium text-muted-foreground">{g.label}</div>
							<div class="gallery-svg overflow-x-auto">{@html g.svg}</div>
							<pre
								class="overflow-x-auto font-mono text-[10px] leading-snug whitespace-pre-wrap break-all text-muted-foreground">{g.literal}</pre>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="space-y-4">
				<Label class="text-sm font-medium">Pipeline playground</Label>
				<p class="text-sm text-muted-foreground">
					<code class="font-mono">parseAnsi</code>
					→
					<code class="font-mono">layout</code>
					→
					<code class="font-mono">render</code>
					→
					<code class="font-mono">exportSvg</code>
					— inspect every stage.
				</p>

				<Textarea bind:value={text} rows={6} class="overflow-x-scroll font-mono text-sm whitespace-nowrap" />
				<p class="text-xs text-muted-foreground">
					Escapes are written as <code class="font-mono">\x1b</code>
					(
					<code class="font-mono">\033</code>
					works too); pasted raw ESC bytes are converted.
				</p>

				<div class="flex flex-wrap items-end gap-4">
					<div class="flex min-w-fit items-center gap-2 pb-2">
						<Switch id="frame-toggle" bind:checked={frame} />
						<Label for="frame-toggle">Frame</Label>
					</div>
					<div class="flex min-w-fit items-center gap-2 pb-2">
						<Switch id="bg-toggle" bind:checked={bgOn} />
						<Label for="bg-toggle">Background</Label>
					</div>
					{#if bgOn}
						<div class="space-y-2">
							<Label class="text-xs text-muted-foreground">Color</Label>
							<Input type="color" bind:value={bgColor} class="h-9 w-12 cursor-pointer p-0" />
						</div>
						<div class="space-y-2">
							<Label class="text-xs text-muted-foreground">Foreground</Label>
							<Input type="color" bind:value={fgColor} class="h-9 w-12 cursor-pointer p-0" />
						</div>
					{/if}
					<div class="min-w-40 space-y-2">
						<Label class="text-xs text-muted-foreground">Font</Label>
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
				</div>

				<div class="flex flex-wrap gap-1">
					{#each views as v}
						<Button variant={view === v.key ? 'secondary' : 'ghost'} size="sm" class="font-mono" onclick={() => (view = v.key)}>
							{v.label}
						</Button>
					{/each}
				</div>

				{#if view === 'rendered'}
					<div class="gallery-svg overflow-auto rounded-sm border border-border p-2">{@html svgString}</div>
				{:else if view === 'svg'}
					<div class="relative">
						<button
							type="button"
							class="absolute top-2 right-2 rounded border border-border bg-background/80 p-1.5"
							onclick={copySvg}
							title={copied ? 'Copied' : 'Copy'}>
							{#if copied}
								<Check class="h-4 w-4" />
							{:else}
								<Copy class="h-4 w-4" />
							{/if}
						</button>
						<pre class="max-h-96 overflow-auto rounded-sm bg-muted p-4 font-mono text-xs">{svgString}</pre>
					</div>
				{:else if view === 'parsed'}
					<pre class="max-h-96 overflow-auto rounded-sm bg-muted p-4 font-mono text-xs">{JSON.stringify(parsed, null, 2)}</pre>
				{:else if view === 'layout'}
					<pre class="max-h-96 overflow-auto rounded-sm bg-muted p-4 font-mono text-xs">{JSON.stringify(laid, null, 2)}</pre>
				{:else if view === 'model'}
					<pre class="max-h-96 overflow-auto rounded-sm bg-muted p-4 font-mono text-xs">{JSON.stringify(model, null, 2)}</pre>
				{/if}
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
	/* gallery SVGs come with intrinsic pixel sizes — keep them, just cap the width */
	.gallery-svg :global(svg) {
		max-width: 100%;
		height: auto;
	}
</style>
