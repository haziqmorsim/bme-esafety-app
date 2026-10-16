<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSupabase } from '$lib/supabase';
	import { use } from 'bcrypt/promises';
	import { authUser } from '$lib/auth-store';

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

<h1 class="title">Reset Password</h1>

{#if !canReset}
	<p>This reset link is invalid or expired. Please request a new password reset.</p>
{:else}
	<div class="project-box">
		<div class="card">
			<div class="reset">
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
			</div>
		</div>
	</div>
{/if}

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	.card {
		align-items: center;
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 15px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.error {
		color: #b00020;
	}

	.project-box {
		margin: 10px;
		border-radius: 4px;
		font-size: 14px;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}
</style>
