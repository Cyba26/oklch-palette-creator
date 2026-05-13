import type { HarmonyType } from '../types';

/** Hue offsets (degrees) generated for each harmony, including the base (0). */
export function harmonyOffsets(harmony: HarmonyType): number[] {
	switch (harmony) {
		case 'complementary':
			return [0, 180];
		case 'triadic':
			return [0, 120, 240];
		case 'analogous':
			return [-30, 0, 30];
		case 'tetradic':
			return [0, 90, 180, 270];
		case 'split-complementary':
			return [0, 150, 210];
		case 'none':
		default:
			return [0];
	}
}

export function harmonyLabels(harmony: HarmonyType): string[] {
	switch (harmony) {
		case 'complementary':
			return ['primary', 'complementary'];
		case 'triadic':
			return ['primary', 'secondary', 'tertiary'];
		case 'analogous':
			return ['analog-a', 'primary', 'analog-b'];
		case 'tetradic':
			return ['primary', 'secondary', 'complementary', 'tertiary'];
		case 'split-complementary':
			return ['primary', 'split-a', 'split-b'];
		case 'none':
		default:
			return ['primary'];
	}
}
