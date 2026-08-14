import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	compilerOptions: {
		experimental: {
			async: true
		}
	},

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		// Resolve the workspace dep to its source (not dist) for vite and
		// svelte-check alike — dist is gitignored and may not exist.
		alias: {
			'svelte-asciiart': '../packages/svelte-asciiart/src/lib/index.ts',
			'lovely-ansi-svg': '../packages/lovely-ansi-svg/src/index.ts',
			'lovely-svg-png': '../packages/lovely-svg-png/src/index.ts'
		},
		paths: {
			base: process.env.BASE_PATH ?? ''
		}
	}
};

export default config;
