<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Local Code Review</title>
</svelte:head>

<div class="h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-200">
	{@render children()}
</div>
