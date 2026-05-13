import { oklchToHex } from '../color/convert';
import { gamutScore, isInGamut, maxChroma } from '../color/gamut';
import { harmonyLabels, harmonyOffsets } from '../color/harmonies';
import type { OKLCH, Palette, Swatch } from '../types';
import { sampleCurve } from './curves';

export type HarmonyTrack = {
	label: string;
	hue: number;
	swatches: Swatch[];
};

function makeSwatch(oklch: { l: number; c: number; h: number }, palette: Palette): Swatch {
	return {
		oklch,
		hex: oklchToHex(oklch),
		inGamut: isInGamut(oklch, palette.gamut),
		gamutScore: gamutScore(oklch, palette.gamut)
	};
}

export function generatePalette(palette: Palette, hueShift = 0): Swatch[] {
	const N = palette.steps;
	const isPrimary = hueShift === 0 && palette.anchor !== null;

	const tOf = (i: number) => (N === 1 ? 0 : i / (N - 1));

	// Pass 1: rough swatches with no anchor-aware shifts, so we can search for
	// the closest step in full (L, C, H) space — robust against degenerate cases
	// like a flat L curve where pure-L distance ties at zero for every step.
	const rough: { l: number; c: number; h: number }[] = [];
	for (let i = 0; i < N; i++) {
		const t = tOf(i);
		const l = sampleCurve(palette.curves.lightness, t);
		const sat = Math.max(0, Math.min(1, sampleCurve(palette.curves.chroma, t)));
		const hOffset = sampleCurve(palette.curves.hue, t);
		const h = (palette.baseHue + hOffset + hueShift + 360) % 360;
		const c = sat * maxChroma(l, h, palette.gamut);
		rough.push({ l, c, h });
	}

	let anchorIdx = -1;
	let anchorT = 0.5;
	if (isPrimary) {
		// Pinned: bypass search and use the user-selected step directly.
		if (palette.anchorIdx !== null && palette.anchorIdx >= 0 && palette.anchorIdx < N) {
			anchorIdx = palette.anchorIdx;
			anchorT = tOf(anchorIdx);
		} else {
			const a = palette.anchor as OKLCH;
			let bestD = Infinity;
			for (let i = 0; i < N; i++) {
				const s = rough[i];
				const dL = s.l - a.l;
				const dC = s.c - a.c;
				const dHraw = ((s.h - a.h + 540) % 360) - 180;
				const dH = (dHraw * Math.max(a.c, 0.02)) / 60;
				const d = dL * dL + dC * dC + dH * dH;
				if (d < bestD) {
					bestD = d;
					anchorIdx = i;
					anchorT = tOf(i);
				}
			}
		}
	}

	// Anchor-aware shifts/scaling so curves smoothly pass through picker.
	let lShift = 0;
	let hShift = 0;
	let satScale = 1;
	if (isPrimary && anchorIdx >= 0) {
		const a = palette.anchor as OKLCH;
		if (palette.shiftLightness) {
			lShift = a.l - sampleCurve(palette.curves.lightness, anchorT);
		}
		if (palette.shiftHue) {
			hShift = -sampleCurve(palette.curves.hue, anchorT);
		}
		const baseHueDeg = ((palette.baseHue + 360) % 360);
		const pickerMaxC = maxChroma(a.l, baseHueDeg, palette.gamut);
		const pickerSat = pickerMaxC > 0 ? Math.min(1, a.c / pickerMaxC) : 1;
		const satAtAnchor = sampleCurve(palette.curves.chroma, anchorT);
		if (satAtAnchor > 0.001) satScale = pickerSat / satAtAnchor;
	}

	// Pass 2: final swatches with all anchor-aware adjustments applied.
	const swatches: Swatch[] = [];
	for (let i = 0; i < N; i++) {
		const t = tOf(i);
		const l = Math.max(0, Math.min(1, sampleCurve(palette.curves.lightness, t) + lShift));
		const rawSat = sampleCurve(palette.curves.chroma, t);
		const saturation = Math.max(0, Math.min(1, rawSat * satScale));
		const hOffset = sampleCurve(palette.curves.hue, t) + hShift;
		const h = (palette.baseHue + hOffset + hueShift + 360) % 360;
		const c = saturation * maxChroma(l, h, palette.gamut);
		swatches.push(makeSwatch({ l, c, h }, palette));
	}

	// Final override: replace the anchor step with the exact picker color.
	if (isPrimary && anchorIdx >= 0) {
		const a = palette.anchor as OKLCH;
		swatches[anchorIdx] = makeSwatch({ l: a.l, c: a.c, h: a.h }, palette);
	}
	return swatches;
}

export function anchorIndex(swatches: Swatch[], anchor: OKLCH | null): number {
	if (!anchor) return -1;
	let best = -1;
	let bestD = Infinity;
	for (let i = 0; i < swatches.length; i++) {
		const s = swatches[i].oklch;
		const dL = s.l - anchor.l;
		const dC = s.c - anchor.c;
		const d = dL * dL + dC * dC;
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best;
}

export function generateHarmonies(palette: Palette): HarmonyTrack[] {
	const offsets = harmonyOffsets(palette.harmonies);
	const labels = harmonyLabels(palette.harmonies);
	return offsets.map((offset, idx) => ({
		label: labels[idx] ?? `track-${idx}`,
		hue: (palette.baseHue + offset + 360) % 360,
		swatches: generatePalette(palette, offset)
	}));
}
