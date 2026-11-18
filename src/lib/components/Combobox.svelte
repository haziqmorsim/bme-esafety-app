<script>
    import { tick } from "svelte";

    let {
        value = $bindable(''),
        options = [],
        id = undefined,
        placeholder = '',
        invalid = false,
        emptyText = 'No matching results',
        ...rest
    } = $props();

    const uid = `combobox-${Math.random().toString(36).slice(2, 9)}`;
    const listId = `${uid}-list`;

    let inputEl = $state('');
    let listEl = $state('');
    let open = $state(false);
    let active = $state(-1);
    let pos = $state({ top: 0, left: 0, width: 0, maxHeight: 240, above: false });

    const matches = $derived.by(() => {
        const q = String(value ?? '')
            .trim()
            .toLowerCase();
        if (!q) return options;
        const starts = [];
        const contains = [];
        for (const option of options) {
            const i = option.toLowerCase().indexOf(q);
            if (i === 0) starts.push(option);
            else if (i > 0) contains.push(option);
        }
        return [...starts, ...contains];
    });

    function portal(node) {
        document.body.appendChild(node);
        return { destroy: () => node.remove() };
    }

    function place() {
        if (!inputEl) return;
        const rect = inputEl.getBoundingClientRect();
        const gap = 2;
        const margin = 12;
        const below = window.innerHeight - rect.bottom - gap - margin;
        const above = rect.top - gap - margin;
        const flip = below < 120 && above > below;
        const space = flip ? above : below;
        pos = {
            top: rect.bottom + gap,
            bottom: window.innerHeight - rect.top + gap,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.max(96, Math.min(260, space)),
            above: flip
        };
    }

    async function openList() {
        if (open) return;
        open = true;
        active = -1;
        await tick();
        if (inputEl && window.innerHeight - inputEl.getBoundingClientRect().bottom < 220) {
            inputEl.scrollIntoView({ block: 'center' });
        }
        place();
    }

    function closeList() {
        open = false;
        active = -1;
    }

    function choose(option) {
        value = option;
        closeList();
    }

    function scrollActiveIntoView() {
        listEl?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }

    async function onKeyDown(event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) return openList();
            if (matches.length === 0) return;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            active = (active + step + matches.lenth) % matches.length;
            await tick();
            scrollActiveIntoView();
        } else if (event.key === 'Enter') {
            if (open && active >= 0 && matches[active]) {
                event.preventDefault();
                choose(matches[active]);
            }
        } else if (event.key === 'Escape') {
            if (open) {
                event.preventDefault();
                event.stopPropagation();
                closeList();
            }
        } else if (event.key === 'Tab') {
            closeList();
        }
    }

    function onInput() {
        if (!open) openList();
        else place;
        active = -1;
    }

    $effect(() => {
        if (!open) return;
        const update = () => place();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    });
</script>

<input 
    bind:this={inputEl}
    bind:value
    {id}
    {placeholder}
    type="text"
    class="combo-input"
    class:invalid
    autocomplete="off"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls={listId}
    aria-activedescendant={open && active >= 0 ? `${uid}-opt-${active}` : undefined}
    onfocus={openList}
    onclick={openList}
    onblur={closeList}
    oninput={onInput}
    onkeydown={onKeyDown}
    {...rest}
/>

{#if open}
    <ul
        use:portal
        bind:this={listEl}
        id={listId}
        role="listbox"
        class="combo-list"
        style:left="{pos.left}px"
        style:width="{pos.width}px"
        style:max-height="{pos.maxHeight}px"
        style:top={pos.above ? 'auto' : `${pos.top}px`}
        style:bottom={pos.above ? `${pos.bottom}px` : 'auto'}
    >
        {#each matches as option, i (option)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
            <li
                id="{uid}-opt-{i}"
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                class="combo-option"
                onmousedown={(e) => e.preventDefault()}
                onclick={() => choose(option)}
                onmousemove={() => (active = i)}
            >
                {option}
            </li>
        {:else}
            <li class="combo-empty" role="presentation">{emptyText}</li>
        {/each}
    </ul>
{/if}

<style>
	.combo-input {
		width: 100%;
		min-width: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 8px 10px;
		font-size: 14px;
		font-weight: normal;
	}

	/* The list is moved to <body>, so its styles must be global. */
	:global(.combo-list) {
		position: fixed;
		z-index: 2000;
		margin: 0;
		padding: 4px;
		list-style: none;
		overflow-y: auto;
		box-sizing: border-box;
		background-color: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-lg);
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: normal;
	}

	:global(.combo-option) {
		padding: 10px 12px;
		border-radius: var(--r-sm);
		color: var(--ink);
		cursor: pointer;
		overflow-wrap: anywhere;
	}

	:global(.combo-option[data-active='true']) {
		background-color: var(--brand);
		color: #ffffff;
	}

	:global(.combo-empty) {
		padding: 10px 12px;
		color: var(--muted);
	}
</style>