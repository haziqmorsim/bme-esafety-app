<script>
	import { getSupabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

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

<h1 class="title">Forgot Password</h1>

<div class="project-box">
	<div class="card">
		<div class="reset">
			<form on:submit={sendReset}>
				<label>
					Email
					<input type="email" bind:value={email} required />
				</label>
				{#if errorMsg}
					<p class="error">{errorMsg}</p>
				{/if}
				<button type="submit" disabled={saving}>
					{saving ? 'Sending...' : 'Send Reset Link'}
				</button>
			</form>
		</div>
	</div>
</div>

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
