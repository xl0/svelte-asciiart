// Browser-only: needs Image, canvas, document.styleSheets and fetch.

// caches: cross-origin stylesheet text and font-file data URIs, so repeated
// exports don't refetch (live previews regenerate on every debounced change)
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
async function sheetFaces(rules: CSSRuleList, base: string, depth: number, out: FontFaceSource[]): Promise<void> {
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
		if (depth < MAX_IMPORT_DEPTH) for (const m of css.matchAll(IMPORT_RE)) await fetchedFaces(new URL(m[1], href).href, depth + 1, out);
	} catch {
		sheetTextCache.delete(href);
	}
}

/**
 * Collect `@font-face` rules for the given font families from the document's
 * stylesheets, with the font files inlined as data: URIs. Rasterizing an SVG
 * via `new Image()` happens in an isolated document that cannot load external
 * fonts, so PNG conversion needs this; embedding it in an SVG file makes the
 * SVG font-standalone too. Cross-origin stylesheets (e.g. Google Fonts) block
 * CSSOM access and are re-fetched as text instead; @import chains are
 * followed either way. Families without a reachable @font-face (system fonts)
 * contribute nothing.
 *
 * @param families family names, or a CSS `font-family` list to split on commas
 */
export async function collectFontCss(families: string | string[]): Promise<string> {
	const wanted = new Set((Array.isArray(families) ? families : families.split(',')).map((f) => unquote(f).toLowerCase()));

	const all: FontFaceSource[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			await sheetFaces(sheet.cssRules, sheet.href ?? document.baseURI, 0, all);
		} catch {
			if (sheet.href) await fetchedFaces(sheet.href, 1, all);
		}
	}
	const faces = all.filter(({ rule }) => wanted.has(unquote(rule.style.getPropertyValue('font-family')).toLowerCase()));

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

export interface SvgStringToPngOptions {
	/** Scale factor over the SVG's intrinsic width/height. Default: 1 */
	scale?: number;
	/** Output format. Default: 'dataUrl' */
	output?: 'dataUrl' | 'blob';
	/** CSS injected into the SVG before rasterizing, e.g. @font-face rules from collectFontCss() */
	fontCss?: string;
}

/**
 * Rasterize an SVG string to a PNG via blob URL → Image → canvas. Dimensions
 * come from the browser's intrinsic size for the SVG (its width/height
 * attributes), times `scale`.
 */
export async function svgStringToPng(svgString: string, options: SvgStringToPngOptions & { output: 'blob' }): Promise<Blob>;
export async function svgStringToPng(svgString: string, options?: SvgStringToPngOptions): Promise<string>;
export async function svgStringToPng(svgString: string, options: SvgStringToPngOptions = {}): Promise<string | Blob> {
	const { scale = 1, output = 'dataUrl', fontCss } = options;

	if (fontCss) {
		const style = `<defs><style>${fontCss.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style></defs>`;
		const injected = svgString.replace(/<svg[^>]*>/, (m) => m + style);
		if (injected === svgString) throw new Error('fontCss set but no <svg> root tag found');
		svgString = injected;
	}

	const img = new Image();
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	return new Promise((resolve, reject) => {
		img.onload = () => {
			URL.revokeObjectURL(url);

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
