/** Shared demo data: font choices and sample art. */

export interface MonoFont {
	key: string;
	label: string;
	family: string;
	/** Google Fonts css2 family slug — set for fonts loaded from Google Fonts (see app.html). */
	gf?: string;
}

export const monoFonts: MonoFont[] = [
	{
		key: 'system',
		label: 'System',
		family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
	},
	{
		key: 'jetbrains',
		label: 'JetBrains Mono',
		family: '"JetBrains Mono", ui-monospace, monospace',
		gf: 'JetBrains+Mono:wght@400;600'
	},
	{ key: 'fira', label: 'Fira Code', family: '"Fira Code", ui-monospace, monospace', gf: 'Fira+Code:wght@400;600' },
	{
		key: 'source',
		label: 'Source Code Pro',
		family: '"Source Code Pro", ui-monospace, monospace',
		gf: 'Source+Code+Pro:wght@400;600'
	},
	{
		key: 'plex',
		label: 'IBM Plex Mono',
		family: '"IBM Plex Mono", ui-monospace, monospace',
		gf: 'IBM+Plex+Mono:wght@400;600'
	},
	{ key: 'courier', label: 'Courier New', family: '"Courier New", Courier, monospace' },
	{ key: 'consolas', label: 'Consolas', family: 'Consolas, "Liberation Mono", monospace' },
	{ key: 'menlo', label: 'Menlo', family: 'Menlo, Monaco, monospace' },
	{ key: 'monaco', label: 'Monaco', family: 'Monaco, monospace' }
];

export const defaultFontKey = monoFonts[0].key;

export const boxArt = `+----------+	   _o<
|  Hello   |	  \`\\\,_
|  World!  |	(_)/ (_)
+----------+`;

export const ansiArt = [
	'\x1b[36m┌────────────────┐\x1b[0m',
	'\x1b[36m│\x1b[0m  \x1b[1;33m★\x1b[0m \x1b[1mANSI art\x1b[0m \x1b[1;33m★\x1b[0m  \x1b[36m│\x1b[0m',
	'\x1b[36m│\x1b[0m \x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m \x1b[94mblue\x1b[0m \x1b[36m│\x1b[0m',
	'\x1b[36m│\x1b[0m \x1b[38;5;208m256\x1b[0m \x1b[38;2;255;105;180mtruecolor\x1b[0m  \x1b[36m│\x1b[0m',
	'\x1b[36m│\x1b[0m \x1b[43;30mbg\x1b[0m \x1b[7minverse\x1b[0m     \x1b[36m│\x1b[0m',
	'\x1b[36m└────────────────┘\x1b[0m'
].join('\n');
