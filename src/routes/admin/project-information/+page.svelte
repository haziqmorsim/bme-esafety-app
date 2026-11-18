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
	import Combobox from '$lib/components/Combobox.svelte';
	import Pagination, { pageSlice } from '$lib/components/Pagination.svelte';
	import { REGIONS } from '$lib/data/regions';
	import { MYDateKey } from '$lib/submission-timing';

	const PAGE_SIZE = 9;

	const STATUS_OPTIONS = [
		'Commissioning',
		'Delivery',
		'Factory',
		'Installation',
		'Mechanical Completion',
		'N/A'
	];

	const normStatus = (value) =>
		String(value ?? '')
			.toLowerCase()
			.replace(/[\s_-]+/g, ' ')
			.trim();
	const matchStatus = (value) => STATUS_OPTIONS.find((o) => normStatus(o) === normStatus(value));

	const EMPTY_FORM = {
		project_name: '',
		project_id: '',
		status: '',
		region: '',
		location: '',
		start_date: '',
		end_date: '',
		project_engineer_name: '',
		project_engineer_start_date: '',
		project_engineer_end_date: '',
		project_site_supervisor_name: '',
		project_site_supervisor_start_date: '',
		project_site_supervisor_end_date: '',
		project_certified_oshc_name: '',
		project_certified_oshc_start_date: '',
		project_certified_oshc_end_date: '',
		site_safety_supervisor_name: '',
		site_safety_supervisor_start_date: '',
		site_safety_supervisor_end_date: ''
	};

	const ROLES = [
		{ key: 'project_engineer', label: 'Project Engineer' },
		{ key: 'project_site_supervisor', label: 'Project Site Supervisor' },
		{ key: 'project_certified_oshc', label: 'Project Certified OSH-C' },
		{ key: 'site_safety_supervisor', label: 'Site Safety Supervisor' }
	];

	const CSV_HEADERS = [
		'Project ID',
		'Project Name',
		'Status',
		'Region',
		'Location',
		'Start Date',
		'End Date',
		'Project Engineer',
		'Start Date',
		'End Date',
		'Project Site Supervisor',
		'Start Date',
		'End Date',
		'Project Certified OSH-C',
		'Start Date',
		'End Date',
		'Site Safety Supervisor',
		'Start Date',
		'End Date',
		'Created By',
		'Created At'
	];

	let projects = $state([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let searchText = $state('');
	let selectedStatus = $state('All');
	let selectedDataOption = $state('All');
	let currentUserName = $state('');
	let currentPage = $state(1);
	let users = $state([]);

	let showFormModal = $state(false);
	let formMode = $state('create'); // 'create' | 'edit'
	let selectedProject = $state(null);
	let form = $state({ ...EMPTY_FORM });
	let isSaving = $state(false);
	let formError = $state('');
	let fieldErr = $state({});
	let submitted = $state(false);

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
				selectedStatus === 'All' || normStatus(p.status) === normStatus(selectedStatus);

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

	const userNames = $derived(
		[...new Set(users.map((u) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()).filter(Boolean))].sort(
			(a, b) => a.localeCompare(b)
		)
	);

	const paginatedProjects = $derived(pageSlice(filteredProjects, currentPage, PAGE_SIZE));

	$effect(() => {
		selectedStatus;
		selectedDataOption;
		searchText;
		currentPage = 1;
	});

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
				'id, project_name, project_id, status, region, location, start_date, end_date, project_engineer_name, project_engineer_start_date, project_engineer_end_date, project_site_supervisor_name, project_site_supervisor_start_date, project_site_supervisor_end_date, project_certified_oshc_name, project_certified_oshc_start_date, project_certified_oshc_end_date, site_safety_supervisor_name, site_safety_supervisor_start_date, site_safety_supervisor_end_date, created_at, created_by'
			)
			.order('project_name', { ascending: true });

		loading = false;

		if (error) {
			errorMsg = error.message;
			projects = [];
			return;
		}

		projects = data ?? [];

		const { data: profileRows } = await supabase
			.from('profiles')
			.select('first_name, last_name')
			.order('first_name');
		users = profileRows ?? [];
	});

	function openCreateModal() {
		formMode = 'create';
		selectedProject = null;
		form = { ...EMPTY_FORM };
		formError = '';
		fieldErr = {};
		submitted = false;
		showFormModal = true;
	}

	function openEditModal(project) {
		formMode = 'edit';
		selectedProject = project;
		form = Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, project[key] ?? '']));
		form.status = matchStatus(project.status) ?? form.status;
		formError = '';
		fieldErr = {};
		submitted = false;
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
			...Object.fromEntries(
				ROLES.flatMap(({ key }) => [
					[`${key}_name`, canonicalName(form[`${key}_name`])],
					[`${key}_start_date`, form[`${key}_start_date`] || null],
					[`${key}_end_date`, form[`${key}_end_date`] || null]
				])
			)
		};
	}

	function canonicalName(value) {
		const name = String(value ?? '').trim();
		if (!name) return null;
		return userNames.find((n) => n.toLowerCase() === name.toLowerCase()) ?? name;
	}

	function validate() {
		const e = {};
		const blank = (v) => !String(v ?? '').trim();
		if (blank(form.project_name)) e.project_name = 'Project name is required.';
		if (blank(form.project_id)) e.project_id = 'Project no. is required.';
		if (blank(form.status)) e.status = 'Status is required.';
		if (blank(form.region)) e.region = 'Region is required.';
		if (blank(form.location)) e.location = 'Location is required.';
		if (!form.start_date) e.start_date = 'Start date is required.';
		if (!form.end_date) e.end_date = 'End date is required.';

		for (const { key, label } of ROLES) {
			const name = String(form[`${key}_name`] ?? '').trim();
			const start = form[`${key}_start_date`];
			const end = form[`${key}_end_date`];
			if (name) {
				const known = userNames.some((n) => n.toLowerCase() === name.toLowerCase());
				if (userNames.length > 0 && !known) {
					e[`${key}_name`] = `Select a name from the user list for ${label}.`;
				}
			} else if (start || end) {
				e[`${key}_name`] = `Enter the ${label} name for these dates.`;
			}
			if (start && end && end < start) {
				e[`${key}_end_date`] = 'End date cannot be before the start date.';
			}
		}
		fieldErr = e;
		return Object.keys(e).length === 0;
	}

	function revalidate() {
		if (submitted) validate();
	}

	async function saveProject(event) {
		event?.preventDefault();
		formError = '';

		submitted = true;
		if (!validate()) return;

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
				currentPage = 1;
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

	const csvDate = (v) => String(v ?? '').slice(0, 10);

	function csvDateTime(iso) {
		const time = new Date(iso).getTime();
		if (!iso || Number.isNaN(time)) return '';
		return new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
	}

	function csvText(v) {
		let text = String(v ?? '');
		if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
		return csvQuote(text);
	}

	function csvQuote(text) {
		return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function projectCsvRow(p) {
		return [
			csvText(p.project_id),
			csvText(p.project_name),
			csvText(p.status),
			csvText(p.region),
			csvText(p.location),
			csvDate(p.start_date),
			csvDate(p.end_date),
			...ROLES.flatMap(({ key }) => [
				csvText(p[`${key}_name`]),
				csvDate(p[`${key}_start_date`]),
				csvDate(p[`${key}_end_date`])
			]),
			csvText(p.created_by),
			csvDateTime(p.created_at)
		].join(',');
	}

	function exportProjects() {
		if (projects.length === 0) {
			toast.error('There are no projects to export.');
			return;
		}

		const lines = [CSV_HEADERS.map(csvQuote).join(','), ...projects.map(projectCsvRow)];
		const blob = new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], {
			type: 'text/csv;charset=utf-8'
		});

		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `ProjectInformation_${MYDateKey(new Date())}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);

		toast.success(`Exported ${projects.length} project${projects.length === 1 ? '' : 's'}.`);
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
		class:invalid={fieldErr[key]}
		bind:value={form[key]}
		onfocus={(e) => e.currentTarget.showPicker?.()}
	/>
	{#if fieldErr[key]}<span class="field-err">{fieldErr[key]}</span>{/if}
{/snippet}

<h1 class="title">Project Information Management</h1>

<div class="filter-bar">
	<div>
		<label for="status-filter">Project Status</label>
		<select id="status-filter" bind:value={selectedStatus} class="status-select">
			<option value="All">Choose a Project Status</option>
			{#each STATUS_OPTIONS as option (option)}
				<option value={option}>{option}</option>
			{/each}
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
		<Plus size={20} /><span>Add Project</span>
	</button>
	<button
		class="button-download"
		onclick={exportProjects}
		disabled={loading || projects.length === 0}
	>
		<ArrowDownToLine size={20} /><span>Excel</span>
	</button>
</div>

{#if loading}
	<Spinner inline size={140} label="Loading projects" />
{:else if filteredProjects.length === 0}
	<p class="status">
		{projects.length === 0 ? 'No projects have been added yet.' : 'No projects match the filters.'}
	</p>
{/if}

<div class="card-grid">
	{#each paginatedProjects as p (p.id)}
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
				{#each ROLES as role (role.key)}
					<p><b>{role.label}:</b> {p[`${role.key}_name`] ?? '-'}</p>
				{/each}
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

{#if !loading}
	<div class="pagination-wrap">
		<Pagination
			bind:page={currentPage}
			totalItems={filteredProjects.length}
			pageSize={PAGE_SIZE}
			itemLabel="projects"
		/>
	</div>
{/if}

<Modal
	open={showFormModal}
	title={formMode === 'create' ? 'Add Project' : 'Edit Project Information'}
	size="md"
	busy={isSaving}
	onclose={closeFormModal}
>
	<form
		id="project-form"
		class="project-form"
		novalidate
		onsubmit={saveProject}
		oninput={revalidate}
		onchange={revalidate}
	>
		<div class="form-grid">
			<label>
				<span class="label-text">Project Name: <span class="required">*</span></span>
				<input type="text" bind:value={form.project_name} class:invalid={fieldErr.project_name} />
				{#if fieldErr.project_name}<span class="field-err">{fieldErr.project_name}</span>{/if}
			</label>
			<label>
				<span class="label-text">Project No.: <span class="required">*</span></span>
				<input type="text" bind:value={form.project_id} class:invalid={fieldErr.project_id} />
				{#if fieldErr.project_id}<span class="field-err">{fieldErr.project_id}</span>{/if}
			</label>
			<label>
				<span class="label-text">Status: <span class="required">*</span></span>
				<select bind:value={form.status} class:invalid={fieldErr.status}>
					<option value="">Select a status</option>
					{#each STATUS_OPTIONS as option (option)}
						<option value={option}>{option}</option>
					{/each}
					{#if form.status && !STATUS_OPTIONS.includes(form.status)}
						<option value={form.status}>{form.status}</option>
					{/if}
				</select>
				{#if fieldErr.status}<span class="field-err">{fieldErr.status}</span>{/if}
			</label>
			<label>
				<span class="label-text">Region: <span class="required">*</span></span>
				<select bind:value={form.region} class:invalid={fieldErr.region}>
					<option value="" disabled>Select a region</option>
					{#each REGIONS as option (option)}
						<option value={option}>{option}</option>
					{/each}
					{#if form.region && !REGIONS.includes(form.region)}
						<option value={form.region}>{form.region}</option>
					{/if}
				</select>
				{#if fieldErr.region}<span class="field-err">{fieldErr.region}</span>{/if}
			</label>
			<label>
				<span class="label-text">Location: <span class="required">*</span></span>
				<input type="text" bind:value={form.location} class:invalid={fieldErr.location} />
				{#if fieldErr.location}<span class="field-err">{fieldErr.location}</span>{/if}
			</label>
			<label>
				<span class="label-text">Start Date: <span class="required">*</span></span>
				{@render dateInput('start_date')}
			</label>
			<label>
				<span class="label-text">End Date: <span class="required">*</span></span>
				{@render dateInput('end_date')}
			</label>
		</div>

		<h3 class="form-section">
			{formMode === 'create' ? 'Person In Charge Information' : 'Edit Person In Charge Information'}
		</h3>
		<p class="form-note">
			Assign person in charge to project roles with their assignment periods
		</p>

		<div class="role-list">
			{#each ROLES as role (role.key)}
				<div class="role-block">
					<label>
						<span class="label-text">{role.label} Name:</span>
						<Combobox
							options={userNames}
							placeholder="Type to search users"
							emptyText="No matching users"
							bind:value={form[`${role.key}_name`]}
							invalid={!!fieldErr[`${role.key}_name`]}
						/>
						{#if fieldErr[`${role.key}_name`]}
							<span class="field-err">{fieldErr[`${role.key}_name`]}</span>
						{/if}
					</label>
					<div class="date-row">
						<label>
							Start Date:
							{@render dateInput(`${role.key}_start_date`)}
						</label>
						<label>
							End Date:
							{@render dateInput(`${role.key}_end_date`)}
						</label>
					</div>
				</div>
			{/each}
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
		background-color: var(--danger-solid);
	}

	.button-delete:hover:not(:disabled) {
		background-color: #c62828c7;
	}

	.button-inverted:hover:not(:disabled) {
		background-color: var(--mist-2);
	}

	.button-confirm {
		background-color: var(--fill);
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
        margin-bottom: 10px;
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

	.pagination-wrap {
		padding: 0 10px 10px;
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
		background-color: var(--surface);
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
		margin: 20px 0 4px;
		font-size: 16px;
	}

	.form-note {
		margin: 0 0 12px;
		color: var(--muted);
		font-size: 13px;
	}

	.role-list {
		display: grid;
		gap: 12px;
	}

	.role-block {
		display: grid;
		gap: 12px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		background-color: var(--surface-alt);
	}

	.date-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.role-block label {
		display: grid;
		gap: 6px;
		min-width: 0;
		font-size: 13px;
		font-weight: 600;
	}

	.role-block input {
		width: 100%;
		min-width: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 8px 10px;
		font-size: 14px;
		font-weight: normal;
	}

	.form-grid label {
		display: grid;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}

	.form-grid input,
	.form-grid select {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 8px 10px;
		font-size: 14px;
		font-weight: normal;
	}

	.form-grid select {
		padding-right: 2.4rem;
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