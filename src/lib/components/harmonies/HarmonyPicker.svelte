<script lang="ts">
	import SwatchCell from '$lib/components/palette/SwatchCell.svelte';
	import type { PaletteStore } from '$lib/stores/palette.svelte';
	import type { PickerStore } from '$lib/stores/picker.svelte';
	import type { HarmonyType, OKLCH } from '$lib/types';

	let { store, picker }: { store: PaletteStore; picker?: PickerStore } = $props();

	const options: HarmonyType[] = [
		'none',
		'complementary',
		'analogous',
		'triadic',
		'tetradic',
		'split-complementary'
	];

	function pickSwatch(color: OKLCH) {
		if (!picker) return;
		// Harmony swatches are not steps of the main palette → just retarget the
		// picker. The new picker hue rebuilds the palette around it.
		store.setAnchorIdx(null);
		picker.setColor(color);
	}
</script>

<div class="harmonies">
	<div class="picker">
		{#each options as opt (opt)}
			<button
				class:active={store.palette.harmonies === opt}
				onclick={() => store.setHarmony(opt)}
			>
				{opt}
			</button>
		{/each}
	</div>

	{#if store.harmonies.length > 1}
		<div class="tracks">
			{#each store.harmonies.filter((t) => t.label !== 'primary') as track (track.label)}
				<div class="track">
					<header>
						<span class="lbl">{track.label}</span>
						<code>H {track.hue.toFixed(0)}°</code>
					</header>
					<div class="palette">
						{#each track.swatches as s, i (i)}
							<SwatchCell swatch={s} onPick={() => pickSwatch(s.oklch)} />
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.harmonies {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.picker {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		background: #1a1a1d;
		padding: 8px;
		border-radius: 12px;
	}
	.picker button {
		background: #27272a;
		color: #a1a1aa;
		border: none;
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 12px;
		cursor: pointer;
		text-transform: capitalize;
	}
	.picker button.active {
		background: #fbbf24;
		color: #1a1a1d;
		font-weight: 600;
	}
	.tracks {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.track {
		background: #0a0a0a;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid #1a1a1d;
	}
	.track header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 10px;
	}
	.lbl {
		font-size: 11px;
		font-weight: 700;
		color: #a1a1aa;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: #71717a;
	}
	.palette {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 8px;
	}
</style>
