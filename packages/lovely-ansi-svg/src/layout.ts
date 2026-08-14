import type { ParsedRow, Style } from './ansi.js';
import { clusters, clusterWidth } from './width.js';

/**
 * A run of glyphs sharing one foreground style, in display-column units.
 * `cols` holds the starting column of each grapheme cluster in `text`
 * (rendered as a per-code-point `x` list, which pins glyphs to the cell grid
 * and — deliberately — suppresses ligatures). A multi-code-point cluster
 * (ZWJ emoji) is always a run of its own with a single `cols` entry, so an
 * x list can never tear it apart.
 */
export interface GlyphRun {
	class?: string;
	fill?: string;
	cols: number[];
	text: string;
}

/** A background run: full-cell columns `[start, end)` sharing one bg style. */
export interface BgRun {
	class?: string;
	fill?: string;
	start: number;
	end: number;
}

/** One laid-out row; `width` is the row's total display columns. */
export interface LayoutRow {
	runs: GlyphRun[];
	bgs: BgRun[];
	width: number;
}

const EMPTY: Style = {};

/**
 * Lay a parsed row out on the column grid: segment the row text into grapheme
 * clusters (the single segmentation pass), assign each cluster the style
 * active at its first code unit, and merge into runs. Foreground runs break
 * on fg style changes; background runs are merged independently, on bg style
 * only, so blocks stay solid across fg changes. Zero-width clusters (stray
 * combining marks with no base) are dropped.
 */
export function layoutRow(row: ParsedRow): LayoutRow {
	const runs: GlyphRun[] = [];
	const bgs: BgRun[] = [];
	let col = 0;
	let offset = 0;
	let bi = -1;
	let style = EMPTY;
	let cur: GlyphRun | null = null;
	let bgCur: { class?: string; fill?: string; start: number } | null = null;
	const flush = () => {
		if (cur && cur.text) runs.push(cur);
		cur = null;
	};
	const bgFlush = () => {
		if (bgCur && col > bgCur.start) bgs.push({ class: bgCur.class, fill: bgCur.fill, start: bgCur.start, end: col });
		bgCur = null;
	};
	for (const cl of clusters(row.text)) {
		while (bi + 1 < row.breaks.length && row.breaks[bi + 1].offset <= offset) {
			bi++;
			style = row.breaks[bi].style;
		}
		offset += cl.length;
		const w = clusterWidth(cl);
		if (w === 0) continue;
		const hasBg = style.bgClass !== undefined || style.bgFill !== undefined;
		if (bgCur && (!hasBg || bgCur.class !== style.bgClass || bgCur.fill !== style.bgFill)) bgFlush();
		if (hasBg && !bgCur) bgCur = { class: style.bgClass, fill: style.bgFill, start: col };
		if ([...cl].length > 1) {
			flush();
			runs.push({ class: style.class, fill: style.fill, cols: [col], text: cl });
		} else {
			if (!cur || cur.class !== style.class || cur.fill !== style.fill) {
				flush();
				cur = { class: style.class, fill: style.fill, cols: [], text: '' };
			}
			cur.cols.push(col);
			cur.text += cl;
		}
		col += w;
	}
	bgFlush();
	flush();
	return { runs, bgs, width: col };
}

/** Lay out all rows. */
export const layout = (rows: ParsedRow[]): LayoutRow[] => rows.map(layoutRow);
