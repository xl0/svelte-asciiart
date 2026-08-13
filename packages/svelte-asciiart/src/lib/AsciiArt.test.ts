import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AsciiArt from './AsciiArt.svelte';

describe('AsciiArt', () => {
	it('renders an SVG element', async () => {
		const { container } = await render(AsciiArt, { text: 'Hello' });
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('renders text content as one tspan per run with per-char x positions', async () => {
		const { container } = await render(AsciiArt, { text: 'Hello\nWorld' });
		const tspans = container.querySelectorAll('tspan');
		expect(tspans.length).toBe(2);
		expect(tspans[0].textContent).toBe('Hello');
		expect(tspans[1].textContent).toBe('World');
		expect(tspans[0].getAttribute('x')!.split(' ').length).toBe(5);
	});

	it('derives rows from text lines', async () => {
		const text = 'Line1\nLine2\nLine3';
		const { container } = await render(AsciiArt, { text });
		const texts = container.querySelectorAll('text');
		expect(texts.length).toBe(3);
	});

	it('calculates viewBox based on text dimensions', async () => {
		const text = 'ABCDE\n12345';
		const { container } = await render(AsciiArt, { text });
		const svg = container.querySelector('svg');
		const viewBox = svg?.getAttribute('viewBox');
		// 5 cols * 0.6 = 3, 2 rows * 1 = 2
		expect(viewBox).toBe('0 0 3 2');
	});

	it('allows overriding rows and cols', async () => {
		const { container } = await render(AsciiArt, {
			text: 'Hi',
			rows: 10,
			cols: 20
		});
		const svg = container.querySelector('svg');
		const viewBox = svg?.getAttribute('viewBox');
		// 20 cols * 0.6 = 12, 10 rows * 1 = 10
		expect(viewBox).toBe('0 0 12 10');
	});

	it('text may overflow the frame into the margin but is clipped at viewBox', async () => {
		const { container } = await render(AsciiArt, {
			text: 'ABCDE',
			rows: 1,
			cols: 2,
			margin: 1,
			frame: true
		});
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 2.4 3');
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
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('handles single line text', async () => {
		const { container } = await render(AsciiArt, { text: 'Single line' });
		const tspans = container.querySelectorAll('tspan');
		expect(tspans.length).toBe(1);
		expect(tspans[0].textContent).toBe('Single line');
	});

	it('grid mode uses rows/cols as viewBox units', async () => {
		const { container } = await render(AsciiArt, {
			text: 'AB\nCD',
			rows: 3,
			cols: 4,
			grid: true
		});
		const svg = container.querySelector('svg');
		// default cellAspect=0.6 => width = cols * 0.6
		expect(svg?.getAttribute('viewBox')).toBe('0 0 2.4 3');
	});

	it('grid mode allows overriding cellAspect', async () => {
		const { container } = await render(AsciiArt, {
			text: 'AB',
			rows: 1,
			cols: 2,
			grid: true,
			cellAspect: 1
		});
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 2 1');
	});

	it('grid mode draws a grid path', async () => {
		const { container } = await render(AsciiArt, {
			text: 'A',
			rows: 2,
			cols: 2,
			grid: true
		});
		const path = container.querySelector('path');
		expect(path).toBeTruthy();
	});

	it('non-grid mode does not draw a grid path', async () => {
		const { container } = await render(AsciiArt, {
			text: 'A',
			rows: 2,
			cols: 2,
			grid: false
		});
		const path = container.querySelector('path');
		expect(path).toBeFalsy();
	});

	it('grid mode renders one <text> per line with x per cell', async () => {
		const { container } = await render(AsciiArt, {
			text: 'A B',
			rows: 1,
			cols: 3,
			grid: true
		});
		const texts = Array.from(container.querySelectorAll('text'));
		expect(texts.length).toBe(1);
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.length).toBe(1);
		expect(tspans[0].textContent).toBe('A B');
		// x per code point keeps cell alignment: 0*0.6, 1*0.6, 2*0.6
		expect(tspans[0].getAttribute('x')).toBe('0 0.6 1.2');
	});

	it('parses ANSI escapes in text into classed runs', async () => {
		const { container } = await render(AsciiArt, {
			text: 'a \u001b[1;36mcyan\u001b[0m b'
		});
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.map((t) => t.textContent)).toEqual(['a ', 'cyan', ' b']);
		expect(tspans[1].getAttribute('class')).toContain('ansi-bold');
		expect(tspans[1].getAttribute('class')).toContain('ansi-fg-36');
		// escapes are zero-width for layout: 8 columns
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 4.8 1');
	});

	it('applies concrete colors as inline fill style', async () => {
		const { container } = await render(AsciiArt, { text: '\u001b[38;2;255;0;0mred' });
		const tspan = container.querySelector('tspan')!;
		expect(tspan.style.fill).toBe('rgb(255, 0, 0)');
	});

	it('counts wide characters as two columns', async () => {
		const { container } = await render(AsciiArt, { text: '你好' });
		// 4 display columns * 0.6 = 2.4
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 2.4 1');
		const tspan = container.querySelector('tspan')!;
		// second char starts at column 2: 2*0.6
		expect(tspan.getAttribute('x')).toBe('0 1.2');
	});

	it('gives multi-code-point clusters their own tspan', async () => {
		const { container } = await render(AsciiArt, { text: 'a👨‍👩‍👧b' });
		const tspans = Array.from(container.querySelectorAll('tspan'));
		expect(tspans.map((t) => t.textContent)).toEqual(['a', '👨‍👩‍👧', 'b']);
		// a=1 col, family emoji=2 cols, b at column 3
		expect(tspans[2].getAttribute('x')).toBe('1.8');
	});

	it('renders background runs as full-cell rects behind the text', async () => {
		const { container } = await render(AsciiArt, {
			text: 'a\x1b[41;32mXY\x1b[0mb'
		});
		const rect = container.querySelector('rect')!;
		expect(rect.getAttribute('class')).toBe('ansi-bg-41');
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
		const { container } = await render(AsciiArt, {
			text: '\x1b[41;31ma\x1b[32mb\x1b[0m'
		});
		const rects = container.querySelectorAll('rect');
		expect(rects.length).toBe(1);
		expect(rects[0].getAttribute('width')).toBe('1.2');
	});

	it('applies concrete backgrounds as inline fill style', async () => {
		const { container } = await render(AsciiArt, { text: '\x1b[48;2;0;0;255mx' });
		const rect = container.querySelector('rect')!;
		expect(rect.style.fill).toBe('rgb(0, 0, 255)');
	});

	it('renders without a text prop', async () => {
		const { container } = await render(AsciiArt, {});
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('fontSize scales glyphs and centers them in the cell', async () => {
		const { container } = await render(AsciiArt, { text: 'A', fontSize: 0.8 });
		const text = container.querySelector('text')!;
		expect(text.getAttribute('font-size')).toBe('0.8');
		// inset = (1-0.8)/2 * 0.6 = 0.06
		expect(container.querySelector('tspan')!.getAttribute('x')).toBe('0.06');
		// baseline = (1-0.8)/2 + 0.8*0.8 = 0.74
		expect(text.getAttribute('y')).toBe('0.74');
	});

	it('cellSize pins the rendered scale instead of stretching', async () => {
		const { container } = await render(AsciiArt, { text: 'AB', cellSize: 20 });
		const svg = container.querySelector('svg')!;
		// 2 cols * 0.6 * 20 = 24, 1 row * 20 = 20
		expect(svg.getAttribute('width')).toBe('24');
		expect(svg.getAttribute('height')).toBe('20');
		expect(svg.style.width).toBe('');
	});

	it('has an img role for accessibility', async () => {
		const { container } = await render(AsciiArt, { text: 'A', 'aria-label': 'box art' });
		const svg = container.querySelector('svg')!;
		expect(svg.getAttribute('role')).toBe('img');
		expect(svg.getAttribute('aria-label')).toBe('box art');
	});

	it('falls back to the escape-stripped text as the accessible name', async () => {
		const { container } = await render(AsciiArt, { text: '\x1b[31mA\x1b[0m\nB' });
		expect(container.querySelector('svg')!.getAttribute('aria-label')).toBe('A\nB');
	});

	it('omits aria-label when the role resolves to presentation', async () => {
		const empty = await render(AsciiArt, { text: '', 'aria-label': 'box art' });
		const emptySvg = empty.container.querySelector('svg')!;
		expect(emptySvg.getAttribute('role')).toBe('presentation');
		expect(emptySvg.hasAttribute('aria-label')).toBe(false);

		const forced = await render(AsciiArt, { text: 'A', role: 'presentation' });
		const forcedSvg = forced.container.querySelector('svg')!;
		expect(forcedSvg.getAttribute('role')).toBe('presentation');
		expect(forcedSvg.hasAttribute('aria-label')).toBe(false);
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
		const negative = await render(AsciiArt, { text: 'AB', rows: -3 });
		// negative rows clamp to 0 — viewBox stays valid, never negative
		expect(negative.container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 1.2 0');

		const fractional = await render(AsciiArt, { text: 'AB', cols: 2.7 });
		expect(fractional.container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 1.2 1');
	});
});
