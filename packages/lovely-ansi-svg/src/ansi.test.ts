import { describe, expect, it } from 'vitest';
import { parseAnsi, type Style } from './ansi.js';

const E = '\x1b';

// Flatten ParsedRow into old-style spans for terse assertions: one entry per
// style stretch that has text.
const spans = (text: string): ({ text: string } & Style)[][] =>
	parseAnsi(text).map((row) => {
		const out: ({ text: string } & Style)[] = [];
		if (!row.breaks.length) {
			if (row.text) out.push({ text: row.text });
			return out;
		}
		if (row.breaks[0].offset > 0) out.push({ text: row.text.slice(0, row.breaks[0].offset) });
		row.breaks.forEach((b, i) => {
			const t = row.text.slice(b.offset, row.breaks[i + 1]?.offset);
			if (t) out.push({ text: t, ...b.style });
		});
		return out;
	});

describe('parseAnsi', () => {
	it('returns break-free rows for plain text', () => {
		expect(parseAnsi('ab\ncd')).toEqual([
			{ text: 'ab', breaks: [] },
			{ text: 'cd', breaks: [] }
		]);
	});

	it('parses 16-color foregrounds into classes', () => {
		const [row] = spans(`a${E}[31mred${E}[0mb`);
		expect(row).toEqual([
			{ text: 'a' },
			{ text: 'red', class: 'ansi-fg-31', fill: undefined, bgClass: undefined, bgFill: undefined },
			{ text: 'b', class: undefined, fill: undefined, bgClass: undefined, bgFill: undefined }
		]);
	});

	it('merges same-style chunks into one stretch', () => {
		// consumed escapes between chunks must not fragment the row
		expect(spans(`a${E}[2Kb${E}[31m${E}[39mc`)).toEqual([[{ text: 'abc' }]]);
	});

	it('combines bold/dim with color classes', () => {
		const [row] = spans(`${E}[1;2;96mx`);
		expect(row[0].class).toBe('ansi-bold ansi-dim ansi-fg-96');
	});

	it('persists state across lines until reset', () => {
		const rows = spans(`${E}[36mline1\nline2${E}[0m\nline3`);
		expect(rows[0][0].class).toBe('ansi-fg-36');
		expect(rows[1][0].class).toBe('ansi-fg-36');
		expect(rows[2][0].class).toBeUndefined();
	});

	it('maps 256-color indices < 16 to the 16-color classes', () => {
		expect(spans(`${E}[38;5;1mx`)[0][0].class).toBe('ansi-fg-31');
		expect(spans(`${E}[38;5;9mx`)[0][0].class).toBe('ansi-fg-91');
	});

	it('maps 256-color indices >= 16 to concrete fills', () => {
		// 196 = cube(5,0,0) = #ff0000; 232 = first grayscale = #080808
		expect(spans(`${E}[38;5;196mx`)[0][0].fill).toBe('#ff0000');
		expect(spans(`${E}[38;5;232mx`)[0][0].fill).toBe('#080808');
	});

	it('parses truecolor foregrounds', () => {
		expect(spans(`${E}[38;2;1;2;3mx`)[0][0].fill).toBe('rgb(1,2,3)');
	});

	it('bakes dim into concrete fills (inline styles beat the class rules)', () => {
		expect(spans(`${E}[2;38;2;255;0;0mx`)[0][0].fill).toBe(
			'color-mix(in srgb, rgb(255,0,0) 55%, var(--ansi-default-bg, var(--_ansi-default-bg, Canvas)))'
		);
		expect(spans(`${E}[2;38;5;196mx`)[0][0].class).toBe('ansi-dim');
	});

	it('39 resets foreground only', () => {
		const [row] = spans(`${E}[1;31mx${E}[39my`);
		expect(row[1].class).toBe('ansi-bold');
	});

	it('22 resets bold and dim', () => {
		const [row] = spans(`${E}[1;2;31mx${E}[22my`);
		expect(row[1].class).toBe('ansi-fg-31');
	});

	it('later background codes override earlier ones', () => {
		const [row] = spans(`${E}[41;48;5;196;48;2;1;2;3mx`);
		expect(row[0].bgClass).toBeUndefined();
		expect(row[0].bgFill).toBe('rgb(1,2,3)');
	});

	it('parses italic, underline, blink and strikethrough', () => {
		const [row] = spans(`${E}[3;4;5;9mx`);
		expect(row[0].class).toBe('ansi-italic ansi-underline ansi-blink ansi-strike');
	});

	it('resets attributes individually', () => {
		const [row] = spans(`${E}[3;4;5;7;9mx${E}[23;24;25;27;29my`);
		expect(row[1].class).toBeUndefined();
	});

	it('parses 16-color backgrounds into bg classes', () => {
		expect(spans(`${E}[41mx`)[0][0].bgClass).toBe('ansi-bg-41');
		expect(spans(`${E}[103mx`)[0][0].bgClass).toBe('ansi-bg-103');
		expect(spans(`${E}[48;5;2mx`)[0][0].bgClass).toBe('ansi-bg-42');
	});

	it('parses concrete backgrounds into bg fills', () => {
		expect(spans(`${E}[48;5;236mx`)[0][0].bgFill).toBe('#303030');
		expect(spans(`${E}[48;2;1;2;3mx`)[0][0].bgFill).toBe('rgb(1,2,3)');
	});

	it('49 resets background only', () => {
		const [row] = spans(`${E}[31;41mx${E}[49my`);
		expect(row[1]).toEqual({
			text: 'y',
			class: 'ansi-fg-31',
			fill: undefined,
			bgClass: undefined,
			bgFill: undefined
		});
	});

	it('inverse swaps foreground and background', () => {
		const [row] = spans(`${E}[7;31;44mx`);
		expect(row[0].class).toBe('ansi-fg-34');
		expect(row[0].bgClass).toBe('ansi-bg-41');
	});

	it('inverse with only a foreground paints glyphs in the default bg color', () => {
		const [row] = spans(`${E}[7;31mx`);
		expect(row[0].class).toBe('ansi-inverse');
		expect(row[0].bgClass).toBe('ansi-bg-41');
	});

	it('inverse with no colors renders a default-fg block', () => {
		const [row] = spans(`${E}[7mx`);
		expect(row[0].class).toBe('ansi-inverse');
		expect(row[0].bgClass).toBe('ansi-bg-inverse');
	});

	it('skips unknown SGR codes', () => {
		expect(spans(`${E}[8;51;73;36mx`)[0][0].class).toBe('ansi-fg-36');
	});

	it('consumes colon-subparameter SGR sequences without effect', () => {
		const [row] = spans(`${E}[38:2::255:0:0mred${E}[4:3mx`);
		expect(row.map((s) => s.text).join('')).toBe('redx');
		for (const s of row) expect(s.class).toBeUndefined();
	});

	it('consumes underline-color (58) sub-params instead of leaking them', () => {
		// 2;255;0;0 must not be misread as dim + reset
		expect(spans(`${E}[4;58;2;255;0;0mu`)[0][0].class).toBe('ansi-underline');
		// 5;196 must not be misread as blink
		expect(spans(`${E}[58;5;196mx`)[0][0].class).toBeUndefined();
	});

	it('strips CSI sequences with intermediate bytes', () => {
		expect(spans(`${E}[1 qa`)[0][0].text).toBe('a');
	});

	it('drops out-of-range 256-color indices', () => {
		expect(spans(`${E}[38;5;300mx`)[0][0].fill).toBeUndefined();
	});

	it('drops truncated truecolor sequences', () => {
		expect(spans(`${E}[38;2;1mx`)[0][0].fill).toBeUndefined();
	});

	it('strips non-SGR escape sequences', () => {
		expect(spans(`${E}[2Ka${E}[1;1Hb${E}(Bc`)).toEqual([[{ text: 'abc' }]]);
	});

	it('strips DCS/APC string sequences including their payload', () => {
		expect(spans(`${E}Pq#0;2;0;0;0${E}\\hello`)[0][0].text).toBe('hello');
		expect(spans(`${E}_payload${E}\\x`)[0][0].text).toBe('x');
	});

	it('strips control-string payloads spanning newlines without row breaks', () => {
		expect(spans(`a${E}Pline1\nline2${E}\\b`)).toEqual([[{ text: 'ab' }]]);
		expect(spans(`${E}]0;ti\ntle${E}\\after\nnext`).length).toBe(2);
	});

	it('strips OSC sequences (BEL- or ST-terminated)', () => {
		expect(spans(`${E}]8;;https://ex.com${E}\\link${E}]8;;${E}\\`)[0][0].text).toBe('link');
		expect(spans(`${E}]0;title\x07after`)[0][0].text).toBe('after');
	});

	it('splits CRLF without leaving \\r cells', () => {
		expect(spans('ab\r\ncd')).toEqual([[{ text: 'ab' }], [{ text: 'cd' }]]);
	});

	it('expands tabs to 8-column stops', () => {
		expect(spans('a\tb')[0][0].text).toBe('a       b');
		// wide char counts as 2 columns toward the stop
		expect(spans('你\tb')[0][0].text).toBe('你      b');
	});

	it('expands tabs against columns styled earlier in the row', () => {
		expect(
			spans(`${E}[31mab${E}[0m\tc`)[0]
				.map((s) => s.text)
				.join('')
		).toBe('ab      c');
	});

	it('drops other C0 controls (bare \\r, BEL, backspace)', () => {
		expect(spans('40%\r90%')[0][0].text).toBe('40%90%');
		expect(spans('a\x07b\x08c')[0][0].text).toBe('abc');
	});

	it('treats empty SGR params as reset', () => {
		const [row] = spans(`${E}[31ma${E}[mb`);
		expect(row[1].class).toBeUndefined();
	});

	it('rewrites a break that received no text instead of stacking breaks', () => {
		const [row] = parseAnsi(`${E}[31m${E}[32mx`);
		expect(row.breaks).toEqual([{ offset: 0, style: expect.objectContaining({ class: 'ansi-fg-32' }) }]);
	});

	it('drops a break that a later escape undoes before any text', () => {
		expect(parseAnsi(`a${E}[31m${E}[0mb`)[0].breaks).toEqual([]);
	});
});
