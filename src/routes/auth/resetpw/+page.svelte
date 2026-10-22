<script>
	import AuthShell from '$lib/components/AuthShell.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSupabase } from '$lib/supabase';
	import { authUser } from '$lib/auth-store';
	import { toast } from '$lib/stores/toast';

	const supabase = getSupabase();

	let password = '';
	let confirmPassword = '';
	let errorMsg = '';
	let saving = false;

	let canReset = false;

	/** @type {null | (() => void)} */
	let unsub = null;

	onMount(async () => {
		errorMsg = '';

		const { data } = supabase.auth.onAuthStateChange((event) => {
			if (event === 'PASSWORD_RECOVERY') {
				canReset = true;
			}
		});
		unsub = () => data.subscription.unsubscribe();

		const unsubUser = authUser.subscribe((user) => {
			if (user) {
				canReset = true;
			}
		});

		const oldUnsub = unsub;
		unsub = () => {
			oldUnsub?.();
			unsubUser?.();
		};
	});

	onDestroy(() => {
		if (unsub) unsub();
	});

	async function submitNewPassword(e) {
		e.preventDefault();
		errorMsg = '';

		const p = password.trim();
		const c = confirmPassword.trim();

		if (!p || !c) {
			errorMsg = 'Please enter and confirm your new password.';
			return;
		}
		if (p.length < 8) {
			errorMsg = 'Password must be at least 8 characters.';
			return;
		}
		if (p !== c) {
			errorMsg = 'Passwords do not match.';
			return;
		}

		saving = true;
		try {
			const { error } = await supabase.auth.updateUser({ password: p });
			if (error) throw error;

			await supabase.auth.signOut();

			toast.success('Password updated successfully. Please sign in with your new password.');
			goto('/signin');
		} catch (err) {
			errorMsg = err?.message ?? String(err);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Reset password | BME e-Safety App</title>
</svelte:head>

<AuthShell>
	<h1 class="auth-title">Reset your password</h1>
	{#if !canReset}
		<p class="auth-sub">This reset link is invalid or has expired. Request a new one to continue.</p>
		<a href="/auth/forgotpw" class="link-button">Request a new link</a>
	{:else}
		<p class="auth-sub">Choose a new password with at least 8 characters.</p>
		<form on:submit={submitNewPassword}>
			<div class="auth-field">
				<label for="new-password">New password</label>
				<input
					id="new-password"
					type="password"
					bind:value={password}
					minlength="8"
					autocomplete="new-password"
					required
				/>
			</div>
			<div class="auth-field">
				<label for="confirm-password">Confirm new password</label>
				<input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					minlength="8"
					autocomplete="new-password"
					required
				/>
			</div>
			{#if errorMsg}
				<p class="error">{errorMsg}</p>
			{/if}
			<button type="submit" class="button-primary" disabled={saving}>
				{saving ? 'Updating…' : 'Update password'}
			</button>
		</form>
	{/if}
	<p class="back"><a href="/signin">Back to sign in</a></p>
</AuthShell>

<style>
	.link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 46px;
		border-radius: var(--r-md);
		background: var(--ink);
		color: #ffffff;
		font-size: 15px;
		font-weight: 600;
		text-decoration: none;
	}

	.link-button:hover {
		background: var(--brand);
		color: #ffffff;
		text-decoration: none;
	}
</style>