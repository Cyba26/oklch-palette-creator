export type OKLCH = { l: number; c: number; h: number; alpha?: number };

export type Gamut = 'sRGB' | 'P3';

export type CurvePreset =
	| 'linear'
	| 'ease-in'
	| 'ease-out'
	| 'ease-in-out'
	| 'bell'
	| 'custom';

export type BezierCurve = {
	preset: CurvePreset;
	controls: [number, number, number, number];
	range: [number, number];
};

export type HarmonyType =
	| 'none'
	| 'complementary'
	| 'triadic'
	| 'analogous'
	| 'tetradic'
	| 'split-complementary';

export type Palette = {
	steps: number;
	baseHue: number;
	curves: {
		lightness: BezierCurve;
		chroma: BezierCurve;
		hue: BezierCurve;
	};
	harmonies: HarmonyType;
	gamut: Gamut;
	/** If set, the closest palette step is overridden with this exact color. */
	anchor: OKLCH | null;
	/** If set, force the anchor to land on this exact step (bypasses search). */
	anchorIdx: number | null;
	/** When true, picker changes won't auto-release the pin (anchor stays at index). */
	anchorLocked: boolean;
	/** Shift the entire lightness curve so the anchor step lands on picker.l. */
	shiftLightness: boolean;
	/** Shift the entire hue-offset curve so the anchor step lands on picker.h. */
	shiftHue: boolean;
};

export type Swatch = {
	oklch: OKLCH;
	hex: string;
	inGamut: boolean;
	gamutScore: number;
};
