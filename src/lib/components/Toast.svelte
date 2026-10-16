<script>
    import CircleCheck from "@lucide/svelte/icons/circle-check";
    import CircleAlert from "@lucide/svelte/icons/circle-alert";
    import Info from "@lucide/svelte/icons/info";
    import X from "@lucide/svelte/icons/x";
    import { fly } from "svelte/transition";
    import { toasts, toast } from "$lib/stores/toast";

    const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

    const reduceMotion = 
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
</script>

<div class="toast-region" aria-live="polite">
    {#each $toasts as item (item.id)}
        {@const Icon = ICONS[item.type] ?? Info}
        <div class="toast toast-{item.type}" role={item.type === 'error' ? 'alert' : 'status'} transition:fly={{ y: 16, duration: reduceMotion ? 0 : 200 }}>
            <Icon size={20} />
            <p class="toast-message">{item.message}</p>
            <button type="button" class="toast-close" onclick={() => toast.dismiss(item.id)} aria-label="Dismiss notification"><X size={16} /></button>
        </div>
    {/each}
</div>

<style>
	.toast-region {
		position: fixed;
		right: 20px;
		bottom: 20px;
		z-index: 10000;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 10px;
		pointer-events: none;
	}
 
	.toast {
		display: flex;
		align-items: center;
		gap: 10px;
		width: max-content;
		max-width: min(420px, calc(100vw - 40px));
		padding: 12px 14px;
		border-radius: 6px;
		color: #ffffff;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		pointer-events: auto;
		font-family: Arial, Helvetica, sans-serif;
	}
 
	.toast-success {
		background-color: #0f8f2f;
	}
 
	.toast-error {
		background-color: #c62828;
	}
 
	.toast-info {
		background-color: #091747;
	}
 
	.toast-message {
		margin: 0;
		flex: 1;
		color: #ffffff;
		font-size: 14px;
		font-weight: bold;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}
 
	.toast-close {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 4px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: #ffffff;
		cursor: pointer;
	}
 
	.toast-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}
 
	@media (max-width: 600px) {
		.toast-region {
			left: 12px;
			right: 12px;
			bottom: 12px;
			align-items: stretch;
		}
 
		.toast {
			width: auto;
			max-width: none;
		}
	}
</style>