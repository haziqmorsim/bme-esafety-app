<script>
    import { onMount } from "svelte";
    import Sun from "@lucide/svelte/icons/sun";
    import Moon from "@lucide/svelte/icons/moon";
    import { theme, toggleTheme, initTheme, syncThemeAcrossTabs } from "$lib/stores/theme";

    onMount(() => {
        initTheme();
        return syncThemeAcrossTabs();
    });

    const isDark = $derived($theme === 'dark');
</script>

<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
    {#if isDark}
        <Sun size={18} />
    {:else}
        <Moon size={18} />
    {/if}
</button>

<style>
	.theme-toggle {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 50%;
		background-color: var(--surface);
		color: var(--ink);
	}

	.theme-toggle:hover {
		border-color: var(--ink);
		background-color: var(--mist);
	}
</style>