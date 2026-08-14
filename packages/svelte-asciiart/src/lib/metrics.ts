/**
 * Canvas-measure cell metrics for a font family: glyph advance per em →
 * `cellAspect`, bounding-box ascent as a fraction of the bounding-box height →
 * `baseline` (lands near the classic 0.8 for typical monos). The keys match
 * `exportSvg`'s options, so the result spreads straight in:
 * `exportSvg(text, { ...measureCellMetrics(family), ... })`. Measure after
 * `document.fonts.ready` for webfonts. Returns null when measurement is
 * unavailable (no canvas, invalid font family, zero advance).
 */
export function measureCellMetrics(
	fontFamily: string
): { cellAspect: number; baseline: number } | null {
	const ctx = document.createElement('canvas').getContext('2d');
	if (!ctx) return null;
	const before = ctx.font;
	ctx.font = `100px ${fontFamily}`;
	// an invalid font shorthand is silently ignored, leaving the 10px default —
	// the measurement would be ~10x off with no error
	if (ctx.font === before) return null;
	const m = ctx.measureText('M');
	if (!(m.width > 0)) return null;
	const asc = m.fontBoundingBoxAscent;
	const desc = m.fontBoundingBoxDescent;
	return {
		cellAspect: m.width / 100,
		baseline: asc + desc > 0 ? Math.min(1, Math.max(0.5, asc / (asc + desc))) : 0.8
	};
}
