<script>
	/** @type {Array<{ items: Array<any>}>} */
	import { onMount } from 'svelte';
	import Search from '@lucide/svelte/icons/search';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';
	import Modal from '$lib/components/Modal.svelte';

	const DEPARTMENTS = ['Admin', 'Project', 'OSH'];

	const splitDepartments = (list) => {
		const chosen = [];
		const other = [];
		for (const value of list ?? []) {
			const match = DEPARTMENTS.find((d) => d.toLowerCase() === String(value).trim().toLowerCase());
			if (match) chosen.push(match);
			else if (String(value).trim()) other.push(String(value).trim());
		}
		return { chosen: [...new Set(chosen)], other };
	};

	let users = [];
	let errorMsg = '';
	let isSaving = false;
	let modalError = '';
	let fieldErr = {};
	let submitted = false;
	let showEditModal = false;
	let showDeleteModal = false;
	let showAddModal = false;
	let showTempPassword = false;
	let selectedUser = null;
	const emptyAddForm = () => ({
		first_name: '',
		last_name: '',
		nickname: '',
		email: '',
		phone: '',
		department: [],
		position: '',
		region: '',
		temporaryPassword: ''
	});
	let addForm = emptyAddForm();
	let editForm = {
		first_name: '',
		last_name: '',
		nickname: '',
		email: '',
		phone: '',
		department: [],
		position: '',
		region: ''
	};
	let editOtherDepartments = [];

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
		const { chosen, other } = splitDepartments(user.department);
		editOtherDepartments = other;
		editForm = {
			first_name: user.first_name ?? '',
			last_name: user.last_name ?? '',
			nickname: user.nickname ?? '',
			email: user.email ?? '',
			phone: user.phone ?? '',
			department: chosen,
			position: user.position ?? '',
			region: user.region ?? ''
		};
		modalError = '';
		fieldErr = {};
		submitted = false;
		showEditModal = true;
	};

	const closeEditModal = () => {
		if (isSaving) return;
		showEditModal = false;
		selectedUser = null;
	};

	const openAddModal = () => {
		addForm = emptyAddForm();
		showTempPassword = false;
		modalError = '';
		fieldErr = {};
		submitted = false;
		showAddModal = true;
	};

	const closeAddModal = () => {
		if (isSaving) return;
		showAddModal = false;
	};

	const generateTempPassword = () => {
		const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789'];
		const all = sets.join('');
		const pick = (chars) => {
			const buf = new Uint32Array(1);
			crypto.getRandomValues(buf);
			return chars[buf[0] % chars.length];
		};
		const out = sets.map(pick);
		while (out.length < 12) out.push(pick(all));
		for (let i = out.length - 1; i > 0; i--) {
			const buf = new Uint32Array(1);
			crypto.getRandomValues(buf);
			const j = buf[0] % (i + 1);
			[out[i], out[j]] = [out[j], out[i]];
		}
		addForm.temporaryPassword = out.join('');
		showTempPassword = true;
	};

	function validate(form, isNew) {
		const e = {};
		const blank = (v) => !String(v ?? '').trim();
		if (blank(form.first_name)) e.first_name = 'First name is required.';
		if (blank(form.last_name)) e.last_name = 'Last name is required.';
		if (blank(form.nickname)) e.nickname = 'Nickname is required.';
		if (blank(form.email)) e.email = 'E-mail address is required.';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
			e.email = 'Enter a valid e-mail address.';
		}
		if (!form.department?.length) e.department = 'Select at least one department.';
		if (blank(form.position)) e.position = 'Position is required.';
		if (blank(form.region)) e.region = 'Region is required.';
		if (isNew) {
			if (!form.temporaryPassword) e.temporaryPassword = 'Temporary password is required.';
			else if (form.temporaryPassword.length < 8) {
				e.temporaryPassword = 'The temporary password must be at least 8 characters.';
			}
		}
		fieldErr = e;
		return Object.keys(e).length === 0;
	}

	const revalidate = () => {
		if (!submitted) return;
		if (showAddModal) validate(addForm, true);
		else if (showEditModal) validate(editForm, false);
	};

	const addUser = async () => {
		modalError = '';

		submitted = true;
		if (!validate(addForm, true)) return;

		const first = addForm.first_name.trim();
		const email = addForm.email.trim();

		isSaving = true;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

			const res = await fetch('/api/admin/users', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					...addForm,
					first_name: first,
					email,
					department: [...addForm.department]
				})
			});

			const result = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(result?.message ?? `Could not add the user (${res.status}).`);

			const created = result.user;
			users = [...users, created].sort((a, b) =>
				(a.first_name ?? '').localeCompare(b.first_name ?? '')
			);
			isSaving = false;
			showAddModal = false;
			addForm = emptyAddForm();
			toast.success(
				`User "${fullName(created)}" added. They must change the temporary password at first sign-in.`
			);
		} catch (error) {
			modalError = error?.message ?? String(error);
		} finally {
			isSaving = false;
		}
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
		modalError = '';
		submitted = true;
		if (!validate(editForm, false)) return;
		isSaving = true;

		const id = selectedUser.id;
		const payload = {
			first_name: editForm.first_name.trim() || null,
			last_name: editForm.last_name.trim() || null,
			nickname: editForm.nickname.trim() || null,
			email: editForm.email.trim() || null,
			phone: editForm.phone.trim() || null,
			department: [...editForm.department, ...editOtherDepartments],
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
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

			const res = await fetch(`/api/admin/users/${id}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${session.access_token}` }
			});
			if (!res.ok) {
				const result = await res.json().catch(() => ({}));
				throw new Error(result?.message ?? `Could not delete the user (${res.status}).`);
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
	<div class="filter-actions">
		<button type="button" class="button-submit add-user" onclick={openAddModal}>
			<Plus size={18} /><span>Add User</span>
		</button>
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
	<form
		id="user-form"
		class="edit-form"
		novalidate
		onsubmit={(e) => (e.preventDefault(), saveUser())}
		oninput={revalidate}
		onchange={revalidate}
	>
		<label>
			<span class="label-text">First Name: <span class="required">*</span></span>
			<input type="text" bind:value={editForm.first_name} class:invalid={fieldErr.first_name} />
			{#if fieldErr.first_name}<span class="field-err">{fieldErr.first_name}</span>{/if}
		</label>
		<label>
			<span class="label-text">Last Name: <span class="required">*</span></span>
			<input type="text" bind:value={editForm.last_name} class:invalid={fieldErr.last_name} />
			{#if fieldErr.last_name}<span class="field-err">{fieldErr.last_name}</span>{/if}
		</label>
		<label>
			<span class="label-text">Nickname: <span class="required">*</span></span>
			<input type="text" bind:value={editForm.nickname} class:invalid={fieldErr.nickname} />
			{#if fieldErr.nickname}<span class="field-err">{fieldErr.nickname}</span>{/if}
		</label>
		<label>
			<span class="label-text">E-mail Address: <span class="required">*</span></span>
			<input type="email" bind:value={editForm.email} class:invalid={fieldErr.email} />
			{#if fieldErr.email}<span class="field-err">{fieldErr.email}</span>{/if}
		</label>
		<label>
			<span class="label-text">Phone Number:</span>
			<input type="text" bind:value={editForm.phone} />
		</label>
		<div class="field">
			<span class="field-title">Department(s): <span class="required">*</span></span>
			<div class="check-row" class:invalid-group={fieldErr.department}>
				{#each DEPARTMENTS as dept (dept)}
					<label class="check-option">
						<input type="checkbox" value={dept} bind:group={editForm.department} />
						{dept}
					</label>
				{/each}
			</div>
			{#if fieldErr.department}<span class="field-err">{fieldErr.department}</span>{/if}
		</div>
		<label>
			<span class="label-text">Position: <span class="required">*</span></span>
			<input type="text" bind:value={editForm.position} class:invalid={fieldErr.position} />
			{#if fieldErr.position}<span class="field-err">{fieldErr.position}</span>{/if}
		</label>
		<label>
			<span class="label-text">Region: <span class="required">*</span></span>
			<input type="text" bind:value={editForm.region} class:invalid={fieldErr.region} />
			{#if fieldErr.region}<span class="field-err">{fieldErr.region}</span>{/if}
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

<Modal open={showAddModal} title="Add User" busy={isSaving} onclose={closeAddModal}>
	<form
		id="add-user-form"
		class="edit-form"
		novalidate
		onsubmit={(e) => (e.preventDefault(), addUser())}
		oninput={revalidate}
		onchange={revalidate}
	>
		<label>
			<span class="label-text">First Name: <span class="required">*</span></span>
			<input type="text" bind:value={addForm.first_name} autocomplete="off" class:invalid={fieldErr.first_name} />
			{#if fieldErr.first_name}<span class="field-err">{fieldErr.first_name}</span>{/if}
		</label>
		<label>
			<span class="label-text">Last Name: <span class="required">*</span></span>
			<input type="text" bind:value={addForm.last_name} autocomplete="off" class:invalid={fieldErr.last_name} />
			{#if fieldErr.last_name}<span class="field-err">{fieldErr.last_name}</span>{/if}
		</label>
		<label>
			<span class="label-text">Nickname: <span class="required">*</span></span>
			<input type="text" bind:value={addForm.nickname} autocomplete="off" class:invalid={fieldErr.nickname} />
			{#if fieldErr.nickname}<span class="field-err">{fieldErr.nickname}</span>{/if}
		</label>
		<label>
			<span class="label-text">E-mail Address: <span class="required">*</span></span>
			<input type="email" bind:value={addForm.email} autocomplete="off" class:invalid={fieldErr.email} />
			{#if fieldErr.email}<span class="field-err">{fieldErr.email}</span>{/if}
		</label>
		<label>
			<span class="label-text">Phone Number:</span>
			<input type="text" bind:value={addForm.phone} autocomplete="off" />
		</label>
		<div class="field">
			<span class="field-title">Department(s): <span class="required">*</span></span>
			<div class="check-row" class:invalid-group={fieldErr.department}>
				{#each DEPARTMENTS as dept (dept)}
					<label class="check-option">
						<input type="checkbox" value={dept} bind:group={addForm.department} />
						{dept}
					</label>
				{/each}
			</div>
			{#if fieldErr.department}<span class="field-err">{fieldErr.department}</span>{/if}
		</div>
		<label>
			<span class="label-text">Position: <span class="required">*</span></span>
			<input type="text" bind:value={addForm.position} autocomplete="off" class:invalid={fieldErr.position} />
			{#if fieldErr.position}<span class="field-err">{fieldErr.position}</span>{/if}
		</label>
		<label>
			<span class="label-text">Region: <span class="required">*</span></span>
			<input type="text" bind:value={addForm.region} autocomplete="off" class:invalid={fieldErr.region} />
			{#if fieldErr.region}<span class="field-err">{fieldErr.region}</span>{/if}
		</label>
		<div class="field">
			<label for="temp-password"
				><span class="label-text">Temporary Password: <span class="required">*</span></span></label
			>
			<div class="password-row">
				<input
					id="temp-password"
					type={showTempPassword ? 'text' : 'password'}
					bind:value={addForm.temporaryPassword}
					maxlength="72"
					autocomplete="new-password"
					class:invalid={fieldErr.temporaryPassword}
				/>
				<button
					type="button"
					class="icon-button"
					onclick={() => (showTempPassword = !showTempPassword)}
					aria-label={showTempPassword ? 'Hide temporary password' : 'Show temporary password'}
					title={showTempPassword ? 'Hide' : 'Show'}
				>
					{#if showTempPassword}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
				</button>
				<button
					type="button"
					class="icon-button"
					onclick={generateTempPassword}
					aria-label="Generate a random temporary password"
					title="Generate a random password"
				>
					<RefreshCw size={18} />
				</button>
			</div>
			{#if fieldErr.temporaryPassword}<span class="field-err">{fieldErr.temporaryPassword}</span>{/if}
			<p class="hint">
				At least 8 characters. The user is asked to choose a new password the first time they sign
				in with this one.
			</p>
		</div>
	</form>
	{#if modalError}
		<p class="error modal-error">{modalError}</p>
	{/if}

	{#snippet footer()}
		<button class="button-inverted" onclick={closeAddModal} disabled={isSaving}>Cancel</button>
		<button type="submit" form="add-user-form" class="button-confirm" disabled={isSaving}>
			{isSaving ? 'Adding...' : 'Add User'}
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
	button span {
		color: #ffffff;
	}

	.button-inverted {
		margin-top: 0;
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
		background-color: var(--danger-solid);
	}

	.button-delete:hover:not(:disabled) {
		background-color: #c62828c7;
	}

	.filter-actions {
		margin-left: auto;
	}

	.add-user {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.add-user span {
		color: #ffffff;
	}

	.field {
		display: grid;
		gap: 6px;
	}

	.field > label,
	.field-title {
		font-size: 13px;
		font-weight: 600;
	}

	.check-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 22px;
	}

	.edit-form .check-option {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}

	.edit-form .check-option input {
		width: 18px;
		height: 18px;
		padding: 0;
		margin: 0;
		cursor: pointer;
	}

	.check-row.invalid-group {
		padding: 8px 10px;
		border: 1px solid var(--danger);
		border-radius: var(--r-md);
	}

	.password-row {
		display: flex;
		gap: 8px;
	}

	.password-row input {
		flex: 1;
		min-width: 0;
	}

	.icon-button {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--r-md);
		background-color: var(--surface);
		color: var(--ink);
	}

	.icon-button:hover:not(:disabled) {
		border-color: var(--ink);
		background-color: var(--mist);
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
		margin-bottom: 30px;
	}

	h3 {
		font-weight: 600;
	}

	.user-card {
		display: flex;
		align-items: center;
		gap: 16px;
		background-color: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 15px 20px;
		margin: 10px 10px 0;
		box-shadow: var(--shadow-sm);
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
		font-weight: 600;
	}

	.edit-form input {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 8px 10px;
		font-size: 14px;
	}

	.button-confirm,
	.button-danger {
		font-weight: 600;
		padding: 8px 20px;
	}

	.button-confirm {
		background-color: var(--fill);
	}

	.button-confirm:hover:not(:disabled) {
		background-color: var(--brand);
	}

	.button-danger:hover:not(:disabled) {
		background-color: #c62828c7;
	}

	.error {
		color: var(--danger);
		font-weight: 600;
		margin: 8px 10px;
	}

	.modal-error {
		margin: 12px 0 0;
	}

	.delete-summary p {
		margin: 2px 0;
	}

	.hint {
		font-size: 12px;
		color: var(--muted);
		margin: 8px 0 0;
	}

	@media (max-width: 1024px) {
		.department-select {
			width: 100%;
		}

		.filter-actions {
			margin-left: 0;
			width: 100%;
		}

		.add-user {
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