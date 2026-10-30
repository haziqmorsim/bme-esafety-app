<script>
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import { supabase } from '$lib/supabase';
	import { menuSections } from '$lib/data/menu';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';

	let users = [];
	let errorMsg = '';
	let isSaving = false;

	let selectedDepartment = 'All';
	let selectedUser = '';
	let selectedMenuAccess = [];

	const getUserName = (user) => {
		return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
	};

	$: filteredUsers =
		selectedDepartment === 'All'
			? users
			: users.filter((u) =>
					Array.isArray(u.department)
						? u.department.includes(selectedDepartment)
						: u.department === selectedDepartment
				);

	$: if (selectedDepartment) {
		selectedUser = '';
	}

	const allMenuItems = menuSections.flatMap((section) =>
		(section.items ?? []).map((item) => ({
			sectionKey: section.key,
			sectionLabel: section.department,
			title: item.title,
			description: item.description,
			route: item.route,
			disabled: item.disabled ?? false
		}))
	);

	const syncSelectedMenuAccess = () => {
		const user = users.find((u) => u.id === selectedUser);
		selectedMenuAccess = user?.menu_access ? [...user.menu_access] : [];
	};

	const toggleMenuItem = (route) => {
		if (selectedMenuAccess.includes(route)) {
			selectedMenuAccess = selectedMenuAccess.filter((r) => r !== route);
		} else {
			selectedMenuAccess = [...selectedMenuAccess, route];
		}
	};

	const lockedRoutes = allMenuItems.filter((i) => i.disabled).map((i) => i.route);
	const keepLocked = () => selectedMenuAccess.filter((r) => lockedRoutes.includes(r));

	const selectAll = () => {
		if (!selectedUser) return;
		selectedMenuAccess = [
			...keepLocked(),
			...allMenuItems.filter((i) => !i.disabled).map((i) => i.route)
		];
	};

	const clearAll = () => {
		if (!selectedUser) return;
		selectedMenuAccess = keepLocked();
	};

	const sameAccess = (a, b) => a.length === b.length && a.every((r) => b.includes(r));

	const saveMenuAccess = async (successMessage) => {
		if (!selectedUser) return;

		isSaving = true;
		errorMsg = '';

		try {
			const { error: updateError } = await supabase
				.from('profiles')
				.update({ menu_access: selectedMenuAccess })
				.eq('id', selectedUser);

			if (updateError) {
				errorMsg = updateError.message;
				return;
			}

			const { data: updated, error: readError } = await supabase
				.from('profiles')
				.select('id, menu_access')
				.eq('id', selectedUser)
				.maybeSingle();

			if (readError) {
				errorMsg = readError.message;
				return;
			}

			if (!updated) {
				errorMsg =
					'Update succeeded but read-back returned no row (likely SELECT RLS blocked for this user).';
				return;
			}

			users = users.map((u) =>
				u.id === selectedUser ? { ...u, menu_access: updated.menu_access } : u
			);

			const user = users.find((u) => u.id === selectedUser);
			toast.success(
				typeof successMessage === 'string'
					? successMessage
					: `Changes saved for ${getUserName(user ?? {}) || 'the user'}.`
			);
		} catch (e) {
			errorMsg = e?.message ?? String(e);
		} finally {
			isSaving = false;
		}
	};

	const discardChanges = () => {
		if (!selectedUser || !hasChanges) return;
		const user = users.find((u) => u.id === selectedUser);
		syncSelectedMenuAccess();
		errorMsg = '';
		toast.info(`Changes discarded for ${getUserName(user ?? {}) || 'the user'}.`);
	};

	let showLeaveModal = false;
	let pendingUrl = null;
	let leaveConfirmed = false;

	beforeNavigate((navigation) => {
		if (leaveConfirmed || !hasChanges) return;

		navigation.cancel();

		if (navigation.willUnload || !navigation.to) return;

		pendingUrl = navigation.to.url;
		showLeaveModal = true;
	});

	const cancelLeave = () => {
		showLeaveModal = false;
		pendingUrl = null;
	};

	const confirmLeave = async () => {
		const url = pendingUrl;
		leaveConfirmed = true;
		showLeaveModal = false;
		pendingUrl = null;
		if (url) await goto(url);
		else leaveConfirmed = false;
	};

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;

		const { supabase, user } = auth;

		const { data, error } = await supabase
			.from('profiles')
			.select('id, first_name, last_name, email, department, menu_access, created_at')
			.order('first_name');

		if (error) {
			errorMsg = error.message;
			users = [];
			return;
		}

		users = data ?? [];
		syncSelectedMenuAccess();
	});

	$: if (selectedUser) syncSelectedMenuAccess();
	else selectedMenuAccess = [];

	$: savedAccess = users.find((u) => u.id === selectedUser)?.menu_access ?? [];
	$: hasChanges = !!selectedUser && !sameAccess(selectedMenuAccess, savedAccess);

	$: allSelected = allMenuItems
		.filter((i) => !i.disabled)
		.every((i) => selectedMenuAccess.includes(i.route));
	$: noneSelected = allMenuItems
		.filter((i) => !i.disabled)
		.every((i) => !selectedMenuAccess.includes(i.route));
</script>

<svelte:head>
	<title>User Access Management | BME e-Safety App</title>
</svelte:head>

<h1 class="title">User Access Management</h1>

<div class="filter-bar">
	<div>
		<p>Department</p>
		<select bind:value={selectedDepartment} class="department-select">
			<option value="All">All Departments</option>
			<option value="Admin">Admin</option>
			<option value="Project">Project</option>
			<option value="OSH">OSH</option>
		</select>
	</div>
	<div>
		<p>User</p>
		<select bind:value={selectedUser} class="user-select">
			<option value="" disabled selected>Select User</option>
			{#each filteredUsers as item}
				<option value={item.id}>{getUserName(item)}</option>
			{/each}
		</select>
	</div>
</div>

<div class="access-tools">
	<button
		type="button"
		class="button-inverted tool-button"
		on:click={selectAll}
		disabled={!selectedUser || isSaving || allSelected}
	>
		Select All
	</button>
	<button
		type="button"
		class="button-inverted tool-button"
		on:click={clearAll}
		disabled={!selectedUser || isSaving || noneSelected}
	>
		Clear All
	</button>
</div>

<div class="access-grid">
	{#each allMenuItems as item (item.route)}
		<div class="menu-card">
			<div class="menu-access">
				<div class="menu-info">
					<p><b>Department:</b> {item.sectionLabel}</p>
					<p><b>Page Name:</b> {item.title}</p>
					<p><b>Description:</b> {item.description}</p>
				</div>

				<div class="access-check">
					<label class="circle-checkbox">
						<input
							type="checkbox"
							checked={selectedMenuAccess.includes(item.route)}
							on:change={() => toggleMenuItem(item.route)}
							disabled={!selectedUser || isSaving || item.disabled}
						/>
						<span class="checkmark" aria-hidden="true"></span>
					</label>
				</div>
			</div>
		</div>
	{/each}
</div>

<div class="button-modify">
	<button class="button-inverted" on:click={discardChanges} disabled={!hasChanges || isSaving}>
		Discard Changes
	</button>
	<button
		class="button-assign"
		on:click={() => saveMenuAccess()}
		disabled={!hasChanges || isSaving}
	>
		{isSaving ? 'Saving...' : 'Save Changes'}
	</button>
</div>

{#if errorMsg}
	<p class="error">{errorMsg}</p>
{/if}

<Modal open={showLeaveModal} title="Unsaved Changes" size="sm" onclose={cancelLeave}>
	<p>Are you sure you want to leave this page? Your changes will not be saved.</p>

	{#snippet footer()}
		<button type="button" class="button-inverted" on:click={cancelLeave}>Cancel</button>
		<button type="button" class="button-primary button-confirm" on:click={confirmLeave}>
			Confirm
		</button>
	{/snippet}
</Modal>

<style>
	.access-check {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
	}

	.access-tools {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin: 10px 10px 0;
	}

	.tool-button {
		min-height: 36px;
		padding: 0 16px;
		font-size: 14px;
	}

	.tool-button:disabled {
		cursor: default;
	}

	.button-confirm {
		margin: 0;
	}

	.access-grid {
		margin: 10px;
		padding: 10px 0;
	}

	.button-assign {
		width: 150px;
		height: 40px;
	}

	.button-modify .button-inverted {
		width: 150px;
		height: 40px;
	}

	.button-modify {
		display: flex;
		padding: 10px 0 20px 10px;
		gap: 15px;
	}

	.circle-checkbox {
		display: inline-block;
		position: relative;
		width: 30px;
		height: 30px;
		cursor: pointer;
	}

	.circle-checkbox input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		margin: 0;
		padding: 0;
	}

	.circle-checkbox .checkmark {
		display: inline-block;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 2px solid var(--line-strong);
		background: var(--surface);
		box-sizing: border-box;
		position: relative;
	}

	.circle-checkbox .checkmark::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 18px;
		height: 18px;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><polyline points='20 6 9 17 4 12' stroke='%23ffffff' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
		background-repeat: no-repeat;
		background-position: center;
		background-size: 100% 100%;
		transform: translate(-50%, -50%) scale(0);
		transition:
			transform 140ms ease,
			opacity 120ms ease;
		opacity: 0;
		pointer-events: none;
	}
	.circle-checkbox input:checked + .checkmark {
		background: var(--fill);
	}

	.circle-checkbox input:checked + .checkmark::after {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
	}

	.circle-checkbox input:focus + .checkmark {
		outline: 3px solid var(--focus-soft);
	}

	.error {
		color: var(--danger);
		padding: 0 10px 10px;
	}

	.department-select {
		height: 40px;
		width: 150px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
	}

	.user-select {
		height: 40px;
		width: 350px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
		background-color: var(--surface);
		color: var(--ink);
	}

	.user-select option {
		background-color: var(--surface);
		color: var(--ink);
	}

	.menu-access {
		display: flex;
	}

	.menu-card {
		width: 100%;
		align-items: center;
		gap: 16px;
		background-color: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 15px 10px;
		margin: 10px 0;
		box-shadow: var(--shadow-sm);
	}

	.menu-info {
		flex-grow: 1;
	}

	.menu-info p {
		margin: 4px 0 0;
		font-size: 14px;
		color: var(--ink);
	}

	@media (min-width: 1025px) {
		.access-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px 20px;
		}

		.menu-card {
			margin: 0;
		}
	}

	@media (max-width: 1024px) {
		.access-grid {
			display: flex;
			flex-direction: column;
		}

		.department-select,
		.user-select {
			width: 100%;
		}

		.menu-access {
			align-items: flex-start;
			gap: 10px;
		}

		.menu-info {
			width: 100%;
		}

		.menu-info p {
			word-break: break-word;
			overflow-wrap: anywhere;
			white-space: normal;
		}

		.access-check {
			align-self: center;
		}

		.button-modify {
			width: 100%;
			padding: 10px;
			gap: 10px;
		}

		.button-assign,
		.button-modify .button-inverted {
			width: 100%;
		}
	}

	@media (max-width: 600px) {
		.department-select,
		.user-select {
			width: 100%;
			box-sizing: border-box;
		}

		.menu-card {
			padding: 12px;
		}

		.menu-info p {
			font-size: 13px;
		}

		.circle-checkbox {
			width: 26px;
			height: 26px;
		}

		.circle-checkbox .checkmark {
			width: 26px;
			height: 26px;
		}

		.circle-checkbox .checkmark::after {
			width: 14px;
			height: 14px;
		}

		.button-modify {
			margin-bottom: 20px;
		}
	}
</style>