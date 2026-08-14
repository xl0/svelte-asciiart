<script lang="ts">
	import './layout.css';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';

	const { children } = $props();

	const links = [
		{ href: `${base}/`, label: 'svelte-asciiart' },
		{ href: `${base}/lovely-ansi-svg`, label: 'lovely-ansi-svg' },
		{ href: `${base}/lovely-svg-png`, label: 'lovely-svg-png' }
	];

	const isActive = (href: string) => page.url.pathname.replace(/\/$/, '') === href.replace(/\/$/, '');
</script>

<header class="border-b border-border">
	<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-3">
		<nav class="flex flex-wrap items-center gap-1">
			{#each links as l}
				<a
					href={l.href}
					class="rounded-sm px-3 py-1.5 font-mono text-sm {isActive(l.href)
						? 'bg-secondary font-semibold text-foreground'
						: 'text-muted-foreground hover:text-foreground'}">
					{l.label}
				</a>
			{/each}
		</nav>
		<Button variant="outline" size="sm" href="https://github.com/xl0/svelte-asciiart">GitHub</Button>
	</div>
</header>

{@render children()}
