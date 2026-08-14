import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		expect: { requireAssertions: true },
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [{ browser: 'chromium', headless: true }]
		},
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
