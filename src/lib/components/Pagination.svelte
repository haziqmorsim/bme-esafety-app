<script module>
    export function pageSlice(list, page, pageSize) {
        const size = Math.max(1, pageSize);
        const totalPages = Math.max(1, Math.ceil((list?.length ?? 0) / size));
        const current = Math.min(Math.max(1, page), totalPages);
        return (list ?? []).slice((current - 1) * size, current * size);
    }
</script>

<script>
    import ChevronLeft from "@lucide/svelte/icons/chevron-left";    
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    
    let {
        page = $bindable(1),
        totalItems = 0,
        pageSize = 10,
        itemLabel = '',
        showSummary = true,
        hideIfSinglePage = true,
        onchange = undefined
    } = $props();

    const totalPages = $derived(Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize))));
    const current = $derived(Math.min(Math.max(1, page), totalPages));
    const firstRow = $derived(totalItems === 0 ? 0 : (current - 1) * pageSize + 1);
    const lastRow = $derived(Math.min(current * pageSize, totalItems));

    $effect(() => {
        if (page !== current) page = current;
    });

    const items = $derived.by(() => {
        const list = [];
        let previous = 0;
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || Math.abs(p - current) <= 1) {
                if (previous && p - previous > 1) list.push({ gap: true, key: `gap-${p}` });
                list.push({ page: p, key: `p-${p}`});
                previous = p;
            }
        }
        return list;
    });

    function goTo(next) {
        const target = Math.min(Math.max(1, next), totalPages);
        if ( target === current) return;
        page = target;
        onchange?.(target);
    }
</script>

{#if !(hideIfSinglePage && totalPages <= 1)}
    <nav class="pagination" aria-label="Pagination">
        {#if showSummary}
            <p class="pagination-summary">
                Showing {firstRow}-{lastRow} of {totalItems}{itemLabel ? ` ${itemLabel}` : ''}
            </p>
        {/if}

        <div class="pagination-buttons">
            <button type="button" class="page-button" onclick={() => goTo(current - 1)} disabled={current === 1} aria-label="Previous page"><ChevronLeft size={18} /></button>
            {#each items as item (item.key)}
                {#if item.gap}
                    <span class="page-gap" aria-hidden="true">…</span>
                {:else}
                    <button type="button" class="page-button" class:active={item.page === current} onclick={() => goTo(item.page)} aria-label={`Page ${item.page}`} aria-current={item.page === current ? 'page' : undefined}>
                        {item.page}
                    </button>
                {/if}
            {/each}

            <button type="button" class="page-button" onclick={() => goTo(current + 1)} disabled={current === totalPages} aria-label="Next page"><ChevronRight size={18} /></button>
        </div>
    </nav>
{/if}

<style>
	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px 16px;
		margin-top: 14px;
		font-family: Arial, Helvetica, sans-serif;
	}
 
	.pagination-summary {
		margin: 0;
		font-size: 13px;
		color: #5b6480;
	}
 
	.pagination-buttons {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}
 
	.page-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 34px;
		height: 34px;
		padding: 0 8px;
		border: 1px solid #283a5a33;
		border-radius: 4px;
		background: #ffffff;
		color: #091747;
		font-size: 14px;
		cursor: pointer;
	}
 
	.page-button:hover:not(:disabled):not(.active) {
		background: #eef1f8;
	}
 
	.page-button.active {
		background: #091747;
		border-color: #091747;
		color: #ffffff;
		font-weight: bold;
	}
 
	.page-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
 
	.page-gap {
		padding: 0 2px;
		color: #5b6480;
	}
 
	@media (max-width: 600px) {
		.pagination {
			flex-direction: column;
			align-items: center;
		}
 
		.pagination-buttons {
			margin-left: 0;
			flex-wrap: wrap;
			justify-content: center;
		}
 
		.page-button {
			min-width: 36px;
			height: 36px;
		}
	}
</style>