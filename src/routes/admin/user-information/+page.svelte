<script>
	/** @type {Array<{ items: Array<any>}>} */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import Close from '@lucide/svelte/icons/x';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';

	let users = [];
	let errorMsg = '';
	let isSaving = false;
	let showEditModal = false;
	let showDeleteModal = false;
	let selectedUser = null;
	let editForm = {
		first_name: '',
		last_name: '',
		nickname: '',
		email: '',
		phone: '',
		department: '',
		position: '',
		region: ''
	};

	let searchText = '';
	let selectedDepartment = 'All';

	$: filteredUsers = users.filter((u) => {
		const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
		const haystack = `${name} ${u.email ?? ''} ${u.department ?? ''}`.toLowerCase();

		const matchesSearch = haystack.includes(searchText.toLowerCase());
		const matchesDepartment =
			selectedDepartment === 'All' || (u.department ?? []).includes(selectedDepartment);

		return matchesSearch && matchesDepartment;
	});

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;

		const { supabase, user } = auth;

		const { data, error } = await supabase
			.from('profiles')
			.select(
				'id, first_name, last_name, nickname, email, phone, department, position, region, created_at'
			)
			.order('first_name');

		if (error) {
			errorMsg = error.message;
			users = [];
			return;
		}

		users = data ?? [];
	});

	const openEditModal = (user) => {
		selectedUser = user;
		editForm = {
			first_name: user.first_name ?? '',
			last_name: user.last_name ?? '',
			nickname: user.nickname ?? '',
			email: user.email ?? '',
			phone: user.phone ?? '',
			department: (user.department ?? []).join(', '),
			position: user.position ?? '',
			region: user.region ?? ''
		};
		showEditModal = true;
	};

	const closeEditModal = () => {
		showEditModal = false;
		selectedUser = null;
	};

	const openDeleteModal = (user) => {
		selectedUser = user;
		showDeleteModal = true;
	};

	const closeDeleteModal = () => {
		showDeleteModal = false;
		selectedUser = null;
	};

	const saveUser = async () => {
		if (!selectedUser) return;
		isSaving = true;
		errorMsg = '';
		const payload = {
			first_name: editForm.first_name.trim() || null,
			last_name: editForm.last_name.trim() || null,
			nickname: editForm.nickname.trim() || null,
			email: editForm.email.trim() || null,
			phone: editForm.phone.trim() || null,
			department: editForm.department
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean),
			position: editForm.position.trim() || null,
			region: editForm.region.trim() || null
		};

		const { data, error } = await supabase
			.from('profiles')
			.update(payload)
			.eq('id', selectedUser.id);

		isSaving = false;

		if (error) {
			errorMsg = error.message;
			return;
		}

		users = users.map((user) => (user.id === selectedUser.id ? { ...user, ...payload } : user));
		closeEditModal();
	};

	const deleteUser = async () => {
		if (!selectedUser) return;
		isSaving = true;
		errorMsg = '';

		const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);

		isSaving = false;

		if (error) {
			errorMsg = error.message;
			return;
		}

		users = users.filter((user) => user.id !== selectedUser.id);
		closeDeleteModal();
	};
</script>

<svelte:head>
	<title>User Information Management | BME e-Safety App</title>
</svelte:head>

<h1 class="title">User Information Management</h1>

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
		<input type="text" placeholder="Search here..." bind:value={searchText} class="filter-input" />
	</div>
	<div>
		<p class="hidden">Search</p>
		<button class="button-primary" id="button-search"><Search />Search User</button>
	</div>
</div>

{#if errorMsg}
	<p class="error">{errorMsg}</p>
{/if}

<div class="card-grid">
	{#each filteredUsers as u (u.id)}
		<div class="user-card">
			<div class="user-info">
				<h3>{`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—'}</h3>
				<p><b>E-mail:</b> {u.email}</p>
				<p><b>Phone:</b> {u.phone ?? '-'}</p>
				<p><b>Department:</b> {u.department?.join(', ') ?? '-'}</p>
				<p><b>Position:</b> {u.position ?? '-'}</p>
				<p><b>Region:</b> {u.region ?? '-'}</p>
			</div>
			<div class="button-modify">
				<button onclick={() => openEditModal(u)}>Edit</button>
				<button class="button-inverted" onclick={() => openDeleteModal(u)}>Delete</button>
			</div>
		</div>
	{/each}
</div>

{#if showEditModal}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Edit user information">
			<button class="modal-close" onclick={closeEditModal} disabled={isSaving}>
				<Close size={18} />
			</button>
			<h2>Edit User Information</h2>
			<div class="modal-body">
				<label>
					First Name:
					<input type="text" bind:value={editForm.first_name} />
				</label>
				<label>
					Last Name:
					<input type="text" bind:value={editForm.last_name} />
				</label>
				<label>
					Nickname:
					<input type="text" bind:value={editForm.nickname} />
				</label>
				<label>
					E-mail Address:
					<input type="email" bind:value={editForm.email} />
				</label>
				<label>
					Phone Number:
					<input type="text" bind:value={editForm.phone} />
				</label>
				<label>
					Department(s) (comma-separated):
					<input type="text" bind:value={editForm.department} />
				</label>
				<label>
					Position:
					<input type="text" bind:value={editForm.position} />
				</label>
				<label>
					Region:
					<input type="text" bind:value={editForm.region} />
				</label>
			</div>
			<div class="modal-actions">
				<button
					class="button-inverted"
					id="button-cancel"
					onclick={closeEditModal}
					disabled={isSaving}
				>
					Cancel
				</button>
				<button onclick={saveUser} disabled={isSaving}>
					{isSaving ? 'Saving...' : 'Confirm'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteModal}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Delete user">
			<button class="modal-close" onclick={closeDeleteModal} disabled={isSaving}>
				<Close size={18} />
			</button>
			<h2>Delete User</h2>
			<p>Are you sure you want to delete this user?</p>
			<div class="modal-actions">
				<button class="button-inverted" onclick={closeDeleteModal} disabled={isSaving}>
					Cancel
				</button>
				<button onclick={deleteUser} disabled={isSaving}>
					{isSaving ? 'Deleting...' : 'Confirm'}
				</button>
			</div>
		</div>
	</div>
{/if}

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

	button:hover {
		background-color: #064c6da4;
	}

	#button-cancel {
		margin-top: 0;
	}

	.button-inverted {
		background-color: #ffffff;
		color: #064c6dd7;
		font-size: small;
		margin-top: 5px;
		padding: 6px 14px;
		border: 2px solid #064c6dd7;
		border-radius: 4px;
		cursor: pointer;
	}

	.button-inverted:hover {
		background-color: #dedede;
	}

	#button-search {
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.button-modify {
		display: grid;
		width: 20%;
	}

	.button-primary {
		background-color: #091747;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.department-select {
		height: 40px;
		width: 150px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
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

	.filter-input {
		width: 350px;
		height: 40px;
		padding: 0 10px;
		font-size: 14px;
	}

	.hidden {
		opacity: 0;
	}

	h2,
	h3 {
		font-weight: bold;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.user-card {
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

	.user-info {
		width: 80%;
	}

	.user-info p {
		font-size: 14px;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(9, 23, 71, 0.45);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 32px 20px;
		z-index: 10;
	}

	.modal {
		position: relative;
		width: min(560px, 100%);
		max-height: calc(100vh - 64px);
		overflow: auto;
		background: #ffffff;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.modal-close {
		position: absolute;
		top: 20px;
		right: 12px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #091747;
	}

	.modal-close:hover {
		background: rgba(0, 0, 0, 0.05);
		border-radius: 50%;
	}

	.modal h2 {
		margin: 0 0 16px;
		font-size: 20px;
	}

	.modal-body {
		display: grid;
		gap: 12px;
	}

	.modal-body label {
		display: grid;
		gap: 6px;
		font-size: 13px;
		font-weight: bold;
	}

	.modal-body input {
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 14px;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 18px;
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

		.filter-input {
			width: 100%;
		}

		.department-select {
			width: 100%;
		}

		#button-search {
			width: 100%;
		}

		.card-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 15px;
		}

		.user-card {
			flex-direction: column;
			align-items: flex-start;
		}

		.user-info {
			width: 100%;
		}

		.user-info p,
		.user-info h3 {
			word-break: break-word;
			overflow-wrap: anywhere;
			white-space: normal;
		}

		.button-inverted {
			margin-top: 0;
		}

		.button-modify {
			width: 100%;
			display: flex;
			gap: 10px;
			margin-top: 10px;
		}

		.button-modify button {
			flex: 1;
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
		.filter-input {
			width: 100%;
			box-sizing: border-box;
		}

		#button-search {
			width: 100%;
			justify-content: center;
			margin-top: 6px;
		}

		.card-grid {
			grid-template-columns: 1fr;
		}

		.user-card {
			padding: 12px;
		}

		.modal {
			width: 100%;
			padding: 16px;
		}

		.modal-body {
			gap: 10px;
		}

		.modal-body label {
			font-size: 12px;
		}

		.modal-body input {
			font-size: 14px;
			width: 100%;
		}

		.modal-actions {
			flex-direction: column;
		}

		.modal-actions button {
			width: 100%;
		}

		p,
		h3,
		label {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}
	}
</style>
