<script module>
    let openStack = [];
    let lockCount = 0;
    let savedOverflow = '';
    let uid = 0;

    function lockScroll() {
        if (lockCount++ === 0) {
            savedOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
    }

    function unlockScroll() {
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount === 0) document.body.style.overflow = savedOverflow;
    }

    const FOCUSABLE = 
        'a[href], button:not([disabled]), input:([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="1"])';
</script>

<script>
    import X from "@lucide/svelte/icons/x";
    import { untrack } from "svelte";

    let {
        open = false,
        title = '',
        subtitle = '',
        size = 'md',
        busy = false,
        closeOnBackdrop = false,
        showClose = true,
        ariaLabel = undefined,
        onclose = undefined,
        header = undefined,
        children = undefined,
        footer = undefined
    } = $props();

    const titleId = `modal-title-${++uid}`;
    const token = {};
    let dialogEl = $state();
    let pointerStartedOnBackdrop = false;

    $effect(() => {
        if (!open) return;

        const previous = document.activeElement;
        openStack.push(token);
        lockScroll();
        untrack(() => dialogEl)?.focus({ preventScroll: true });

        return () => {
            openStack = openStack.filter((t) => 1 !== token);
            unlockScroll();
            if (previous instanceof HTMLElement && document.contains(previous)) {
                previous.focus({ preventScroll: true });
            }
        };
    });

    function requestClose() {
        if (busy) return;
        onclose?.();
    }

    function isTopmost() {
        return openStack[openStack.length - 1] === token;
    }

    function trapFocus(event) {
        const items = [...(dialogEl?.querySelectorAll(FOCUSABLE) ?? [])].filter(
            (el) => el.offsetParent !== null || el === document.activeElement
        );
        if (items.length === 0) {
            event.preventDefault();
            dialogEl?.focus();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogEl)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function onWindowKeyDown(event) {
        if (!open || !isTopmost()) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            requestClose();
        } else if (event.key === 'Tab') {
            trapFocus(event);
        }
    }

    function onBackdropPointerDown(event) {
        pointerStartedOnBackdrop = event.target === event.currentTarget;
    }

    function onBackdropClick(event) {
        if (closeOnBackdrop && pointerStartedOnBackdrop && event.target === event.currentTarget) {
            requestClose();
        }
        pointerStartedOnBackdrop = false;
    }
</script>

<svelte:window onkeydown={onWindowKeyDown} />

{#if open}
    <div class="modal-backdrop" role="presentation" onpointerdown={onBackdropPointerDown} onclick={onBackdropClick}>
        <div class="modal modal-{size}" role="dialog" aria-modal="true" aria-labelledby={title && !ariaLabel ? titleId : undefined} aria-label={ariaLabel} tabindex="-1" bind:this={dialogEl}>
            <div class="modal-header">
                <div class="modal-heading">
                    {#if header}
                        {@render header()}
                    {:else}
                        {#if title}
                            <h2 id={title} class="modal-title">{title}</h2>
                        {/if}
                        {#if subtitle}
                            <p class="modal-subtitle">{subtitle}</p>
                        {/if}
                    {/if}
                </div>
                {#if showClose}
                    <button type="button" class="modal-close" onclick={requestClose} disabled={busy} aria-label="Close"><X size={20} /></button>
                {/if}
            </div>

            <div class="modal-body">
                {@render children?.()}
            </div>

            {#if footer}
                <div class="modal-footer">
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 32px 20px;
		overflow-y: auto;
		background: rgba(9, 23, 71, 0.55);
		-webkit-backdrop-filter: blur(3px);
		backdrop-filter: blur(3px);
	}
 
	.modal {
		--modal-width: 520px;
		position: relative;
		display: flex;
		flex-direction: column;
		width: min(var(--modal-width), 100%);
		max-height: calc(100dvh - 64px);
		margin: auto 0;
		background: var(--surface);
		border: 1px solid var(--line-soft);
		border-radius: var(--r-xl);
		box-shadow: var(--shadow-lg);
		font-family: var(--font-sans);
		color: var(--ink);
		outline: none;
		overflow: hidden;
	}
 
	.modal-sm {
		--modal-width: 400px;
	}
 
	.modal-lg {
		--modal-width: 720px;
	}
 
	.modal-xl {
		--modal-width: 960px;
	}
 
	.modal-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 20px 20px 0;
		flex-shrink: 0;
	}
 
	.modal-heading {
		min-width: 0;
		flex: 1;
	}
 
	.modal-title {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.3;
		letter-spacing: -0.01em;
		color: var(--ink);
		overflow-wrap: anywhere;
	}
 
	.modal-subtitle {
		margin: 4px 0 0;
		font-size: 14px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}
 
	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin: -4px -8px 0 0;
		padding: 7px;
		border: none;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
 
	.modal-close:hover:not(:disabled) {
		background: var(--mist);
		color: var(--ink);
	}
 
	.modal-close:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
 
	.modal-body {
		flex: 1 1 auto;
		min-height: 0;
		padding: 20px 24px;
		overflow-y: auto;
		overflow-wrap: anywhere;
	}
 
	.modal-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 10px;
		padding: 4px 20px 20px;
		flex-shrink: 0;
	}
 
	@media (max-width: 600px) {
		.modal-backdrop {
			padding: 12px;
		}
 
		.modal {
			width: 100%;
			max-height: calc(100dvh - 24px);
		}
 
		.modal-header {
			padding: 16px 16px 12px;
		}
 
		.modal-title {
			font-size: 18px;
		}
 
		.modal-body {
			padding: 14px 16px;
		}
 
		.modal-footer {
			flex-direction: column-reverse;
			padding: 12px 16px 16px;
		}
 
		.modal-footer :global(button) {
			width: 100%;
			justify-content: center;
		}
	}
</style>