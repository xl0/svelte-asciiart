/**
 * Color theme for rendered/exported SVG. Colors resolve at parse time
 * (`parseAnsi(text, theme)`) — the output carries concrete values, there is
 * no CSS-level theming layer. Re-theming means re-rendering.
 *
 * - `palette`: the 16 ANSI colors (normal 0-7, bright 8-15).
 * - `foreground`: default text color; unset → `currentColor` inherits.
 * - `background`: the backdrop *assumption* the color math runs on — what
 *   inverse-without-fg glyphs paint in and what dim mixes toward; unset →
 *   `Canvas`. Paints nothing itself; `exportSvg` defaults it to its painted
 *   `background` option.
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
