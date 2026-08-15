import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectFontCss, svgStringToPng } from './index.js';

const SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1.2 1" width="60" height="50">' +
	'<rect width="1.2" height="1" fill="rgb(255, 0, 0)"/></svg>';

const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('image failed to load'));
		img.src = src;
	});

describe('svgStringToPng', () => {
	it('renders a PNG data URL at the intrinsic size', async () => {
		const dataUrl = await svgStringToPng(SVG);
		expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
		const img = await loadImage(dataUrl);
		expect(img.naturalWidth).toBe(60);
		expect(img.naturalHeight).toBe(50);
	});

	it('applies the scale factor', async () => {
		const img = await loadImage(await svgStringToPng(SVG, { scale: 2 }));
		expect(img.naturalWidth).toBe(120);
		expect(img.naturalHeight).toBe(100);
	});

	it('returns a PNG Blob when output is blob', async () => {
		const blob = await svgStringToPng(SVG, { output: 'blob' });
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe('image/png');
		expect(blob.size).toBeGreaterThan(0);
	});

	it('rasterizes the actual content', async () => {
		const img = await loadImage(await svgStringToPng(SVG));
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		expect([r, g, b, a]).toEqual([255, 0, 0, 255]);
	});

	it('injects fontCss into the SVG before rasterizing', async () => {
		// glyph coverage is hard to assert; assert the injection is well-formed
		// by round-tripping a styled rect through a <style> rule instead
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="50" height="50">' + '<rect class="p" width="1" height="1"/></svg>';
		const img = await loadImage(await svgStringToPng(svg, { fontCss: '.p { fill: rgb(0, 128, 0) }' }));
		const canvas = document.createElement('canvas');
		canvas.width = 50;
		canvas.height = 50;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		expect(Array.from(ctx.getImageData(25, 25, 1, 1).data)).toEqual([0, 128, 0, 255]);
	});

	it('injects fontCss correctly when a root attribute contains ">"', async () => {
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" aria-label="a > b" viewBox="0 0 1 1" width="50" height="50">' +
			'<rect class="p" width="1" height="1"/></svg>';
		const img = await loadImage(await svgStringToPng(svg, { fontCss: '.p { fill: rgb(0, 128, 0) }' }));
		const canvas = document.createElement('canvas');
		canvas.width = 50;
		canvas.height = 50;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		expect(Array.from(ctx.getImageData(25, 25, 1, 1).data)).toEqual([0, 128, 0, 255]);
	});

	it('rejects on an unloadable SVG string', async () => {
		await expect(svgStringToPng('not an svg at all')).rejects.toThrow('Failed to load SVG into image');
	});
});

describe('collectFontCss', () => {
	let face: HTMLStyleElement;
	beforeAll(() => {
		face = document.createElement('style');
		// dummy woff2 payload; collectFontCss only fetches and re-encodes it
		face.textContent = '@font-face { font-family: TestMono; src: url(data:font/woff2;base64,AAECAw==); }';
		document.head.appendChild(face);
	});
	afterAll(() => face.remove());

	it('embeds @font-face src as a data: URI for the requested families', async () => {
		const css = await collectFontCss('TestMono, monospace');
		expect(css).toContain('@font-face');
		expect(css).toContain('font-family: TestMono');
		expect(css).toContain('src: url(data:');
	});

	it('accepts an array of family names', async () => {
		expect(await collectFontCss(['testmono'])).toContain('font-family: TestMono');
	});

	it('returns nothing for system-font stacks', async () => {
		expect(await collectFontCss('ui-monospace, monospace')).toBe('');
	});
});
