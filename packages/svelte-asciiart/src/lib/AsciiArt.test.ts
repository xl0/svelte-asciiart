import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AsciiArt from './AsciiArt.svelte';

describe('AsciiArt', () => {
	it('renders an SVG element', () => {
		const { container } = render(AsciiArt, { props: { text: 'Hello' } });
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('renders text content', () => {
		const { container } = render(AsciiArt, { props: { text: 'Hello\nWorld' } });
		const tspans = container.querySelectorAll('tspan');
		expect(tspans.length).toBe(10);
		expect(tspans[0].textContent).toBe('H');
		expect(tspans[5].textContent).toBe('W');
	});

	it('derives rows from text lines', () => {
		const text = 'Line1\nLine2\nLine3';
		const { container } = render(AsciiArt, { props: { text } });
		const tspans = container.querySelectorAll('tspan');
		expect(tspans.length).toBe(15);
	});

	it('calculates viewBox based on text dimensions', () => {
		const text = 'ABCDE\n12345';
		const { container } = render(AsciiArt, { props: { text } });
		const svg = container.querySelector('svg');
		const viewBox = svg?.getAttribute('viewBox');
		// 5 cols * 0.6 = 3, 2 rows * 1 = 2
		expect(viewBox).toBe('0 0 3 2');
	});

	it('allows overriding rows and cols', () => {
		const { container } = render(AsciiArt, {
			props: { text: 'Hi', rows: 10, cols: 20 }
		});
		const svg = container.querySelector('svg');
		const viewBox = svg?.getAttribute('viewBox');
		// 20 cols * 0.6 = 12, 10 rows * 1 = 10
		expect(viewBox).toBe('0 0 12 10');
	});

	it('uses CSS variable for font family', () => {
		const { container } = render(AsciiArt, { props: { text: 'Test' } });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('style')).toContain('font-family: var(--ascii-font-family');
	});

	it('handles empty text', () => {
		const { container } = render(AsciiArt, { props: { text: '' } });
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('handles single line text', () => {
		const { container } = render(AsciiArt, { props: { text: 'Single line' } });
		const tspans = container.querySelectorAll('tspan');
		expect(tspans.length).toBe(11);
		expect(
			Array.from(tspans)
				.map((t) => t.textContent)
				.join('')
		).toBe('Single line');
	});

	it('grid mode uses rows/cols as viewBox units', () => {
		const { container } = render(AsciiArt, {
			props: { text: 'AB\nCD', rows: 3, cols: 4, grid: true }
		});
		const svg = container.querySelector('svg');
		// default cellAspect=0.6 => width = cols * 0.6
		expect(svg?.getAttribute('viewBox')).toBe('0 0 2.4 3');
	});

	it('grid mode allows overriding cellAspect', () => {
		const { container } = render(AsciiArt, {
			props: { text: 'AB', rows: 1, cols: 2, grid: true, cellAspect: 1 }
		});
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 2 1');
	});

	it('grid mode draws a grid path', () => {
		const { container } = render(AsciiArt, {
			props: { text: 'A', rows: 2, cols: 2, grid: true }
		});
		const path = container.querySelector('path');
		expect(path).toBeTruthy();
	});

	it('non-grid mode does not draw a grid path', () => {
		const { container } = render(AsciiArt, {
			props: { text: 'A', rows: 2, cols: 2, grid: false }
		});
		const path = container.querySelector('path');
		expect(path).toBeFalsy();
	});

	it('grid mode renders one <text> per line with tspans per character', () => {
		const { container } = render(AsciiArt, {
			props: { text: 'A B', rows: 1, cols: 3, grid: true }
		});
		const texts = Array.from(container.querySelectorAll('text'));
		expect(texts.length).toBe(1);
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.length).toBe(3);
		expect(tspans.map((t) => t.textContent)).toEqual(['A', ' ', 'B']);
	});
});
