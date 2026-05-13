<script lang="ts">
	import { anchorIndex as findAnchorIndex } from '$lib/palette/generate';
	import type { PaletteStore } from '$lib/stores/palette.svelte';
	import type { PickerStore } from '$lib/stores/picker.svelte';
	import type { OKLCH } from '$lib/types';
	import SwatchCell from './SwatchCell.svelte';

	let { store, picker }: { store: PaletteStore; picker?: PickerStore } = $props();

	const anchorIndex = $derived(findAnchorIndex(store.swatches, store.palette.anchor));

	function pickSwatch(idx: number, color: OKLCH) {
		if (!picker) return;
		store.pinAnchor(idx, color);
		picker.setColor(color);
	}
</script>

<div class="palette">
	{#each store.swatches as swatch, i (i)}
		<SwatchCell
			{swatch}
			anchor={i === anchorIndex}
			onPick={() => pickSwatch(i, swatch.oklch)}
		/>
	{/each}
</div>

<style>
	.palette {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 8px;
	}
</style>
