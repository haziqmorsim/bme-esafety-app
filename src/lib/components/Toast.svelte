<script>
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';
	import { toasts, toast } from '$lib/stores/toast';

	const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
</script>

<div class="toast-region" aria-live="polite">
	{#each $toasts as item (item.id)}
		{@const Icon = ICONS[item.type] ?? Info}
		<div
			class="toast toast-{item.type}"
			class:leaving={item.leaving}
			role={item.type === 'error' ? 'alert' : 'status'}
		>
			<Icon size={22} />
			<p class="toast-message">{item.message}</p>
			<button
				type="button"
				class="toast-close"
				onclick={() => toast.dismiss(item.id)}
				aria-label="Dismiss notification"
			>
				<X size={16} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-region {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 10000;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 10px;
		pointer-events: none;
	}

	.toast {
		--toast-icon-color: var(--brand);
		--toast-accent: var(--brand);
		display: flex;
		align-items: center;
		gap: 10px;
		width: max-content;
		max-width: min(420px, calc(100vw - 40px));
		padding: 13px 14px 13px 16px;
		border: 1px solid var(--line-soft);
		border-left: 4px solid var(--toast-accent);
		border-radius: var(--r-lg);
		background-color: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow-lg);
		pointer-events: auto;
		font-family: var(--font-sans);
		animation: toast-in 200ms ease-out both;
	}

	.toast.leaving {
		pointer-events: none;
		animation: toast-out 200ms ease-in both;
	}

	.toast-success {
		--toast-icon-color: var(--success);
		--toast-accent: var(--success);
	}

	.toast-error {
		--toast-icon-color: var(--danger);
		--toast-accent: var(--danger);
	}

	.toast-info {
		--toast-icon-color: var(--link);
		--toast-accent: var(--link);
	}

	.toast :global(svg) {
		flex-shrink: 0;
	}

	.toast > :global(svg:first-child) {
		color: var(--toast-icon-color);
	}

	.toast-message {
		margin: 0;
		flex: 1;
		color: var(--ink);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.toast-close {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 5px;
		border: none;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.toast-close:hover {
		background: var(--mist);
		color: var(--ink);
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(-16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes toast-out {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(-16px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast,
		.toast.leaving {
			animation: none;
		}
	}

	@media (max-width: 600px) {
		.toast-region {
			top: 12px;
			left: 12px;
			right: 12px;
			align-items: stretch;
		}

		.toast {
			width: auto;
			max-width: none;
		}
	}
</style>