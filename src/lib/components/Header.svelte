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

	const isAuthPage = $derived.by(() => {
		const path = $page.url.pathname;
		return (
			path === '/signin' ||
			path === '/signup' ||
			path === '/auth/forgotpw' ||
			path === '/auth/resetpw' ||
			path === '/confirmation'
		);
	});

	let hasUser = $state(false);
	let userName = $state('User');
	let unsubUser = null;

	async function syncUser(user) {
		if (!user) {
			hasUser = false;
			userName = 'User';
			return;
		}

		hasUser = true;

		const supabase = getSupabase();
		if (!supabase) return;

		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('nickname, first_name')
			.eq('id', user.id)
			.single();

		if (profileError) {
			userName = user.email ?? 'User';
			return;
		}

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
		await goto('/signin');
	}
</script>

<div class="container">
	<div class="logo-column">
		<a href="/"><img src="/images/bme-logo.png" alt="BME Logo" class="logo" /></a>
	</div>
	{#if !isAuthPage && hasUser}
		<div class="welcome">
			<p>Welcome, <span>{userName}</span>!</p>
			<div class="calendar-history">
				<a href="/" class="navigation"><House size={20} />Main Menu</a>
				<a href="/osh/notifications" class="navigation"><Bell size={20} />Notifications</a>
				<a href="/osh/calendar-view" class="navigation"><Calendar size={20} />Calendar</a>
				<a href="/osh/submission-history" class="navigation"><History size={20} />History</a>
				<button type="submit" onclick={signOut} class="button-primary">Sign Out</button>
			</div>
		</div>
	{/if}
</div>

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	a:hover {
		color: #091747b9;
	}

	button {
		background-color: #093d85;
		color: #ffffff;
		border: none;
		font-size: small;
		padding: 6px 14px;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #093d85a4;
	}

	.button-primary {
		background-color: #091747;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.calendar-history {
		display: flex;
		align-items: center;
		gap: 25px;
		font-size: 14px;
	}

	.container {
		display: flex;
		align-items: end;
		margin-bottom: 15px;
		padding: 0 10px;
	}

	.logo-column {
		width: 30%;
	}

	.logo {
		width: 40%;
	}

	.navigation {
		display: flex;
		vertical-align: middle;
		gap: 5px;
	}

	p {
		font-size: 18px;
	}

	span {
		font-size: 18px;
		font-weight: bold;
	}

	.welcome {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		position: absolute;
		right: 10px;
		gap: 20px;
	}

	@media (max-width: 600px) {
		.container {
			margin-top: 10px;
			display: flex;
			justify-content: space-between;
			gap: 10px;
		}

		.logo {
			width: 70%;
		}

		p {
			font-size: 14px;
		}

		span {
			font-size: 14px;
			font-weight: bold;
		}

		.welcome {
			margin-left: auto;
			position: static;
			display: flex;
			justify-content: flex-end;
			gap: 5px;
			flex-wrap: wrap;
		}

		.welcome a {
			display: inline-flex;
			align-items: center;
			gap: 0;
			font-size: 0;
			line-height: 0;
		}

		.welcome a {
			width: 18px;
			height: 18px;
		}

		.welcome .button-primary {
			height: 32px;
			padding: 0 12px;
			font-size: 13px;
			border-radius: 4px;
		}

		.calendar-history {
			gap: 15px;
		}
	}
</style>
