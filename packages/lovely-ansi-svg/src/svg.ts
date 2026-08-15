import { parseAnsi } from './ansi.js';
import { fmt } from './fmt.js';
import { customGlyph } from './glyphs.js';
import { layout, type GlyphRun, type LayoutRow } from './layout.js';
import { defaultTheme, type Theme } from './theme.js';

export type Margin = number | [number, number] | [number, number, number, number];

/** Geometry options shared by the render model and `exportSvg`. */
export interface RenderOptions {
	/** Frame height in cells; default: content height. */
	rows?: number;
	/** Frame width in cells; default: content width (display columns). */
	cols?: number;
	/** Margin around the frame, in cells: uniform, [v, h] or [t, r, b, l]. */
	margin?: Margin;
	/** Cell grid lines: `true` for a default faint stroke, a string for a CSS class. */
	grid?: boolean | string;
	/** Border around the frame: `true` for a default stroke, a string for a CSS class. */
	frame?: boolean | string;
	/** Cell width:height ratio; default 0.6 (typical monospace). */
	cellAspect?: number;
	/** Baseline position within the em box, 0-1 from the top; default 0.8. */
	baseline?: number;
	/** Glyph size as a fraction of cell height; default 1 (full cell — box-drawing tiles seamlessly). */
	glyphScale?: number;
	/** Pixels per cell (height) for the intrinsic width/height attributes; default 50. */
	cellSize?: number;
	/** Draw box-drawing/block chars (U+2500–U+259F) as exact-cell shapes instead of font glyphs; default true. */
	customGlyphs?: boolean;
}

export interface RenderedRun {
	/** Inline CSS (fill, font-weight, …); absent for default-styled text. */
	style?: string;
	/** space-separated x list, one per code point */
	x: string;
	text: string;
}
export interface RenderedBg {
	/** Inline CSS (the background fill). */
	style: string;
	x: string;
	y: string;
	width: string;
	height: string;
}
/** A custom-drawn glyph path (box drawing / block elements), one per style. */
export interface RenderedShape {
	d: string;
	/** Inline CSS: fill or stroke, always explicit. */
	style: string;
}
export interface RenderedRow {
	/** text baseline y */
	y: string;
	runs: RenderedRun[];
	bgs: RenderedBg[];
	shapes: RenderedShape[];
}

/**
 * Everything needed to emit the SVG, with all numbers pre-formatted as
 * attribute strings. Cell height is 1 viewBox unit; `width`/`height` are the
 * intrinsic pixel size (`cellSize` px per unit).
 */
export interface RenderModel {
	viewBox: string;
	width: string;
	height: string;
	fontSize: string;
	rows: RenderedRow[];
	grid?: { d: string; class?: string; stroke?: string; strokeOpacity?: string; strokeWidth?: string };
	frame?: { x: string; y: string; width: string; height: string; class?: string; stroke?: string; strokeWidth?: string };
}

const clampDim = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? undefined : Math.max(0, Math.floor(n)));

// one inline-CSS string per run: colors and font styling ride as `style` so
// host/extra CSS rules can't accidentally override them
function runStyle(run: GlyphRun): string | undefined {
	const parts: string[] = [];
	if (run.fill) parts.push(`fill: ${run.fill}`);
	if (run.bold) parts.push('font-weight: bold');
	if (run.italic) parts.push('font-style: italic');
	if (run.underline || run.strike) parts.push(`text-decoration:${run.underline ? ' underline' : ''}${run.strike ? ' line-through' : ''}`);
	// blink is parsed but deliberately not rendered
	return parts.length ? parts.join('; ') : undefined;
}

function parseMargin(m: Margin): { top: number; right: number; bottom: number; left: number } {
	if (typeof m === 'number') return { top: m, right: m, bottom: m, left: m };
	if (m.length === 2) return { top: m[0], right: m[1], bottom: m[0], left: m[1] };
	return { top: m[0], right: m[1], bottom: m[2], left: m[3] };
}

/**
 * Map laid-out rows to render geometry. The frame is `rows`×`cols` cells (or
 * the content size); content may overflow the frame — the render grid is
 * max(frame, content) but the viewBox is frame + margin, so a `hidden`
 * overflow clips it. `rows`/`cols` are clamped to non-negative integers.
 */
export function render(layoutRows: LayoutRow[], options: RenderOptions = {}): RenderModel {
	const { cellAspect = 0.6, baseline = 0.8, glyphScale = 1, cellSize = 50 } = options;
	const m = parseMargin(options.margin ?? 0);

	const contentRows = layoutRows.length;
	const contentCols = layoutRows.reduce((w, r) => Math.max(w, r.width), 0);
	const frameRows = clampDim(options.rows) ?? contentRows;
	const frameCols = clampDim(options.cols) ?? contentCols;
	const renderRows = Math.max(frameRows, contentRows);

	const totalCols = frameCols + m.left + m.right;
	const totalRows = frameRows + m.top + m.bottom;
	const viewBoxWidth = totalCols * cellAspect;
	const viewBoxHeight = totalRows;
	const offsetX = m.left * cellAspect;
	const offsetY = m.top;

	// center glyphs smaller than the cell: horizontal inset per cell, and the
	// baseline shifted into the centered band
	const glyphInset = ((1 - glyphScale) / 2) * cellAspect;
	const baselineY = (1 - glyphScale) / 2 + baseline * glyphScale;
	const cellX = (c: number) => fmt(offsetX + c * cellAspect + glyphInset);

	const drawGlyphs = options.customGlyphs !== false;
	const rows: RenderedRow[] = Array.from({ length: renderRows }, (_, r) => {
		const built = layoutRows[r];
		if (!built) return { y: fmt(offsetY + r + baselineY), runs: [], bgs: [], shapes: [] };
		const runs: RenderedRun[] = [];
		// custom-glyph paths, accumulated per style so a row of box drawing
		// stays one <path>; drawn full-cell (no glyphScale inset) — exact
		// tiling is the point
		const shapeAcc = new Map<string, string>();
		for (const run of built.runs) {
			if (drawGlyphs && run.custom) {
				const color = run.fill ?? 'currentColor';
				for (let i = 0; i < run.text.length; i++) {
					const g = customGlyph(run.text.charCodeAt(i), offsetX + run.cols[i] * cellAspect, offsetY + r, cellAspect);
					const style =
						g.strokeWidth !== undefined
							? `fill: none; stroke: ${color}; stroke-width: ${fmt(g.strokeWidth)}`
							: `fill: ${color}${g.opacity !== undefined ? `; fill-opacity: ${fmt(g.opacity)}` : ''}`;
					shapeAcc.set(style, (shapeAcc.get(style) ?? '') + g.d);
				}
			} else runs.push({ style: runStyle(run), x: run.cols.map(cellX).join(' '), text: run.text });
		}
		return {
			y: fmt(offsetY + r + baselineY),
			runs,
			bgs: built.bgs.map((b) => ({
				style: `fill: ${b.fill}`,
				x: fmt(offsetX + b.start * cellAspect),
				y: fmt(offsetY + r),
				width: fmt((b.end - b.start) * cellAspect),
				height: '1'
			})),
			shapes: Array.from(shapeAcc, ([style, d]) => ({ d, style }))
		};
	});

	const model: RenderModel = {
		viewBox: `0 0 ${fmt(viewBoxWidth)} ${fmt(viewBoxHeight)}`,
		width: fmt(viewBoxWidth * cellSize),
		height: fmt(viewBoxHeight * cellSize),
		fontSize: fmt(glyphScale),
		rows
	};

	// an unclassed grid/frame carries default stroke attributes on the model —
	// a bare path would be invisible; a classed one is styled via CSS
	if (options.grid) {
		const d = [
			...Array.from({ length: totalCols + 1 }, (_, c) => `M ${fmt(c * cellAspect)} 0 V ${fmt(totalRows)}`),
			...Array.from({ length: totalRows + 1 }, (_, r) => `M 0 ${fmt(r)} H ${fmt(totalCols * cellAspect)}`)
		].join(' ');
		model.grid =
			typeof options.grid === 'string'
				? { d, class: options.grid }
				: { d, stroke: 'currentColor', strokeOpacity: '0.25', strokeWidth: '0.02' };
	}

	if (options.frame) {
		model.frame = {
			x: fmt(offsetX),
			y: fmt(offsetY),
			width: fmt(frameCols * cellAspect),
			height: fmt(frameRows),
			...(typeof options.frame === 'string' ? { class: options.frame } : { stroke: 'currentColor', strokeWidth: '0.02' })
		};
	}

	return model;
}

export const DEFAULT_FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export interface ExportSvgOptions extends RenderOptions {
	/** Theme the ANSI colors resolve through. */
	theme?: Theme;
	/** font-family for the text; default: a generic monospace stack. */
	fontFamily?: string;
	/** Solid background color painted behind everything. Also becomes the theme background (what dim/inverse mix toward) unless the theme sets its own. */
	background?: string;
	/** Extra CSS appended to the `<style>` block, e.g. `@font-face` rules or grid/frame class styling. */
	extraCss?: string;
}

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escAttr = (s: string) => escText(s).replace(/"/g, '&quot;');
// undefined-tolerant attribute helper: '' when the value is absent
const attr = (name: string, value: string | undefined) => (value === undefined ? '' : ` ${name}="${escAttr(value)}"`);

/**
 * Render ANSI/ASCII text to a standalone SVG string. Pure text → string, no
 * DOM: usable in Node, SSR, workers. Colors resolve from `theme` into
 * concrete values; fonts are named, not embedded — pass `@font-face` CSS
 * (e.g. from lovely-svg-png's `collectFontCss`) via `extraCss` to make the
 * file font-standalone.
 */
export function exportSvg(text: string, options: ExportSvgOptions = {}): string {
	const base = options.theme ?? defaultTheme;
	// a painted background rect is the backdrop dim/inverse mix toward, unless
	// the theme explicitly says otherwise
	const theme = base.background === undefined && options.background !== undefined ? { ...base, background: options.background } : base;
	const model = render(layout(parseAnsi(text, theme)), options);
	const out: string[] = [];

	const rootStyle = theme.foreground ? `color: ${theme.foreground}` : undefined;
	out.push(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${model.viewBox}"` +
			` width="${model.width}" height="${model.height}" overflow="hidden"` +
			` preserveAspectRatio="xMinYMin meet"` +
			attr('font-family', options.fontFamily ?? DEFAULT_FONT_STACK) +
			attr('style', rootStyle) +
			`>`
	);

	if (options.extraCss) out.push(`<defs><style>${escText(options.extraCss)}</style></defs>`);

	if (options.background) {
		const [, , w, h] = model.viewBox.split(' ');
		out.push(`<rect width="${w}" height="${h}"${attr('fill', options.background)}/>`);
	}

	for (const row of model.rows)
		for (const b of row.bgs) out.push(`<rect${attr('style', b.style)} x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"/>`);

	if (model.grid)
		out.push(
			`<path${attr('class', model.grid.class)} d="${model.grid.d}" fill="none"` +
				attr('stroke', model.grid.stroke) +
				attr('stroke-opacity', model.grid.strokeOpacity) +
				attr('stroke-width', model.grid.strokeWidth) +
				`/>`
		);
	if (model.frame)
		out.push(
			`<rect${attr('class', model.frame.class)} x="${model.frame.x}" y="${model.frame.y}"` +
				` width="${model.frame.width}" height="${model.frame.height}" fill="none"` +
				attr('stroke', model.frame.stroke) +
				attr('stroke-width', model.frame.strokeWidth) +
				`/>`
		);

	for (const row of model.rows) for (const s of row.shapes) out.push(`<path${attr('style', s.style)} d="${s.d}"/>`);

	for (const row of model.rows) {
		if (!row.runs.length) continue;
		const tspans = row.runs.map((run) => `<tspan${attr('style', run.style)} x="${run.x}">${escText(run.text)}</tspan>`).join('');
		// xml:space on each <text>: rasterizers don't reliably inherit it from
		// the root, and collapsed space runs would mis-slot the per-char x list
		out.push(`<text y="${row.y}" font-size="${model.fontSize}" fill="currentColor" xml:space="preserve">${tspans}</text>`);
	}

	out.push('</svg>');
	return out.join('\n');
}
