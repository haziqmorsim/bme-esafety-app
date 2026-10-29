<script>
	/** @type {{ children: any, wide?: boolean }} */
	const { children, wide = false } = $props();
</script>

<div class="auth">
	<aside class="panel">
		<div class="panel-inner">
			<span class="logo-tile">
				<img src="/images/bme-logo.png" alt="BME Logo" />
			</span>
			<div class="panel-copy">
				<h2>BME e-Safety App</h2>
				<p>Submit site safety forms, file claims and review records in one place.</p>
			</div>
		</div>
		<p class="panel-foot">© 2026 Boilermech Sdn Bhd</p>
	</aside>

	<div class="form-side">
		<div class="card" class:wide>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.auth {
		display: grid;
		grid-template-columns: minmax(320px, 5fr) 7fr;
		min-height: 100vh;
		min-height: 100dvh;
		background-color: var(--mist);
	}

	/* ---------- Brand panel ---------- */

	.panel {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 48px 44px 28px;
		overflow: hidden;
		background:
			repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.055) 0 16px, transparent 16px 46px),
			linear-gradient(160deg, var(--panel-from) 0%, var(--panel-to) 135%);
		color: #ffffff;
	}

	.panel::after {
		content: '';
		position: absolute;
		right: -90px;
		bottom: -90px;
		width: 340px;
		height: 340px;
		border-radius: 50%;
		background: repeating-linear-gradient(
			115deg,
			rgba(255, 255, 255, 0.14) 0 6px,
			transparent 6px 16px
		);
		-webkit-mask-image: radial-gradient(circle, #000 55%, transparent 72%);
		mask-image: radial-gradient(circle, #000 55%, transparent 72%);
		pointer-events: none;
	}

	.panel-inner {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 36px;
		max-width: 400px;
	}

	.logo-tile {
		display: grid;
		place-items: center;
		width: 112px;
		height: 96px;
		overflow: hidden;
		border-radius: var(--r-xl);
		background: #ffffff;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
	}

	.logo-tile img {
		width: 104px;
		max-width: none;
	}

	.panel-copy h2 {
		margin: 0 0 12px;
		color: #ffffff;
		font-size: 34px;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: -0.025em;
	}

	.panel-copy p {
		margin: 0;
		max-width: 32ch;
		color: rgba(255, 255, 255, 0.82);
		font-size: 16px;
		line-height: 1.55;
	}

	.panel-foot {
		position: relative;
		z-index: 1;
		margin: 0;
		color: rgba(255, 255, 255, 0.6);
		font-size: 12px;
	}

	/* ---------- Form side ---------- */

	.form-side {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px 24px;
	}

	.card {
		width: 100%;
		max-width: 440px;
		padding: 36px;
		border: 1px solid var(--line-soft);
		border-radius: var(--r-xl);
		background: var(--surface);
		box-shadow: var(--shadow-md);
	}

	.card.wide {
		max-width: 520px;
	}

	/* Shared typography for the pages that render inside the card */
	.card :global(.auth-title) {
		margin: 0 0 6px;
		font-size: 26px;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.02em;
	}

	.card :global(.auth-sub) {
		margin: 0 0 24px;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.5;
	}

	.card :global(label) {
		font-weight: 600;
	}

	.card :global(p:has(> label)) {
		margin: 16px 0 6px;
	}

	.card :global(.auth-field) {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 16px;
	}

	.card :global(.input-box),
	.card :global(.auth-field input) {
		width: 100%;
		height: 44px;
	}

	.card :global(.password-wrapper) {
		position: relative;
	}

	.card :global(.password-wrapper .input-box) {
		padding-right: 48px;
	}

	.card :global(.toggle-password) {
		position: absolute;
		top: 50%;
		right: 6px;
		width: 34px;
		height: 34px;
		padding: 0;
		transform: translateY(-50%);
		background: transparent;
		color: var(--muted);
	}

	.card :global(.toggle-password:hover) {
		background: var(--mist);
		color: var(--ink);
	}

	.card :global(.toggle-password svg) {
		width: 20px;
		height: 20px;
	}

	.card :global(.button-primary) {
		width: 100%;
		height: 46px;
		margin: 20px 0 0;
		font-size: 15px;
	}

	.card :global(.forgotpw) {
		margin: 8px 0 0;
		text-align: right;
		font-size: 13px;
	}

	.card :global(.forgotpw a),
	.card :global(.back a),
	.card :global(.have-account a) {
		font-weight: 600;
	}

	.card :global(.have-account),
	.card :global(.back) {
		margin: 22px 0 0;
		color: var(--muted);
		font-size: 14px;
		text-align: center;
	}

	.card :global(.error),
	.card :global(.input-error) {
		margin: 12px 0 0;
		padding: 10px 12px;
		border-left: 3px solid var(--danger);
		border-radius: var(--r-sm);
		background: var(--danger-bg);
		color: var(--danger);
		font-size: 13px;
		font-weight: 500;
	}

	.card :global(.input-mismatch) {
		border-color: var(--danger);
	}

	.card :global(.match-ok) {
		margin: 8px 0 0;
		color: var(--success);
		font-size: 13px;
		font-weight: 500;
	}

	.card :global(.password-rules) {
		margin: 10px 0 0;
		padding: 12px 14px;
		border-radius: var(--r-md);
		background: var(--mist);
		list-style: none;
		font-size: 13px;
	}

	.card :global(.password-rules li) {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 4px 0;
		color: var(--muted);
	}

	.card :global(.password-rules li::before) {
		content: '○';
		font-weight: 700;
	}

	.card :global(.password-rules li.valid) {
		color: var(--success);
	}

	.card :global(.password-rules li.valid::before) {
		content: '✔';
		color: var(--success);
	}

	/* ---------- Narrow screens: panel collapses into a slim banner ---------- */

	@media (max-width: 860px) {
		.auth {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 1fr;
		}

		.panel {
			padding: 20px 20px 22px;
		}

		.panel::after,
		.panel-foot {
			display: none;
		}

		.panel-inner {
			flex-direction: row;
			align-items: center;
			gap: 16px;
			max-width: none;
		}

		.logo-tile {
			width: 68px;
			height: 58px;
			border-radius: var(--r-lg);
		}

		.logo-tile img {
			width: 62px;
		}

		.panel-copy h2 {
			margin: 0;
			font-size: 20px;
		}

		.panel-copy p {
			display: none;
		}

		.form-side {
			align-items: flex-start;
			padding: 24px 16px 40px;
		}

		.card,
		.card.wide {
			max-width: 520px;
			padding: 26px 22px;
		}
	}
</style>