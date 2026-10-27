<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { getSupabase } from '$lib/supabase';
	import { authUser, waitForAuthReady } from '$lib/auth-store';
	import { toast } from '$lib/stores/toast';

	const MIN_PASSWORD = 8;
	const supabase = getSupabase();

	let checking = $state(true);
	let password = $state('');
	let confirmPassword = $state('');
	let errorMsg = $state('');
	let saving = $state(false);

	onMount(async () => {
		const { user } = await waitForAuthReady(8000);
		if (!user) {
			await goto('/signin', { replaceState: true });
			return;
		}
		if (!user.app_metadata?.must_change_password) {
			await goto('/', { replaceState: true });
			return;
		}
		checking = false;
	});

	async function submit(e) {
		e.preventDefault();
		if (saving) return;
		errorMsg = '';

		if (password.length < MIN_PASSWORD) {
			errorMsg = `Password must be at least ${MIN_PASSWORD} characters.`;
			return;
		}
		if (password !== confirmPassword) {
			errorMsg = 'Passwords do not match.';
			return;
		}

		saving = true;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

			const res = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({ newPassword: password })
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(result?.message ?? `Could not change the password (${res.status}).`);

			const { data, error } = await supabase.auth.refreshSession();
			if (error || data?.user?.app_metadata?.must_change_password) {
				await supabase.auth.signOut();
				toast.success('Password changed. Please sign in with your new password.');
				await goto('/signin');
				return;
			}

			authUser.set(data.user);
			toast.success('Password changed successfully.');
			await goto('/');
		} catch (err) {
			errorMsg = err?.message ?? String(err);
		} finally {
			saving = false;
		}
	}

	async function signOut() {
		await supabase.auth.signOut();
		await goto('/signin');
	}
</script>

<svelte:head>
	<title>Change Password | BME e-Safety App</title>
</svelte:head>

<AuthShell>
	<h1 class="auth-title">Change your password</h1>
	{#if checking}
		<p class="auth-sub">Checking your account…</p>
	{:else}
		<p class="auth-sub">
			You signed in with a temporary password. Choose a new password with at least {MIN_PASSWORD}
			characters to continue.
		</p>
		<form onsubmit={submit}>
			<div class="auth-field">
				<label for="new-password">New Password</label>
				<PasswordInput
					id="new-password"
					bind:value={password}
					minlength={MIN_PASSWORD}
					maxlength={72}
					what="new password"
				/>
			</div>
			<div class="auth-field">
				<label for="confirm-password">Confirm new password</label>
				<PasswordInput
					id="confirm-password"
					bind:value={confirmPassword}
					minlength={MIN_PASSWORD}
					maxlength={72}
					what="confirm password"
				/>
			</div>
			{#if errorMsg}
				<p class="error" role="alert">{errorMsg}</p>
			{/if}
			<button type="submit" class="button-primary" disabled={saving}>
				{saving ? 'Saving…' : 'Change password'}
			</button>
		</form>
		<p class="back"><button type="button" class="link" onclick={signOut}>Sign out</button></p>
	{/if}
</AuthShell>

<style>
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.link:hover {
		color: var(--link-hover);
		text-decoration: underline;
	}
</style>