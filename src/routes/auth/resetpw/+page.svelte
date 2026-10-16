<script>
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
	<title>Reset Password | BME e-Safety App</title>
</svelte:head>

<div class="page">
	<div class="card">
		<img src="/images/bme-logo.png" alt="BME Logo" class="logo" />
		<h1 class="title">Reset Password</h1>
		{#if !canReset}
			<p class="sub">This reset link is invalid or expired. Please request a new password reset.</p>
			<p class="back"><a href="/auth/forgotpw">Request a new link</a></p>
		{:else}
			<p class="sub">Choose a new password with at least 8 characters.</p>
			<form on:submit={submitNewPassword}>
				<label>
					New Password
					<input type="password" bind:value={password} minlength="8" required />
				</label>
				<label>
					Confirm New Password
					<input type="password" bind:value={confirmPassword} minlength="8" required />
				</label>
				{#if errorMsg}
					<p class="error">{errorMsg}</p>
				{/if}
				<button type="submit" disabled={saving}>
					{saving ? 'Updating...' : 'Update Password'}
				</button>
			</form>
		{/if}
		<p class="back"><a href="/signin">Back to Sign In</a></p>
	</div>
</div>

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	.page {
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
		background-color: #f2f4f9;
	}

	.card {
		width: 100%;
		max-width: 420px;
		background-color: #ffffff;
		border: 1px solid #091747b7;
		border-radius: 4px;
		padding: 30px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.logo {
		display: block;
		width: 35%;
		margin: 0 auto 12px;
	}

	.title {
		font-size: 26px;
		font-weight: bold;
		text-align: center;
		margin-bottom: 8px;
	}

	.sub {
		text-align: center;
		color: #5b6480;
		margin-bottom: 20px;
	}

	form {
		display: grid;
		gap: 14px;
	}

	label {
		display: grid;
		gap: 6px;
		font-weight: bold;
	}

	input {
		width: 100%;
		height: 40px;
		padding: 0 10px;
		border: 1px solid #b0b0b0;
		border-radius: 4px;
		font-weight: normal;
	}

	button {
		width: 100%;
		background-color: #091747;
		color: #ffffff;
		border: none;
		border-radius: 4px;
		font-weight: bold;
		padding: 11px 20px;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background-color: #091747b9;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #c62828;
		font-weight: bold;
		margin: 0;
	}

	.back {
		margin-top: 16px;
		text-align: center;
	}

	.back a {
		text-decoration: underline;
	}

	@media (max-width: 600px) {
		.page {
			align-items: flex-start;
			padding-top: 40px;
		}

		.card {
			padding: 20px;
		}

		.title {
			font-size: 22px;
		}
	}
</style>