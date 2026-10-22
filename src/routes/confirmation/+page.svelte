<script>
	import AuthShell from '$lib/components/AuthShell.svelte';
</script>

<svelte:head>
	<title>Account created | BME e-Safety App</title>
</svelte:head>

<AuthShell>
	<div class="done">
		<span class="done-icon">
			<img src="/icons/confirm.png" alt="" />
		</span>
		<h1 class="auth-title">Account created</h1>
		<p class="auth-sub">Check your e-mail and follow the link to confirm your account before signing in.</p>
		<p class="back"><a href="/signin">Back to sign in</a></p>
	</div>
</AuthShell>

<style>
	.done {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.done-icon {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		margin-bottom: 18px;
		border-radius: 50%;
		background: var(--success-bg);
	}

	.done-icon img {
		width: 40px;
		height: 40px;
		object-fit: contain;
	}

	.done :global(.auth-sub) {
		margin-bottom: 4px;
	}
</style>