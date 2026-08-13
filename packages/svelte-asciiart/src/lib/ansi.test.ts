import { describe, it, expect } from 'vitest';
import { ansiToSpans } from './ansi.js';

const E = '\x1b';

describe('ansiToSpans', () => {
	it('returns unstyled spans for plain text', () => {
		expect(ansiToSpans('ab\ncd')).toEqual([
			[{ text: 'ab', class: undefined, fill: undefined }],
			[{ text: 'cd', class: undefined, fill: undefined }]
		]);
	});

	it('parses 16-color foregrounds into classes', () => {
		const [row] = ansiToSpans(`a${E}[31mred${E}[0mb`);
		expect(row).toEqual([
			{ text: 'a', class: undefined, fill: undefined },
			{ text: 'red', class: 'ansi-fg-31', fill: undefined },
			{ text: 'b', class: undefined, fill: undefined }
		]);
	});

	it('combines bold/dim with color classes', () => {
		const [row] = ansiToSpans(`${E}[1;2;96mx`);
		expect(row[0].class).toBe('ansi-bold ansi-dim ansi-fg-96');
	});

	it('persists state across lines until reset', () => {
		const rows = ansiToSpans(`${E}[36mline1\nline2${E}[0m\nline3`);
		expect(rows[0][0].class).toBe('ansi-fg-36');
		expect(rows[1][0].class).toBe('ansi-fg-36');
		expect(rows[2][0].class).toBeUndefined();
	});

	it('maps 256-color indices < 16 to the 16-color classes', () => {
		expect(ansiToSpans(`${E}[38;5;1mx`)[0][0].class).toBe('ansi-fg-31');
		expect(ansiToSpans(`${E}[38;5;9mx`)[0][0].class).toBe('ansi-fg-91');
	});

	it('maps 256-color indices >= 16 to concrete fills', () => {
		// 196 = cube(5,0,0) = #ff0000; 232 = first grayscale = #080808
		expect(ansiToSpans(`${E}[38;5;196mx`)[0][0].fill).toBe('#ff0000');
		expect(ansiToSpans(`${E}[38;5;232mx`)[0][0].fill).toBe('#080808');
	});

	it('parses truecolor foregrounds', () => {
		expect(ansiToSpans(`${E}[38;2;1;2;3mx`)[0][0].fill).toBe('rgb(1,2,3)');
	});

	it('39 resets foreground only', () => {
		const [row] = ansiToSpans(`${E}[1;31mx${E}[39my`);
		expect(row[1].class).toBe('ansi-bold');
	});

	it('22 resets bold and dim', () => {
		const [row] = ansiToSpans(`${E}[1;2;31mx${E}[22my`);
		expect(row[1].class).toBe('ansi-fg-31');
	});

	it('later background codes override earlier ones', () => {
		const [row] = ansiToSpans(`${E}[41;48;5;196;48;2;1;2;3mx`);
		expect(row[0].bgClass).toBeUndefined();
		expect(row[0].bgFill).toBe('rgb(1,2,3)');
	});

	it('parses italic, underline, blink and strikethrough', () => {
		const [row] = ansiToSpans(`${E}[3;4;5;9mx`);
		expect(row[0].class).toBe('ansi-italic ansi-underline ansi-blink ansi-strike');
	});

	it('resets attributes individually', () => {
		const [row] = ansiToSpans(`${E}[3;4;5;7;9mx${E}[23;24;25;27;29my`);
		expect(row[1].class).toBeUndefined();
	});

	it('parses 16-color backgrounds into bg classes', () => {
		expect(ansiToSpans(`${E}[41mx`)[0][0].bgClass).toBe('ansi-bg-41');
		expect(ansiToSpans(`${E}[103mx`)[0][0].bgClass).toBe('ansi-bg-103');
		expect(ansiToSpans(`${E}[48;5;2mx`)[0][0].bgClass).toBe('ansi-bg-42');
	});

	it('parses concrete backgrounds into bg fills', () => {
		expect(ansiToSpans(`${E}[48;5;236mx`)[0][0].bgFill).toBe('#303030');
		expect(ansiToSpans(`${E}[48;2;1;2;3mx`)[0][0].bgFill).toBe('rgb(1,2,3)');
	});

	it('49 resets background only', () => {
		const [row] = ansiToSpans(`${E}[31;41mx${E}[49my`);
		expect(row[1]).toEqual({
			text: 'y',
			class: 'ansi-fg-31',
			fill: undefined,
			bgClass: undefined,
			bgFill: undefined
		});
	});

	it('inverse swaps foreground and background', () => {
		const [row] = ansiToSpans(`${E}[7;31;44mx`);
		expect(row[0].class).toBe('ansi-fg-34');
		expect(row[0].bgClass).toBe('ansi-bg-41');
	});

	it('inverse with only a foreground paints glyphs in the default bg color', () => {
		const [row] = ansiToSpans(`${E}[7;31mx`);
		expect(row[0].class).toBe('ansi-inverse');
		expect(row[0].bgClass).toBe('ansi-bg-41');
	});

	it('inverse with no colors renders a default-fg block', () => {
		const [row] = ansiToSpans(`${E}[7mx`);
		expect(row[0].class).toBe('ansi-inverse');
		expect(row[0].bgClass).toBe('ansi-bg-inverse');
	});

	it('skips unknown SGR codes', () => {
		expect(ansiToSpans(`${E}[8;51;73;36mx`)[0][0].class).toBe('ansi-fg-36');
	});

	it('consumes colon-subparameter SGR sequences without effect', () => {
		const [row] = ansiToSpans(`${E}[38:2::255:0:0mred${E}[4:3mx`);
		expect(row.map((s) => s.text).join('')).toBe('redx');
		for (const s of row) expect(s.class).toBeUndefined();
	});

	it('consumes underline-color (58) sub-params instead of leaking them', () => {
		// 2;255;0;0 must not be misread as dim + reset
		expect(ansiToSpans(`${E}[4;58;2;255;0;0mu`)[0][0].class).toBe('ansi-underline');
		// 5;196 must not be misread as blink
		expect(ansiToSpans(`${E}[58;5;196mx`)[0][0].class).toBeUndefined();
	});

	it('strips CSI sequences with intermediate bytes', () => {
		expect(ansiToSpans(`${E}[1 qa`)[0][0].text).toBe('a');
	});

	it('drops out-of-range 256-color indices', () => {
		expect(ansiToSpans(`${E}[38;5;300mx`)[0][0].fill).toBeUndefined();
	});

	it('drops truncated truecolor sequences', () => {
		expect(ansiToSpans(`${E}[38;2;1mx`)[0][0].fill).toBeUndefined();
	});

	it('strips non-SGR escape sequences', () => {
		const [row] = ansiToSpans(`${E}[2Ka${E}[1;1Hb${E}(Bc`);
		expect(row.map((s) => s.text).join('')).toBe('abc');
	});

	it('strips DCS/APC string sequences including their payload', () => {
		expect(ansiToSpans(`${E}Pq#0;2;0;0;0${E}\\hello`)[0][0].text).toBe('hello');
		expect(ansiToSpans(`${E}_payload${E}\\x`)[0][0].text).toBe('x');
	});

	it('strips control-string payloads spanning newlines without row breaks', () => {
		expect(ansiToSpans(`a${E}Pline1\nline2${E}\\b`)).toEqual([
			[
				{ text: 'a', class: undefined, fill: undefined },
				{ text: 'b', class: undefined, fill: undefined }
			]
		]);
		expect(ansiToSpans(`${E}]0;ti\ntle${E}\\after\nnext`).length).toBe(2);
	});

	it('strips OSC sequences (BEL- or ST-terminated)', () => {
		expect(ansiToSpans(`${E}]8;;https://ex.com${E}\\link${E}]8;;${E}\\`)[0][0].text).toBe('link');
		expect(ansiToSpans(`${E}]0;title\x07after`)[0][0].text).toBe('after');
	});

	it('splits CRLF without leaving \\r cells', () => {
		expect(ansiToSpans('ab\r\ncd')).toEqual([
			[{ text: 'ab', class: undefined, fill: undefined }],
			[{ text: 'cd', class: undefined, fill: undefined }]
		]);
	});

	it('expands tabs to 8-column stops', () => {
		expect(ansiToSpans('a\tb')[0][0].text).toBe('a       b');
		// wide char counts as 2 columns toward the stop
		expect(ansiToSpans('你\tb')[0][0].text).toBe('你      b');
	});

	it('reattaches combining marks split off their base by an escape', () => {
		const [row] = ansiToSpans(`e${E}[31m\u0301x`);
		expect(row[0].text).toBe('e\u0301');
		expect(row[1]).toMatchObject({ text: 'x', class: 'ansi-fg-31' });
	});

	it('drops other C0 controls (bare \\r, BEL, backspace)', () => {
		expect(ansiToSpans('40%\r90%')[0][0].text).toBe('40%90%');
		expect(ansiToSpans('a\x07b\x08c')[0][0].text).toBe('abc');
	});

	it('treats empty SGR params as reset', () => {
		const [row] = ansiToSpans(`${E}[31ma${E}[mb`);
		expect(row[1].class).toBeUndefined();
	});
});
