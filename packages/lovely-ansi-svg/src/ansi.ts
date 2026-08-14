import { DIM_PCT } from './theme.js';
import { displayWidth } from './width.js';

/**
 * Style of a run of text.
 *
 * - `class`/`fill`: foreground — CSS class(es) (`ansi-bold`, `ansi-fg-31`, …,
 *   themeable via `--ansi-fg-*` vars) and/or a concrete color (256-color /
 *   truecolor) applied as inline style.
 * - `bgClass`/`bgFill`: background — same split, painted as a full-cell rect
 *   behind the text (`ansi-bg-41`, …, themeable via `--ansi-bg-*`).
 */
export interface Style {
	class?: string;
	fill?: string;
	bgClass?: string;
	bgFill?: string;
}

/** A style change: `style` applies from code-unit `offset` to the next break (or end of row). */
export interface StyleBreak {
	offset: number;
	style: Style;
}

/**
 * One row of parsed output: the escape-stripped text plus its style
 * breakpoints (sorted by offset; empty for unstyled text). Styles are overlaid
 * onto the text — grapheme segmentation happens later, in layout, over the
 * whole row, so an escape can never tear a cluster (ZWJ emoji, combining
 * marks) apart.
 */
export interface ParsedRow {
	text: string;
	breaks: StyleBreak[];
}

interface SgrState {
	/** active attribute flags, keyed by `ansi-<name>` class suffix */
	attrs: Set<string>;
	/** 30-37 / 90-97 when the fg is a themeable 16-color code */
	fgCode?: number;
	/** concrete fg color when set via 38;5;n (n>=16) or 38;2;r;g;b */
	fgFill?: string;
	/** 40-47 / 100-107 when the bg is a themeable 16-color code */
	bgCode?: number;
	/** concrete bg color when set via 48;5;n (n>=16) or 48;2;r;g;b */
	bgFill?: string;
}

const ATTR_ON: Record<number, string> = {
	1: 'bold',
	2: 'dim',
	3: 'italic',
	4: 'underline',
	5: 'blink',
	6: 'blink',
	7: 'inverse',
	9: 'strike'
};
const ATTR_OFF: Record<number, string[]> = {
	22: ['bold', 'dim'],
	23: ['italic'],
	24: ['underline'],
	25: ['blink'],
	27: ['inverse'],
	29: ['strike']
};
// stable class order for styleOf; inverse is handled as a fg/bg swap instead
const ATTR_ORDER = ['bold', 'dim', 'italic', 'underline', 'blink', 'strike'];

/** xterm 256-color index → hex, for indices >= 16 (cube + grayscale ramp). */
function xterm256(n: number): string {
	let r: number, g: number, b: number;
	if (n >= 232) {
		r = g = b = 8 + 10 * (n - 232);
	} else {
		const v = (c: number) => (c === 0 ? 0 : 55 + 40 * c);
		const i = n - 16;
		r = v(Math.floor(i / 36));
		g = v(Math.floor(i / 6) % 6);
		b = v(i % 6);
	}
	const hex = (c: number) => c.toString(16).padStart(2, '0');
	return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function applySgr(state: SgrState, params: number[]): void {
	for (let i = 0; i < params.length; i++) {
		const p = params[i];
		if (p === 0) {
			state.attrs.clear();
			state.fgCode = state.fgFill = state.bgCode = state.bgFill = undefined;
		} else if (ATTR_ON[p]) state.attrs.add(ATTR_ON[p]);
		else if (ATTR_OFF[p]) for (const a of ATTR_OFF[p]) state.attrs.delete(a);
		else if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) {
			state.fgCode = p;
			state.fgFill = undefined;
		} else if (p === 39) state.fgCode = state.fgFill = undefined;
		else if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) {
			state.bgCode = p;
			state.bgFill = undefined;
		} else if (p === 49) state.bgCode = state.bgFill = undefined;
		else if (p === 38 || p === 48) {
			// extended color: 5;n (256-color) or 2;r;g;b (truecolor)
			const mode = params[i + 1];
			let color: string | undefined;
			let index: number | undefined;
			const ok = (c: number) => Number.isInteger(c) && c >= 0 && c <= 255;
			if (mode === 5) {
				index = params[i + 2];
				if (!ok(index)) break; // malformed — drop the rest
				i += 2;
			} else if (mode === 2) {
				const [r, g, b] = [params[i + 2], params[i + 3], params[i + 4]];
				if (!ok(r) || !ok(g) || !ok(b)) break;
				color = `rgb(${r},${g},${b})`;
				i += 4;
			} else break;
			const base = p === 38 ? 30 : 40;
			let code: number | undefined;
			let fill: string | undefined;
			if (index !== undefined) {
				if (index < 16) code = index < 8 ? base + index : base + 60 + (index - 8);
				else fill = xterm256(index);
			} else fill = color;
			if (p === 38) {
				state.fgCode = code;
				state.fgFill = fill;
			} else {
				state.bgCode = code;
				state.bgFill = fill;
			}
		} else if (p === 58) {
			// underline color (unsupported): consume its sub-params so they
			// aren't misread as independent SGR codes
			const mode = params[i + 1];
			if (mode === 5) i += 2;
			else if (mode === 2) i += 4;
			else break; // malformed — drop the rest
		}
		// anything unknown: skipped (59, underline-color reset, lands here too)
	}
}

function styleOf(state: SgrState): Style {
	const classes: string[] = [];
	for (const a of ATTR_ORDER) if (state.attrs.has(a)) classes.push(`ansi-${a}`);

	let { fgCode, fgFill, bgCode, bgFill } = state;
	let bgClass: string | undefined;
	if (state.attrs.has('inverse')) {
		// swap fg and bg (class codes differ by 10). A missing bg becomes an
		// ansi-bg-inverse block (CSS: currentColor, the default fg); a missing
		// fg is marked with ansi-inverse so CSS can paint it in the default
		// background color.
		[fgCode, fgFill, bgCode, bgFill] = [
			bgCode !== undefined ? bgCode - 10 : undefined,
			bgFill,
			fgCode !== undefined ? fgCode + 10 : undefined,
			fgFill
		];
		if (fgCode === undefined && fgFill === undefined) classes.push('ansi-inverse');
		if (bgCode === undefined && bgFill === undefined) bgClass = 'ansi-bg-inverse';
	}
	if (fgCode !== undefined) classes.push(`ansi-fg-${fgCode}`);
	// concrete fills are applied inline (beating class rules), so dim — a
	// solid mix toward the background in the theme CSS — is baked in here
	if (fgFill !== undefined && state.attrs.has('dim')) fgFill = `color-mix(in srgb, ${fgFill} ${DIM_PCT}, var(--ansi-default-bg, var(--_ansi-default-bg, Canvas)))`;
	return {
		class: classes.length ? classes.join(' ') : undefined,
		fill: fgFill,
		bgClass: bgCode !== undefined ? `ansi-bg-${bgCode}` : bgClass,
		bgFill
	};
}

const sameStyle = (a: Style, b: Style) => a.class === b.class && a.fill === b.fill && a.bgClass === b.bgClass && a.bgFill === b.bgFill;

// SGR (group 1 captures params; ':' admits ITU T.416 colon subparams, which
// applySgr then skips as unknown), other CSI sequences (params + intermediates
// + final), string sequences — OSC, DCS, APC, PM, SOS — with their payload up
// to BEL or ST (e.g. OSC-8 hyperlinks, title sets, sixel), or ESC +
// intermediates + final.
const ESCAPE_RE =
	/\x1b\[([0-9;:]*)m|\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]|\x1b[\]PX^_][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[\x20-\x2f]*[\x30-\x7e]?/g;

// C0 controls (and DEL) that can appear inside a line: TAB is expanded to the
// next 8-column stop, the rest (bare \r, BEL, backspace, …) are dropped — they
// would render as tofu cells and BEL/BS are not even legal XML for exportSvg.
const C0_RE = /[\x00-\x09\x0b-\x1f\x7f]/;

/**
 * Parse text containing ANSI SGR escapes into rows of escape-stripped text
 * with style breakpoints. Style state persists across lines until reset.
 * Supported: 16-color, 256-color and truecolor foregrounds and backgrounds;
 * bold, dim, italic, underline, blink, strikethrough; inverse (rendered as a
 * fg/bg swap); resets. Unknown codes are consumed without effect; non-SGR
 * escapes are stripped. Tabs are expanded to 8-column stops; other C0
 * controls are dropped. On plain text this degenerates to one break-free row
 * per line.
 *
 * Escapes are matched over the whole text, not per line: control-string
 * payloads (OSC/DCS/APC/PM/SOS) may legally contain newlines, which must not
 * become row breaks. Rows split only on `\r?\n` in plain chunks.
 */
export function parseAnsi(text: string): ParsedRow[] {
	const state: SgrState = { attrs: new Set() };
	let curStyle: Style = {};
	const rows: ParsedRow[] = [{ text: '', breaks: [] }];
	let row = rows[0];
	// display column, tracked lazily: computed from the row's text at the
	// first tab, then kept incrementally — tab-free rows never pay the
	// displayWidth (segmentation) pass
	let col: number | null = null;
	const emit = (chunk: string) => {
		if (C0_RE.test(chunk)) {
			let out = '';
			for (const part of chunk.split(/([\x00-\x09\x0b-\x1f\x7f])/)) {
				if (part === '\t') {
					col ??= displayWidth(row.text) + displayWidth(out);
					const n = 8 - (col % 8);
					out += ' '.repeat(n);
					col += n;
				} else if (part.length === 1 && C0_RE.test(part)) continue;
				else {
					out += part;
					if (col !== null) col += displayWidth(part);
				}
			}
			chunk = out;
		} else if (col !== null) col += displayWidth(chunk);
		if (!chunk) return;
		// record a break only when the style actually changes; a break that got
		// no text is rewritten in place (or dropped if that undoes the change)
		const last = row.breaks[row.breaks.length - 1];
		if (!sameStyle(last?.style ?? {}, curStyle)) {
			if (last && last.offset === row.text.length) {
				const prev = row.breaks[row.breaks.length - 2];
				if (sameStyle(prev?.style ?? {}, curStyle)) row.breaks.pop();
				else last.style = curStyle;
			} else row.breaks.push({ offset: row.text.length, style: curStyle });
		}
		row.text += chunk;
	};
	const plain = (seg: string) => {
		const parts = seg.split(/\r?\n/);
		emit(parts[0]);
		for (let i = 1; i < parts.length; i++) {
			row = { text: '', breaks: [] };
			rows.push(row);
			col = null;
			emit(parts[i]);
		}
	};
	let pos = 0;
	for (const m of text.matchAll(ESCAPE_RE)) {
		plain(text.slice(pos, m.index));
		pos = m.index + m[0].length;
		if (m[1] !== undefined) {
			applySgr(state, m[1].split(';').map(Number));
			curStyle = styleOf(state);
		}
	}
	plain(text.slice(pos));
	return rows;
}
