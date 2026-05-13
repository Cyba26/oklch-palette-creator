<script lang="ts">
	import { oklchToSrgbBytes } from '$lib/color/fast';
	import { clampToGamut, isInGamut } from '$lib/color/gamut';
	import { oklchToHex } from '$lib/color/convert';
	import type { PickerStore } from '$lib/stores/picker.svelte';
	import type { OKLCH } from '$lib/types';

	type Axis = 'L' | 'C' | 'H';

	type Props = {
		store: PickerStore;
		title: string;
		xAxis: Axis;
		yAxis: Axis;
		primary: Axis; // which axis the numeric input edits
		step: number;
		min: number;
		max: number;
		overlay?: OKLCH[];
		compact?: boolean; // hide canvas+header, keep only the slider
	};

	let { store, title, xAxis, yAxis, primary, step, min, max, overlay, compact = false }: Props = $props();

	const C_MAX = 0.32;
	const HEIGHT = 200;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let width = $state(400);
	let dragging = $state(false);

	const axisGradient = $derived.by(() => {
		const N = 40;
		const [lo, hi] = primary === 'L' ? [0, 1] : primary === 'C' ? [0, 0.4] : [0, 360];
		const stops: string[] = [];
		for (let i = 0; i <= N; i++) {
			const t = i / N;
			const v = lo + t * (hi - lo);
			const oklch =
				primary === 'L'
					? { l: v, c: store.color.c, h: store.color.h }
					: primary === 'C'
						? { l: store.color.l, c: v, h: store.color.h }
						: { l: store.color.l, c: store.color.c, h: v };
			// OOG → dark band so the user sees the achievable range at a glance.
			const hex = isInGamut(oklch, store.gamut) ? oklchToHex(oklch) : '#0a0a0a';
			stops.push(`${hex} ${(t * 100).toFixed(1)}%`);
		}
		return `linear-gradient(to right, ${stops.join(', ')})`;
	});

	function axisRange(axis: Axis): [number, number] {
		if (axis === 'L') return [0, 1];
		if (axis === 'C') return [0, C_MAX];
		return [0, 360];
	}

	function axisValue(axis: Axis): number {
		if (axis === 'L') return store.color.l;
		if (axis === 'C') return store.color.c;
		return store.color.h;
	}

	function setAxis(axis: Axis, v: number) {
		if (axis === 'L') store.setL(v);
		else if (axis === 'C') store.setC(v);
		else store.setH(v);
	}

	$effect(() => {
		if (!canvas) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const w = entry.contentRect.width;
				if (w > 0 && Math.abs(w - width) > 1) width = w;
			}
		});
		ro.observe(canvas);
		return () => ro.disconnect();
	});

	let rafHandle = 0;
	$effect(() => {
		if (!canvas) return;
		void width;
		void store.color.l;
		void store.color.c;
		void store.color.h;
		void store.gamut;
		void overlay;
		if (rafHandle) cancelAnimationFrame(rafHandle);
		rafHandle = requestAnimationFrame(() => draw());
	});

	function draw() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const cssW = Math.max(50, Math.floor(width));
		const cssH = HEIGHT;
		const dpr = window.devicePixelRatio ?? 1;
		const W = cssW * dpr; // physical buffer width
		const H = cssH * dpr; // physical buffer height

		canvas.width = W;
		canvas.height = H;
		ctx.setTransform(1, 0, 0, 1, 0, 0); // pixel-space

		const [xmin, xmax] = axisRange(xAxis);
		const [ymin, ymax] = axisRange(yAxis);
		const fixedL = store.color.l;
		const fixedC = store.color.c;
		const fixedH = store.color.h;

		// One OKLCH calc per physical pixel — sub-CSS-pixel gamut boundary on Retina.
		const img = ctx.createImageData(W, H);
		const data = img.data;
		const isSrgb = store.gamut === 'sRGB';
		for (let y = 0; y < H; y++) {
			const yv = ymin + (1 - y / H) * (ymax - ymin);
			let row = y * W * 4;
			for (let x = 0; x < W; x++) {
				const xv = xmin + (x / W) * (xmax - xmin);
				let l = fixedL,
					c = fixedC,
					h = fixedH;
				if (xAxis === 'L') l = xv;
				if (xAxis === 'C') c = xv;
				if (xAxis === 'H') h = xv;
				if (yAxis === 'L') l = yv;
				if (yAxis === 'C') c = yv;
				if (yAxis === 'H') h = yv;
				if (isSrgb) {
					oklchToSrgbBytes(l, c, h, data, row);
				} else {
					// P3 path — falls back to culori, slower but correct
					const oklch = { l, c, h };
					if (isInGamut(oklch, store.gamut)) {
						const hex = oklchToHex(oklch);
						data[row] = parseInt(hex.slice(1, 3), 16);
						data[row + 1] = parseInt(hex.slice(3, 5), 16);
						data[row + 2] = parseInt(hex.slice(5, 7), 16);
					} else {
						data[row] = 24;
						data[row + 1] = 24;
						data[row + 2] = 27;
					}
					data[row + 3] = 255;
				}
				row += 4;
			}
		}
		ctx.putImageData(img, 0, 0);

		// overlay palette swatches as faint dots (projected onto this 2D slice)
		if (overlay && overlay.length) {
			for (const c of overlay) {
				const ax = xAxis === 'L' ? c.l : xAxis === 'C' ? c.c : c.h;
				const ay = yAxis === 'L' ? c.l : yAxis === 'C' ? c.c : c.h;
				if (ax < xmin || ax > xmax || ay < ymin || ay > ymax) continue;
				const px = ((ax - xmin) / (xmax - xmin)) * W;
				const py = (1 - (ay - ymin) / (ymax - ymin)) * H;
				ctx.beginPath();
				ctx.arc(px, py, 4 * dpr, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
				ctx.fill();
				ctx.beginPath();
				ctx.arc(px, py, 4 * dpr, 0, Math.PI * 2);
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
				ctx.lineWidth = 1 * dpr;
				ctx.stroke();
			}
		}

		// marker in CSS coords, scaled to physical
		const mx = ((axisValue(xAxis) - xmin) / (xmax - xmin)) * W;
		const my = (1 - (axisValue(yAxis) - ymin) / (ymax - ymin)) * H;
		ctx.beginPath();
		ctx.arc(mx, my, 7 * dpr, 0, Math.PI * 2);
		ctx.strokeStyle = 'white';
		ctx.lineWidth = 2 * dpr;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(mx, my, 7 * dpr, 0, Math.PI * 2);
		ctx.strokeStyle = 'rgba(0,0,0,0.6)';
		ctx.lineWidth = 1 * dpr;
		ctx.stroke();
	}

	function handlePointer(e: PointerEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
		const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
		const [xmin, xmax] = axisRange(xAxis);
		const [ymin, ymax] = axisRange(yAxis);
		const xv = xmin + (x / rect.width) * (xmax - xmin);
		const yv = ymin + (1 - y / rect.height) * (ymax - ymin);

		// Build full OKLCH target keeping the third axis fixed at current value.
		let l = store.color.l,
			c = store.color.c,
			h = store.color.h;
		if (xAxis === 'L') l = xv;
		if (xAxis === 'C') c = xv;
		if (xAxis === 'H') h = xv;
		if (yAxis === 'L') l = yv;
		if (yAxis === 'C') c = yv;
		if (yAxis === 'H') h = yv;

		// Clamp to gamut: if OOG, walk chroma down (preserves H, L).
		const clamped = clampToGamut({ l, c, h }, store.gamut);
		store.setColor(clamped);
	}
</script>

<div class="graph" class:compact>
	{#if !compact}
		<div class="header">
			<span class="title">{title}</span>
			<input
				type="number"
				{min}
				{max}
				{step}
				value={axisValue(primary).toFixed(primary === 'H' ? 1 : 3)}
				oninput={(e) => setAxis(primary, +e.currentTarget.value)}
			/>
		</div>
		<canvas
			bind:this={canvas}
			style="width: 100%; height: {HEIGHT}px; display: block;"
			onpointerdown={(e) => {
				dragging = true;
				(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
				handlePointer(e);
			}}
			onpointermove={(e) => dragging && handlePointer(e)}
			onpointerup={() => (dragging = false)}
		></canvas>
	{:else}
		<span class="title compact-label">{title}</span>
	{/if}

	<input
		class="axis-slider"
		type="range"
		{min}
		{max}
		{step}
		value={axisValue(primary)}
		oninput={(e) => setAxis(primary, +e.currentTarget.value)}
		aria-label="{primary} fine adjust"
		style="--track: {axisGradient};"
	/>
</div>

<style>
	.graph {
		background: #1a1a1d;
		border-radius: 12px;
		padding: 12px;
	}
	.graph.compact {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
	}
	.compact-label {
		min-width: 70px;
		font-size: 12px;
		font-weight: 600;
		color: #a1a1aa;
	}
	.graph.compact .axis-slider {
		margin-top: 0;
		flex: 1;
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		color: #e4e4e7;
	}
	.title {
		font-weight: 600;
	}
	input[type='number'] {
		background: #27272a;
		color: #e4e4e7;
		border: none;
		border-radius: 6px;
		padding: 6px 10px;
		font-family: ui-monospace, monospace;
		font-size: 12px;
		width: 90px;
		text-align: right;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	canvas {
		display: block;
		width: 100%;
		border-radius: 6px;
		cursor: crosshair;
		touch-action: none;
	}
	.axis-slider {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		margin-top: 12px;
		height: 22px;
		border-radius: 12px;
		background: var(--track);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);
		cursor: pointer;
		outline: none;
	}
	.axis-slider::-webkit-slider-runnable-track {
		height: 22px;
		background: transparent;
		border-radius: 12px;
	}
	.axis-slider::-moz-range-track {
		height: 22px;
		background: transparent;
		border-radius: 12px;
	}
	.axis-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: transparent;
		border: 2px solid #fff;
		box-shadow: 0 0 6px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.4);
		cursor: grab;
		margin-top: 0;
	}
	.axis-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: transparent;
		border: 2px solid #fff;
		box-shadow: 0 0 6px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.4);
		cursor: grab;
	}
	.axis-slider:active::-webkit-slider-thumb,
	.axis-slider:active::-moz-range-thumb {
		cursor: grabbing;
	}
</style>
