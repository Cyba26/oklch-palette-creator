<script lang="ts">
	import { formatOklch } from '$lib/color/convert';
	import type { PaletteStore } from '$lib/stores/palette.svelte';
	import type { PickerStore } from '$lib/stores/picker.svelte';
	import SliceGraph from './SliceGraph.svelte';

	let { store, palette }: { store: PickerStore; palette?: PaletteStore } = $props();

	const overlay = $derived(palette ? palette.swatches.map((s) => s.oklch) : undefined);

	let collapsed = $state(false);

	let inputValue = $state('');
	let inputError = $state(false);

	function handleInput(value: string) {
		inputValue = value;
		if (!value.trim()) {
			inputError = false;
			return;
		}
		inputError = !store.setFromString(value);
	}
</script>

<section class="picker">
	<div class="topbar">
		<div class="swatch" style="background: {store.hex}"></div>

		<div class="field">
			<span class="badge">OKLCH</span>
			<code>{formatOklch(store.color)}</code>
		</div>

		<label class="field input-field">
			<span class="badge">HEX</span>
			<input
				type="text"
				class:error={inputError}
				value={inputValue || store.hex}
				placeholder={store.hex}
				oninput={(e) => handleInput(e.currentTarget.value)}
				onblur={() => (inputValue = '')}
			/>
		</label>

		<div class="segmented" role="radiogroup" aria-label="Gamut">
			<button
				type="button"
				class="seg"
				class:active={store.gamut === 'sRGB'}
				aria-pressed={store.gamut === 'sRGB'}
				onclick={() => store.setGamut('sRGB')}
			>
				sRGB
			</button>
			<button
				type="button"
				class="seg"
				class:active={store.gamut === 'P3'}
				aria-pressed={store.gamut === 'P3'}
				onclick={() => store.setGamut('P3')}
			>
				P3
			</button>
		</div>

		{#if !store.inGamut}
			<span class="warning">⚠ Out of {store.gamut}</span>
		{/if}

		<button
			class="collapse-btn"
			aria-label={collapsed ? 'Expand graphs' : 'Collapse graphs'}
			title={collapsed ? 'Expand graphs' : 'Collapse graphs'}
			onclick={() => (collapsed = !collapsed)}
		>
			<svg
				class="chev"
				class:up={!collapsed}
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>
	</div>

	<div class="graphs" class:collapsed>
		<SliceGraph {store} {overlay} title="Lightness" xAxis="L" yAxis="C" primary="L" min={0} max={1} step={0.01} compact={collapsed} />
		<SliceGraph {store} {overlay} title="Chroma" xAxis="H" yAxis="C" primary="C" min={0} max={0.4} step={0.001} compact={collapsed} />
		<SliceGraph {store} {overlay} title="Hue" xAxis="H" yAxis="L" primary="H" min={0} max={360} step={1} compact={collapsed} />
	</div>
</section>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 14px;
		background: #0a0a0a;
		border-radius: 16px;
		color: #e4e4e7;
		border: 1px solid #1a1a1d;
	}
	.topbar {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.swatch {
		width: 80px;
		height: 44px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #1a1a1d;
		padding: 0 14px;
		border-radius: 10px;
		height: 44px;
		min-width: 0;
	}
	.input-field {
		flex: 1;
		min-width: 200px;
		cursor: text;
	}
	.badge {
		font-size: 10px;
		font-weight: 700;
		background: #27272a;
		padding: 3px 7px;
		border-radius: 5px;
		color: #a1a1aa;
		flex-shrink: 0;
		letter-spacing: 0.04em;
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 14px;
		color: #e4e4e7;
		white-space: nowrap;
	}
	input[type='text'] {
		background: transparent;
		border: none;
		color: #e4e4e7;
		font-family: ui-monospace, monospace;
		font-size: 14px;
		flex: 1;
		outline: none;
		min-width: 0;
		padding: 0;
	}
	input.error {
		color: #ef4444;
	}
	.segmented {
		display: inline-flex;
		background: #1a1a1d;
		border-radius: 10px;
		padding: 3px;
		height: 44px;
		align-items: center;
		flex-shrink: 0;
		box-sizing: border-box;
	}
	.seg {
		background: transparent;
		color: #a1a1aa;
		border: none;
		border-radius: 7px;
		padding: 0 12px;
		font-size: 13px;
		font-weight: 500;
		height: 100%;
		cursor: pointer;
	}
	.seg.active {
		background: #27272a;
		color: #e4e4e7;
		font-weight: 600;
	}
	.warning {
		background: #422006;
		color: #fbbf24;
		padding: 0 12px;
		border-radius: 8px;
		font-size: 12px;
		height: 44px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	.collapse-btn {
		background: #1a1a1d;
		color: #e4e4e7;
		border: none;
		border-radius: 10px;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}
	.collapse-btn:hover {
		background: #27272a;
		color: #fbbf24;
	}
	.chev {
		transition: transform 0.2s ease;
	}
	.chev.up {
		transform: rotate(180deg);
	}
	.graphs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		min-width: 0;
	}
	.graphs.collapsed {
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	@media (max-width: 900px) {
		.graphs.collapsed {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 900px) {
		.graphs {
			grid-template-columns: 1fr;
		}
	}
</style>
