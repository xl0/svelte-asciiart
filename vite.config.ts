import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		fs: {
			allow: [
				path.resolve('packages/svelte-asciiart/dist'),
				path.resolve('packages/svelte-asciiart/src')
			]
		}
	},
	// ssr: {
	// 	noExternal: ['svelte-asciiart']
	// },
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		alias: {
			svelte: 'svelte'
		}
	},
	resolve: {
		alias: {
			'svelte-asciiart': path.resolve('packages/svelte-asciiart/src/lib/index.ts')
		},
		conditions: ['browser']
	}
});
