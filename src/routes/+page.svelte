<script lang="ts">
	import { untrack } from 'svelte';
	import ExportPanel from '$lib/components/export/ExportPanel.svelte';
	import HarmonyPicker from '$lib/components/harmonies/HarmonyPicker.svelte';
	import ColorPicker from '$lib/components/pickers/ColorPicker.svelte';
	import CurvePanel from '$lib/components/palette/CurvePanel.svelte';
	import PaletteView from '$lib/components/palette/PaletteView.svelte';
	import { createPaletteStore } from '$lib/stores/palette.svelte';
	import { createPickerStore } from '$lib/stores/picker.svelte';

	const palette = createPaletteStore();
	const picker = createPickerStore({ l: 0.7, c: 0.1, h: palette.palette.baseHue });

	// Picker drives palette. untrack() prevents the palette mutations inside
	// syncFromPicker from re-triggering this effect (avoids feedback loops).
	$effect(() => {
		const color = picker.color;
		const gamut = picker.gamut;
		untrack(() => {
			// If a swatch was pinned via click but the picker no longer matches
			// that swatch (user dragged sliders, edited hex...), release the pin
			// so the natural anchor search runs again.
			const pinned = palette.palette.anchorIdx;
			if (pinned !== null && pinned >= 0 && pinned < palette.swatches.length) {
				const s = palette.swatches[pinned].oklch;
				const dL = Math.abs(s.l - color.l);
				const dC = Math.abs(s.c - color.c);
				const dH = Math.abs(((s.h - color.h + 540) % 360) - 180);
				if (dL > 0.005 || dC > 0.005 || dH > 0.5) {
					palette.setAnchorIdx(null);
				}
			}
			palette.syncFromPicker(color, gamut);
		});
	});
</script>

<div class="layout">
	<header class="title">
		<h1>OKLCH Palette Creator</h1>
		<p>Pick a color above — the palette below regenerates around it.</p>
	</header>

	<div class="sticky">
		<ColorPicker store={picker} {palette} />
	</div>

	<main>
		<section class="block">
			<div class="section-head">
				<h2>Palette curves</h2>
				<button class="reset-btn" onclick={() => palette.reset()} title="Reset all curves to defaults">
					Reset curves
				</button>
			</div>
			<CurvePanel store={palette} {picker} />
		</section>

		<section class="block">
			<div class="section-head stacked">
				<h2>Generated palette</h2>
				<div class="stepper" role="group" aria-label="Number of steps">
					<span class="stepper-label">Steps</span>
					<button
						type="button"
						aria-label="Decrease steps"
						onclick={() => palette.setSteps(palette.palette.steps - 1)}
						disabled={palette.palette.steps <= 2}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="15 18 9 12 15 6" />
						</svg>
					</button>
					<span class="stepper-value">{palette.palette.steps}</span>
					<button
						type="button"
						aria-label="Increase steps"
						onclick={() => palette.setSteps(palette.palette.steps + 1)}
						disabled={palette.palette.steps >= 24}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>
			</div>
			<PaletteView store={palette} {picker} />
		</section>

		<section class="block">
			<h2>Harmonies</h2>
			<HarmonyPicker store={palette} {picker} />
		</section>

		<section class="block">
			<h2>Export</h2>
			<ExportPanel store={palette} />
		</section>
	</main>
</div>

<style>
	:global(body) {
		background: #050505;
		color: #e4e4e7;
		margin: 0;
		font-family: system-ui, sans-serif;
	}
	.layout {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem 1rem 4rem;
	}
	.title h1 {
		margin: 0 0 4px;
		font-size: 24px;
	}
	.title p {
		margin: 0 0 16px;
		color: #71717a;
		font-size: 13px;
	}
	.sticky {
		position: sticky;
		top: 0;
		z-index: 10;
		padding: 12px 0;
		background: linear-gradient(to bottom, #050505 0%, #050505 80%, transparent 100%);
	}
	main {
		margin-top: 24px;
	}
	.block {
		margin-bottom: 32px;
	}
	h2 {
		font-size: 12px;
		font-weight: 700;
		color: #71717a;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0 0 12px;
	}
	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	.section-head.stacked {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}
	.section-head h2 {
		margin: 0;
	}
	.reset-btn {
		background: #27272a;
		color: #e4e4e7;
		border: none;
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 12px;
		cursor: pointer;
	}
	.reset-btn:hover {
		background: #3f3f46;
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: #1a1a1d;
		padding: 4px;
		border-radius: 8px;
	}
	.stepper-label {
		font-size: 11px;
		font-weight: 700;
		color: #71717a;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0 8px;
	}
	.stepper button {
		background: #27272a;
		color: #e4e4e7;
		border: none;
		border-radius: 6px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.stepper button:hover:not(:disabled) {
		background: #3f3f46;
		color: #fbbf24;
	}
	.stepper button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.stepper-value {
		font-family: ui-monospace, monospace;
		font-size: 13px;
		color: #e4e4e7;
		min-width: 24px;
		text-align: center;
		font-weight: 600;
	}
</style>
