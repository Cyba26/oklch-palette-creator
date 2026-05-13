import { converter, formatHex, parse } from 'culori';
import type { OKLCH } from '../types';

const toOklch = converter('oklch');
const toRgb = converter('rgb');

export function oklchToHex(color: OKLCH): string {
	const hex = formatHex({
		mode: 'oklch',
		l: color.l,
		c: color.c,
		h: color.h,
		alpha: color.alpha
	});
	return hex ?? '#000000';
}

export function oklchToRgb(color: OKLCH) {
	return toRgb({ mode: 'oklch', l: color.l, c: color.c, h: color.h });
}

export function parseToOklch(input: string): OKLCH | null {
	const parsed = parse(input);
	if (!parsed) return null;
	const oklch = toOklch(parsed);
	if (!oklch) return null;
	return {
		l: oklch.l ?? 0,
		c: oklch.c ?? 0,
		h: oklch.h ?? 0,
		alpha: oklch.alpha
	};
}

export function formatOklch(color: OKLCH, precision = 3): string {
	const l = color.l.toFixed(precision);
	const c = color.c.toFixed(precision);
	const h = color.h.toFixed(1);
	return `oklch(${l} ${c} ${h})`;
}

export function formatRgb(color: OKLCH): string {
	const rgb = oklchToRgb(color);
	if (!rgb) return 'rgb(0, 0, 0)';
	const r = Math.round(Math.max(0, Math.min(1, rgb.r ?? 0)) * 255);
	const g = Math.round(Math.max(0, Math.min(1, rgb.g ?? 0)) * 255);
	const b = Math.round(Math.max(0, Math.min(1, rgb.b ?? 0)) * 255);
	return `rgb(${r}, ${g}, ${b})`;
}
