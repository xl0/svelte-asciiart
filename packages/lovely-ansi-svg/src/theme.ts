/**
 * Color theme for rendered/exported SVG.
 *
 * - `palette`: the 16 ANSI colors (normal 0-7, bright 8-15).
 * - `foreground`: default text color; unset → `currentColor` inherits.
 * - `background`: the color inverse-without-fg glyphs paint in; unset → `Canvas`.
 *
 * Emitted CSS keeps every color behind a `var(--ansi-*, <resolved>)` fallback,
 * so browser embeddings can still retheme with CSS custom properties.
 */
export interface Theme {
	foreground?: string;
	background?: string;
	palette: string[];
}

/** How much of the glyph color survives dimming (the rest is background). */
export const DIM_PCT = '55%';

/** VS Code-ish defaults (matches the pre-0.1.0 component CSS). */
export const defaultTheme: Theme = {
	palette: [
		'#000000',
		'#cd3131',
		'#00a600',
		'#b58900',
		'#0451a5',
		'#bc05bc',
		'#0598bc',
		'#a5a5a5',
		'#666666',
		'#f14c4c',
		'#23d18b',
		'#f5f543',
		'#3b8eea',
		'#d670d6',
		'#29b8db',
		'#ffffff'
	]
};

/**
 * CSS rules for the `ansi-*` classes the parser emits, with the theme's
 * colors as `var()` fallbacks. `.ansi-blink` is deliberately absent —
 * hosts opt into blink styling themselves.
 *
 * `scope` prefixes every rule (e.g. `svg.asciiart`) — needed when the CSS is
 * injected into a document-scoped `<style>` where bare `.ansi-*` rules would
 * leak to the whole page.
 */
export function themeCss(theme: Theme = defaultTheme, scope?: string): string {
	const resolvedBg = theme.background ?? 'Canvas';
	const bg = `var(--ansi-default-bg, ${resolvedBg})`;
	// dim as a solid color mixed toward the background, not opacity —
	// overlapping translucent glyphs (full-cell box drawing) double-composite
	// into stripes. Two-class combos below keep dim working with fg colors.
	const dim = (color: string) => `fill: color-mix(in srgb, ${color} ${DIM_PCT}, ${bg})`;
	const rules = [
		'.ansi-bold { font-weight: bold }',
		`.ansi-dim { ${dim('currentColor')} }`,
		'.ansi-italic { font-style: italic }',
		'.ansi-underline { text-decoration: underline }',
		'.ansi-strike { text-decoration: line-through }',
		'.ansi-underline.ansi-strike { text-decoration: underline line-through }',
		// inverse with no explicit fg: glyph paints in the default background
		`.ansi-inverse { fill: ${bg} }`,
		// dimmed inverse glyph: fade toward the block behind it (currentColor)
		`.ansi-dim.ansi-inverse { fill: color-mix(in srgb, ${bg} ${DIM_PCT}, currentColor) }`,
		// inverse with no explicit colors: the block paints in the default text color
		'.ansi-bg-inverse { fill: currentColor }'
	];
	for (let i = 0; i < 16; i++) {
		const fg = i < 8 ? 30 + i : 82 + i;
		const color = `var(--ansi-fg-${fg}, ${theme.palette[i]})`;
		rules.push(`.ansi-fg-${fg} { fill: ${color} }`);
		rules.push(`.ansi-dim.ansi-fg-${fg} { ${dim(color)} }`);
		rules.push(`.ansi-bg-${fg + 10} { fill: var(--ansi-bg-${fg + 10}, ${theme.palette[i]}) }`);
	}
	const prefixed = scope ? rules.map((r) => `${scope} ${r}`) : rules;
	// resolve the theme background for the parser's inline dim fills too
	// (styleOf bakes color-mix toward this var chain without knowing the theme)
	return [`${scope ?? 'svg'} { --_ansi-default-bg: ${resolvedBg} }`, ...prefixed].join('\n');
}
