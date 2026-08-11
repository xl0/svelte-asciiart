import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		fs: {
			allow: [
				path.resolve('../packages/svelte-asciiart/dist'),
				path.resolve('../packages/svelte-asciiart/src')
			]
		}
	},
	resolve: {
		conditions: ['browser']
	}
});
