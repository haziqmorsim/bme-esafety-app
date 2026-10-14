<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { menuSections } from '$lib/data/menu';
	import Check from '@lucide/svelte/icons/check';
	import { requireUser } from '$lib/auth-guard';

	let users = [];
	let errorMsg = '';
	let isSaving = false;

	let selectedDepartment = 'All';
	let selectedUser = '';
	let selectedMenuAccess = [];

	let showSuccess = false;

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

	const saveMenuAccess = async () => {
		if (!selectedUser) return;

		isSaving = true;
		errorMsg = '';
		showSuccess = false;

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

			showSuccess = true;

			setTimeout(() => {
				showSuccess = false;
				goto('/');
			}, 3000);
		} catch (e) {
			errorMsg = e?.message ?? String(e);
		} finally {
			isSaving = false;
		}
	};

	const removeAllAccess = async () => {
		if (!selectedUser) return;
		selectedMenuAccess = [];
		await saveMenuAccess();
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
</script>

<svelte:head>
	<title>User Access Management | BME Automation App</title>
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
	<button class="button-inverted" on:click={removeAllAccess} disabled={!selectedUser || isSaving}>
		Remove All Access From This User
	</button>
	<button class="button-assign" on:click={saveMenuAccess} disabled={!selectedUser || isSaving}>
		{isSaving ? 'Saving...' : 'Assign Access To This User'}
	</button>
	{#if showSuccess}
		<div class="success-overlay">
			<div class="success-popup">
				<h3>Success! <Check strokeWidth={4} /></h3>
				<p>The user access was updated.</p>
			</div>
		</div>
	{/if}
</div>

{#if errorMsg}
	<p class="error">{errorMsg}</p>
{/if}

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	.access-check {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
	}

	.access-grid {
		margin: 10px;
		padding: 10px 0;
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

	button:hover {
		background-color: #064c6da4;
	}

	.button-assign {
		width: 250px;
		height: 40px;
	}

	.button-inverted {
		background-color: #ffffff;
		color: #064c6dd7;
		width: 250px;
		height: 40px;
		font-size: small;
		padding: 6px 14px;
		border: 2px solid #064c6dd7;
		border-radius: 4px;
		cursor: pointer;
	}

	.button-inverted:hover {
		background-color: #dedede;
	}

	.button-modify {
		display: flex;
		width: 40%;
		padding: 10px 0 10px 10px;
		justify-content: space-between;
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
		border: 2px solid #091747;
		background: #ffffff;
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
		background: #091747;
	}

	.circle-checkbox input:checked + .checkmark::after {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
	}

	.circle-checkbox input:focus + .checkmark {
		outline: 3px solid rgba(9, 23, 71, 0.12);
	}

	.error {
		color: #b00020;
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
		background-color: #ffffff;
		color: #091747;
	}

	.user-select option {
		background-color: #ffffff;
		color: #091747;
	}

	.filter-bar {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin: 10px;
		padding: 10px 0;
	}

	.filter-bar p {
		margin: 0 0 6px 0;
	}

	.menu-access {
		display: flex;
	}

	.menu-card {
		width: 100%;
		align-items: center;
		gap: 16px;
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 15px 10px;
		margin: 10px 0;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.menu-info {
		flex-grow: 1;
	}

	.menu-info p {
		margin: 4px 0 0;
		font-size: 14px;
		color: #091747;
	}

	.success-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.success-popup {
		height: 250px;
		background: #ffffff;
		padding: 25px 35px;
		border: 1px solid #091747;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		animation: fadeIn 0.3s ease;
	}

	.success-popup h3 {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: #2e7d32;
		font-size: 20px;
		font-weight: bold;
		margin-bottom: 15px;
	}

	.success-popup h3 :global(svg) {
		display: block;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.filter-bar {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
		}

		.access-grid {
			display: flex;
			flex-direction: column;
			gap: 10px;
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
		.button-inverted {
			width: 100%;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
		}

		.filter-bar {
			flex-direction: column;
			align-items: stretch;
			margin: 8px;
			padding: 8px 0;
			gap: 12px;
		}

		.filter-bar > div {
			width: 100%;
		}

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
			flex-direction: column;
		}

		button {
			width: 100%;
		}
	}
</style>
