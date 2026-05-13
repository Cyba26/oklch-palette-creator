import type { Swatch } from '../types';
import { stepName } from './css';

/**
 * W3C Design Tokens Community Group format.
 * Importable by Figma Variables via Tokens Studio plugin, and by most modern
 * design-token tooling (Style Dictionary v4+, etc.).
 */
export function toFigmaTokens(swatches: Swatch[], name = 'palette'): string {
	const tokens: Record<string, unknown> = {};
	swatches.forEach((s, i) => {
		tokens[stepName(i, swatches.length)] = {
			$type: 'color',
			$value: s.hex,
			$description: s.inGamut ? undefined : `Out of gamut (score ${s.gamutScore}/100)`
		};
	});
	return JSON.stringify({ [name]: tokens }, null, 2);
}
