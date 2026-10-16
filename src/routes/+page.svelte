<script>
	import { requireUser } from '$lib/auth-guard';
	import { goto } from '$app/navigation';
	import { menuSections } from '$lib/data/menu';
	import { onDestroy, onMount } from 'svelte';
	import { authUser } from '$lib/auth-store';

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

<h1 class="title">Main Menu</h1>

{#if loading}
	<p class="status">Loading menu...</p>
{:else if !errorMsg && visibleSections.length === 0}
	<p class="status">No menu items have been assigned to your account yet.</p>
{/if}

{#each visibleSections as section}
	<h2 class="department">Department: <span class="item">{section.department}</span></h2>

	{#each section.groups as group (group.key)}
		{#if group.label}
			<h3 class="category-title">{group.label}</h3>
		{/if}

		{#each group.items as item}
			<div class="menu-card">
				<img src={item.icon} alt="icon" class="menu-icon" />
				<div class="menu-info">
					<h4>{item.title}</h4>
					<p>{item.description}</p>
				</div>
				<button
					type="button"
					disabled={item.disabled}
					on:click={() => !item.disabled && goto(item.route)}
				>
					Open
				</button>
			</div>
		{/each}
	{/each}
{/each}

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
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

	button[disabled] {
		background-color: #cccccc;
		color: #666666;
		cursor: not-allowed;
		opacity: 0.6;
	}

	button:hover {
		background-color: #064c6da4;
	}

	.department {
		font-size: large;
		font-weight: bold;
		margin-top: 30px;
		padding: 0 10px;
	}

	h4 {
		font-weight: bold;
		font-size: 16px;
	}

	.category-title {
		margin: 24px 10px 0;
		padding: 0 0 6px 10px;
		font-size: 16px;
		font-weight: bold;
		color: #064c6dd7;
		border-left: 4px solid #064c6dd7;
	}

	.item {
		font-size: large;
		color: #064c6dd7;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.menu-card {
		display: flex;
		align-items: center;
		gap: 16px;
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 15px 20px;
		margin: 10px 10px 0;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.menu-icon {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
	}

	.menu-info {
		flex-grow: 1;
	}

	.menu-info h4 {
		margin: 0;
	}

	.menu-info p {
		margin: 4px 0 0;
		font-size: 14px;
		color: #091747;
	}

	.status {
		padding: 0 10px;
		color: #5b6480;
	}

	.error {
		margin: 10px;
		color: #c62828;
		font-weight: bold;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
		}

		.department,
		.item {
			font-size: 16px;
		}

		.menu-card {
			padding: 12px;
		}

		.menu-info h4 {
			font-size: 15px;
		}

		.menu-info p {
			font-size: 13px;
		}

		.menu-card button {
			height: 32px;
			padding: 0 12px;
			font-size: 13px;
		}

		.menu-card {
			display: flex;
			align-items: center;
			gap: 10px;
		}

		.menu-icon {
			width: 38px;
			height: 38px;
			flex: 0 0 auto;
		}

		.menu-info {
			flex: 1 1 auto;
			min-width: 0;
			padding-right: 8px;
		}

		.menu-card button {
			flex: 0 0 auto;
			white-space: nowrap;
			min-width: 72px;
		}
	}
</style>