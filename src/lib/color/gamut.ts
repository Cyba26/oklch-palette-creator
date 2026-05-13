import { displayable, inGamut } from 'culori';
import type { Gamut, OKLCH } from '../types';

const inP3 = inGamut('p3');

export function isInGamut(color: OKLCH, gamut: Gamut): boolean {
	const c = { mode: 'oklch' as const, l: color.l, c: color.c, h: color.h };
	return gamut === 'sRGB' ? displayable(c) : inP3(c);
}

/**
 * Score 0-100: how far the color is from being inside the gamut.
 * 100 = comfortably inside, <100 = out of gamut by some margin.
 * Naive impl for MVP; refine later with proper chroma-clip distance.
 */
/**
 * Find the maximum in-gamut chroma at a given lightness and hue.
 * Binary search ~15 iterations → accurate to 0.0001.
 */
export function maxChroma(l: number, h: number, gamut: Gamut): number {
	if (!isInGamut({ l, c: 0, h }, gamut)) return 0;
	let lo = 0;
	let hi = 0.5;
	for (let i = 0; i < 18; i++) {
		const mid = (lo + hi) / 2;
		if (isInGamut({ l, c: mid, h }, gamut)) lo = mid;
		else hi = mid;
	}
	return lo;
}

/**
 * Clamp a color to the nearest in-gamut point along the chroma axis,
 * preserving L and H. Used to keep the picker marker on the gamut surface.
 */
export function clampToGamut(color: OKLCH, gamut: Gamut): OKLCH {
	if (isInGamut(color, gamut)) return color;
	let c = color.c;
	const step = 0.002;
	while (c > 0) {
		c -= step;
		if (isInGamut({ ...color, c }, gamut)) {
			return { ...color, c: Math.max(0, c) };
		}
	}
	return { ...color, c: 0 };
}

export function gamutScore(color: OKLCH, gamut: Gamut): number {
	if (isInGamut(color, gamut)) return 100;
	// step chroma down until in gamut, score by ratio
	const step = 0.005;
	let c = color.c;
	let tries = 0;
	while (c > 0 && tries < 100) {
		c -= step;
		tries++;
		if (isInGamut({ ...color, c }, gamut)) {
			return Math.max(0, Math.round((c / color.c) * 100));
		}
	}
	return 0;
}
