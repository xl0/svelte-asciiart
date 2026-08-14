import { describe, expect, it } from 'vitest';
import { parseAnsi } from './ansi.js';
import { layout, layoutRow } from './layout.js';

const E = '\x1b';
const lay = (text: string) => layout(parseAnsi(text));

describe('layoutRow', () => {
	it('merges plain text into a single run with per-cluster columns', () => {
		expect(layoutRow({ text: 'abc', breaks: [] })).toEqual({
			runs: [{ cols: [0, 1, 2], text: 'abc' }],
			bgs: [],
			width: 3
		});
	});

	it('breaks runs on foreground style changes', () => {
		const [row] = lay(`a${E}[31mb`);
		expect(row.runs).toEqual([
			{ cols: [0], text: 'a' },
			{ fill: '#cd3131', cols: [1], text: 'b' }
		]);
	});

	it('gives wide clusters two columns', () => {
		const [row] = lay('你a');
		expect(row.runs[0].cols).toEqual([0, 2]);
		expect(row.width).toBe(3);
	});

	it('isolates multi-code-point clusters in their own single-x run', () => {
		const [row] = lay('a👍🏽b');
		expect(row.runs.map((r) => r.text)).toEqual(['a', '👍🏽', 'b']);
		expect(row.runs[1].cols).toEqual([1]);
		expect(row.width).toBe(4);
	});

	it('keeps a cluster split by an escape whole, styled by its base', () => {
		// the combining mark lands after the SGR — segment-first layout still
		// joins it with 'e' and styles the cluster as its first code unit
		const [row] = lay(`e${E}[31m\u0301x`);
		expect(row.runs).toEqual([
			{ cols: [0], text: 'e\u0301' },
			{ fill: '#cd3131', cols: [1], text: 'x' }
		]);
	});

	it('drops zero-width clusters with no base', () => {
		const [row] = lay('\u0301a');
		expect(row.runs).toEqual([{ cols: [0], text: 'a' }]);
		expect(row.width).toBe(1);
	});

	it('merges backgrounds independently of foreground changes', () => {
		const [row] = lay(`${E}[41;31ma${E}[32mb${E}[0mc`);
		expect(row.runs.map((r) => r.fill)).toEqual(['#cd3131', '#00a600', undefined]);
		expect(row.bgs).toEqual([{ fill: '#cd3131', start: 0, end: 2 }]);
	});

	it('splits backgrounds when the bg style changes', () => {
		const [row] = lay(`${E}[41ma${E}[42mb`);
		expect(row.bgs).toEqual([
			{ fill: '#cd3131', start: 0, end: 1 },
			{ fill: '#00a600', start: 1, end: 2 }
		]);
	});

	it('covers wide clusters with full-width backgrounds', () => {
		const [row] = lay(`${E}[44m你`);
		expect(row.bgs).toEqual([{ fill: '#0451a5', start: 0, end: 2 }]);
	});
});

describe('layout', () => {
	it('lays out one LayoutRow per parsed row', () => {
		const rows = lay('ab\ncdef');
		expect(rows.map((r) => r.width)).toEqual([2, 4]);
	});

	it('produces an empty row for empty input', () => {
		expect(lay('')).toEqual([{ runs: [], bgs: [], width: 0 }]);
	});
});
