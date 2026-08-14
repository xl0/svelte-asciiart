<script lang="ts">
	import { defaultTheme, exportSvg } from 'lovely-ansi-svg';
	import { collectFontCss, svgStringToPng } from 'lovely-svg-png';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { ansiArt, monoFonts } from '$lib/demo';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Select from '$lib/components/ui/select';
	import { ChevronDown } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	// default to a webfont so the embedding actually has something to embed
	let fontKey = $state('jetbrains');
	const fontFamily = $derived(monoFonts.find((f) => f.key === fontKey)?.family ?? monoFonts[0].family);

	const sampleSvg = (family: string) =>
		exportSvg(ansiArt, {
			margin: 1,
			background: '#1e1e1e',
			theme: { ...defaultTheme, foreground: '#d4d4d4' },
			fontFamily: family,
			cellSize: 24
		});

	// editable source: regenerate from the sample, or paste any SVG string
	let svgSource = $state(sampleSvg(monoFonts.find((f) => f.key === 'jetbrains')!.family));

	let embedFonts = $state(true);
	let scale = $state(2);

	let debouncedSvg = $state<string>(untrack(() => svgSource));
	$effect(() => {
		const s = svgSource;
		const timeout = setTimeout(() => (debouncedSvg = s), 300);
		return () => clearTimeout(timeout);
	});

	let pngUrl = $state<string | null>(null);
	let pngBytes = $state(0);
	let fontCss = $state('');
	let error = $state<string | null>(null);
	let gen = 0;
	$effect(() => {
		const [svg, family, embed, sc] = [debouncedSvg, fontFamily, embedFonts, scale];
		const g = ++gen;
		void (async () => {
			try {
				const css = embed ? await collectFontCss(family) : '';
				const blob = await svgStringToPng(svg, { scale: sc, fontCss: css, output: 'blob' });
				if (g !== gen) return;
				if (pngUrl) URL.revokeObjectURL(pngUrl);
				pngUrl = URL.createObjectURL(blob);
				pngBytes = blob.size;
				fontCss = css;
				error = null;
			} catch (e) {
				if (g !== gen) return;
				error = String(e);
				if (untrack(() => pngUrl)) URL.revokeObjectURL(untrack(() => pngUrl)!);
				pngUrl = null;
			}
		})();
	});

	const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

	async function copyPng() {
		const blob = await svgStringToPng(debouncedSvg, {
			scale,
			fontCss: embedFonts ? await collectFontCss(fontFamily) : '',
			output: 'blob'
		});
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
	}
</script>

<div class="p-6">
	<div class="mx-auto mb-6 max-w-6xl">
		<h1 class="text-xl font-bold">lovely-svg-png</h1>
		<p class="text-sm text-muted-foreground">
			Rasterize any SVG string to PNG in the browser, with webfonts fetched and embedded as
			<code class="font-mono">data:</code>
			 URIs. Not tied to ANSI art or any framework.
		</p>
	</div>

	<div class="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 xl:grid-cols-2">
		<Card.Root>
			<Card.Content class="space-y-4">
				<div class="flex items-center justify-between">
					<Label for="svg-source">Source SVG</Label>
					<Button variant="ghost" size="sm" onclick={() => (svgSource = sampleSvg(fontFamily))}>Regenerate sample</Button>
				</div>
				<Textarea id="svg-source" bind:value={svgSource} rows={12} class="font-mono text-xs" />
				<p class="text-xs text-muted-foreground">
					The sample comes from <code class="font-mono">exportSvg</code>
					 (lovely-ansi-svg), but any SVG string works — paste your own.
				</p>

				<div class="flex flex-wrap items-end gap-6">
					<div class="min-w-40 space-y-2">
						<Label class="text-xs text-muted-foreground">Webfont</Label>
						<Select.Root
							type="single"
							bind:value={fontKey}
							onValueChange={(v) => {
								const f = monoFonts.find((x) => x.key === v);
								if (f) svgSource = sampleSvg(f.family);
							}}>
							<Select.Trigger class="w-full">
								{monoFonts.find((f) => f.key === fontKey)?.label ?? 'System'}
							</Select.Trigger>
							<Select.Content>
								{#each monoFonts.filter((f) => f.gf) as f}
									<Select.Item value={f.key}>{f.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="flex min-w-fit items-center gap-2 pb-2">
						<Switch id="embed-toggle" bind:checked={embedFonts} />
						<Label for="embed-toggle">Embed fonts (collectFontCss)</Label>
					</div>
					<div class="min-w-40 flex-1 space-y-2">
						<Label class="text-xs text-muted-foreground">Scale: {scale}×</Label>
						<Slider type="single" bind:value={scale} min={1} max={4} step={0.5} />
					</div>
				</div>

				{#if embedFonts}
					<Collapsible.Root class="space-y-2">
						<Collapsible.Trigger class="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
							<ChevronDown class="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
							Embedded font CSS {fontCss ? `(${kb(fontCss.length)})` : ''}
						</Collapsible.Trigger>
						<Collapsible.Content>
							<pre class="max-h-64 overflow-auto rounded-sm bg-muted p-4 font-mono text-xs break-all whitespace-pre-wrap">{fontCss
									? fontCss.length > 4000
										? fontCss.slice(0, 4000) + `\n… ${kb(fontCss.length - 4000)} more`
										: fontCss
									: '(nothing collected — font not loaded on this page?)'}</pre>
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="space-y-4">
				<div class="flex items-center justify-between">
					<Label>PNG {pngUrl ? `(${kb(pngBytes)} at ${scale}×)` : ''}</Label>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={copyPng} disabled={!pngUrl}>Copy PNG</Button>
						{#if pngUrl}
							<Button variant="outline" size="sm" href={pngUrl} download="ascii-art.png">Download</Button>
						{/if}
					</div>
				</div>
				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{:else if pngUrl}
					<div class="overflow-auto rounded-sm border border-border bg-muted/50 p-2">
						<img src={pngUrl} alt="PNG preview" class="max-w-full" />
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">Rendering…</p>
				{/if}
				<p class="text-xs text-muted-foreground">
					The PNG is rendered off-screen: SVG string → blob URL → <code class="font-mono">Image</code>
					 → canvas. Toggle font embedding off and the rasterizer falls back to whatever font the browser substitutes.
				</p>
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
