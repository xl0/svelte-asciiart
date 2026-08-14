/** Format a number for SVG attributes/code output: fixed precision (default 3) with trailing zeros trimmed. */
export function fmt(n: number, digits = 3): string {
	if (!Number.isFinite(n)) return String(n);
	if (Math.abs(n) < 1e-12) return '0';
	const s = n.toFixed(digits);
	return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
