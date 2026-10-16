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
	let phone = '';
	let departments = [];
	let position = '';
	let region = '';
	let error = '';
	let emailError = '';
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

		if (departments.length === 0) {
			error = 'Please select at least one department';
			return;
		}

		submitting = true;
		const { error: signUpError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					first_name,
					last_name,
					nickname,
					employee_no,
					phone,
					department: departments,
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

		toast.success('Account created successfully. Please check your e-mail to confirm your account.');

		goto('/confirmation');
	}
</script>

<div class="box">
	<div class="form">
		<form on:submit|preventDefault={signUp}>
			<img src="/images/bme-logo.png" alt="BME Logo" class="logo" />
			<h1 class="title">Sign Up</h1>
			<p><label for="first_name">First Name</label></p>
			<p>
				<input
					name="first_name"
					type="text"
					bind:value={first_name}
					placeholder="John"
					class="input-box"
					required
				/>
			</p>
			<p><label for="last_name">Last Name</label></p>
			<p>
				<input
					name="last_name"
					type="text"
					bind:value={last_name}
					placeholder="Smith"
					class="input-box"
					required
				/>
			</p>
			<p><label for="nickname">Nickname</label></p>
			<p>
				<input
					name="nickname"
					type="text"
					bind:value={nickname}
					placeholder="John"
					class="input-box"
					required
				/>
			</p>
			<p><label for="employee_no">Employee No.</label></p>
			<p>
				<input
					name="employee_no"
					type="text"
					bind:value={employee_no}
					placeholder="BM12345"
					class="input-box"
					required
				/>
			</p>
			<p><label for="email">E-mail</label></p>
			<p>
				<input
					name="email"
					type="email"
					bind:value={email}
					placeholder="johnsmith@email.com"
					class="input-box"
					required
					on:input={(e) => validateEmail(e.target.value)}
				/>
			</p>
			{#if emailError}
				<p class="input-error">{emailError}</p>
			{/if}
			<p><label for="password">Password</label></p>
			<p class="password-wrapper">
				<input
					name="password"
					type="password"
					bind:value={password}
					placeholder="********"
					class="input-box"
					required
					on:focus={() => (showPasswordRules = true)}
					on:blur={() => (showPasswordRules = false)}
				/>
			</p>
			{#if showPasswordRules}
				<ul class="password-rules">
					<li class:valid={hasUppercase}>Uppercase letter</li>
					<li class:valid={hasLowercase}>Lowercase letter</li>
					<li class:valid={hasNumber}>Number</li>
					<li class:valid={hasSpecial}>Special character (e.g. !?&lt;&gt;@#$%)</li>
					<li class:valid={hasMinLength}>8 characters or more</li>
				</ul>
			{/if}

			<p><label for="phone">Phone Number</label></p>
			<p>
				<input
					name="phone"
					type="text"
					bind:value={phone}
					placeholder="0123456789"
					class="input-box"
					required
				/>
			</p>
			<p><label for="departments">Department(s)</label></p>
			<div class="departments">
				<p>
					<label class="checkbox">
						<input type="checkbox" value="Project" bind:group={departments} />
						Project
					</label>
				</p>

				<p>
					<label class="checkbox">
						<input type="checkbox" value="OSH" bind:group={departments} />
						OSH
					</label>
				</p>
			</div>
			<p><label for="position">Position</label></p>
			<p>
				<input
					name="position"
					type="text"
					bind:value={position}
					placeholder="Technical Director"
					class="input-box"
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

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	.box {
		vertical-align: middle;
		display: grid;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		margin: 30px 0;
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
		padding: 10px 20px;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.checkbox {
		font-weight: 400;
	}

	.departments {
		margin-bottom: 5px;
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

	.logo {
		width: 35%;
		justify-self: center;
	}

	.input-box {
		width: 100%;
		max-width: 350px;
		margin-bottom: 10px;
	}

	.input-error {
		color: #d32f2f;
		font-size: 12px;
		margin-top: -6px;
		margin-bottom: 10px;
	}

	label {
		font-weight: bold;
	}

	.have-account {
		font-size: 14px;
		margin-top: 5px;
	}

	.password-wrapper {
		position: relative;
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
		margin-bottom: 20px;
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

	@media (min-width: 1024px) {
		.form {
			max-width: 520px;
		}
	}
</style>