<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Local Code Review</title>
</svelte:head>

<div class="h-screen w-screen overflow-hidden bg-surface text-primary">
	{@render children()}
</div>
