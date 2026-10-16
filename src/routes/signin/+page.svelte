<script>
	import { supabase } from '$lib/supabase';
	import { authUser } from '$lib/auth-store';
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let error = '';
	let showPassword = false;

	async function signIn() {
		error = '';
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

		goto('/');
	}
</script>

<div class="background">
	<div class="box">
		<div class="form">
			<form on:submit|preventDefault={signIn}>
				<img src="/images/bme-logo.png" alt="BME Logo" class="logo" />
				<h1 class="title">BME e-Safety App</h1>
				<p class="sub">Sign In</p>				
				<p><label for="email">E-mail</label></p>
				<p>
					<input
						id="email"
						name="email"
						type="email"
						bind:value={email}
						placeholder="example@email.com"
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
				<button type="submit" class="button-primary">Sign In</button>
				<!-- <p class="no-account">
					Don't have an account? Sign up <a href="/signup" class="signup">here</a>.
				</p> -->
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

	.background {
		background-color: #09174723;
	}

	.box {
		display: grid;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-height: 100dvh;
		box-sizing: border-box;
		padding: 30px 15px;
	}

	.logo {
		width: 35%;
		justify-self: center;
	}

	button {
		background-color: #064c6dd7;
		color: #ffffff;
		border: none;
		font-size: small;
		padding: 6px 14px;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #064c6da4;
	}

	.button-primary {
		width: 100%;
		background-color: #091747;
		font-weight: bold;
		margin-top: 10px;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.error {
		font-size: 12px;
		color: #ff0000;
	}

	.forgotpw {
		font-size: 14px;
		text-align: right;
	}

	.forgotpw:hover {
		cursor: pointer;
		text-decoration: underline;
	}

	.form {
		background-color: #ffffff;
		border: 1px solid #091747b7;
		border-radius: 4px;
		padding: 30px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 420px;
	}

	.input-box {
		width: 100%;
		margin-bottom: 10px;
	}

	.password-wrapper {
		position: relative;
		margin-bottom: 10px;
	}

	.password-wrapper .input-box {
		margin-bottom: 0;
		padding-right: 44px;
	}

	.toggle-password {
		position: absolute;
		top: 50%;
		right: 6px;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		color: #091747;
		border-radius: 4px;
	}

	.toggle-password:hover {
		background: #09174714;
	}

	.toggle-password:focus-visible {
		outline: 2px solid #091747;
		outline-offset: 1px;
	}

	.toggle-password svg {
		color: currentColor;
		pointer-events: none;
	}

	label {
		font-weight: bold;
	}

	/* .no-account {
		font-size: 14px;
		margin-top: 5px;
	} */

	/* .signup {
		font-size: 14px;
		text-decoration: underline;
	} */

	.title {
		font-size: 35px;
		font-weight: bold;
		text-align: center;
		margin-bottom: 10px;
	}

	.sub {
		font-size: 20px;
		font-weight: bold;
		margin-bottom: 10px;
	}

	@media (max-width: 600px) {
		.box {
			padding-left: 15px;
			padding-right: 15px;
		}

		.form {
			width: 100%;
			max-width: 100%;
			margin: 0;
			padding: 20px;
		}

		.input-box {
			width: 100%;
		}
	}
</style>