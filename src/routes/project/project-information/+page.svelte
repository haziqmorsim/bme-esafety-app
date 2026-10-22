<script>
	import Plus from '@lucide/svelte/icons/plus';
	import Spinner from '$lib/components/Spinner.svelte';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import Search from '@lucide/svelte/icons/search';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';
	import Modal from '$lib/components/Modal.svelte';

	const EMPTY_FORM = {
		project_name: '',
		project_id: '',
		status: '',
		region: '',
		location: '',
		start_date: '',
		end_date: '',
		pic_name: '',
		pic_position: '',
		pic_start_date: '',
		pic_end_date: ''
	};

	let projects = $state([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let searchText = $state('');
	let selectedStatus = $state('All');
	let selectedDataOption = $state('All');
	let currentUserName = $state('');

	let showFormModal = $state(false);
	let formMode = $state('create'); // 'create' | 'edit'
	let selectedProject = $state(null);
	let form = $state({ ...EMPTY_FORM });
	let isSaving = $state(false);
	let formError = $state('');

	let showDeleteModal = $state(false);
	let deletingProject = $state(null);
	let isDeleting = $state(false);
	let deleteError = $state('');

	function formatDate(iso) {
		if (!iso) return '-';

		const date = new Date(iso);
		const gmt8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		const day = String(gmt8.getUTCDate()).padStart(2, '0');
		const month = gmt8.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
		const year = gmt8.getUTCFullYear();

		return `${day} ${month} ${year}`;
	}

	const filteredProjects = $derived(
		projects.filter((p) => {
			const search = searchText.trim().toLowerCase();

			const matchesStatus =
				selectedStatus === 'All' || (p.status ?? '').toLowerCase() === selectedStatus.toLowerCase();

			let matchesSearch = true;

			if (search !== '') {
				if (selectedDataOption === 'project-id') {
					matchesSearch = (p.project_id ?? '').toLowerCase().includes(search);
				} else if (selectedDataOption === 'project-name') {
					matchesSearch = (p.project_name ?? '').toLowerCase().includes(search);
				} else if (selectedDataOption === 'region') {
					matchesSearch = (p.region ?? '').toLowerCase().includes(search);
				} else {
					const haystack =
						`${p.project_name ?? ''} ${p.project_id ?? ''} ${p.region ?? ''} ${p.status ?? ''}`.toLowerCase();
					matchesSearch = haystack.includes(search);
				}
			}

			return matchesSearch && matchesStatus;
		})
	);

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;

		const { supabase, user } = auth;

		const { data: profileData, error: profileError } = await supabase
			.from('profiles')
			.select('first_name, last_name')
			.eq('id', user.id)
			.single();

		if (profileError) {
			errorMsg = profileError.message;
		} else {
			const firstName = profileData?.first_name ?? '';
			const lastName = profileData?.last_name ?? '';
			currentUserName = `${firstName} ${lastName}`.trim();
		}

		const { data, error } = await supabase
			.from('projects')
			.select(
				'id, project_name, project_id, status, region, location, start_date, end_date, pic_name, pic_position, pic_start_date, pic_end_date, created_at, created_by'
			)
			.order('project_name', { ascending: true });

		loading = false;

		if (error) {
			errorMsg = error.message;
			projects = [];
			return;
		}

		projects = data ?? [];
	});

	function openCreateModal() {
		formMode = 'create';
		selectedProject = null;
		form = { ...EMPTY_FORM };
		formError = '';
		showFormModal = true;
	}

	function openEditModal(project) {
		formMode = 'edit';
		selectedProject = project;
		form = Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, project[key] ?? '']));
		formError = '';
		showFormModal = true;
	}

	function closeFormModal() {
		if (isSaving) return;
		showFormModal = false;
		selectedProject = null;
	}

	function buildPayload() {
		const text = (v) => String(v ?? '').trim() || null;
		return {
			project_name: text(form.project_name),
			project_id: text(form.project_id),
			status: text(form.status),
			region: text(form.region),
			location: text(form.location),
			start_date: form.start_date || null,
			end_date: form.end_date || null,
			pic_name: text(form.pic_name),
			pic_position: text(form.pic_position),
			pic_start_date: form.pic_start_date || null,
			pic_end_date: form.pic_end_date || null
		};
	}

	async function saveProject(event) {
		event?.preventDefault();
		formError = '';

		if (!String(form.project_name).trim()) {
			formError = 'Please enter the project name.';
			return;
		}

		isSaving = true;
		const payload = buildPayload();

		try {
			if (formMode === 'create') {
				const { data, error } = await supabase
					.from('projects')
					.insert({ ...payload, created_by: currentUserName || null })
					.select()
					.single();

				if (error) throw error;

				projects = data ? [data, ...projects] : projects;
				isSaving = false;
				closeFormModal();
				toast.success(`Project "${payload.project_name}" created successfully.`);
			} else {
				const id = selectedProject.id;
				const { data, error } = await supabase
					.from('projects')
					.update(payload)
					.eq('id', id)
					.select('id');

				if (error) throw error;
				if (!data || data.length === 0) {
					throw new Error('The project was not updated. You may not have permission to edit it.');
				}

				projects = projects.map((project) =>
					project.id === id ? { ...project, ...payload } : project
				);
				isSaving = false;
				closeFormModal();
				toast.success(`Project "${payload.project_name}" updated successfully.`);
			}
		} catch (error) {
			formError = error?.message ?? String(error);
		} finally {
			isSaving = false;
		}
	}

	function openDeleteModal(project) {
		deletingProject = project;
		deleteError = '';
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		if (isDeleting) return;
		showDeleteModal = false;
		deletingProject = null;
	}

	async function deleteProject() {
		if (!deletingProject) return;
		isDeleting = true;
		deleteError = '';

		const { id, project_name } = deletingProject;

		try {
			const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id');

			if (error) throw error;
			if (!data || data.length === 0) {
				throw new Error('The project was not deleted. You may not have permission to delete it.');
			}

			projects = projects.filter((project) => project.id !== id);
			isDeleting = false;
			closeDeleteModal();
			toast.success(`Project "${project_name ?? ''}" deleted successfully.`);
		} catch (error) {
			deleteError = error?.message ?? String(error);
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>Project Information Management | BME e-Safety App</title>
</svelte:head>

{#snippet dateInput(key)}
	<input
		type="date"
		class="forms-date"
		bind:value={form[key]}
		onfocus={(e) => e.currentTarget.showPicker?.()}
	/>
{/snippet}

<h1 class="title">Project Information Management</h1>

<div class="filter-bar">
	<div>
		<label for="status-filter">Project Status</label>
		<select id="status-filter" bind:value={selectedStatus} class="status-select">
			<option value="All">Choose a Project Status</option>
			<option value="Commissioning">Commissioning</option>
			<option value="Delivery">Delivery</option>
			<option value="Factory">Factory</option>
			<option value="Installation">Installation</option>
			<option value="Mechanical-completion">Mechanical Completion</option>
			<option value="N/A">N/A</option>
		</select>
	</div>
</div>

<div class="filter-bar">
	<div>
		<label for="data-option">Data Option:</label>
		<select id="data-option" bind:value={selectedDataOption} class="option-select">
			<option value="All">Choose a Data Option</option>
			<option value="project-id">Project No.</option>
			<option value="project-name">Project Name</option>
			<option value="region">Region</option>
		</select>
	</div>
	<div>
		<label for="project-search">Project No./Project Name/Region</label>
		<input
			id="project-search"
			type="text"
			placeholder="Search by project..."
			bind:value={searchText}
			class="filter-input"
		/>
	</div>
</div>

{#if errorMsg}
	<p class="error">{errorMsg}</p>
{/if}

<div class="button-modify">
	<button class="button-assign" onclick={openCreateModal}>
		<Plus size={20} /><span>New Project</span>
	</button>
	<button class="button-download"><ArrowDownToLine size={20} /><span>Excel</span></button>
</div>

{#if loading}
	<Spinner inline size={140} label="Loading projects" />
{:else if filteredProjects.length === 0}
	<p class="status">
		{projects.length === 0 ? 'No projects have been added yet.' : 'No projects match the filters.'}
	</p>
{/if}

<div class="card-grid">
	{#each filteredProjects as p (p.id)}
		<div class="project-card">
			<div class="project-info">
				<h3>{p.project_name ?? '-'}</h3>
				<p><b>Project No.:</b> {p.project_id ?? '-'}</p>
				<p><b>Status:</b> {p.status ?? '-'}</p>
				<p><b>Region:</b> {p.region ?? '-'}</p>
				<p><b>Location:</b> {p.location ?? '-'}</p>
				<p><b>Created By:</b> {p.created_by ?? '-'}</p>
				<p><b>Start Date:</b> {formatDate(p.start_date)}</p>
				<p><b>End Date:</b> {formatDate(p.end_date)}</p>
				<p class="pic">Person In Charge</p>
				<p><b>Name:</b> {p.pic_name ?? '-'}</p>
				<p><b>Position:</b> {p.pic_position ?? '-'}</p>
			</div>
			<div class="card-actions">
				<button class="button-edit" onclick={() => openEditModal(p)}>
					<Pencil size={16} /><span>Edit</span>
				</button>
				<button class="button-delete" onclick={() => openDeleteModal(p)}>
					<Trash2 size={16} /><span>Delete</span>
				</button>
			</div>
		</div>
	{/each}
</div>

<Modal
	open={showFormModal}
	title={formMode === 'create' ? 'New Project' : 'Edit Project Information'}
	size="md"
	busy={isSaving}
	onclose={closeFormModal}
>
	<form id="project-form" class="project-form" onsubmit={saveProject} novalidate>
		<div class="form-grid">
			<label>
				Project Name:
				<input type="text" bind:value={form.project_name} />
			</label>
			<label>
				Project No.:
				<input type="text" bind:value={form.project_id} />
			</label>
			<label>
				Status:
				<input type="text" bind:value={form.status} />
			</label>
			<label>
				Region:
				<input type="text" bind:value={form.region} />
			</label>
			<label>
				Location:
				<input type="text" bind:value={form.location} />
			</label>
			<label>
				Start Date:
				{@render dateInput('start_date')}
			</label>
			<label>
				End Date:
				{@render dateInput('end_date')}
			</label>
		</div>

		<h3 class="form-section">
			{formMode === 'create' ? 'Person In Charge Information' : 'Edit Person In Charge Information'}
		</h3>
		<div class="form-grid">
			<label>
				Full Name:
				<input type="text" bind:value={form.pic_name} />
			</label>
			<label>
				Position:
				<input type="text" bind:value={form.pic_position} />
			</label>
			<label>
				Start Date:
				{@render dateInput('pic_start_date')}
			</label>
			<label>
				End Date:
				{@render dateInput('pic_end_date')}
			</label>
		</div>

		{#if formError}
			<p class="error">{formError}</p>
		{/if}
	</form>

	{#snippet footer()}
		<button type="button" class="button-inverted" onclick={closeFormModal} disabled={isSaving}>
			Cancel
		</button>
		<button type="submit" form="project-form" class="button-confirm" disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Confirm'}
		</button>
	{/snippet}
</Modal>

<Modal
	open={showDeleteModal && !!deletingProject}
	title="Delete Project"
	size="sm"
	busy={isDeleting}
	onclose={closeDeleteModal}
>
	<p>Are you sure you want to delete this project?</p>
	{#if deletingProject}
		<div class="delete-summary">
			<p><b>Project Name:</b> {deletingProject.project_name ?? '-'}</p>
			<p><b>Project No.:</b> {deletingProject.project_id ?? '-'}</p>
			<p><b>Status:</b> {deletingProject.status ?? '-'}</p>
			<p><b>Region:</b> {deletingProject.region ?? '-'}</p>
		</div>
	{/if}
	<p class="hint">This action cannot be undone.</p>
	{#if deleteError}
		<p class="error">{deleteError}</p>
	{/if}

	{#snippet footer()}
		<button type="button" class="button-inverted" onclick={closeDeleteModal} disabled={isDeleting}>
			Cancel
		</button>
		<button type="button" class="button-danger" onclick={deleteProject} disabled={isDeleting}>
			{isDeleting ? 'Deleting...' : 'Delete'}
		</button>
	{/snippet}
</Modal>

<style>
	button:hover:not(:disabled) {
		background-color: var(--brand-deep);
	}

	button span {
		color: #ffffff;
	}

	.button-assign,
	.button-download {
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.button-assign {
		width: 150px;
	}

	.button-download {
		width: 100px;
		background-color: #31b647;
	}

	.button-download:hover:not(:disabled) {
		background-color: #31b647bd;
	}

	.card-actions {
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
		background-color: var(--danger);
	}

	.button-delete:hover:not(:disabled) {
		background-color: #c62828c7;
	}

	.button-inverted:hover:not(:disabled) {
		background-color: var(--mist-2);
	}

	.button-confirm {
		background-color: var(--ink);
		font-weight: 600;
		padding: 10px 20px;
	}

	.button-confirm:hover:not(:disabled) {
		background-color: var(--brand);
	}

	.button-danger:hover:not(:disabled) {
		background-color: #c62828c7;
	}

	.button-modify {
		display: flex;
		padding: 10px;
		justify-content: space-between;
		gap: 10px;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px;
		padding: 0 10px;
	}

	.filter-bar label {
		display: block;
		margin: 0 0 6px 0;
	}

	h3 {
		margin-bottom: 10px;
		font-size: 16px;
		font-weight: 600;
	}

	.option-select,
	.status-select {
		height: 40px;
		width: 200px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
	}

	.pic {
		margin: 10px 0;
		font-weight: 600;
	}

	.project-card {
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
		background-color: #ffffff;
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 15px 20px;
		box-shadow: var(--shadow-sm);
	}

	.project-info {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.project-info p {
		font-size: 14px;
	}

	.status {
		padding: 0 10px;
		margin: 10px 0;
		color: var(--muted);
	}

	.error {
		color: var(--danger);
		font-weight: 600;
		margin: 8px 10px;
	}

	.project-form .error {
		margin: 12px 0 0;
	}

	.form-grid {
		display: grid;
		gap: 12px;
	}

	.form-section {
		margin: 20px 0 12px;
		font-size: 16px;
	}

	.form-grid label {
		display: grid;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}

	.form-grid input {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 8px 10px;
		font-size: 14px;
		font-weight: normal;
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
		.status-select,
		.option-select,
		.filter-input {
			width: 100%;
		}

		.card-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.project-card {
			flex-direction: column;
			align-items: stretch;
		}

		.card-actions {
			flex-direction: row;
			width: 100%;
		}
	}

	@media (max-width: 600px) {
		.button-modify {
			flex-direction: column;
		}

		.button-assign,
		.button-download {
			width: 100%;
		}

		.card-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.project-card {
			padding: 12px;
		}

		.project-info p {
			font-size: 13px;
		}

		.button-edit,
		.button-delete {
			height: 38px;
		}
	}
</style>