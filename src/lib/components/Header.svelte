<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { getSupabase } from '$lib/supabase';
	import { authUser } from '$lib/auth-store';
	import History from '@lucide/svelte/icons/history';
	import Calendar from '@lucide/svelte/icons/calendar-days';
	import Bell from '@lucide/svelte/icons/bell';
	import House from '@lucide/svelte/icons/house';
	import LogOut from '@lucide/svelte/icons/log-out';

	const navItems = [
		{ href: '/', label: 'Main Menu', icon: House },
		{ href: '/osh/notifications', label: 'Notifications', icon: Bell },
		{ href: '/osh/calendar-view', label: 'Calendar', icon: Calendar },
		{ href: '/osh/submission-history', label: 'History', icon: History }
	];

	const isAuthPage = $derived.by(() => {
		const path = $page.url.pathname;
		return (
			path === '/signin' ||
			path === '/signup' ||
			path === '/auth/forgotpw' ||
			path === '/auth/forgotpw/confirm' ||
			path === '/auth/resetpw' ||
			path === '/confirmation'
		);
	});

	let hasUser = $state(false);
	let userName = $state('User');
	let firstName = $state('');
	let lastName = $state('');
	let unsubUser = null;

	const initials = $derived.by(() => {
		const first = (firstName ?? '').trim();
		const last = (lastName ?? '').trim();
		if (first && last) return (first[0] + last[0]).toUpperCase();
		if (first) return first[0].toUpperCase();
		if (last) return last[0].toUpperCase();

		const name = (userName ?? '').trim();
		return name && name !== 'User' ? name[0].toUpperCase() : 'U';
	});

	function isActive(href) {
		const path = $page.url.pathname;
		return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
	}

	async function syncUser(user) {
		if (!user) {
			hasUser = false;
			userName = 'User';
			firstName = '';
			lastName = '';
			return;
		}

		hasUser = true;

		const supabase = getSupabase();
		if (!supabase) return;

		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('nickname, first_name, last_name')
			.eq('id', user.id)
			.single();

		if (profileError) {
			userName = user.email ?? 'User';
			return;
		}

		firstName = profile?.first_name ?? '';
		lastName = profile?.last_name ?? '';
		userName = profile?.nickname || profile?.first_name || user.email;
	}

	onMount(async () => {
		unsubUser = authUser.subscribe(async (user) => {
			await syncUser(user);
		});
	});

	onDestroy(() => {
		unsubUser?.();
	});

	async function signOut() {
		const supabase = getSupabase();
		if (supabase) await supabase.auth.signOut();
		hasUser = false;
		userName = 'User';
		firstName = '';
		lastName = '';
		await goto('/signin');
	}
</script>

<header class="site-header">
	<div class="stripe" aria-hidden="true"></div>

	<div class="bar">
		<a href="/" class="brand" aria-label="BME e-Safety App home">
			<span class="logo-crop">
				<img src="/images/bme-logo.png" alt="BME Logo" class="logo" />
			</span>
			<span class="brand-name">e-Safety App</span>
		</a>

		{#if !isAuthPage && hasUser}
			<nav class="nav" aria-label="Primary">
				{#each navItems as item (item.href)}
					{@const Icon = item.icon}
					<a
						href={item.href}
						class="nav-link"
						class:active={isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						<Icon size={18} />
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>

			<div class="user">
				<span class="avatar" aria-hidden="true">{initials}</span>
				<span class="user-text">
					<span class="user-label">Signed in as</span>
					<span class="user-name">{userName}</span>
				</span>
				<button type="button" onclick={signOut} class="signout" aria-label="Sign out">
					<LogOut size={18} />
					<span>Sign out</span>
				</button>
			</div>
		{/if}
	</div>
</header>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 50;
		background-color: rgba(255, 255, 255, 0.92);
		border-bottom: 1px solid var(--line-soft);
		box-shadow: var(--shadow-sm);
		-webkit-backdrop-filter: saturate(160%) blur(10px);
		backdrop-filter: saturate(160%) blur(10px);
	}

	.stripe {
		height: 4px;
		background: var(--brand)
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 24px;
		max-width: 1320px;
		min-height: var(--header-h);
		margin: 0 auto;
		padding: 0 20px;
	}

	/* ---- Brand ---- */

	.brand {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
		color: var(--ink);
		text-decoration: none;
	}

	.brand:hover {
		color: var(--ink);
		text-decoration: none;
	}

	.logo-crop {
		display: block;
		width: 86px;
		height: 56px;
		overflow: hidden;
		position: relative;
	}

	.logo {
		position: absolute;
		top: -8px;
		left: -3px;
		height: 74px;
		width: auto;
		max-width: none;
	}

	.brand-name {
		padding-left: 14px;
		border-left: 1px solid var(--line);
		font-size: 17px;
		font-weight: 600;
		letter-spacing: -0.015em;
		line-height: 1.1;
		white-space: nowrap;
	}

	/* ---- Navigation ---- */

	.nav {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
	}

	.nav-link {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 14px;
		border-radius: var(--r-md);
		color: var(--muted);
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.nav-link:hover {
		background-color: var(--mist);
		color: var(--ink);
		text-decoration: none;
	}

	.nav-link.active {
		background-color: var(--mist);
		color: var(--ink);
		font-weight: 600;
	}

	.nav-link.active::after {
		content: '';
		position: absolute;
		left: 14px;
		right: 14px;
		bottom: -12px;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background-color: var(--brand);
	}

	/* ---- User ---- */

	.user {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-left: 8px;
		padding-left: 20px;
		border-left: 1px solid var(--line-soft);
	}

	.avatar {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background-color: var(--ink);
		color: #ffffff;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.user-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.2;
	}

	.user-label {
		color: var(--muted);
		font-size: 11px;
	}

	.user-name {
		max-width: 150px;
		overflow: hidden;
		color: var(--ink);
		font-size: 14px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.signout {
		padding: 8px 12px;
		border: 1px solid var(--line);
		background-color: var(--surface);
		color: var(--ink);
		font-size: 13px;
	}

	.signout:hover {
		border-color: var(--ink);
		background-color: var(--mist);
	}

	/* ---- Tablet: drop the "signed in as" label, shorten spacing ---- */

	@media (max-width: 1100px) {
		.bar {
			gap: 12px;
		}

		.nav-link {
			padding: 9px 11px;
		}

		.user-label {
			display: none;
		}
	}

	/* ---- Mobile: brand + account on top, navigation scrolls beneath ---- */

	@media (max-width: 860px) {
		.bar {
			display: grid;
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'brand user'
				'nav nav';
			gap: 0 12px;
			min-height: 0;
			padding: 6px 12px 0;
		}

		.brand {
			grid-area: brand;
			gap: 10px;
		}

		.logo-crop {
			width: 62px;
			height: 44px;
		}

		.logo {
			top: -5px;
			left: -2px;
			height: 56px;
		}

		.brand-name {
			padding-left: 10px;
			font-size: 15px;
		}

		.user {
			grid-area: user;
			margin: 0;
			padding: 0;
			border-left: none;
			gap: 8px;
		}

		.user-text {
			display: none;
		}

		.signout span {
			display: none;
		}

		.signout {
			padding: 8px;
		}

		.nav {
			grid-area: nav;
			margin: 4px -12px 0;
			padding: 0 12px;
			overflow-x: auto;
			scrollbar-width: none;
		}

		.nav::-webkit-scrollbar {
			display: none;
		}

		.nav-link {
			flex: 1 0 auto;
			justify-content: center;
			gap: 6px;
			padding: 10px 8px;
			border-radius: var(--r-md) var(--r-md) 0 0;
			background-color: transparent;
			font-size: 13px;
		}

		.nav-link.active {
			background-color: transparent;
			color: var(--brand);
		}

		.nav-link.active::after {
			left: 8px;
			right: 8px;
			bottom: 0;
		}
	}

	/* ---- Small phones: icon over label so all four tabs fit ---- */

	@media (max-width: 480px) {
		.nav {
			overflow-x: visible;
		}

		.nav-link {
			flex: 1 1 0;
			flex-direction: column;
			gap: 2px;
			padding: 8px 2px 10px;
			font-size: 11px;
		}

		.nav-link.active::after {
			left: 14px;
			right: 14px;
		}
	}
</style>