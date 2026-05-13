<script lang="ts">
	import { oklchToHex } from '$lib/color/convert';
	import { clampToGamut, maxChroma } from '$lib/color/gamut';
	import type { PaletteStore } from '$lib/stores/palette.svelte';
	import type { PickerStore } from '$lib/stores/picker.svelte';
	import CurveEditor from './CurveEditor.svelte';

	let { store, picker }: { store: PaletteStore; picker?: PickerStore } = $props();

	const N_STOPS = 16;

	function stopsHex(stops: { l: number; c: number; h: number }[]): string[] {
		return stops.map((s) => oklchToHex(clampToGamut(s, store.palette.gamut)));
	}

	function lerpStops(
		from: { l: number; c: number; h: number },
		to: { l: number; c: number; h: number },
		n = N_STOPS
	): { l: number; c: number; h: number }[] {
		const stops = [];
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			stops.push({
				l: from.l + (to.l - from.l) * t,
				c: from.c + (to.c - from.c) * t,
				h: from.h + (to.h - from.h) * t
			});
		}
		return stops;
	}

	// Bars always show the full potential (picker → range BOUNDS extreme),
	// independent of current spread, so the user sees "what's possible" without
	// having to drag. The thumb position shows how much of that potential is
	// currently applied.

	const lightnessStops = $derived.by(() => {
		if (!picker) return { top: undefined, bot: undefined };
		const pc = picker.color;
		// Top bar = picker → darkest possible (L=0). Bottom = picker → lightest (L=1).
		return {
			top: stopsHex(lerpStops(pc, { l: 0, c: pc.c, h: pc.h })),
			bot: stopsHex(lerpStops(pc, { l: 1, c: pc.c, h: pc.h }))
		};
	});

	const saturationStops = $derived.by(() => {
		if (!picker) return { top: undefined, bot: undefined };
		const pc = picker.color;
		const mc = maxChroma(pc.l, pc.h, store.palette.gamut);
		// Top = picker → grey (no chroma). Bottom = picker → max chroma at this L/H.
		return {
			top: stopsHex(lerpStops(pc, { l: pc.l, c: 0, h: pc.h })),
			bot: stopsHex(lerpStops(pc, { l: pc.l, c: mc, h: pc.h }))
		};
	});

	const hueStops = $derived.by(() => {
		if (!picker) return { top: undefined, bot: undefined };
		const pc = picker.color;
		// Top = picker → counterclockwise 180°. Bottom = picker → clockwise 180°.
		const topStops: { l: number; c: number; h: number }[] = [];
		const botStops: { l: number; c: number; h: number }[] = [];
		for (let i = 0; i <= N_STOPS; i++) {
			const t = i / N_STOPS;
			topStops.push({ l: pc.l, c: pc.c, h: (pc.h - 180 * t + 360) % 360 });
			botStops.push({ l: pc.l, c: pc.c, h: (pc.h + 180 * t + 360) % 360 });
		}
		return { top: stopsHex(topStops), bot: stopsHex(botStops) };
	});
</script>

<div class="panel">
	<div class="curves">
		<CurveEditor
			curve={store.palette.curves.lightness}
			label="Lightness"
			rangeMin={0}
			rangeMax={1}
			rangeStep={0.01}
			rangeBounds={[0, 1]}
			recommended="linear"
			topStops={lightnessStops.top}
			bottomStops={lightnessStops.bot}
			onChange={(c) => store.setCurve('lightness', c)}
		/>
		<CurveEditor
			curve={store.palette.curves.chroma}
			label="Saturation"
			rangeMin={0}
			rangeMax={1}
			rangeStep={0.01}
			rangeBounds={[0, 1]}
			recommended="bell"
			topStops={saturationStops.top}
			bottomStops={saturationStops.bot}
			onChange={(c) => store.setCurve('chroma', c)}
		/>
		<CurveEditor
			curve={store.palette.curves.hue}
			label="Hue offset"
			rangeMin={-180}
			rangeMax={180}
			rangeStep={1}
			rangeBounds={[-180, 180]}
			recommended="linear"
			topStops={hueStops.top}
			bottomStops={hueStops.bot}
			onChange={(c) => store.setCurve('hue', c)}
		/>
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.curves {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	@media (max-width: 900px) {
		.curves {
			grid-template-columns: 1fr;
		}
	}
</style>
