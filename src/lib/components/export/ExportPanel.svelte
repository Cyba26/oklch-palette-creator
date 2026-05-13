<script lang="ts">
	import { toCss } from '$lib/export/css';
	import { toFigmaTokens } from '$lib/export/figma-tokens';
	import { toJson } from '$lib/export/json';
	import { toTailwind } from '$lib/export/tailwind';
	import type { PaletteStore } from '$lib/stores/palette.svelte';

	let { store }: { store: PaletteStore } = $props();

	type Tab = 'css' | 'tailwind' | 'json' | 'figma';
	let tab = $state<Tab>('css');
	let name = $state('brand');
	let copied = $state(false);

	const output = $derived.by(() => {
		const sw = store.swatches;
		switch (tab) {
			case 'css':
				return toCss(sw, name);
			case 'tailwind':
				return toTailwind(sw, name);
			case 'json':
				return toJson(sw, name);
			case 'figma':
				return toFigmaTokens(sw, name);
		}
	});

	async function copy() {
		await navigator.clipboard.writeText(output);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	async function copyShareUrl() {
		await navigator.clipboard.writeText(store.shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'css', label: 'CSS variables' },
		{ id: 'tailwind', label: 'Tailwind' },
		{ id: 'json', label: 'JSON' },
		{ id: 'figma', label: 'Figma tokens' }
	];
</script>

<div class="export">
	<div class="head">
		<div class="tabs">
			{#each tabs as t (t.id)}
				<button class:active={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
			{/each}
		</div>
		<label class="name">
			<span>Name</span>
			<input type="text" value={name} oninput={(e) => (name = e.currentTarget.value || 'brand')} />
		</label>
	</div>

	<pre><code>{output}</code></pre>

	<div class="actions">
		<button onclick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
		<button onclick={copyShareUrl}>Copy share URL</button>
	</div>
</div>

<style>
	.export {
		background: #1a1a1d;
		border-radius: 12px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.tabs {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.tabs button {
		background: #27272a;
		color: #a1a1aa;
		border: none;
		border-radius: 6px;
		padding: 6px 10px;
		font-size: 12px;
		cursor: pointer;
	}
	.tabs button.active {
		background: #fbbf24;
		color: #1a1a1d;
		font-weight: 600;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: #71717a;
	}
	.name input {
		background: #27272a;
		color: #e4e4e7;
		border: none;
		border-radius: 6px;
		padding: 4px 8px;
		font-family: ui-monospace, monospace;
		font-size: 12px;
		width: 100px;
	}
	pre {
		background: #050505;
		padding: 12px;
		border-radius: 8px;
		margin: 0;
		max-height: 320px;
		overflow: auto;
		font-family: ui-monospace, monospace;
		font-size: 12px;
		color: #e4e4e7;
		white-space: pre;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.actions button {
		background: #27272a;
		color: #e4e4e7;
		border: none;
		border-radius: 6px;
		padding: 8px 14px;
		font-size: 12px;
		cursor: pointer;
	}
	.actions button:hover {
		background: #3f3f46;
	}
</style>
