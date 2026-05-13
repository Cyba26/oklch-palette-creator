<script lang="ts">
	import { formatOklch, formatRgb } from '$lib/color/convert';
	import type { Swatch } from '$lib/types';

	type Props = {
		swatch: Swatch;
		anchor?: boolean;
		onPick?: () => void;
	};

	let { swatch, anchor = false, onPick }: Props = $props();

	let copied = $state<'hex' | 'rgb' | 'oklch' | null>(null);

	async function copy(value: string, key: 'hex' | 'rgb' | 'oklch', e: Event) {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(value);
			copied = key;
			setTimeout(() => (copied = null), 1200);
		} catch {
			/* clipboard blocked, fail silently */
		}
	}
</script>

<div class="cell">
	<button
		type="button"
		class="swatch"
		style="background: {swatch.hex}"
		onclick={onPick}
		title={onPick ? 'Click to set as picker color' : ''}
	>
		{#if anchor}
			<span class="anchor-tag">picker</span>
		{/if}
		{#if !swatch.inGamut}
			<span class="badge" title="Gamut score {swatch.gamutScore}/100">⚠ {swatch.gamutScore}</span>
		{/if}
	</button>

	<div class="meta">
		<button class="line copyable" onclick={(e) => copy(swatch.hex, 'hex', e)} title="Copy hex">
			<code>{swatch.hex}</code>
			<span class="copy-mark">{copied === 'hex' ? '✓' : '⧉'}</span>
		</button>
		<button class="line copyable" onclick={(e) => copy(formatRgb(swatch.oklch), 'rgb', e)} title="Copy RGB">
			<code>{formatRgb(swatch.oklch)}</code>
			<span class="copy-mark">{copied === 'rgb' ? '✓' : '⧉'}</span>
		</button>
		<button class="line copyable" onclick={(e) => copy(formatOklch(swatch.oklch, 3), 'oklch', e)} title="Copy OKLCH">
			<code>{formatOklch(swatch.oklch, 2)}</code>
			<span class="copy-mark">{copied === 'oklch' ? '✓' : '⧉'}</span>
		</button>
	</div>
</div>

<style>
	.cell {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.swatch {
		aspect-ratio: 1;
		border-radius: 8px;
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: transparent;
		padding: 0;
		cursor: pointer;
		transition: transform 0.1s ease;
	}
	.swatch:hover {
		transform: scale(1.03);
	}
	.anchor-tag {
		position: absolute;
		top: 4px;
		left: 4px;
		background: #fbbf24;
		color: #1a1a1d;
		font-size: 9px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.badge {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.7);
		color: #fbbf24;
		font-size: 10px;
		padding: 2px 5px;
		border-radius: 4px;
		font-family: ui-monospace, monospace;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.line {
		background: transparent;
		border: none;
		padding: 2px 4px;
		border-radius: 4px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		color: inherit;
		text-align: left;
		min-width: 0;
	}
	.line:hover {
		background: #1a1a1d;
	}
	.line code {
		font-family: ui-monospace, monospace;
		font-size: 10px;
		color: #a1a1aa;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}
	.line:first-child code {
		color: #e4e4e7;
		font-size: 11px;
	}
	.copy-mark {
		font-size: 11px;
		color: #71717a;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.line:hover .copy-mark,
	.copy-mark:not(:empty) {
		opacity: 1;
	}
</style>
