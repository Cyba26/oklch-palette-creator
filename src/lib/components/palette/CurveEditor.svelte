<script lang="ts">
	import { PRESETS, sampleCurve } from '$lib/palette/curves';
	import type { BezierCurve, CurvePreset } from '$lib/types';

	type Props = {
		curve: BezierCurve;
		label: string;
		rangeMin: number;
		rangeMax: number;
		rangeStep: number;
		rangeBounds: [number, number];
		recommended?: CurvePreset;
		topStops?: string[];
		bottomStops?: string[];
		onChange: (curve: BezierCurve) => void;
	};

	let { curve, label, rangeStep, rangeBounds, recommended, topStops, bottomStops, onChange }: Props = $props();

	function stopsToGradient(stops?: string[]): string {
		if (!stops || stops.length === 0) return '#3f3f46';
		const parts = stops.map((hex, i) => `${hex} ${((i / (stops.length - 1)) * 100).toFixed(1)}%`);
		return `linear-gradient(to right, ${parts.join(', ')})`;
	}

	const topGradient = $derived(stopsToGradient(topStops));
	const bottomGradient = $derived(stopsToGradient(bottomStops));

	const slug = $derived(label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

	const HEIGHT = 160;
	const PAD = 14; // inner padding so curve doesn't touch edges
	let svgEl = $state<SVGSVGElement | null>(null);
	let width = $state(280);
	let dragging = $state<0 | 1 | null>(null);

	$effect(() => {
		if (!svgEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const w = entry.contentRect.width;
				if (w > 0 && Math.abs(w - width) > 0.5) width = w;
			}
		});
		ro.observe(svgEl);
		return () => ro.disconnect();
	});

	function toScreenX(tx: number): number {
		return PAD + tx * (width - 2 * PAD);
	}
	function toScreenY(ty: number): number {
		// ty=0 is bottom, ty=1 is top
		return PAD + (1 - ty) * (HEIGHT - 2 * PAD);
	}

	const samples = $derived.by(() => {
		const pts: { x: number; y: number }[] = [];
		const N = 60;
		const flatCurve: BezierCurve = { ...curve, range: [0, 1] };
		for (let i = 0; i <= N; i++) {
			const t = i / N;
			const y = sampleCurve(flatCurve, t);
			pts.push({ x: toScreenX(t), y: toScreenY(y) });
		}
		return pts;
	});

	const path = $derived('M ' + samples.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L '));

	const editable = $derived(curve.preset === 'custom');

	const endpoints = $derived.by(() => {
		const flatCurve: BezierCurve = { ...curve, range: [0, 1] };
		return {
			start: { x: toScreenX(0), y: toScreenY(sampleCurve(flatCurve, 0)) },
			end: { x: toScreenX(1), y: toScreenY(sampleCurve(flatCurve, 1)) }
		};
	});

	function setPreset(preset: CurvePreset) {
		const controls = preset === 'custom' ? curve.controls : (PRESETS as Record<string, [number, number, number, number]>)[preset] ?? curve.controls;
		onChange({ ...curve, preset, controls });
	}

	function startDrag(idx: 0 | 1, e: PointerEvent) {
		if (!editable) return;
		dragging = idx;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onMove(e: PointerEvent) {
		if (dragging === null || !svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		const innerW = rect.width - 2 * PAD;
		const innerH = rect.height - 2 * PAD;
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left - PAD) / innerW));
		const y = Math.max(-0.3, Math.min(1.3, 1 - (e.clientY - rect.top - PAD) / innerH));
		const c: [number, number, number, number] = [...curve.controls];
		if (dragging === 0) {
			c[0] = x;
			c[1] = y;
		} else {
			c[2] = x;
			c[3] = y;
		}
		onChange({ ...curve, preset: 'custom', controls: c });
	}

	function endDrag() {
		dragging = null;
	}

	function fmt(v: number): string {
		return Number(v.toFixed(2)).toString();
	}

	function setRangeMin(v: number) {
		onChange({ ...curve, range: [v, curve.range[1]] });
	}
	function setRangeMax(v: number) {
		onChange({ ...curve, range: [curve.range[0], v] });
	}

	// Mirror slider: drags both ends symmetrically around their current midpoint.
	const midpoint = $derived((curve.range[0] + curve.range[1]) / 2);
	const direction = $derived(curve.range[1] >= curve.range[0] ? 1 : -1);
	const spread = $derived(Math.abs(curve.range[1] - curve.range[0]));
	const maxSpread = $derived(rangeBounds[1] - rangeBounds[0]);
	const thumbPct = $derived(maxSpread > 0 ? (spread / maxSpread) * 100 : 0);
	const thumbColor = $derived.by(() => {
		if (!topStops || topStops.length === 0) return 'transparent';
		const idx = Math.round((thumbPct / 100) * (topStops.length - 1));
		return topStops[Math.max(0, Math.min(topStops.length - 1, idx))];
	});

	function setSpread(newSpread: number) {
		const half = (newSpread * direction) / 2;
		const newStart = midpoint - half;
		const newEnd = midpoint + half;
		onChange({ ...curve, range: [newStart, newEnd] });
	}

	let trackEl = $state<HTMLDivElement | null>(null);
	let thumbDragging = $state(false);

	function thumbStart(e: PointerEvent) {
		thumbDragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		updateFromPointer(e);
	}
	function thumbMove(e: PointerEvent) {
		if (!thumbDragging) return;
		updateFromPointer(e);
	}
	function thumbEnd() {
		thumbDragging = false;
	}
	function updateFromPointer(e: PointerEvent) {
		if (!trackEl) return;
		const rect = trackEl.getBoundingClientRect();
		const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
		const newSpread = (x / rect.width) * maxSpread;
		setSpread(newSpread);
	}

	const presets: CurvePreset[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bell', 'custom'];
</script>

<div class="editor">
	<div class="head">
		<span class="lbl">{label}</span>
	</div>

	{#if recommended}
		<button
			class="preset-btn standard"
			class:active={curve.preset === recommended}
			title="Recommended for {label.toLowerCase()}"
			onclick={() => setPreset(recommended)}
		>
			<span class="muted">Standard</span>
			<span class="sep">·</span>
			{recommended}
		</button>
	{/if}
	<div class="presets">
		{#each presets.filter((p) => p !== recommended) as p (p)}
			<button
				class="preset-btn"
				class:active={curve.preset === p}
				onclick={() => setPreset(p)}
			>
				{p}
			</button>
		{/each}
	</div>

	<svg
		bind:this={svgEl}
		width="100%"
		height={HEIGHT}
		viewBox="0 0 {width} {HEIGHT}"
		onpointermove={onMove}
		onpointerup={endDrag}
		role="application"
		aria-label="{label} curve editor"
	>
		<defs>
			<pattern id="grid-{slug}" width="20" height="20" patternUnits="userSpaceOnUse">
				<path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.5" />
			</pattern>
		</defs>
		<rect width={width} height={HEIGHT} fill="url(#grid-{slug})" />

		{#if editable}
			<line
				x1={toScreenX(0)}
				y1={toScreenY(0)}
				x2={toScreenX(curve.controls[0])}
				y2={toScreenY(curve.controls[1])}
				stroke="rgba(255,255,255,0.25)"
				stroke-width="1"
				stroke-dasharray="3,3"
			/>
			<line
				x1={toScreenX(1)}
				y1={toScreenY(1)}
				x2={toScreenX(curve.controls[2])}
				y2={toScreenY(curve.controls[3])}
				stroke="rgba(255,255,255,0.25)"
				stroke-width="1"
				stroke-dasharray="3,3"
			/>
		{/if}

		<path d={path} fill="none" stroke="#fbbf24" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

		<circle cx={endpoints.start.x} cy={endpoints.start.y} r="4" fill="#fbbf24" />
		<circle cx={endpoints.end.x} cy={endpoints.end.y} r="4" fill="#fbbf24" />

		{#if editable}
			<circle
				cx={toScreenX(curve.controls[0])}
				cy={toScreenY(curve.controls[1])}
				r="7"
				fill="transparent"
				stroke="#fbbf24"
				stroke-width="2"
				style="cursor: grab"
				role="slider"
				tabindex="0"
				aria-label="Control point 1"
				aria-valuenow={curve.controls[1]}
				onpointerdown={(e) => startDrag(0, e)}
			/>
			<circle
				cx={toScreenX(curve.controls[2])}
				cy={toScreenY(curve.controls[3])}
				r="7"
				fill="transparent"
				stroke="#fbbf24"
				stroke-width="2"
				style="cursor: grab"
				role="slider"
				tabindex="0"
				aria-label="Control point 2"
				aria-valuenow={curve.controls[3]}
				onpointerdown={(e) => startDrag(1, e)}
			/>
		{/if}
	</svg>

	<div class="mirror" title="Drags start and end together around the midpoint">
		<span class="mirror-label">Range</span>
		<div
			class="dual-track"
			bind:this={trackEl}
			role="slider"
			aria-label="Range"
			aria-valuenow={spread}
			tabindex="0"
		>
			<div class="bar bar-top" style="background: {topGradient};"></div>
			<div class="bar bar-bot" style="background: {bottomGradient};"></div>
			<div
				class="dual-thumb"
				style="left: {thumbPct}%; background: {thumbColor};"
				role="slider"
				tabindex="0"
				aria-label="Range spread"
				aria-valuenow={spread}
				onpointerdown={thumbStart}
				onpointermove={thumbMove}
				onpointerup={thumbEnd}
				onpointercancel={thumbEnd}
			></div>
		</div>
	</div>

	<div class="range">
		<label>
			start
			<input
				type="number"
				min={rangeBounds[0]}
				max={rangeBounds[1]}
				step={rangeStep}
				value={fmt(curve.range[0])}
				oninput={(e) => setRangeMin(+e.currentTarget.value)}
			/>
		</label>
		<label>
			end
			<input
				type="number"
				min={rangeBounds[0]}
				max={rangeBounds[1]}
				step={rangeStep}
				value={fmt(curve.range[1])}
				oninput={(e) => setRangeMax(+e.currentTarget.value)}
			/>
		</label>
	</div>
</div>

<style>
	.editor {
		background: #1a1a1d;
		border-radius: 12px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.lbl {
		font-weight: 600;
		color: #e4e4e7;
	}
	.presets {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.preset-btn {
		background: #27272a;
		color: #a1a1aa;
		border: none;
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 11px;
		cursor: pointer;
		text-transform: capitalize;
	}
	.preset-btn.active {
		background: #fbbf24;
		color: #1a1a1d;
		font-weight: 600;
	}
	.preset-btn.standard {
		box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.5);
		color: #fbbf24;
		font-weight: 600;
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.preset-btn.standard.active {
		color: #1a1a1d;
		box-shadow: none;
	}
	.preset-btn.standard .muted {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		opacity: 0.65;
	}
	.preset-btn.standard .sep {
		opacity: 0.5;
	}
	svg {
		display: block;
		width: 100%;
		background: #1a1a1d;
		border-radius: 6px;
		touch-action: none;
	}
	.mirror {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		color: #71717a;
	}
	.mirror-label {
		font-size: 11px;
		color: #71717a;
	}
	.dual-track {
		flex: 1;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 5px;
		height: 25px;
		touch-action: none;
	}
	.bar {
		height: 10px;
		border-radius: 5px;
		background: #3f3f46;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);
	}
	.dual-thumb {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid #fff;
		box-shadow: 0 0 6px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.4);
		cursor: grab;
	}
	.dual-thumb:active {
		cursor: grabbing;
	}
	.range {
		display: flex;
		gap: 8px;
	}
	.range label {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: #71717a;
	}
	.range input[type='number'] {
		flex: 1;
		background: #27272a;
		color: #e4e4e7;
		border: none;
		border-radius: 6px;
		padding: 6px 10px;
		font-family: ui-monospace, monospace;
		font-size: 12px;
		min-width: 0;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.range input[type='number']::-webkit-inner-spin-button,
	.range input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>
