import { describe, expect, it } from 'vitest';
import { parseAnsi } from './ansi.js';
import { layout } from './layout.js';
import { exportSvg, render } from './svg.js';
import { defaultTheme, themeCss } from './theme.js';

const E = '\x1b';
const model = (text: string, opts = {}) => render(layout(parseAnsi(text)), opts);

describe('themeCss', () => {
	it('resolves palette colors behind var() fallbacks', () => {
		const css = themeCss();
		expect(css).toContain('.ansi-fg-31 { fill: var(--ansi-fg-31, #cd3131) }');
		expect(css).toContain('.ansi-bg-107 { fill: var(--ansi-bg-107, #ffffff) }');
	});

	it('dims as a solid color mix, not opacity, including per-color combos', () => {
		const css = themeCss();
		expect(css).toContain('.ansi-dim { fill: color-mix(in srgb, currentColor 55%, var(--ansi-default-bg, Canvas)) }');
		expect(css).toContain(
			'.ansi-dim.ansi-fg-31 { fill: color-mix(in srgb, var(--ansi-fg-31, #cd3131) 55%, var(--ansi-default-bg, Canvas)) }'
		);
		expect(css).not.toContain('opacity');
	});

	it('uses the theme background for inverse and leaves blink unstyled', () => {
		const css = themeCss({ ...defaultTheme, background: '#123456' });
		expect(css).toContain('.ansi-inverse { fill: var(--ansi-default-bg, #123456) }');
		expect(css).not.toContain('.ansi-blink');
	});
});

describe('render', () => {
	it('computes the viewBox from frame + margin in cell units', () => {
		const m = model('abc', { margin: 1 });
		// (3 + 2margin) * 0.6 wide, (1 + 2margin) tall
		expect(m.viewBox).toBe('0 0 3 3');
		expect(m.width).toBe('150');
		expect(m.height).toBe('150');
	});

	it('places the baseline at 0.8 and offsets rows by the margin', () => {
		const m = model('a\nb', { margin: [1, 0] });
		expect(m.rows.map((r) => r.y)).toEqual(['1.8', '2.8']);
	});

	it('centers scaled-down glyphs in the cell', () => {
		const m = model('a', { glyphScale: 0.5 });
		// inset = 0.25 * 0.6 = 0.15; baseline = 0.25 + 0.8*0.5 = 0.65
		expect(m.rows[0].runs[0].x).toBe('0.15');
		expect(m.rows[0].y).toBe('0.65');
		expect(m.fontSize).toBe('0.5');
	});

	it('clamps rows/cols to non-negative integers and ignores non-finite values', () => {
		expect(model('ab', { rows: 2.9, cols: -3 }).viewBox).toBe('0 0 0 2');
		expect(model('ab', { rows: NaN, cols: Infinity }).viewBox).toBe('0 0 1.2 1');
	});

	it('renders content overflowing the frame', () => {
		const m = model('abc\ndef', { rows: 1 });
		expect(m.viewBox).toBe('0 0 1.8 1');
		expect(m.rows).toHaveLength(2);
	});

	it('emits grid and frame with classes from string options', () => {
		const m = model('a', { grid: 'g', frame: 'f' });
		expect(m.grid?.class).toBe('g');
		expect(m.frame).toMatchObject({ x: '0', y: '0', width: '0.6', height: '1', class: 'f' });
		expect(m.grid?.d).toContain('M 0 0 V 1');
	});

	it('maps background runs to full-cell rects', () => {
		const m = model(`${E}[41mab`);
		expect(m.rows[0].bgs[0]).toEqual({
			class: 'ansi-bg-41',
			fill: undefined,
			x: '0',
			y: '0',
			width: '1.2',
			height: '1'
		});
	});
});

describe('exportSvg', () => {
	it('produces a standalone SVG with theme CSS and positioned tspans', () => {
		const svg = exportSvg(`${E}[31mhi`);
		expect(svg).toContain('viewBox="0 0 1.2 1"');
		expect(svg).toContain('.ansi-fg-31 { fill: var(--ansi-fg-31, #cd3131) }');
		expect(svg).toContain('<tspan class="ansi-fg-31" x="0 0.6">hi</tspan>');
		expect(svg).toContain('font-size="1"');
	});

	it('escapes XML metacharacters in text and attributes', () => {
		const svg = exportSvg('<&>', { fontFamily: '"My" Font' });
		expect(svg).toContain('&lt;&amp;>');
		expect(svg).toContain('font-family="&quot;My&quot; Font"');
	});

	it('inlines concrete fills as style, not attribute', () => {
		expect(exportSvg(`${E}[38;2;1;2;3mx`)).toContain('style="fill: rgb(1,2,3)"');
	});

	it('paints an optional background under everything', () => {
		const svg = exportSvg('a', { background: '#fff' });
		expect(svg).toContain('<rect width="0.6" height="1" fill="#fff"/>');
	});

	it('gives unclassed grid/frame a default stroke and classed ones none', () => {
		expect(exportSvg('a', { grid: true })).toContain('stroke-opacity="0.25"');
		const classed = exportSvg('a', { grid: 'g', extraCss: '.g { stroke: red }' });
		expect(classed).toContain('class="g"');
		expect(classed).not.toContain('stroke-opacity');
		expect(classed).toContain('.g { stroke: red }');
	});

	it('defaults the theme background to the painted background', () => {
		expect(exportSvg('a', { background: '#123456' })).toContain('.ansi-inverse { fill: var(--ansi-default-bg, #123456) }');
		// an explicit theme background wins
		expect(exportSvg('a', { background: '#123456', theme: { ...defaultTheme, background: '#000' } })).toContain(
			'.ansi-inverse { fill: var(--ansi-default-bg, #000) }'
		);
	});

	it('resolves a custom theme and sets the root color from foreground', () => {
		const svg = exportSvg('x', {
			theme: { ...defaultTheme, foreground: '#abc', palette: defaultTheme.palette }
		});
		expect(svg).toContain('style="color: #abc"');
		expect(svg).toContain('fill="currentColor"');
	});

	it('preserves whitespace on every text element', () => {
		// rasterizers don't reliably inherit xml:space from the root; collapsed
		// space runs would mis-slot the per-char x list
		const svg = exportSvg('a  b\nc   d');
		for (const m of svg.match(/<text [^>]*/g)!) expect(m).toContain('xml:space="preserve"');
	});

	it('skips empty rows but keeps their vertical space', () => {
		const svg = exportSvg('a\n\nb');
		expect(svg).toContain('viewBox="0 0 0.6 3"');
		expect(svg.match(/<text /g)).toHaveLength(2);
		expect(svg).toContain('<text y="2.8"');
	});
});
