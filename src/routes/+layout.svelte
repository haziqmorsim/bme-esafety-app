<script>
	import './layout.css';
	import { page, navigating } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { spinner } from '$lib/stores/spinner.js';
	import { toast } from '$lib/stores/toast';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { initAuthStore, destroyAuthStore, authUser } from '$lib/auth-store';
	import { checkSession } from '$lib/auth-guard';
	import { getSupabase } from '$lib/supabase';
	import { goto, onNavigate } from '$app/navigation';

	/** @type {{ children: any }} */
	const { children } = $props();

	const MIN_SPINNER_MS = 400;
	const INACTIVITY_MS = 30 * 60 * 1000;
	const INACTIVITY_CHECK_MS = 60 * 1000;
	const NAVIGATION_SESSION_CHECK_MS = 8000;
	const FORCED_RELOAD_KEY = 'bme:forced-reload-at';

	let spinnerActive = $state(false);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let hideTimer = null;
	/** @type {null | (() => void)} */
	let navUnsub = null;
	/** @type {ReturnType<typeof setInterval> | null} */
	let inactivityInterval = null;
	let lastActivity = Date.now();
	let signingOut = false;

	const AUTH_PATHS = [
		'/signin',
		'/signup',
		'/auth/forgotpw',
		'/auth/forgotpw/confirm',
		'/auth/resetpw',
		'/confirmation'
	];

	const isAuthPage = $derived(AUTH_PATHS.includes($page.url.pathname));

	function recentlyForcedReload() {
		try {
			const at = Number(sessionStorage.getItem(FORCED_RELOAD_KEY) || 0);
			return Date.now() - at < 30_000;
		} catch {
			return false;
		}
	}

	onNavigate(async (navigation) => {
		const target = navigation.to?.url;
		if (!target || navigation.willUnload || target.origin !== location.origin) return;
		if (AUTH_PATHS.includes(target.pathname) || !get(authUser)) return;

		const { ok } = await checkSession(NAVIGATION_SESSION_CHECK_MS);
		if (ok || recentlyForcedReload()) return;

		try {
			sessionStorage.setItem(FORCED_RELOAD_KEY, String(Date.now()));
		} catch {
			// ignore
		}
		location.href = target.href;
		await new Promise(() => {});
	});

	async function handleSessionTimeout() {
		if (isAuthPage || signingOut || !get(authUser)) return;
		signingOut = true;

		try {
			const supabase = getSupabase();
			if (supabase) {
				await Promise.race([
					supabase.auth.signOut(),
					new Promise((resolve) => setTimeout(resolve, 5000))
				]);
			}
		} catch {
			// Sign-out failures still end with the sign-in page.
		} finally {
			signingOut = false;
		}

		toast.info('You were signed out after 30 minutes of inactivity.');
		await goto('/signin');
	}

	function markActivity() {
		lastActivity = Date.now();
	}

	function checkInactivity() {
		if (Date.now() - lastActivity >= INACTIVITY_MS) {
			handleSessionTimeout();
		}
	}

	function onVisibilityChange() {
		if (document.visibilityState === 'visible') checkInactivity();
	}

	const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

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

		for (const name of ACTIVITY_EVENTS) {
			window.addEventListener(name, markActivity, { capture: true, passive: true });
		}
		document.addEventListener('visibilitychange', onVisibilityChange);

		markActivity();
		inactivityInterval = setInterval(checkInactivity, INACTIVITY_CHECK_MS);

		return () => {
			for (const name of ACTIVITY_EVENTS) {
				window.removeEventListener(name, markActivity, { capture: true });
			}
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	onDestroy(() => {
		if (navUnsub) navUnsub();
		if (hideTimer) clearTimeout(hideTimer);
		if (inactivityInterval) clearInterval(inactivityInterval);
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

	<main class="app-main" class:auth={isAuthPage}>
		{@render children()}
	</main>

	{#if !isAuthPage}
		<Footer />
	{/if}
</div>

<Toast />

<style>
	.app-shell {
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.app-main {
		flex: 1;
		width: 100%;
		min-width: 0;
		max-width: 1320px;
		margin: 0 auto;
		padding: 28px 14px 0;
		box-sizing: border-box;
	}

	.app-main.auth {
		max-width: none;
		margin: 0;
		padding: 0;
	}

	@media (max-width: 600px) {
		.app-main {
			padding-top: 20px;
		}
	}
</style>