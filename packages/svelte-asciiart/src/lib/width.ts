// Display-width for monospace grids: grapheme clusters and their column count.
// Compact by design — coarse EAW Wide/Fullwidth ranges + emoji presentation,
// not a full generated table. Good enough for box art; swap in a real table if
// exotic scripts misalign.

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Iterate grapheme clusters so no consumer can split one. */
export function* clusters(s: string): Generator<string> {
	for (const seg of segmenter.segment(s)) yield seg.segment;
}

// East Asian Wide + Fullwidth, coarse ranges (CJK, Hangul, Kana, fullwidth forms).
const WIDE: [number, number][] = [
	[0x1100, 0x115f],
	[0x2e80, 0x303e],
	[0x3041, 0x33ff],
	[0x3400, 0x4dbf],
	[0x4e00, 0x9fff],
	[0xa000, 0xa4cf],
	[0xa960, 0xa97f],
	[0xac00, 0xd7a3],
	[0xf900, 0xfaff],
	[0xfe10, 0xfe19],
	[0xfe30, 0xfe6f],
	[0xff00, 0xff60],
	[0xffe0, 0xffe6],
	[0x20000, 0x3fffd]
];

const EMOJI = /\p{Emoji_Presentation}/u;
const ZERO_WIDTH = /^[\p{Mn}\p{Me}\u200b-\u200d\ufeff]+$/u;
/** Leading combining marks / zero-width joiners of a string. */
export const LEADING_ZERO_WIDTH = /^[\p{Mn}\p{Me}\u200b-\u200d\ufeff]+/u;
const VS16 = 0xfe0f;

/**
 * Columns one grapheme cluster occupies: 2 for CJK/emoji (incl. VS16-forced
 * emoji presentation and flag pairs), 0 for pure combining/zero-width, else 1.
 */
export function clusterWidth(cluster: string): number {
	let wide = false;
	let regional = 0;
	for (const ch of cluster) {
		const cp = ch.codePointAt(0)!;
		if (cp === VS16) wide = true;
		if (cp >= 0x1f1e6 && cp <= 0x1f1ff) regional++;
		if (EMOJI.test(ch) || WIDE.some(([lo, hi]) => cp >= lo && cp <= hi)) wide = true;
	}
	if (regional >= 2) wide = true;
	if (wide) return 2;
	return ZERO_WIDTH.test(cluster) ? 0 : 1;
}

/** Display columns of a string. */
export function displayWidth(s: string): number {
	let w = 0;
	for (const cl of clusters(s)) w += clusterWidth(cl);
	return w;
}
