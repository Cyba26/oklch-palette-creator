import { oklchToHex, parseToOklch } from '../color/convert';
import { isInGamut } from '../color/gamut';
import type { Gamut, OKLCH } from '../types';

export function createPickerStore(initial: OKLCH = { l: 0.7, c: 0.1, h: 250 }) {
	let color = $state<OKLCH>({ ...initial });
	let gamut = $state<Gamut>('sRGB');

	const hex = $derived(oklchToHex(color));
	const inGamut = $derived(isInGamut(color, gamut));

	return {
		get color() {
			return color;
		},
		get hex() {
			return hex;
		},
		get gamut() {
			return gamut;
		},
		get inGamut() {
			return inGamut;
		},
		setL(l: number) {
			color = { ...color, l };
		},
		setC(c: number) {
			color = { ...color, c };
		},
		setH(h: number) {
			color = { ...color, h };
		},
		/** Update L, C, H in one go — avoids 3 intermediate sync cycles. */
		setColor(next: OKLCH) {
			color = { l: next.l, c: next.c, h: next.h, alpha: color.alpha };
		},
		setGamut(g: Gamut) {
			gamut = g;
		},
		setFromString(input: string): boolean {
			const parsed = parseToOklch(input);
			if (!parsed) return false;
			color = parsed;
			return true;
		}
	};
}

export type PickerStore = ReturnType<typeof createPickerStore>;
