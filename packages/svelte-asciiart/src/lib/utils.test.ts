import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AsciiArt from './AsciiArt.svelte';
import { exportSvg, svgStringToPng, exportSvgToPng } from './utils.js';

const getSvg = (container: HTMLElement) => container.querySelector('svg') as SVGSVGElement;

const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('image failed to load'));
		img.src = src;
	});

// Real stylesheet so getComputedStyle sees the class styles during export.
let sheet: HTMLStyleElement;
beforeAll(() => {
	sheet = document.createElement('style');
	sheet.textContent = '.test-grid { stroke: rgb(255, 0, 0); stroke-width: 0.02px; }';
	document.head.appendChild(sheet);
});
afterAll(() => sheet.remove());

describe('exportSvg', () => {
	it('produces a standalone parseable SVG with xmlns', () => {
		const { container } = render(AsciiArt, { text: 'Hi' });
		const str = exportSvg(getSvg(container));
		const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
		expect(doc.querySelector('parsererror')).toBeNull();
		expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
	});

	it('inlines computed styles for classed elements into a <style> block', () => {
		const { container } = render(AsciiArt, {
			text: 'Hi',
			grid: true,
			gridClass: 'test-grid'
		});
		const str = exportSvg(getSvg(container));
		const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
		const style = doc.querySelector('defs style');
		expect(style?.textContent).toContain('.test-grid {');
		expect(style?.textContent).toContain('stroke: rgb(255, 0, 0)');
	});

	it('inlines text/tspan styles (font stack)', () => {
		const { container } = render(AsciiArt, { text: 'Hi' });
		const str = exportSvg(getSvg(container));
		expect(str).toContain('text, tspan {');
		expect(str).toContain('font-family:');
	});

	it('adds a background rect sized to the viewBox when requested', () => {
		const { container } = render(AsciiArt, { text: 'AB' });
		const str = exportSvg(getSvg(container), {
			includeBackground: true,
			backgroundColor: 'rgb(0, 128, 0)'
		});
		const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
		const rect = doc.documentElement.querySelector('rect');
		// 'AB' => 2 cols * 0.6 wide, 1 row tall
		expect(rect?.getAttribute('width')).toBe('1.2');
		expect(rect?.getAttribute('height')).toBe('1');
		expect(rect?.getAttribute('fill')).toBe('rgb(0, 128, 0)');
	});

	it('adds no background rect by default', () => {
		const { container } = render(AsciiArt, { text: 'AB' });
		const doc = new DOMParser().parseFromString(exportSvg(getSvg(container)), 'image/svg+xml');
		expect(doc.documentElement.querySelector('rect')).toBeNull();
	});
});

describe('svgStringToPng', () => {
	it('renders a PNG data URL at the intrinsic size', async () => {
		const { container } = render(AsciiArt, { text: 'AB' });
		const dataUrl = await svgStringToPng(exportSvg(getSvg(container)));
		expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
		// intrinsic size: viewBox 1.2 x 1 * baseSize 50
		const img = await loadImage(dataUrl);
		expect(img.naturalWidth).toBe(60);
		expect(img.naturalHeight).toBe(50);
	});

	it('applies the scale factor', async () => {
		const { container } = render(AsciiArt, { text: 'AB' });
		const dataUrl = await svgStringToPng(exportSvg(getSvg(container)), { scale: 2 });
		const img = await loadImage(dataUrl);
		expect(img.naturalWidth).toBe(120);
		expect(img.naturalHeight).toBe(100);
	});

	it('returns a PNG Blob when output is blob', async () => {
		const { container } = render(AsciiArt, { text: 'AB' });
		const blob = await svgStringToPng(exportSvg(getSvg(container)), { output: 'blob' });
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe('image/png');
		expect(blob.size).toBeGreaterThan(0);
	});

	it('rejects on an unloadable SVG string', async () => {
		await expect(svgStringToPng('not an svg at all')).rejects.toThrow(
			'Failed to load SVG into image'
		);
	});
});

describe('exportSvgToPng', () => {
	it('composes export and rasterization; background pixel survives', async () => {
		const { container } = render(AsciiArt, { text: 'AB' });
		const dataUrl = await exportSvgToPng(getSvg(container), {
			includeBackground: true,
			backgroundColor: 'rgb(255, 0, 0)'
		});
		const img = await loadImage(dataUrl);
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		expect([r, g, b, a]).toEqual([255, 0, 0, 255]);
	});
});
