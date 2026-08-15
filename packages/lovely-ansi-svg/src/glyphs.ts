import { fmt } from './fmt.js';

/**
 * Custom-drawn glyphs: box drawing (U+2500–U+257F) and block elements
 * (U+2580–U+259F) as exact-cell rects/paths instead of font glyphs — the
 * xterm `customGlyphs` approach. Font-rendered box characters overshoot or
 * underfill the cell depending on the font, breaking seamless tiling; drawn
 * shapes are exact at any cell aspect.
 *
 * Coordinates: a cell is `w` wide and 1 tall at `(x, y)`. Thicknesses are in
 * cell heights (the viewBox is uniform, so they are the same on both axes).
 */

const LIGHT = 0.1;
const HEAVY = 0.2;
/** Center offset of each line of a double from the middle. */
const DSEP = 0.1;

export interface GlyphShape {
	/** Path data, absolute coordinates. */
	d: string;
	/** Stroke width — stroke the path instead of filling it (arcs, diagonals). */
	strokeWidth?: number;
	/** Fill opacity (shade blocks). */
	opacity?: number;
}

/** Chars {@link customGlyph} can draw. */
export const isCustomGlyph = (cp: number): boolean => cp >= 0x2500 && cp <= 0x259f;

const rect = (x: number, y: number, w: number, h: number) => `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}Z`;

// Straight box-drawing chars as four half-arms, encoded 'udlr' with
// 0 = none, 1 = light, 2 = heavy; keyed by codepoint - 0x2500.
// prettier-ignore
const ARMS: Record<number, string> = {
	0x00: '0011' /* ─ */, 0x01: '0022' /* ━ */, 0x02: '1100' /* │ */, 0x03: '2200' /* ┃ */,
	0x0c: '0101' /* ┌ */, 0x0d: '0102' /* ┍ */, 0x0e: '0201' /* ┎ */, 0x0f: '0202' /* ┏ */,
	0x10: '0110' /* ┐ */, 0x11: '0120' /* ┑ */, 0x12: '0210' /* ┒ */, 0x13: '0220' /* ┓ */,
	0x14: '1001' /* └ */, 0x15: '1002' /* ┕ */, 0x16: '2001' /* ┖ */, 0x17: '2002' /* ┗ */,
	0x18: '1010' /* ┘ */, 0x19: '1020' /* ┙ */, 0x1a: '2010' /* ┚ */, 0x1b: '2020' /* ┛ */,
	0x1c: '1101' /* ├ */, 0x1d: '1102' /* ┝ */, 0x1e: '2101' /* ┞ */, 0x1f: '1201' /* ┟ */,
	0x20: '2201' /* ┠ */, 0x21: '2102' /* ┡ */, 0x22: '1202' /* ┢ */, 0x23: '2202' /* ┣ */,
	0x24: '1110' /* ┤ */, 0x25: '1120' /* ┥ */, 0x26: '2110' /* ┦ */, 0x27: '1210' /* ┧ */,
	0x28: '2210' /* ┨ */, 0x29: '2120' /* ┩ */, 0x2a: '1220' /* ┪ */, 0x2b: '2220' /* ┫ */,
	0x2c: '0111' /* ┬ */, 0x2d: '0121' /* ┭ */, 0x2e: '0112' /* ┮ */, 0x2f: '0122' /* ┯ */,
	0x30: '0211' /* ┰ */, 0x31: '0221' /* ┱ */, 0x32: '0212' /* ┲ */, 0x33: '0222' /* ┳ */,
	0x34: '1011' /* ┴ */, 0x35: '1021' /* ┵ */, 0x36: '1012' /* ┶ */, 0x37: '1022' /* ┷ */,
	0x38: '2011' /* ┸ */, 0x39: '2021' /* ┹ */, 0x3a: '2012' /* ┺ */, 0x3b: '2022' /* ┻ */,
	0x3c: '1111' /* ┼ */, 0x3d: '1121' /* ┽ */, 0x3e: '1112' /* ┾ */, 0x3f: '1122' /* ┿ */,
	0x40: '2111' /* ╀ */, 0x41: '1211' /* ╁ */, 0x42: '2211' /* ╂ */, 0x43: '2121' /* ╃ */,
	0x44: '2112' /* ╄ */, 0x45: '1221' /* ╅ */, 0x46: '1212' /* ╆ */, 0x47: '2122' /* ╇ */,
	0x48: '1222' /* ╈ */, 0x49: '2221' /* ╉ */, 0x4a: '2212' /* ╊ */, 0x4b: '2222' /* ╋ */,
	0x74: '0010' /* ╴ */, 0x75: '1000' /* ╵ */, 0x76: '0001' /* ╶ */, 0x77: '0100' /* ╷ */,
	0x78: '0020' /* ╸ */, 0x79: '2000' /* ╹ */, 0x7a: '0002' /* ╺ */, 0x7b: '0200' /* ╻ */,
	0x7c: '0012' /* ╼ */, 0x7d: '1200' /* ╽ */, 0x7e: '0021' /* ╾ */, 0x7f: '2100' /* ╿ */
};

// Dashed lines: [horizontal, dash count, heavy], keyed by codepoint - 0x2500.
// prettier-ignore
const DASHES: Record<number, [boolean, number, boolean]> = {
	0x04: [true, 3, false] /* ┄ */, 0x05: [true, 3, true] /* ┅ */, 0x06: [false, 3, false] /* ┆ */, 0x07: [false, 3, true] /* ┇ */,
	0x08: [true, 4, false] /* ┈ */, 0x09: [true, 4, true] /* ┉ */, 0x0a: [false, 4, false] /* ┊ */, 0x0b: [false, 4, true] /* ┋ */,
	0x4c: [true, 2, false] /* ╌ */, 0x4d: [true, 2, true] /* ╍ */, 0x4e: [false, 2, false] /* ╎ */, 0x4f: [false, 2, true] /* ╏ */
};

// Quadrant blocks as [upper-left, upper-right, lower-left, lower-right],
// keyed by codepoint - 0x2596.
// prettier-ignore
const QUADRANTS: number[][] = [
	[0, 0, 1, 0] /* ▖ */, [0, 0, 0, 1] /* ▗ */, [1, 0, 0, 0] /* ▘ */, [1, 0, 1, 1] /* ▙ */,
	[1, 0, 0, 1] /* ▚ */, [1, 1, 1, 0] /* ▛ */, [1, 1, 0, 1] /* ▜ */, [0, 1, 0, 0] /* ▝ */,
	[0, 1, 1, 0] /* ▞ */, [0, 1, 1, 1] /* ▟ */
];

/** The four straight half-arms, joined cleanly at the center. */
function arms(spec: string, x: number, y: number, w: number): string {
	const [u, d, l, r] = [...spec].map(Number);
	const th = (wt: number) => (wt === 2 ? HEAVY : LIGHT);
	const cx = x + w / 2;
	const cy = y + 0.5;
	// arms extend past the center by half the thickest perpendicular arm, so
	// corners and tees join without notches or nubs
	const vHalf = Math.max(u ? th(u) : 0, d ? th(d) : 0) / 2;
	const hHalf = Math.max(l ? th(l) : 0, r ? th(r) : 0) / 2;
	const parts: string[] = [];
	if (l) parts.push(rect(x, cy - th(l) / 2, w / 2 + vHalf, th(l)));
	if (r) parts.push(rect(cx - vHalf, cy - th(r) / 2, w / 2 + vHalf, th(r)));
	if (u) parts.push(rect(cx - th(u) / 2, y, th(u), 0.5 + hHalf));
	if (d) parts.push(rect(cx - th(d) / 2, cy - hHalf, th(d), 0.5 + hHalf));
	return parts.join('');
}

function dashes(horiz: boolean, n: number, heavy: boolean, x: number, y: number, w: number): string {
	const t = heavy ? HEAVY : LIGHT;
	const len = (horiz ? w : 1) / n;
	const gap = len * 0.3;
	const parts: string[] = [];
	for (let i = 0; i < n; i++) {
		const s = i * len + gap / 2;
		if (horiz) parts.push(rect(x + s, y + 0.5 - t / 2, len - gap, t));
		else parts.push(rect(x + w / 2 - t / 2, y + s, t, len - gap));
	}
	return parts.join('');
}

/** Double-line chars U+2550–U+256C: explicit per-char geometry. */
function doubles(off: number, x: number, y: number, w: number): string {
	const t = LIGHT;
	const g = DSEP;
	const cx = x + w / 2;
	const cy = y + 0.5;
	const R = x + w;
	const B = y + 1;
	const h = (x0: number, x1: number, yc: number) => rect(x0, yc - t / 2, x1 - x0, t);
	const v = (y0: number, y1: number, xc: number) => rect(xc - t / 2, y0, t, y1 - y0);
	switch (off) {
		case 0x50 /* ═ */:
			return h(x, R, cy - g) + h(x, R, cy + g);
		case 0x51 /* ║ */:
			return v(y, B, cx - g) + v(y, B, cx + g);
		case 0x52 /* ╒ */:
			return h(cx - t / 2, R, cy - g) + h(cx - t / 2, R, cy + g) + v(cy - g - t / 2, B, cx);
		case 0x53 /* ╓ */:
			return v(cy - t / 2, B, cx - g) + v(cy - t / 2, B, cx + g) + h(cx - g - t / 2, R, cy);
		case 0x54 /* ╔ */:
			return h(cx - g - t / 2, R, cy - g) + h(cx + g - t / 2, R, cy + g) + v(cy - g - t / 2, B, cx - g) + v(cy + g - t / 2, B, cx + g);
		case 0x55 /* ╕ */:
			return h(x, cx + t / 2, cy - g) + h(x, cx + t / 2, cy + g) + v(cy - g - t / 2, B, cx);
		case 0x56 /* ╖ */:
			return v(cy - t / 2, B, cx - g) + v(cy - t / 2, B, cx + g) + h(x, cx + g + t / 2, cy);
		case 0x57 /* ╗ */:
			return h(x, cx + g + t / 2, cy - g) + h(x, cx - g + t / 2, cy + g) + v(cy - g - t / 2, B, cx + g) + v(cy + g - t / 2, B, cx - g);
		case 0x58 /* ╘ */:
			return h(cx - t / 2, R, cy - g) + h(cx - t / 2, R, cy + g) + v(y, cy + g + t / 2, cx);
		case 0x59 /* ╙ */:
			return v(y, cy + t / 2, cx - g) + v(y, cy + t / 2, cx + g) + h(cx - g - t / 2, R, cy);
		case 0x5a /* ╚ */:
			return h(cx + g - t / 2, R, cy - g) + h(cx - g - t / 2, R, cy + g) + v(y, cy - g + t / 2, cx + g) + v(y, cy + g + t / 2, cx - g);
		case 0x5b /* ╛ */:
			return h(x, cx + t / 2, cy - g) + h(x, cx + t / 2, cy + g) + v(y, cy + g + t / 2, cx);
		case 0x5c /* ╜ */:
			return v(y, cy + t / 2, cx - g) + v(y, cy + t / 2, cx + g) + h(x, cx + g + t / 2, cy);
		case 0x5d /* ╝ */:
			return h(x, cx - g + t / 2, cy - g) + h(x, cx + g + t / 2, cy + g) + v(y, cy - g + t / 2, cx - g) + v(y, cy + g + t / 2, cx + g);
		case 0x5e /* ╞ */:
			return v(y, B, cx) + h(cx - t / 2, R, cy - g) + h(cx - t / 2, R, cy + g);
		case 0x5f /* ╟ */:
			return v(y, B, cx - g) + v(y, B, cx + g) + h(cx + g - t / 2, R, cy);
		case 0x60 /* ╠ */:
			return (
				v(y, B, cx - g) +
				v(y, cy - g + t / 2, cx + g) +
				v(cy + g - t / 2, B, cx + g) +
				h(cx + g - t / 2, R, cy - g) +
				h(cx + g - t / 2, R, cy + g)
			);
		case 0x61 /* ╡ */:
			return v(y, B, cx) + h(x, cx + t / 2, cy - g) + h(x, cx + t / 2, cy + g);
		case 0x62 /* ╢ */:
			return v(y, B, cx - g) + v(y, B, cx + g) + h(x, cx - g + t / 2, cy);
		case 0x63 /* ╣ */:
			return (
				v(y, B, cx + g) +
				v(y, cy - g + t / 2, cx - g) +
				v(cy + g - t / 2, B, cx - g) +
				h(x, cx - g + t / 2, cy - g) +
				h(x, cx - g + t / 2, cy + g)
			);
		case 0x64 /* ╤ */:
			return h(x, R, cy - g) + h(x, R, cy + g) + v(cy + g - t / 2, B, cx);
		case 0x65 /* ╥ */:
			return h(x, R, cy) + v(cy - t / 2, B, cx - g) + v(cy - t / 2, B, cx + g);
		case 0x66 /* ╦ */:
			return (
				h(x, R, cy - g) +
				h(x, cx - g + t / 2, cy + g) +
				h(cx + g - t / 2, R, cy + g) +
				v(cy + g - t / 2, B, cx - g) +
				v(cy + g - t / 2, B, cx + g)
			);
		case 0x67 /* ╧ */:
			return h(x, R, cy - g) + h(x, R, cy + g) + v(y, cy - g + t / 2, cx);
		case 0x68 /* ╨ */:
			return h(x, R, cy) + v(y, cy + t / 2, cx - g) + v(y, cy + t / 2, cx + g);
		case 0x69 /* ╩ */:
			return (
				h(x, R, cy + g) +
				h(x, cx - g + t / 2, cy - g) +
				h(cx + g - t / 2, R, cy - g) +
				v(y, cy - g + t / 2, cx - g) +
				v(y, cy - g + t / 2, cx + g)
			);
		case 0x6a /* ╪ */:
			return v(y, B, cx) + h(x, R, cy - g) + h(x, R, cy + g);
		case 0x6b /* ╫ */:
			return h(x, R, cy) + v(y, B, cx - g) + v(y, B, cx + g);
		default:
			/* ╬ 0x6c */ return (
				h(x, cx - g + t / 2, cy - g) +
				h(cx + g - t / 2, R, cy - g) +
				h(x, cx - g + t / 2, cy + g) +
				h(cx + g - t / 2, R, cy + g) +
				v(y, cy - g + t / 2, cx - g) +
				v(y, cy - g + t / 2, cx + g) +
				v(cy + g - t / 2, B, cx - g) +
				v(cy + g - t / 2, B, cx + g)
			);
	}
}

/** Rounded corners U+256D–U+2570 and diagonals U+2571–U+2573, as stroked paths. */
function strokes(off: number, x: number, y: number, w: number): GlyphShape {
	const cx = x + w / 2;
	const cy = y + 0.5;
	const R = x + w;
	const B = y + 1;
	const r = Math.min(w, 1) / 2;
	const M = (px: number, py: number) => `M${fmt(px)} ${fmt(py)}`;
	const L = (px: number, py: number) => `L${fmt(px)} ${fmt(py)}`;
	const arc = (ex: number, ey: number, sweep: 0 | 1) => `A${fmt(r)} ${fmt(r)} 0 0 ${sweep} ${fmt(ex)} ${fmt(ey)}`;
	let d: string;
	switch (off) {
		case 0x6d /* ╭ */:
			d = M(cx, B) + L(cx, cy + r) + arc(cx + r, cy, 1) + L(R, cy);
			break;
		case 0x6e /* ╮ */:
			d = M(cx, B) + L(cx, cy + r) + arc(cx - r, cy, 0) + L(x, cy);
			break;
		case 0x6f /* ╯ */:
			d = M(cx, y) + L(cx, cy - r) + arc(cx - r, cy, 1) + L(x, cy);
			break;
		case 0x70 /* ╰ */:
			d = M(cx, y) + L(cx, cy - r) + arc(cx + r, cy, 0) + L(R, cy);
			break;
		case 0x71 /* ╱ */:
			d = M(R, y) + L(x, B);
			break;
		case 0x72 /* ╲ */:
			d = M(x, y) + L(R, B);
			break;
		default:
			/* ╳ 0x73 */ d = M(R, y) + L(x, B) + M(x, y) + L(R, B);
	}
	return { d, strokeWidth: LIGHT };
}

/** Block elements U+2580–U+2595 (halves, eighths, shades). */
function blocks(off: number, x: number, y: number, w: number): GlyphShape {
	const full = rect(x, y, w, 1);
	if (off === 0x00) return { d: rect(x, y, w, 0.5) }; // ▀ upper half
	if (off >= 0x01 && off <= 0x07) {
		const h = off / 8; // ▁▂▃▄▅▆▇ lower eighths
		return { d: rect(x, y + 1 - h, w, h) };
	}
	if (off === 0x08) return { d: full }; // █
	if (off >= 0x09 && off <= 0x0f) {
		const fw = (16 - off) / 8; // ▉▊▋▌▍▎▏ left eighths (7/8 … 1/8)
		return { d: rect(x, y, w * fw, 1) };
	}
	if (off === 0x10) return { d: rect(x + w / 2, y, w / 2, 1) }; // ▐ right half
	if (off <= 0x13) return { d: full, opacity: [0.25, 0.5, 0.75][off - 0x11] }; // ░▒▓
	if (off === 0x14) return { d: rect(x, y, w, 1 / 8) }; // ▔ upper eighth
	return { d: rect(x + w * (7 / 8), y, w / 8, 1) }; // ▕ right eighth
}

/**
 * The drawn shape for a codepoint in U+2500–U+259F, positioned for a `w` × 1
 * cell at `(x, y)`. Shapes fill the full cell (ignoring `glyphScale` and the
 * baseline) — exact tiling is the point.
 */
export function customGlyph(cp: number, x: number, y: number, w: number): GlyphShape {
	const off = cp - 0x2500;
	if (off >= 0x80) {
		if (off >= 0x96) {
			const q = QUADRANTS[off - 0x96];
			const parts: string[] = [];
			if (q[0]) parts.push(rect(x, y, w / 2, 0.5));
			if (q[1]) parts.push(rect(x + w / 2, y, w / 2, 0.5));
			if (q[2]) parts.push(rect(x, y + 0.5, w / 2, 0.5));
			if (q[3]) parts.push(rect(x + w / 2, y + 0.5, w / 2, 0.5));
			return { d: parts.join('') };
		}
		return blocks(off - 0x80, x, y, w);
	}
	if (ARMS[off]) return { d: arms(ARMS[off], x, y, w) };
	if (DASHES[off]) {
		const [horiz, n, heavy] = DASHES[off];
		return { d: dashes(horiz, n, heavy, x, y, w) };
	}
	if (off >= 0x6d && off <= 0x73) return strokes(off, x, y, w);
	return { d: doubles(off, x, y, w) }; // 0x50–0x6c — everything else is handled above
}
