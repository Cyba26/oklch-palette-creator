import { formatOklch } from '../color/convert';
import type { Swatch } from '../types';

export type ExportFlavor = 'hex' | 'oklch';

export function toCss(swatches: Swatch[], name = 'color', flavor: ExportFlavor = 'oklch'): string {
	const lines = swatches.map((s, i) => {
		const step = stepName(i, swatches.length);
		const value = flavor === 'hex' ? s.hex : formatOklch(s.oklch, 3);
		return `  --${name}-${step}: ${value};`;
	});
	return `:root {\n${lines.join('\n')}\n}`;
}

export function stepName(i: number, total: number): string {
	// Tailwind-style: 50, 100, 200, ... 900, 950
	if (total === 11) {
		const scale = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
		return String(scale[i]);
	}
	if (total === 10) {
		const scale = [50, 100, 200, 300, 400, 500, 600, 700, 800, 950];
		return String(scale[i]);
	}
	return String(i + 1).padStart(2, '0');
}
