import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AsciiArt from './AsciiArt.svelte';

// geometry assertions pin cellAspect — the 'auto' default measures the real
// font and would make expected numbers environment-dependent
const A = { cellAspect: 0.6 };

describe('AsciiArt', () => {
	it('renders an SVG element', async () => {
		const { container } = await render(AsciiArt, { text: 'Hello' });
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('renders text content as one tspan per run with per-char x positions', async () => {
		const { container } = await render(AsciiArt, { text: 'Hello\nWorld', ...A });
		const tspans = container.querySelectorAll('tspan');
		expect(tspans.length).toBe(2);
		expect(tspans[0].textContent).toBe('Hello');
		expect(tspans[1].textContent).toBe('World');
		expect(tspans[0].getAttribute('x')!.split(' ').length).toBe(5);
	});

	it('derives rows from text lines', async () => {
		const { container } = await render(AsciiArt, { text: 'Line1\nLine2\nLine3', ...A });
		expect(container.querySelectorAll('text').length).toBe(3);
	});

	it('calculates viewBox based on text dimensions', async () => {
		const { container } = await render(AsciiArt, { text: 'ABCDE\n12345', ...A });
		// 5 cols * 0.6 = 3, 2 rows * 1 = 2
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 3 2');
	});

	it('measures the font when cellAspect is auto', async () => {
		const { container } = await render(AsciiArt, { text: 'AB' });
		const svg = container.querySelector('svg')!;
		await vi.waitFor(() => {
			const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
			expect(h).toBe(1);
			// a real monospace advance lands well inside (0.4, 0.8) per cell
			expect(w / 2).toBeGreaterThan(0.4);
			expect(w / 2).toBeLessThan(0.8);
		});
	});

	it('allows overriding rows and cols', async () => {
		const { container } = await render(AsciiArt, { text: 'Hi', rows: 10, cols: 20, ...A });
		// 20 cols * 0.6 = 12, 10 rows * 1 = 10
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 12 10');
	});

	it('text may overflow the frame into the margin but is clipped at viewBox', async () => {
		const { container } = await render(AsciiArt, {
			text: 'ABCDE',
			rows: 1,
			cols: 2,
			margin: 1,
			frame: true,
			...A
		});
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 2.4 3');
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.length).toBe(1);
		expect(tspans[0].textContent).toBe('ABCDE');
	});

	it('uses CSS variable for font family', async () => {
		const { container } = await render(AsciiArt, { text: 'Test' });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('style')).toContain('font-family: var(--ascii-font-family');
	});

	it('handles empty text', async () => {
		const { container } = await render(AsciiArt, { text: '' });
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('resolves ANSI colors through a custom theme prop', async () => {
		const palette: string[] = Array(16).fill('#000000');
		palette[1] = '#123456';
		const theme = { palette };
		const { container } = await render(AsciiArt, { text: '\x1b[31mx', theme });
		expect(container.querySelector('tspan')!.style.fill).toBe('rgb(18, 52, 86)');
	});

	it('grid: true draws a default-stroked grid path', async () => {
		const { container } = await render(AsciiArt, { text: 'A', rows: 2, cols: 2, grid: true, ...A });
		const path = container.querySelector('path')!;
		expect(path).toBeTruthy();
		expect(path.getAttribute('stroke')).toBe('currentColor');
	});

	it('grid: string sets the class and no default stroke', async () => {
		const { container } = await render(AsciiArt, { text: 'A', grid: 'my-grid', ...A });
		const path = container.querySelector('path')!;
		expect(path.getAttribute('class')).toBe('my-grid');
		expect(path.hasAttribute('stroke')).toBe(false);
	});

	it('frame: string sets the class on the frame rect', async () => {
		const { container } = await render(AsciiArt, { text: 'A', frame: 'my-frame', ...A });
		const rect = container.querySelector('rect')!;
		expect(rect.getAttribute('class')).toBe('my-frame');
		expect(rect.getAttribute('fill')).toBe('none');
	});

	it('non-grid mode does not draw a grid path', async () => {
		const { container } = await render(AsciiArt, { text: 'A', rows: 2, cols: 2 });
		expect(container.querySelector('path')).toBeFalsy();
	});

	it('grid mode renders one <text> per line with x per cell', async () => {
		const { container } = await render(AsciiArt, {
			text: 'A B',
			rows: 1,
			cols: 3,
			grid: true,
			...A
		});
		expect(container.querySelectorAll('text').length).toBe(1);
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.length).toBe(1);
		expect(tspans[0].textContent).toBe('A B');
		// x per code point keeps cell alignment: 0*0.6, 1*0.6, 2*0.6
		expect(tspans[0].getAttribute('x')).toBe('0 0.6 1.2');
	});

	it('parses ANSI escapes in text into styled runs', async () => {
		const { container } = await render(AsciiArt, { text: 'a \x1b[1;36mcyan\x1b[0m b', ...A });
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.map((t) => t.textContent)).toEqual(['a ', 'cyan', ' b']);
		expect(tspans[1].style.fontWeight).toBe('bold');
		// default-theme cyan
		expect(tspans[1].style.fill).toBe('rgb(5, 152, 188)');
		// escapes are zero-width for layout: 8 columns
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 4.8 1');
	});

	it('applies concrete colors as inline fill style', async () => {
		const { container } = await render(AsciiArt, { text: '\x1b[38;2;255;0;0mred' });
		expect(container.querySelector('tspan')!.style.fill).toBe('rgb(255, 0, 0)');
	});

	it('counts wide characters as two columns', async () => {
		const { container } = await render(AsciiArt, { text: '你好', ...A });
		// 4 display columns * 0.6 = 2.4
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 2.4 1');
		// second char starts at column 2: 2*0.6
		expect(container.querySelector('tspan')!.getAttribute('x')).toBe('0 1.2');
	});

	it('gives multi-code-point clusters their own tspan', async () => {
		const { container } = await render(AsciiArt, { text: 'a👨‍👩‍👧b', ...A });
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.map((t) => t.textContent)).toEqual(['a', '👨‍👩‍👧', 'b']);
		// a=1 col, family emoji=2 cols, b at column 3
		expect(tspans[2].getAttribute('x')).toBe('1.8');
	});

	it('renders background runs as full-cell rects behind the text', async () => {
		const { container } = await render(AsciiArt, { text: 'a\x1b[41;32mXY\x1b[0mb', ...A });
		const rect = container.querySelector('rect')!;
		// default-theme red background
		expect(rect.style.fill).toBe('rgb(205, 49, 49)');
		// starts at col 1, spans 2 cols, full cell height
		expect(rect.getAttribute('x')).toBe('0.6');
		expect(rect.getAttribute('width')).toBe('1.2');
		expect(rect.getAttribute('height')).toBe('1');
		expect(rect.getAttribute('y')).toBe('0');
		// bg rect painted before the text layer
		const svg = container.querySelector('svg')!;
		expect(svg.querySelector('rect + text, rect ~ text')).toBeTruthy();
	});

	it('merges background runs across foreground changes', async () => {
		const { container } = await render(AsciiArt, { text: '\x1b[41;31ma\x1b[32mb\x1b[0m', ...A });
		const rects = container.querySelectorAll('rect');
		expect(rects.length).toBe(1);
		expect(rects[0].getAttribute('width')).toBe('1.2');
	});

	it('applies concrete backgrounds as inline fill style', async () => {
		const { container } = await render(AsciiArt, { text: '\x1b[48;2;0;0;255mx' });
		expect(container.querySelector('rect')!.style.fill).toBe('rgb(0, 0, 255)');
	});

	it('draws box-drawing chars as paths, or text with customGlyphs off', async () => {
		const drawn = await render(AsciiArt, { text: '┌─┐', ...A });
		expect(drawn.container.querySelectorAll('path').length).toBe(1);
		expect(drawn.container.querySelector('tspan')).toBeFalsy();

		const off = await render(AsciiArt, { text: '┌─┐', customGlyphs: false, ...A });
		expect(off.container.querySelector('path')).toBeFalsy();
		expect(off.container.querySelector('tspan')!.textContent).toBe('┌─┐');
	});

	it('wraps OSC 8 linked runs in an anchor', async () => {
		const { container } = await render(AsciiArt, {
			text: '\x1b]8;;https://example.com/\x07hi\x1b]8;;\x07 x',
			...A
		});
		const a = container.querySelector('a')!;
		expect(a.getAttribute('href')).toBe('https://example.com/');
		expect(a.querySelector('tspan')!.textContent).toBe('hi');
	});

	it('renders without a text prop', async () => {
		const { container } = await render(AsciiArt, {});
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('glyphScale scales glyphs and centers them in the cell', async () => {
		const { container } = await render(AsciiArt, { text: 'A', glyphScale: 0.8, ...A });
		const text = container.querySelector('text')!;
		expect(text.getAttribute('font-size')).toBe('0.8');
		// inset = (1-0.8)/2 * 0.6 = 0.06
		expect(container.querySelector('tspan')!.getAttribute('x')).toBe('0.06');
		// baseline = (1-0.8)/2 + 0.8*0.8 = 0.74
		expect(text.getAttribute('y')).toBe('0.74');
	});

	it('cellSize sets the intrinsic size', async () => {
		const { container } = await render(AsciiArt, { text: 'AB', cellSize: 20, ...A });
		const svg = container.querySelector('svg')!;
		// 2 cols * 0.6 * 20 = 24, 1 row * 20 = 20
		expect(svg.getAttribute('width')).toBe('24');
		expect(svg.getAttribute('height')).toBe('20');
	});

	it('is an img with the consumer label, decorative without one', async () => {
		const labelled = await render(AsciiArt, { text: 'A', 'aria-label': 'box art' });
		const svg = labelled.container.querySelector('svg')!;
		expect(svg.getAttribute('role')).toBe('img');
		expect(svg.getAttribute('aria-label')).toBe('box art');

		const bare = await render(AsciiArt, { text: 'A' });
		expect(bare.container.querySelector('svg')!.getAttribute('role')).toBe('presentation');
	});

	it('respects a consumer role override', async () => {
		const { container } = await render(AsciiArt, { text: 'A', role: 'img' });
		expect(container.querySelector('svg')!.getAttribute('role')).toBe('img');
	});

	it('forwards consumer width/height/preserveAspectRatio over the computed ones', async () => {
		const { container } = await render(AsciiArt, {
			text: 'AB',
			width: 400,
			preserveAspectRatio: 'none'
		});
		const svg = container.querySelector('svg')!;
		expect(svg.getAttribute('width')).toBe('400');
		expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
	});

	it('clamps rows/cols to non-negative integers', async () => {
		const negative = await render(AsciiArt, { text: 'AB', rows: -3, ...A });
		// negative rows clamp to 0 — viewBox stays valid, never negative
		expect(negative.container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 1.2 0');

		const fractional = await render(AsciiArt, { text: 'AB', cols: 2.7, ...A });
		expect(fractional.container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 1.2 1');
	});
});
