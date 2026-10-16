<script>
	import { getSupabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast';

	const supabase = getSupabase();

	let email = '';
	let errorMsg = '';
	let saving = false;

	async function sendReset(e) {
		e.preventDefault();
		errorMsg = '';
		saving = true;

		try {
			const cleanEmail = email.trim();
			if (!cleanEmail) {
				errorMsg = 'Please enter your e-mail';
				return;
			}

			const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
				redirectTo: `${window.location.origin}/auth/resetpw`
			});

			if (error) throw error;

			toast.success('Password reset link sent. Please check your e-mail.');
			goto('/auth/forgotpw/confirm');
		} catch (err) {
			errorMsg = err?.message ?? String(err);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password | BME e-Safety App</title>
</svelte:head>

<div class="page">
	<div class="card">
		<img src="/images/bme-logo.png" alt="BME Logo" class="logo" />
		<h1 class="title">Forgot Password</h1>
		<p class="sub">Enter your e-mail and we will send you a link to reset your password.</p>
		<form on:submit={sendReset}>
			<label>
				E-mail
				<input type="email" bind:value={email} placeholder="example@email.com" required />
			</label>
			{#if errorMsg}
				<p class="error">{errorMsg}</p>
			{/if}
			<button type="submit" disabled={saving}>
				{saving ? 'Sending...' : 'Send Reset Link'}
			</button>
		</form>
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