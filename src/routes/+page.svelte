<script>
	import { requireUser } from '$lib/auth-guard';
	import Spinner from '$lib/components/Spinner.svelte';
	import { goto } from '$app/navigation';
	import { menuSections } from '$lib/data/menu';
	import { onDestroy, onMount } from 'svelte';
	import { authUser } from '$lib/auth-store';
	import Search from '@lucide/svelte/icons/search';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';

	let allowedMenuAccess = [];
	let visibleSections = [];
	let errorMsg = '';
	let authUnsub = null;

	function computeVisible() {
		const allowedRoutes = new Set(allowedMenuAccess ?? []);

		visibleSections = menuSections
			.map((section) => {
				const items = (section.items ?? []).filter((item) => {
					return allowedRoutes.has(item.route);
				});
				return { ...section, items, groups: buildGroups(section, items) };
			})
			.filter((section) => section.items.length > 0);
	}

	function buildGroups(section, items) {
		const categories = section.categories ?? [];
		if (categories.length === 0) {
			return [{ key: 'all', label: null, items }];
		}

		const known = new Set(categories.map((c) => c.key));
		const groups = categories
			.map((c) => ({
				key: c.key,
				label: c.label,
				items: items.filter((item) => item.category === c.key)
			}))
			.filter((group) => group.items.length > 0);

		const uncategorised = items.filter((item) => !known.has(item.category));
		if (uncategorised.length > 0) {
			groups.push({ key: 'other', label: null, items: uncategorised });
		}

		return groups;
	}

	let query = '';

	$: shownSections = filterSections(visibleSections, query);
	$: totalShown = shownSections.reduce((sum, section) => sum + section.items.length, 0);

	function filterSections(sections, text) {
		const q = text.trim().toLowerCase();
		if (!q) return sections;

		return sections
			.map((section) => {
				const items = section.items.filter((item) =>
					`${item.title} ${item.description} ${section.department}`.toLowerCase().includes(q)
				);
				return { ...section, items, groups: buildGroups(section, items) };
			})
			.filter((section) => section.items.length > 0);
	}

	let loading = true;
	let loadedForUserId = null;
	let loadToken = 0;

	async function loadMenu() {
		const token = ++loadToken;
		errorMsg = '';

		const auth = await requireUser();
		if (!auth || token !== loadToken) return;

		const { supabase, user } = auth;

		const { data: profile, error } = await supabase
			.from('profiles')
			.select('menu_access')
			.eq('id', user.id)
			.single();

		if (token !== loadToken) return;
		loading = false;

		if (error) {
			errorMsg = error.message;
			return;
		}

		loadedForUserId = user.id;
		allowedMenuAccess = profile?.menu_access ?? [];
		computeVisible();
	}

	onMount(() => {
		loadMenu();

		authUnsub = authUser.subscribe((user) => {
			if (!user) {
				if (loadedForUserId) goto('/signin');
				return;
			}
			if (loadedForUserId && user.id !== loadedForUserId) loadMenu();
		});
	});

	onDestroy(() => {
		loadToken++;
		if (authUnsub) authUnsub();
	});
</script>

{#if errorMsg}
	<p class="error">{errorMsg}</p>
{/if}

<div class="page-head">
	<h1 class="title">Main Menu</h1>

	{#if !loading && visibleSections.length > 0}
		<label class="finder">
			<Search size={18} />
			<input
				type="search"
				placeholder="Find a form or record"
				aria-label="Find a form or record"
				bind:value={query}
			/>
			{#if query}
				<button type="button" class="finder-clear" aria-label="Clear search" on:click={() => (query = '')}>
					<X size={16} />
				</button>
			{/if}
		</label>
	{/if}
</div>

{#if loading}
	<Spinner inline size={140} label="Loading menu" />
{:else if !errorMsg && visibleSections.length === 0}
	<p class="status">No menu items have been assigned to your account yet. Ask an admin to grant access.</p>
{:else if query && totalShown === 0}
	<p class="status">Nothing matches “{query}”. Try a shorter or different word.</p>
{/if}

{#each shownSections as section (section.key)}
	<section class="dept">
		<div class="dept-head">
			<h2 class="department">{section.department}</h2>
			<!-- <span class="count">{section.items.length}</span> -->
		</div>

		{#each section.groups as group (group.key)}
			{#if group.label}
				<h3 class="category-title">{group.label}</h3>
			{/if}

			<div class="grid">
				{#each group.items as item (item.route)}
					<div class="menu-card" class:is-disabled={item.disabled}>
						<span class="icon-tile">
							<img src={item.icon} alt="" class="menu-icon" />
						</span>
						<div class="menu-info">
							<h4>{item.title}</h4>
							<p>{item.description}</p>
						</div>
						<button
							type="button"
							class="open"
							disabled={item.disabled}
							aria-label={`Open ${item.title}`}
							on:click={() => !item.disabled && goto(item.route)}
						>
							<span>Open</span>
							<ChevronRight size={16} />
						</button>
					</div>
				{/each}
			</div>
		{/each}
	</section>
{/each}

<style>
	.page-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 16px 24px;
		margin-bottom: 28px;
	}

	.page-head .title {
		margin-bottom: 0;
	}

	/* ---- Search ---- */

	.finder {
		position: relative;
		display: block;
		width: min(100%, 340px);
		margin: 4px 10px 0 0;
	}

	.finder :global(svg:first-child) {
		position: absolute;
		top: 50%;
		left: 13px;
		transform: translateY(-50%);
		color: var(--muted);
		pointer-events: none;
	}

	.finder input {
		width: 100%;
		height: 44px;
		padding: 0 40px 0 40px;
		border-radius: var(--r-lg);
		box-shadow: var(--shadow-sm);
	}

	.finder input::-webkit-search-cancel-button {
		display: none;
	}

	.finder-clear {
		position: absolute;
		top: 50%;
		right: 8px;
		width: 28px;
		height: 28px;
		padding: 0;
		transform: translateY(-50%);
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--muted);
	}

	.finder-clear:hover {
		background: var(--mist);
		color: var(--ink);
	}

	/* ---- Departments & groups ---- */

	.dept {
		margin: 0 10px 36px;
	}

	.dept-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.dept-head::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}

	.department {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	/* .count {
		min-width: 24px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--fill);
		color: #ffffff;
		font-size: 12px;
		font-weight: 600;
		text-align: center;
	} */

	.category-title {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 22px 0 12px;
		color: var(--link);
		font-size: 15px;
		font-weight: 600;
	}

	.category-title::before {
		content: '';
		width: 18px;
		height: 8px;
		border-radius: 2px;
		background: var(--stripes);
	}

	/* ---- Cards ---- */

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.menu-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
		padding: 16px 18px;
		border: 1px solid var(--line-soft);
		border-radius: var(--r-lg);
		background-color: var(--surface);
		box-shadow: var(--shadow-sm);
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.menu-card:not(.is-disabled):hover {
		border-color: var(--brand);
		box-shadow: var(--shadow-md);
	}

	.menu-card.is-disabled {
		background-color: var(--mist);
		box-shadow: none;
	}

	.menu-card.is-disabled .menu-info,
	.menu-card.is-disabled .icon-tile {
		opacity: 0.55;
	}

	.icon-tile {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 52px;
		height: 52px;
		border: 1px solid var(--line-soft);
		border-radius: var(--r-lg);
		background: #ffffff;
	}

	.menu-icon {
		width: 34px;
		height: 34px;
		object-fit: contain;
	}

	.menu-info {
		flex: 1 1 auto;
		min-width: 0;
	}

	.menu-info h4 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.3;
	}

	.menu-info p {
		margin: 3px 0 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.45;
	}

	.open {
		flex: 0 0 auto;
		gap: 4px;
		padding: 8px 10px 8px 14px;
		background-color: var(--mist);
		color: var(--ink);
		cursor: pointer;
	}

	.open:hover:not(:disabled) {
		background-color: var(--fill);
		color: #ffffff;
	}

	.open[disabled] {
		background-color: transparent;
		color: var(--muted);
		cursor: not-allowed;
	}

	.status {
		margin: 0 10px;
		padding: 18px 20px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-lg);
		color: var(--muted);
	}

	.error {
		margin: 0 10px 16px;
		padding: 12px 16px;
		border-left: 4px solid var(--danger);
		border-radius: var(--r-md);
		background: var(--danger-bg);
		color: var(--danger);
		font-weight: 600;
	}

	@media (max-width: 1024px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 600px) {
		.dept,
		.status,
		.error {
			margin-left: 4px;
			margin-right: 4px;
		}

		.finder {
			margin-right: 4px;
			width: 100%;
		}

		.menu-card {
			gap: 12px;
			padding: 12px;
		}

		.icon-tile {
			width: 44px;
			height: 44px;
		}

		.menu-icon {
			width: 28px;
			height: 28px;
		}

		.open span {
			display: none;
		}

		.open {
			padding: 8px;
		}
	}
</style>