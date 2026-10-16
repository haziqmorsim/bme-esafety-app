<script>
	import './layout.css';
	import { page, navigating } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { spinner } from '$lib/stores/spinner.js';
	import { onMount, onDestroy } from 'svelte';
	import { initAuthStore, destroyAuthStore } from '$lib/auth-store';
	import { getSupabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	/** @type {{ children: any }} */
	const { children } = $props();

	const MIN_SPINNER_MS = 400;
	const INACTIVITY_MS = 30 * 60 * 1000;

	let spinnerActive = $state(false);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let hideTimer = null;
	/** @type {null | (() => void)} */
	let navUnsub = null;
	let inactivityTimer = null;

	const isAuthPage = $derived.by(() => {
		const path = $page.url.pathname;
		return (
			path === '/signin' ||
			path === '/signup' ||
			path === '/auth/forgotpw' ||
			path === '/auth/resetpw' ||
			path == '/confirmation'
		);
	});

	async function handleSessionTimeout() {
		if (isAuthPage) return;

		const supabase = getSupabase();
		if (supabase) {
			await supabase.auth.signOut();
		}

		await goto('/signin');
	}

	function resetInactivityTimer() {
		if (isAuthPage) return;

		if (inactivityTimer) {
			clearTimeout(inactivityTimer);
		}

		inactivityTimer = setTimeout(() => {
			handleSessionTimeout();
		}, INACTIVITY_MS);
	}

	onMount(() => {
		initAuthStore();

		navUnsub = navigating.subscribe((nav) => {
			if (nav) {
				if (hideTimer) {
					clearTimeout(hideTimer);
					hideTimer = null;
				}
				spinnerActive = true;
			} else {
				hideTimer = setTimeout(() => {
					spinnerActive = false;
					hideTimer = null;
				}, MIN_SPINNER_MS);
			}
		});

		const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

		for (const events of activityEvents) {
			window.addEventListener(event, resetInactivityTimer, true);
		}

		resetInactivityTimer();

		return () => {
			for (const events of activityEvents) {
				window.removeEventListener(event, resetInactivityTimer, true);
			}
		};
	});

	onDestroy(() => {
		// @ts-ignore
		if (navUnsub) navUnsub();
		if (hideTimer) clearTimeout(hideTimer);
		if (inactivityTimer) clearTimeout(inactivityTimer);
		destroyAuthStore();
	});
</script>

<svelte:head>
	<title>{$page.data.title ?? 'BME e-Safety App'}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<Spinner active={$spinner || spinnerActive} />

<div class="app-shell">
	{#if !isAuthPage}
		<Header />
	{/if}

	<main class="app-main">
		{@render children()}
	</main>

	{#if !isAuthPage}
		<Footer />
	{/if}
</div>

<style>
	.app-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.app-main {
		flex: 1;
	}
</style>
