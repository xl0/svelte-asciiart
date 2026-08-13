/** Format a number for SVG attributes/code output: fixed precision (default 3) with trailing zeros trimmed. */
export function fmt(n: number, digits = 3): string {
	if (!Number.isFinite(n)) return String(n);
	if (Math.abs(n) < 1e-12) return '0';
	const s = n.toFixed(digits);
	return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

// SVG style properties relevant for export
const SVG_STYLE_PROPS = [
	'fill',
	'stroke',
	'stroke-width',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-dasharray',
	'opacity',
	'font-family',
	'font-size',
	'font-weight',
	'font-style',
	'text-decoration-line',
	'color',
	'paint-order'
] as const;

/**
 * Build one CSS rule per distinct class combination found in the SVG, carrying
 * the full computed values of SVG_STYLE_PROPS. No diffing against a probe:
 * styling that reaches the element through host tag/descendant selectors must
 * survive in the standalone export, and a probe in the same document matches
 * those host rules too, which made the diff drop them. Inline-styled
 * properties are skipped — the clone keeps the inline style, and baking one
 * element's inline value into a shared class rule would leak it onto siblings
 * with the same classes. Works on mounted SVG elements only.
 */
function extractClassStyles(svgEl: SVGSVGElement): string {
	const styleRules: string[] = [];
	const processed = new Set<string>();

	svgEl.querySelectorAll('[class]').forEach((el) => {
		const classes = el.getAttribute('class')!.split(/\s+/).filter(Boolean);
		if (!classes.length) return;
		// CSS.escape: consumer classes may carry metacharacters (Tailwind's
		// `foo/50`, `[...]` variants) — unescaped they void the whole rule
		const selector = '.' + classes.map((c) => CSS.escape(c)).join('.');
		if (processed.has(selector)) return;
		processed.add(selector);

		const computed = getComputedStyle(el);
		const inline = (el as SVGElement).style;
		const declarations: string[] = [];

		SVG_STYLE_PROPS.forEach((prop) => {
			const value = computed.getPropertyValue(prop);
			if (!value || inline.getPropertyValue(prop)) return;
			declarations.push(`${prop}: ${value}`);
		});

		if (declarations.length) {
			styleRules.push(`${selector} { ${declarations.join('; ')} }`);
		}
	});

	return styleRules.join('\n');
}

// paint-affecting subset of SVG_STYLE_PROPS relevant for shapes
const SHAPE_STYLE_PROPS = [
	'fill',
	'stroke',
	'stroke-width',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-dasharray',
	'opacity',
	'paint-order'
] as const;

/**
 * Unclassed shapes (background rects, grid/frame with no *Class prop) have no
 * class rule to carry host styling, so their computed paint props are inlined
 * onto the clone directly.
 */
function inlineShapeStyles(svgEl: SVGSVGElement, clone: SVGSVGElement): void {
	const bare = (root: SVGSVGElement) =>
		Array.from(root.querySelectorAll('rect, path')).filter(
			(el) => !el.getAttribute('class')?.trim()
		);
	const src = bare(svgEl);
	const dst = bare(clone);
	src.forEach((el, i) => {
		const computed = getComputedStyle(el);
		const inline = (el as SVGElement).style;
		SHAPE_STYLE_PROPS.forEach((prop) => {
			if (inline.getPropertyValue(prop)) return;
			const value = computed.getPropertyValue(prop);
			if (value) (dst[i] as SVGElement).style.setProperty(prop, value);
		});
	});
}

/**
 * Extract computed styles for text elements (applied via CSS variables or
 * inheritance). Host CSS can style tspans differently from <text> via tag
 * selectors, so a bare tspan's delta from the <text> sample is captured in a
 * second rule (class rules still win on specificity).
 */
function extractTextStyles(svgEl: SVGSVGElement): string {
	const textEl = svgEl.querySelector('text');
	if (!textEl) return '';

	const textComputed = getComputedStyle(textEl);
	const declarations: string[] = [];

	SVG_STYLE_PROPS.forEach((prop) => {
		const value = textComputed.getPropertyValue(prop);
		if (!value) return;
		declarations.push(`${prop}: ${value}`);
	});

	if (!declarations.length) return '';
	const rules = [`text, tspan { ${declarations.join('; ')} }`];

	const bareTspan = Array.from(svgEl.querySelectorAll('tspan')).find(
		(t) => !t.getAttribute('class')?.trim() && !t.getAttribute('style')
	);
	if (bareTspan) {
		const computed = getComputedStyle(bareTspan);
		const delta = SVG_STYLE_PROPS.filter(
			(prop) => computed.getPropertyValue(prop) !== textComputed.getPropertyValue(prop)
		).map((prop) => `${prop}: ${computed.getPropertyValue(prop)}`);
		if (delta.length) rules.push(`tspan { ${delta.join('; ')} }`);
	}

	return rules.join('\n');
}

export interface ExportSvgOptions {
	/** Include background color as a rect. Default: false */
	includeBackground?: boolean;
	/** Background color to use if includeBackground is true */
	backgroundColor?: string;
	/** Extra CSS prepended to the exported <style> block, e.g. @font-face rules from collectFontCss() */
	extraCss?: string;
}

/**
 * Export an SVG element with all computed styles embedded as a <style> block.
 * The SVG must be mounted in the DOM for getComputedStyle to work.
 */
export function exportSvg(svgEl: SVGSVGElement, options: ExportSvgOptions = {}): string {
	const clone = svgEl.cloneNode(true) as SVGSVGElement;
	const cssRules: string[] = [];

	if (options.extraCss) cssRules.push(options.extraCss);

	// Extract styles from classed elements using original (mounted) element
	const classStyles = extractClassStyles(svgEl);
	if (classStyles) cssRules.push(classStyles);

	inlineShapeStyles(svgEl, clone);

	// Extract text styles
	const textStyles = extractTextStyles(svgEl);
	if (textStyles) cssRules.push(textStyles);

	// Add background rect if requested
	if (options.includeBackground && options.backgroundColor) {
		const viewBox = clone.getAttribute('viewBox');
		if (viewBox) {
			const [, , w, h] = viewBox.split(/\s+/).map(Number);
			const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			bgRect.setAttribute('width', String(w));
			bgRect.setAttribute('height', String(h));
			bgRect.setAttribute('fill', options.backgroundColor);
			clone.insertBefore(bgRect, clone.firstChild);
		}
	}

	// Embed styles in cloned SVG
	if (cssRules.length) {
		const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
		style.textContent = cssRules.join('\n');
		defs.appendChild(style);
		clone.insertBefore(defs, clone.firstChild);
	}

	return new XMLSerializer().serializeToString(clone);
}

// caches for collectFontCss: cross-origin stylesheet text and font-file data
// URIs, so repeated exports don't refetch (the demo regenerates its PNG
// preview on every debounced change)
const sheetTextCache = new Map<string, Promise<string>>();
const fontDataCache = new Map<string, Promise<string>>();

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '');

interface FontFaceSource {
	rule: CSSFontFaceRule;
	/** URL relative urls in the rule's src resolve against */
	base: string;
}

// @import url resolution ceiling — imports of imports of imports is already
// exotic; deeper is a cycle or abuse
const MAX_IMPORT_DEPTH = 3;
const IMPORT_RE = /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/g;

/** Walk a rule list, collecting @font-face rules and following @import. */
async function sheetFaces(
	rules: CSSRuleList,
	base: string,
	depth: number,
	out: FontFaceSource[]
): Promise<void> {
	for (const rule of Array.from(rules)) {
		if (rule instanceof CSSFontFaceRule) out.push({ rule, base });
		else if (rule instanceof CSSImportRule && depth < MAX_IMPORT_DEPTH) {
			let child: CSSRuleList | undefined;
			try {
				child = rule.styleSheet?.cssRules;
			} catch {
				// cross-origin import — fall through to the fetch path
			}
			if (child) await sheetFaces(child, rule.styleSheet!.href ?? base, depth + 1, out);
			else await fetchedFaces(new URL(rule.href, base).href, depth + 1, out);
		}
	}
}

/**
 * Collect @font-face rules from a stylesheet the CSSOM won't show us
 * (cross-origin): fetch the text and parse it in a constructed sheet.
 * Constructed sheets silently drop @import rules, so imports are re-extracted
 * from the raw text and followed by fetch.
 */
async function fetchedFaces(href: string, depth: number, out: FontFaceSource[]): Promise<void> {
	try {
		let text = sheetTextCache.get(href);
		if (!text) {
			text = fetch(href).then((r) => r.text());
			sheetTextCache.set(href, text);
		}
		const css = await text;
		const parsed = new CSSStyleSheet();
		parsed.replaceSync(css);
		await sheetFaces(parsed.cssRules, href, depth, out);
		if (depth < MAX_IMPORT_DEPTH)
			for (const m of css.matchAll(IMPORT_RE))
				await fetchedFaces(new URL(m[1], href).href, depth + 1, out);
	} catch {
		sheetTextCache.delete(href);
	}
}

/**
 * Collect `@font-face` rules for the font families the SVG's text uses, with
 * the font files inlined as data: URIs. Rasterizing an SVG via `new Image()`
 * happens in an isolated document that cannot load external fonts, so PNG
 * export needs this; pass the result to `exportSvg`'s `extraCss` to make an
 * SVG export font-standalone too. Cross-origin stylesheets (e.g. Google
 * Fonts) block CSSOM access and are re-fetched as text instead; @import
 * chains are followed either way. Families without a reachable @font-face
 * (system fonts) contribute nothing.
 */
export async function collectFontCss(svgEl: SVGSVGElement): Promise<string> {
	const textEl = svgEl.querySelector('text') ?? svgEl;
	const families = new Set(
		getComputedStyle(textEl)
			.fontFamily.split(',')
			.map((f) => unquote(f).toLowerCase())
	);

	const all: FontFaceSource[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			await sheetFaces(sheet.cssRules, sheet.href ?? document.baseURI, 0, all);
		} catch {
			if (sheet.href) await fetchedFaces(sheet.href, 1, all);
		}
	}
	const faces = all.filter(({ rule }) =>
		families.has(unquote(rule.style.getPropertyValue('font-family')).toLowerCase())
	);

	const cssFaces = await Promise.all(
		faces.map(async ({ rule, base }) => {
			const src = rule.style.getPropertyValue('src');
			const m = src.match(/url\(([^)]+)\)/);
			if (!m) return '';
			const url = new URL(unquote(m[1]), base).href;
			try {
				let data = fontDataCache.get(url);
				if (!data) {
					data = fetch(url)
						.then((r) => r.blob())
						.then(
							(blob) =>
								new Promise<string>((resolve, reject) => {
									const reader = new FileReader();
									reader.onload = () => resolve(reader.result as string);
									reader.onerror = () => reject(reader.error);
									reader.readAsDataURL(blob);
								})
						);
					fontDataCache.set(url, data);
				}
				const props = ['font-family', 'font-style', 'font-weight', 'unicode-range']
					.map((p) => [p, rule.style.getPropertyValue(p)])
					.filter(([, v]) => v)
					.map(([p, v]) => `${p}: ${v};`)
					.join(' ');
				return `@font-face { ${props} src: url(${await data}); }`;
			} catch {
				fontDataCache.delete(url);
				return ''; // unreachable font file — the raster falls back for this face
			}
		})
	);

	return cssFaces.filter(Boolean).join('\n');
}

export interface ExportPngOptions extends ExportSvgOptions {
	/** Scale factor for the PNG. Default: 1 */
	scale?: number;
	/** Output format. Default: 'dataUrl' */
	output?: 'dataUrl' | 'blob';
}

export interface SvgStringToPngOptions {
	/** Scale factor for the PNG. Default: 1 */
	scale?: number;
	/** Output format. Default: 'dataUrl' */
	output?: 'dataUrl' | 'blob';
}

/**
 * Convert an SVG string to PNG.
 * Uses the browser's computed dimensions from the loaded image.
 */
export async function svgStringToPng(
	svgString: string,
	options: SvgStringToPngOptions & { output: 'blob' }
): Promise<Blob>;
export async function svgStringToPng(
	svgString: string,
	options?: SvgStringToPngOptions
): Promise<string>;
export async function svgStringToPng(
	svgString: string,
	options: SvgStringToPngOptions = {}
): Promise<string | Blob> {
	const { scale = 1, output = 'dataUrl' } = options;

	const img = new Image();
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	return new Promise((resolve, reject) => {
		img.onload = () => {
			URL.revokeObjectURL(url);

			// Use browser's computed dimensions
			const width = Math.round(img.naturalWidth * scale);
			const height = Math.round(img.naturalHeight * scale);

			if (width === 0 || height === 0) {
				reject(new Error('SVG has zero dimensions - ensure it has width/height or viewBox'));
				return;
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Could not get canvas 2d context'));
				return;
			}

			ctx.drawImage(img, 0, 0, width, height);

			if (output === 'blob') {
				canvas.toBlob((blob) => {
					if (blob) resolve(blob);
					else reject(new Error('Failed to create PNG blob'));
				}, 'image/png');
			} else {
				resolve(canvas.toDataURL('image/png'));
			}
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load SVG into image'));
		};
		img.src = url;
	});
}

/**
 * Export an SVG element to PNG. Webfonts used by the SVG are embedded as
 * data: URIs (the rasterizing Image cannot load external fonts).
 * Returns a data URL or Blob depending on options.
 */
export async function exportSvgToPng(
	svgEl: SVGSVGElement,
	options: ExportPngOptions & { output: 'blob' }
): Promise<Blob>;
export async function exportSvgToPng(
	svgEl: SVGSVGElement,
	options?: ExportPngOptions
): Promise<string>;
export async function exportSvgToPng(
	svgEl: SVGSVGElement,
	options: ExportPngOptions = {}
): Promise<string | Blob> {
	const { scale, output, ...svgOptions } = options;
	const fontCss = await collectFontCss(svgEl);
	const extraCss = [fontCss, svgOptions.extraCss].filter(Boolean).join('\n') || undefined;
	const svgString = exportSvg(svgEl, { ...svgOptions, extraCss });
	return svgStringToPng(svgString, { scale, output });
}
