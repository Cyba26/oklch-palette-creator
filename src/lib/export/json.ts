import { formatOklch } from '../color/convert';
import type { Swatch } from '../types';
import { stepName } from './css';

export function toJson(swatches: Swatch[], name = 'palette'): string {
	const out: Record<string, Record<string, { hex: string; oklch: string; inGamut: boolean }>> = {
		[name]: {}
	};
	swatches.forEach((s, i) => {
		out[name][stepName(i, swatches.length)] = {
			hex: s.hex,
			oklch: formatOklch(s.oklch, 3),
			inGamut: s.inGamut
		};
	});
	return JSON.stringify(out, null, 2);
}
