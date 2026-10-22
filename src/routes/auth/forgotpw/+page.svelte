<script>
	import { getSupabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast';
	import AuthShell from '$lib/components/AuthShell.svelte';

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
	<title>Forgot password | BME e-Safety App</title>
</svelte:head>

<AuthShell>
	<h1 class="auth-title">Forgot your password?</h1>
	<p class="auth-sub">Enter your e-mail and we will send you a link to reset it.</p>
	<form on:submit={sendReset}>
		<div class="auth-field">
			<label for="email">E-mail</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				placeholder="name@company.com"
				autocomplete="email"
				required
			/>
		</div>
		{#if errorMsg}
			<p class="error">{errorMsg}</p>
		{/if}
		<button type="submit" class="button-primary" disabled={saving}>
			{saving ? 'Sending…' : 'Send reset link'}
		</button>
	</form>
	<p class="back"><a href="/signin">Back to sign in</a></p>
</AuthShell>