import type { Palette } from '../types';

/**
 * Encode a palette to a URL-safe base64 string.
 * Roundtrips via JSON — compact enough for query strings (~150 chars).
 */
export function encodePalette(palette: Palette): string {
	const json = JSON.stringify(palette);
	const b64 = typeof btoa !== 'undefined' ? btoa(json) : Buffer.from(json).toString('base64');
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePalette(encoded: string): Palette | null {
	try {
		const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
		const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
		const json = typeof atob !== 'undefined' ? atob(padded) : Buffer.from(padded, 'base64').toString();
		const parsed = JSON.parse(json);
		if (!isPalette(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}

function isPalette(x: unknown): x is Palette {
	if (!x || typeof x !== 'object') return false;
	const p = x as Record<string, unknown>;
	return (
		typeof p.steps === 'number' &&
		typeof p.baseHue === 'number' &&
		typeof p.gamut === 'string' &&
		typeof p.harmonies === 'string' &&
		!!p.curves &&
		typeof p.curves === 'object'
	);
}
