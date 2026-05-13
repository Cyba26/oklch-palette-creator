import BezierEasing from 'bezier-easing';
import type { BezierCurve, CurvePreset } from '../types';

export const PRESETS: Record<Exclude<CurvePreset, 'custom'>, [number, number, number, number]> = {
	linear: [0, 0, 1, 1],
	'ease-in': [0.42, 0, 1, 1],
	'ease-out': [0, 0, 0.58, 1],
	'ease-in-out': [0.42, 0, 0.58, 1],
	bell: [0.5, 1, 0.5, 0]
};

export function makeCurve(preset: CurvePreset, range: [number, number]): BezierCurve {
	const controls = preset === 'custom' ? PRESETS.linear : PRESETS[preset];
	return { preset, controls, range };
}

/**
 * Sample curve at t∈[0,1]. The "bell" preset is not a real bezier-easing
 * (control y values >1 are illegal there), so we hand-roll it.
 */
export function sampleCurve(curve: BezierCurve, t: number): number {
	const [min, max] = curve.range;
	let y: number;
	if (curve.preset === 'bell') {
		// symmetric cosine bell: smooth peak at t=0.5, value 0 at extremes.
		y = Math.sin(Math.PI * t);
	} else {
		const [p1x, p1y, p2x, p2y] = curve.controls;
		const ease = BezierEasing(p1x, p1y, p2x, p2y);
		y = ease(t);
	}
	return min + (max - min) * y;
}
