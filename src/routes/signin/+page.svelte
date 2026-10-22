<script>
	import { supabase } from '$lib/supabase';
	import { authUser } from '$lib/auth-store';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast';
	import AuthShell from '$lib/components/AuthShell.svelte';

	let email = '';
	let password = '';
	let error = '';
	let showPassword = false;
	let signingIn = false;

	async function signIn() {
		if (signingIn) return;
		error = '';
		signingIn = true;

		try {
			await completeSignIn();
		} catch (err) {
			error = err?.message ?? String(err);
		} finally {
			signingIn = false;
		}
	}

	async function completeSignIn() {
		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			error = signInError.message;
			return;
		}

		const user =
			data?.user ??
			data?.session?.user ??
			(await new Promise((resolve) => {
				const unsub = authUser.subscribe((u) => {
					if (u) {
						unsub();
						resolve(u);
					}
				});

				setTimeout(() => {
					unsub();
					resolve(null);
				}, 8000);
			}));

		if (user) {
			const meta = user.user_metadata ?? {};

			const { data: profile, error: profileError } = await supabase
				.from('profiles')
				.select('id, email, first_name, last_name, nickname, phone, department, position, region')
				.eq('id', user.id)
				.single();

			if (profileError && !profile) {
				await supabase.from('profiles').insert({
					id: user.id,
					email: user.email,
					first_name: meta.first_name ?? null,
					last_name: meta.last_name ?? null,
					nickname: meta.nickname ?? null,
					phone: meta.phone ?? null,
					department: meta.department ?? null,
					position: meta.position ?? null,
					region: meta.region ?? null
				});
			} else if (profile) {
				const patch = {};
				const keys = [
					'first_name',
					'last_name',
					'nickname',
					'phone',
					'department',
					'position',
					'region'
				];
				for (const k of keys) {
					if ((profile[k] == null || profile[k] === '') && meta[k]) {
						patch[k] = meta[k];
					}
				}
				if ((profile.email == null || profile.email === '') && user.email) {
					patch.email = user.email;
				}
				if (Object.keys(patch).length) {
					await supabase.from('profiles').update(patch).eq('id', user.id);
				}
			}
		}

		toast.success('Signed in successfully.');
		goto('/');
	}
</script>

<svelte:head>
	<title>Sign in | BME e-Safety App</title>
</svelte:head>

<AuthShell>
			<form on:submit|preventDefault={signIn}>
				<h1 class="auth-title">Sign in</h1>
				<p class="auth-sub">Use the e-mail and password registered to your account.</p>
				<p><label for="email">E-mail</label></p>
				<p>
					<input
						id="email"
						name="email"
						type="email"
						bind:value={email}
						placeholder="name@company.com"
						class="input-box"
						autocomplete="email"
						required
					/>
				</p>
				<p><label for="password">Password</label></p>
				<div class="password-wrapper">
					<input
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						placeholder="********"
						class="input-box"
						autocomplete="current-password"
						required
					/>
					<button
						type="button"
						class="toggle-password"
						on:click={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						aria-pressed={showPassword}
						title={showPassword ? 'Hide password' : 'Show password'}
					>
						{#if showPassword}
							<!-- Eye-off icon: password is currently visible -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
								<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
								<path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
								<line x1="2" y1="2" x2="22" y2="22" />
							</svg>
						{:else}
							<!-- Eye icon: password is currently hidden -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{/if}
					</button>
				</div>
				<p class="forgotpw"><a href="/auth/forgotpw">Forgot password?</a></p>
				{#if error}
					<p class="error">{error}</p>
				{/if}
				<button type="submit" class="button-primary" disabled={signingIn}>
					{signingIn ? 'Signing in…' : 'Sign in'}
				</button>
				<!-- <p class="no-account">
					Don't have an account? Sign up <a href="/signup" class="signup">here</a>.
				</p> -->
			</form>
</AuthShell>