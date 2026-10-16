<script>
	/** @type {Array<{ items: Array<any>}>} */
	import { onMount } from 'svelte';
	import Search from '@lucide/svelte/icons/search';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';
	import Modal from '$lib/components/Modal.svelte';

	let users = [];
	let errorMsg = '';
	let isSaving = false;
	let modalError = '';
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

	const fullName = (user) => `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.email || 'User';

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
		modalError = '';
		showEditModal = true;
	};

	const closeEditModal = () => {
		if (isSaving) return;
		showEditModal = false;
		selectedUser = null;
	};

	const openDeleteModal = (user) => {
		selectedUser = user;
		modalError = '';
		showDeleteModal = true;
	};

	const closeDeleteModal = () => {
		if (isSaving) return;
		showDeleteModal = false;
		selectedUser = null;
	};

	const saveUser = async () => {
		if (!selectedUser) return;
		isSaving = true;
		modalError = '';

		const id = selectedUser.id;
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

		try {
			const { data, error } = await supabase
				.from('profiles')
				.update(payload)
				.eq('id', id)
				.select('id');

			if (error) throw error;
			if (!data || data.length === 0) {
				throw new Error('The user was not updated. You may not have permission to edit this user.');
			}

			users = users.map((user) => (user.id === id ? { ...user, ...payload } : user));
			isSaving = false;
			closeEditModal();
			toast.success(`User "${fullName(payload)}" updated successfully.`);
		} catch (error) {
			modalError = error?.message ?? String(error);
		} finally {
			isSaving = false;
		}
	};

	const deleteUser = async () => {
		if (!selectedUser) return;
		isSaving = true;
		modalError = '';

		const id = selectedUser.id;
		const name = fullName(selectedUser);

		try {
			const { data, error } = await supabase
				.from('profiles')
				.delete()
				.eq('id', id)
				.select('id');

			if (error) throw error;
			if (!data || data.length === 0) {
				throw new Error('The user was not deleted. You may not have permission to delete this user.');
			}

			users = users.filter((user) => user.id !== id);
			isSaving = false;
			closeDeleteModal();
			toast.success(`User "${name}" deleted successfully.`);
		} catch (error) {
			modalError = error?.message ?? String(error);
		} finally {
			isSaving = false;
		}
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
		<input type="text" placeholder="Search by user..." bind:value={searchText} class="filter-input" />
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
				<button class="button-edit" onclick={() => openEditModal(u)}>
					<Pencil size={16} /><span>Edit</span>
				</button>
				<button class="button-delete" onclick={() => openDeleteModal(u)}>
					<Trash2 size={16} /><span>Delete</span>
				</button>
			</div>
		</div>
	{/each}
</div>

<Modal open={showEditModal} title="Edit User Information" busy={isSaving} onclose={closeEditModal}>
	<form id="user-form" class="edit-form" onsubmit={(e) => (e.preventDefault(), saveUser())}>
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
	</form>
	{#if modalError}
		<p class="error modal-error">{modalError}</p>
	{/if}

	{#snippet footer()}
		<button class="button-inverted" onclick={closeEditModal} disabled={isSaving}>Cancel</button>
		<button type="submit" form="user-form" class="button-confirm" disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Confirm'}
		</button>
	{/snippet}
</Modal>

<Modal open={showDeleteModal} title="Delete User" size="sm" busy={isSaving} onclose={closeDeleteModal}>
	<p>Are you sure you want to delete this user?</p>
	{#if selectedUser}
		<div class="delete-summary">
			<p><b>Name:</b> {fullName(selectedUser)}</p>
			<p><b>E-mail:</b> {selectedUser.email ?? '-'}</p>
			<p><b>Department:</b> {selectedUser.department?.join(', ') || '-'}</p>
		</div>
	{/if}
	<p class="hint">This action cannot be undone.</p>
	{#if modalError}
		<p class="error modal-error">{modalError}</p>
	{/if}

	{#snippet footer()}
		<button class="button-inverted" onclick={closeDeleteModal} disabled={isSaving}>Cancel</button>
		<button class="button-danger" onclick={deleteUser} disabled={isSaving}>
			{isSaving ? 'Deleting...' : 'Delete'}
		</button>
	{/snippet}
</Modal>

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

	button span {
		color: #ffffff;
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

	.button-modify {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 20%;
		min-width: 96px;
		align-self: flex-start;
	}

	.button-edit,
	.button-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		height: 34px;
	}

	.button-delete {
		background-color: #c62828;
	}

	.button-delete:hover:not(:disabled) {
		background-color: #c62828c7;
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

	.edit-form {
		display: grid;
		gap: 12px;
	}

	.edit-form label {
		display: grid;
		gap: 6px;
		font-size: 13px;
		font-weight: bold;
	}

	.edit-form input {
		width: 100%;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 14px;
	}

	.button-confirm,
	.button-danger {
		font-weight: bold;
		padding: 8px 20px;
	}

	.button-confirm {
		background-color: #091747;
	}

	.button-confirm:hover:not(:disabled) {
		background-color: #091747b9;
	}

	.button-danger {
		background-color: #c62828;
	}

	.button-danger:hover:not(:disabled) {
		background-color: #c62828c7;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #c62828;
		font-weight: bold;
		margin: 8px 10px;
	}

	.modal-error {
		margin: 12px 0 0;
	}

	.delete-summary {
		margin: 12px 0;
		padding: 10px 12px;
		background-color: #f2f4f9;
		border-radius: 4px;
	}

	.delete-summary p {
		margin: 2px 0;
	}

	.hint {
		font-size: 12px;
		color: #5b6480;
		margin: 8px 0 0;
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

		.card-grid {
			grid-template-columns: 1fr;
		}

		.user-card {
			padding: 12px;
		}

		.edit-form {
			gap: 10px;
		}

		.edit-form label {
			font-size: 12px;
		}

		.edit-form input {
			font-size: 14px;
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