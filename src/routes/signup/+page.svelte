<script>
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast';

	let first_name = '';
	let last_name = '';
	let nickname = '';
	let employee_no = '';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let phone = '';
	let position = '';
	let region = '';
	let error = '';
	let emailError = '';
	let showPassword = false;
	let showConfirmPassword = false;
	let showPasswordRules = false;
	let submitting = false;

	function validateEmail(value) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		if (!value) {
			emailError = '';
			return;
		}

		if (!emailRegex.test(value)) {
			emailError = 'Please enter a valid e-mail address';
		} else {
			emailError = '';
		}
	}

	$: hasUppercase = /[A-Z]/.test(password);
	$: hasLowercase = /[a-z]/.test(password);
	$: hasNumber = /[0-9]/.test(password);
	$: hasSpecial = /[^A-Za-z0-9]/.test(password);
	$: hasMinLength = password.length >= 8;

	$: isPasswordValid = hasUppercase && hasLowercase && hasNumber && hasSpecial && hasMinLength;
	$: passwordsMatch = password === confirmPassword;

	async function signUp() {
		error = '';

		if (emailError) {
			error = 'Please correct the e-mail format';
			return;
		}

		if (!isPasswordValid) {
			error = 'Password does not meet the requirements';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		submitting = true;
		const { data, error: signUpError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					first_name,
					last_name,
					nickname,
					employee_no,
					phone,
					department: [],
					position,
					region
				}
			}
		});

		submitting = false;

		if (signUpError) {
			error = signUpError.message;
			return;
		}

		if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
			error = 'This e-mail address is already registered. Please sign in instead.';
			return;
		}

		toast.success('Account created successfully. Please check your e-mail to confirm your account.');

		goto('/confirmation');
	}
</script>

<div class="background">
	<div class="box">
		<div class="form">
			<form on:submit|preventDefault={signUp}>
				<img src="/images/bme-logo.png" alt="BME Logo" class="logo" />
				<h1 class="title">BME e-Safety App</h1>
				<p class="sub">Sign Up</p>
				<p><label for="first_name">First Name</label></p>
				<p>
					<input
						id="first_name"
						name="first_name"
						type="text"
						bind:value={first_name}
						placeholder="Mohd Ali bin"
						class="input-box"
						required
					/>
				</p>
				<p><label for="last_name">Last Name</label></p>
				<p>
					<input
						id="last_name"
						name="last_name"
						type="text"
						bind:value={last_name}
						placeholder="Abu"
						class="input-box"
						required
					/>
				</p>
				<p><label for="nickname">Nickname</label></p>
				<p>
					<input
						id="nickname"
						name="nickname"
						type="text"
						bind:value={nickname}
						placeholder="Ali"
						class="input-box"
						required
					/>
				</p>
				<p><label for="employee_no">Employee No.</label></p>
				<p>
					<input
						id="employee_no"
						name="employee_no"
						type="text"
						bind:value={employee_no}
						placeholder="BM12345"
						class="input-box"
						required
					/>
				</p>
				<p><label for="position">Position</label></p>
				<p>
					<input
						id="position"
						name="position"
						type="text"
						bind:value={position}
						placeholder="Project Engineer"
						class="input-box"
						required
					/>
				</p>
				<p><label for="email">E-mail</label></p>
				<p>
					<input
						id="email"
						name="email"
						type="email"
						bind:value={email}
						placeholder="ali.abu@boilermech.com"
						class="input-box"
						autocomplete="email"
						required
						on:input={(e) => validateEmail(e.target.value)}
					/>
				</p>
				{#if emailError}
					<p class="input-error">{emailError}</p>
				{/if}
				<p><label for="password">Password</label></p>
				<div class="password-wrapper">
					<input
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						placeholder="********"
						class="input-box"
						autocomplete="new-password"
						required
						on:focus={() => (showPasswordRules = true)}
						on:blur={() => (showPasswordRules = false)}
					/>
					<button
						type="button"
						class="toggle-password"
						on:mousedown|preventDefault
						on:click={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						aria-pressed={showPassword}
						title={showPassword ? 'Hide password' : 'Show password'}
					>
						{#if showPassword}
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
				{#if showPasswordRules}
					<ul class="password-rules">
						<li class:valid={hasUppercase}>Uppercase letter</li>
						<li class:valid={hasLowercase}>Lowercase letter</li>
						<li class:valid={hasNumber}>Number</li>
						<li class:valid={hasSpecial}>Special character (e.g. !?&lt;&gt;@#$%)</li>
						<li class:valid={hasMinLength}>8 characters or more</li>
					</ul>
				{/if}

				<p><label for="confirm_password">Confirm Password</label></p>
				<div class="password-wrapper">
					<input
						id="confirm_password"
						name="confirm_password"
						type={showConfirmPassword ? 'text' : 'password'}
						bind:value={confirmPassword}
						placeholder="********"
						class="input-box"
						class:input-mismatch={confirmPassword && !passwordsMatch}
						autocomplete="new-password"
						required
					/>
					<button
						type="button"
						class="toggle-password"
						on:mousedown|preventDefault
						on:click={() => (showConfirmPassword = !showConfirmPassword)}
						aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
						aria-pressed={showConfirmPassword}
						title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
					>
						{#if showConfirmPassword}
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
				{#if confirmPassword}
					{#if passwordsMatch}
						<p class="match-ok">Passwords match</p>
					{:else}
						<p class="input-error">Passwords do not match</p>
					{/if}
				{/if}
				<p><label for="phone">Phone Number</label></p>
				<p>
					<input
						id="phone"
						name="phone"
						type="text"
						bind:value={phone}
						placeholder="0123456789"
						class="input-box"
						autocomplete="tel"
						required
					/>
				</p>
				<p><label for="region">Region</label></p>
				<p>
					<select name="region" id="region" bind:value={region} class="input-box select-box" required>
						<option value="" disabled>Choose a Region</option>
						<option value="Local">Local</option>
						<option value="Overseas">Overseas</option>
						<option value="Sabah">Sabah</option>
						<option value="Sarawak">Sarawak</option>
					</select>
				</p>
				{#if error}
					<p class="error">{error}</p>
				{/if}
				<button type="submit" class="button-primary" disabled={submitting}>
					{submitting ? 'Signing up...' : 'Sign Up'}
				</button>
				<p class="have-account">
					Already have an account? Sign in <a href="/signin" class="signup">here</a>.
				</p>
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
		background-color: #093d85;
		color: #ffffff;
		border: none;
		font-size: small;
		padding: 6px 14px;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #093d85a4;
	}

	.button-primary {
		width: 100%;
		background-color: #091747;
		font-weight: bold;
		margin-top: 10px;
		padding: 10px 20px;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.error {
		font-size: 12px;
		color: #ff0000;
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

	.input-error {
		color: #d32f2f;
		font-size: 12px;
		margin-top: -6px;
		margin-bottom: 10px;
	}

	.input-mismatch {
		border-color: #d32f2f;
	}

	.match-ok {
		color: #4caf50;
		font-size: 12px;
		margin-top: -6px;
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

	.have-account {
		font-size: 14px;
		text-align: right;
		margin-top: 10px;
	}

	.password-rules {
		list-style: none;
		padding-left: 0;
		margin-top: 2px;
		font-size: 14px;
	}

	.password-rules li {
		color: #8f8f8f;
		margin: 4px 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.password-rules li::before {
		content: '○';
		color: #777;
		font-weight: bold;
	}

	.password-rules li.valid {
		color: #4caf50;
	}

	.password-rules li.valid::before {
		content: '✔';
		color: #4caf50;
	}

	.select-box {
		cursor: pointer;
	}

	.signup {
		font-size: 14px;
		text-decoration: underline;
	}

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