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
	'color',
	'paint-order'
] as const;

/**
 * Extract computed styles from elements with classes and build CSS rules.
 * Works on mounted SVG elements only.
 */
function extractClassStyles(svgEl: SVGSVGElement): string {
	const styleRules: string[] = [];
	const processedClasses = new Set<string>();

	// Find all elements with class attribute
	const elementsWithClasses = svgEl.querySelectorAll('[class]');

	elementsWithClasses.forEach((el) => {
		const classAttr = el.getAttribute('class')!;
		// Handle multiple classes per element
		const classes = classAttr.split(/\s+/).filter(Boolean);

		classes.forEach((className) => {
			if (processedClasses.has(className)) return;
			processedClasses.add(className);

			const computed = getComputedStyle(el);
			const declarations: string[] = [];

			SVG_STYLE_PROPS.forEach((prop) => {
				const value = computed.getPropertyValue(prop);
				// Skip empty/default values
				if (!value || (value === 'none' && prop !== 'fill')) return;
				declarations.push(`${prop}: ${value}`);
			});

			if (declarations.length) {
				styleRules.push(`.${className} { ${declarations.join('; ')} }`);
			}
		});
	});

	return styleRules.join('\n');
}

/**
 * Extract computed styles for text elements (applied via CSS variables or inheritance).
 */
function extractTextStyles(svgEl: SVGSVGElement): string {
	const textEl = svgEl.querySelector('text');
	if (!textEl) return '';

	const computed = getComputedStyle(textEl);
	const declarations: string[] = [];

	SVG_STYLE_PROPS.forEach((prop) => {
		const value = computed.getPropertyValue(prop);
		if (!value) return;
		declarations.push(`${prop}: ${value}`);
	});

	if (!declarations.length) return '';
	return `text, tspan { ${declarations.join('; ')} }`;
}

export interface ExportSvgOptions {
	/** Include background color as a rect. Default: false */
	includeBackground?: boolean;
	/** Background color to use if includeBackground is true */
	backgroundColor?: string;
}

/**
 * Export an SVG element with all computed styles embedded as a <style> block.
 * The SVG must be mounted in the DOM for getComputedStyle to work.
 */
export function exportSvg(svgEl: SVGSVGElement, options: ExportSvgOptions = {}): string {
	const clone = svgEl.cloneNode(true) as SVGSVGElement;
	const cssRules: string[] = [];

	// Extract styles from classed elements using original (mounted) element
	const classStyles = extractClassStyles(svgEl);
	if (classStyles) cssRules.push(classStyles);

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
 * Export an SVG element to PNG.
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
	const svgString = exportSvg(svgEl, svgOptions);
	return svgStringToPng(svgString, { scale, output });
}

