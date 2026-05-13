import { maxChroma } from '../color/gamut';
import { makeCurve } from '../palette/curves';
import { generateHarmonies, generatePalette } from '../palette/generate';
import { decodePalette, encodePalette } from '../palette/serialize';
import type { BezierCurve, Gamut, HarmonyType, OKLCH, Palette } from '../types';

function defaultPalette(): Palette {
	return {
		steps: 10,
		baseHue: 250,
		curves: {
			lightness: makeCurve('linear', [0.95, 0.15]),
			// chroma is now a SATURATION curve (0-1 = fraction of in-gamut max).
			// Bell shape with [0.6, 1] keeps middle steps fully saturated, lighter
			// and darker tones slightly muted (a clean design-system look).
			chroma: makeCurve('bell', [0.6, 1]),
			hue: makeCurve('linear', [0, 0])
		},
		harmonies: 'none',
		gamut: 'sRGB',
		anchor: null,
		anchorIdx: null,
		anchorLocked: false,
		shiftLightness: true,
		shiftHue: true
	};
}

function hydrateFromUrl(): Palette {
	if (typeof window === 'undefined') return defaultPalette();
	const hash = window.location.hash.replace(/^#/, '');
	if (!hash) return defaultPalette();
	const decoded = decodePalette(hash);
	return decoded ?? defaultPalette();
}

export function createPaletteStore() {
	let palette = $state<Palette>(hydrateFromUrl());
	const swatches = $derived(generatePalette(palette));
	const harmonies = $derived(generateHarmonies(palette));
	const shareUrl = $derived.by(() => {
		if (typeof window === 'undefined') return '';
		const encoded = encodePalette(palette);
		return `${window.location.origin}${window.location.pathname}#${encoded}`;
	});

	$effect.root(() => {
		$effect(() => {
			if (typeof window === 'undefined') return;
			const encoded = encodePalette(palette);
			window.history.replaceState(null, '', `#${encoded}`);
		});
	});

	return {
		get palette() {
			return palette;
		},
		get swatches() {
			return swatches;
		},
		get harmonies() {
			return harmonies;
		},
		get shareUrl() {
			return shareUrl;
		},
		setSteps(n: number) {
			// Steps change invalidates a pinned index (might not exist anymore).
			palette = {
				...palette,
				steps: Math.max(2, Math.min(24, Math.round(n))),
				anchorIdx: null
			};
		},
		setAnchorIdx(idx: number | null) {
			// Releasing the pin also clears the lock — they're conceptually paired.
			palette = { ...palette, anchorIdx: idx, anchorLocked: idx === null ? false : palette.anchorLocked };
		},
		setAnchorLocked(v: boolean) {
			palette = { ...palette, anchorLocked: v };
		},
		/**
		 * Atomic pin: set anchorIdx, anchor color, and baseHue in one mutation so
		 * the derived swatches are consistent before the picker $effect fires.
		 */
		pinAnchor(idx: number, color: OKLCH) {
			const baseHue = ((color.h % 360) + 360) % 360;
			palette = {
				...palette,
				anchorIdx: idx,
				anchor: { l: color.l, c: color.c, h: baseHue },
				baseHue
			};
		},
		setBaseHue(h: number) {
			palette = { ...palette, baseHue: ((h % 360) + 360) % 360 };
		},
		setGamut(g: Gamut) {
			palette = { ...palette, gamut: g };
		},
		setHarmony(h: HarmonyType) {
			palette = { ...palette, harmonies: h };
		},
		setShiftLightness(v: boolean) {
			palette = { ...palette, shiftLightness: v };
		},
		setShiftHue(v: boolean) {
			palette = { ...palette, shiftHue: v };
		},
		setCurve(which: 'lightness' | 'chroma' | 'hue', curve: BezierCurve) {
			palette = { ...palette, curves: { ...palette.curves, [which]: curve } };
		},
		/**
		 * Sync palette to a picker color. Drives hue + gamut, resets the hue-offset
		 * curve to 0 (so the palette stays monochromatic in hue by default), and
		 * caps the chroma curve so the picked chroma is the peak. Picker L is left
		 * to fall naturally within the lightness range.
		 */
		syncFromPicker(color: OKLCH, gamut: Gamut) {
			const baseHue = ((color.h % 360) + 360) % 360;
			// Compute picker saturation as a fraction of the max in-gamut chroma at
			// its lightness/hue. Drives the chroma (saturation) curve peak so the
			// whole palette feels as saturated as the picked color.
			const pickerMaxC = maxChroma(color.l, baseHue, gamut);
			const pickerSat = pickerMaxC > 0 ? Math.min(1, color.c / pickerMaxC) : 1;
			const chroma = palette.curves.chroma;
			const newChroma: BezierCurve = {
				...chroma,
				range: [Math.max(0, pickerSat * 0.6), pickerSat]
			};
			palette = {
				...palette,
				baseHue,
				gamut,
				curves: { ...palette.curves, chroma: newChroma },
				anchor: { l: color.l, c: color.c, h: baseHue }
			};
		},
		reset() {
			palette = defaultPalette();
		}
	};
}

export type PaletteStore = ReturnType<typeof createPaletteStore>;
