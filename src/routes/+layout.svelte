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
	import { appSettings, loadSettings } from '$lib/settings';
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';

	/** @type {{ children: any }} */
	const { children } = $props();

	const MIN_SPINNER_MS = 400;
	const SETTINGS_REFRESH_MS = 5 * 60 * 1000;
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
	let lastSettingsLoad = 0;
	let signingOut = false;

	const inactivityMinutes = $derived($appSettings.session_timeout_minutes);
	const inactivityMs = $derived(inactivityMinutes * 60 * 1000);

	const announcement = $derived($appSettings.announcement);
	let dismissedAnnouncement = $state('');
	const announcementKey = $derived(`${announcement.level}|${announcement.message.trim()}`);

	const AUTH_PATHS = [
		'/signin',
		'/signup',
		'/auth/forgotpw',
		'/auth/forgotpw/confirm',
		'/auth/resetpw',
		'/auth/changepw',
		'/confirmation'
	];
	const CHANGE_PW_PATH = '/auth/changepw';

	const isAuthPage = $derived(AUTH_PATHS.includes($page.url.pathname));

	const mustChangePassword = $derived(Boolean($authUser?.app_metadata?.must_change_password));

	const showAnnouncement = $derived(
		!isAuthPage &&
			Boolean($authUser) &&
			announcement.enabled &&
			announcement.message.trim() !== '' &&
			dismissedAnnouncement !== announcementKey
	);

	function refreshSettings() {
		lastSettingsLoad = Date.now();
		loadSettings();
	}

	$effect(() => {
		if ($authUser && !isAuthPage && !mustChangePassword) refreshSettings();
	});

	$effect(() => {
		if (mustChangePassword && $page.url.pathname !== CHANGE_PW_PATH) {
			goto(CHANGE_PW_PATH, { replaceState: true });
		}
	});

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
		const onChangePw = $page.url.pathname === CHANGE_PW_PATH;
		if ((isAuthPage && !onChangePw) || signingOut || !get(authUser)) return;
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

		toast.info(`You were signed out after ${inactivityMinutes} minutes of inactivity.`);
		await goto('/signin');
	}

	function markActivity() {
		lastActivity = Date.now();
	}

	function checkInactivity() {
		if (Date.now() - lastActivity >= inactivityMs) {
			handleSessionTimeout();
		}
	}

	function onVisibilityChange() {
		if (document.visibilityState !== 'visible') return;
		checkInactivity();
		if (get(authUser) && Date.now() - lastSettingsLoad > SETTINGS_REFRESH_MS) refreshSettings();
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

	{#if showAnnouncement}
		<div
			class="announcement"
			class:warning={announcement.level === 'warning'}
			role={announcement.level === 'warning' ? 'alert' : 'status'}
		>
			<div class="announcement-inner">
				{#if announcement.level === 'warning'}
					<TriangleAlert size={18} />
				{:else}
					<Info size={18} />
				{/if}
				<p>{announcement.message.trim()}</p>
				<button
					type="button"
					class="announcement-close"
					aria-label="Dismiss announcement"
					onclick={() => (dismissedAnnouncement = announcementKey)}
				>
					<X size={16} />
				</button>
			</div>
		</div>
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

	.announcement {
		border-bottom: 1px solid var(--brand);
		background-color: var(--brand-tint);
		color: var(--ink);
		font-size: 14px;
	}

	.announcement.warning {
		border-bottom-color: var(--warn);
		background-color: var(--warn-bg);
	}

	.announcement-inner {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		max-width: 1320px;
		margin: 0 auto;
		padding: 10px 20px;
		box-sizing: border-box;
	}

	.announcement-inner :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
	}

	.announcement p {
		flex: 1;
		min-width: 0;
		margin: 0;
		line-height: 1.45;
		overflow-wrap: anywhere;
		white-space: pre-line;
	}

	.announcement-close {
		flex-shrink: 0;
		padding: 4px;
		border-color: transparent;
		background-color: transparent;
		color: var(--ink);
	}

	.announcement-close:hover:not(:disabled) {
		background-color: var(--hover-tint);
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