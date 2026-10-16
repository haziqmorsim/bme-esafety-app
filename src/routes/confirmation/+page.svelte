<div class="page">
	<div class="user-card">
		<img src="/icons/confirm.png" alt="Confirm Icon" class="confirm-icon" />
		<h3>Your account was successfully registered.</h3>
		<p>Please check your e-mail to confirm your account.</p>
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
		justify-content: center;
		align-items: center;
		padding: 24px 16px;
		background-color: #f2f4f9;
	}

	.user-card {
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		text-align: center;
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 36px 24px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.confirm-icon {
		width: 56px;
		height: 56px;
	}

	h3 {
		font-size: 22px;
		font-weight: bold;
		line-height: 1.3;
	}

	.back {
		margin-top: 8px;
	}

	.back a {
		text-decoration: underline;
		font-weight: bold;
	}

	@media (max-width: 600px) {
		h3 {
			font-size: 18px;
		}

		.user-card {
			padding: 28px 18px;
		}
	}
</style>