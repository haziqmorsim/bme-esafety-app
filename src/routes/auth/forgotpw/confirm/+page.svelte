<script>
	import AuthShell from '$lib/components/AuthShell.svelte';
</script>

<svelte:head>
	<title>Check your e-mail | BME e-Safety App</title>
</svelte:head>

<AuthShell>
	<div class="done">
		<span class="done-icon">
			<img src="/icons/confirm.png" alt="" />
		</span>
		<h1 class="auth-title">Check your e-mail</h1>
		<p class="auth-sub">We sent a link to reset your password. It can take a minute to arrive.</p>
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