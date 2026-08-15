import { describe, expect, it } from 'vitest';
import { customGlyph, isCustomGlyph } from './glyphs.js';

const W = 0.6;

describe('customGlyph', () => {
	it('covers the whole U+2500–U+259F range with non-empty shapes', () => {
		for (let cp = 0x2500; cp <= 0x259f; cp++) {
			expect(isCustomGlyph(cp)).toBe(true);
			expect(customGlyph(cp, 0, 0, W).d.length, `U+${cp.toString(16)}`).toBeGreaterThan(0);
		}
		expect(isCustomGlyph(0x24ff)).toBe(false);
		expect(isCustomGlyph(0x25a0)).toBe(false);
	});

	it('draws a light horizontal line as two centered half-rects', () => {
		expect(customGlyph(0x2500, 0, 0, W).d).toBe('M0 0.45h0.3v0.1h-0.3ZM0.3 0.45h0.3v0.1h-0.3Z');
	});

	it('positions shapes at the cell origin', () => {
		expect(customGlyph(0x2588, 1.2, 2, W).d).toBe('M1.2 2h0.6v1h-0.6Z'); // █
	});

	it('joins corner arms without notches', () => {
		// ┌: right arm starts half a light-line left of center; down arm starts
		// half a light-line above center
		expect(customGlyph(0x250c, 0, 0, W).d).toBe('M0.25 0.45h0.35v0.1h-0.35ZM0.25 0.45h0.1v0.55h-0.1Z');
	});

	it('renders heavy arms twice as thick', () => {
		expect(customGlyph(0x2501, 0, 0, W).d).toContain('v0.2'); // ━
	});

	it('draws shades as full-cell fills with opacity', () => {
		expect(customGlyph(0x2591, 0, 0, W)).toEqual({ d: 'M0 0h0.6v1h-0.6Z', opacity: 0.25 }); // ░
		expect(customGlyph(0x2593, 0, 0, W).opacity).toBe(0.75); // ▓
	});

	it('draws diagonals and arcs as stroked paths', () => {
		expect(customGlyph(0x2571, 0, 0, W)).toEqual({ d: 'M0.6 0L0 1', strokeWidth: 0.1 }); // ╱
		expect(customGlyph(0x256d, 0, 0, W).strokeWidth).toBe(0.1); // ╭
		expect(customGlyph(0x256d, 0, 0, W).d).toContain('A'); // arc command
	});

	it('splits eighth blocks along the right axis', () => {
		expect(customGlyph(0x2581, 0, 0, W).d).toBe('M0 0.875h0.6v0.125h-0.6Z'); // ▁ lower eighth
		expect(customGlyph(0x258f, 0, 0, W).d).toBe('M0 0h0.075v1h-0.075Z'); // ▏ left eighth
	});

	it('composes quadrants', () => {
		// ▚ = upper-left + lower-right
		expect(customGlyph(0x259a, 0, 0, W).d).toBe('M0 0h0.3v0.5h-0.3ZM0.3 0.5h0.3v0.5h-0.3Z');
	});

	it('keeps double lines as two parallel light lines', () => {
		const d = customGlyph(0x2550, 0, 0, W).d; // ═
		expect(d).toBe('M0 0.35h0.6v0.1h-0.6ZM0 0.55h0.6v0.1h-0.6Z');
	});
});
