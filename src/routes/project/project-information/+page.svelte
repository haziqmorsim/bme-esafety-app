<script>
	/** @type {Array<{ items: Array<any>}>} */
	import ListPlus from '@lucide/svelte/icons/list-plus';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import Search from '@lucide/svelte/icons/search';
	import Close from '@lucide/svelte/icons/x';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';

	let projects = [];
	let errorMsg = '';
	let isSaving = false;
	let showEditModal = false;
	let showCreateModal = false;
	let selectedProject = null;
	let searchText = '';
	let selectedStatus = 'All';
	let selectedDataOption = 'All';
	let currentUserName = '';
	let editForm = {
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
	let createForm = {
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

	function formatDate(iso) {
		if (!iso) return '';

		const date = new Date(iso);

		const gmt8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		const day = String(gmt8.getUTCDate()).padStart(2, '0');
		const month = gmt8.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
		const year = gmt8.getUTCFullYear();

		return `${day} ${month} ${year}`;
	}

	$: filteredProjects = projects.filter((p) => {
		const search = searchText.toLowerCase();

		const matchesStatus =
			selectedStatus === 'All' || (p.status ?? '').toLowerCase() === selectedStatus.toLowerCase();

		let matchesSearch = true;

		if (searchText.trim() !== '') {
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
	});

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;

		const { supabase, user } = auth;
		if (!user) throw new Error('Not signed in.');

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
			.order('created_at', { ascending: false });

		if (error) {
			errorMsg = error.message;
			projects = [];
			return;
		}

		projects = data ?? [];
	});

	const openEditModal = (project) => {
		selectedProject = project;
		editForm = {
			project_name: project.project_name ?? '',
			project_id: project.project_id ?? '',
			status: project.status ?? '',
			region: project.region ?? '',
			location: project.location ?? '',
			start_date: project.start_date ?? '',
			end_date: project.end_date ?? '',
			pic_name: project.pic_name ?? '',
			pic_position: project.pic_position ?? '',
			pic_start_date: project.pic_start_date ?? '',
			pic_end_date: project.pic_end_date ?? ''
		};
		showEditModal = true;
	};

	const closeEditModal = () => {
		showEditModal = false;
		selectedProject = null;
	};

	const openCreateModal = () => {
		createForm = {
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
		showCreateModal = true;
	};

	const closeCreateModal = () => {
		showCreateModal = false;
	};

	const saveProject = async () => {
		if (!selectedProject) return;
		isSaving = true;
		errorMsg = '';

		const payload = {
			project_name: editForm.project_name.trim() || null,
			project_id: editForm.project_id.trim() || null,
			status: editForm.status.trim() || null,
			region: editForm.region.trim() || null,
			location: editForm.location.trim() || null,
			start_date: editForm.start_date || null,
			end_date: editForm.end_date || null,
			pic_name: editForm.pic_name.trim() || null,
			pic_position: editForm.pic_position.trim() || null,
			pic_start_date: editForm.pic_start_date || null,
			pic_end_date: editForm.pic_end_date || null
		};

		const { error } = await supabase.from('projects').update(payload).eq('id', selectedProject.id);

		isSaving = false;

		if (error) {
			errorMsg = error.message;
			return;
		}

		projects = projects.map((project) =>
			project.id === selectedProject.id ? { ...project, ...payload } : project
		);
		closeEditModal();
	};

	const createProject = async () => {
		isSaving = true;
		errorMsg = '';

		const payload = {
			project_name: createForm.project_name.trim() || null,
			project_id: createForm.project_id.trim() || null,
			status: createForm.status.trim() || null,
			region: createForm.region.trim() || null,
			location: createForm.location.trim() || null,
			start_date: createForm.start_date || null,
			end_date: createForm.end_date || null,
			pic_name: createForm.pic_name.trim() || null,
			pic_position: createForm.pic_position.trim() || null,
			pic_start_date: createForm.pic_start_date || null,
			pic_end_date: createForm.pic_end_date || null,
			created_by: currentUserName || null
		};

		const { data, error } = await supabase.from('projects').insert(payload).select().single();

		isSaving = false;

		if (error) {
			errorMsg = error.message;
			return;
		}

		projects = data ? [data, ...projects] : projects;
		closeCreateModal();
	};
</script>

<svelte:head>
	<title>Project Information Management | BME Automation App</title>
</svelte:head>

<h1 class="title">Project Information Management</h1>

<div class="filter-bar">
	<div>
		<p>Project Status</p>
		<select bind:value={selectedStatus} class="status-select">
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
		<p>Data Option:</p>
		<select bind:value={selectedDataOption} class="option-select">
			<option value="All">Choose a Data Option</option>
			<option value="project-id">Project ID</option>
			<option value="project-name">Project Name</option>
			<option value="region">Region</option>
		</select>
	</div>
	<div>
		<p>Project ID/Project Name/Region</p>
		<input
			type="text"
			placeholder="Project ID/Project Name/Region"
			bind:value={searchText}
			class="filter-input"
		/>
	</div>
	<div>
		<p class="hidden">Search</p>
		<button class="button-primary" id="button-search"><Search />Search Project</button>
	</div>
</div>

{#if errorMsg}
	<p class="error">{errorMsg}</p>
{/if}

<div class="button-modify">
	<button class="button-assign" on:click={openCreateModal}>
		<ListPlus /><span>New Project</span>
	</button>
	<button class="button-download"><CloudDownload /><span>Excel</span></button>
</div>

<div class="card-grid">
	{#each filteredProjects as p (p.id)}
		<div class="project-card">
			<div class="project-info">
				<h3>{p.project_name ?? '-'}</h3>
				<p><b>Project ID:</b> {p.project_id ?? '-'}</p>
				<p><b>Status:</b> {p.status ?? '-'}</p>
				<p><b>Region:</b> {p.region ?? '-'}</p>
				<p><b>Location:</b> {p.location ?? '-'}</p>
				<p><b>Created By:</b> {p.created_by ?? '-'}</p>
				<p><b>Start Date:</b> {formatDate(p.start_date) ?? '-'}</p>
				<p><b>End Date:</b> {formatDate(p.end_date) ?? '-'}</p>
				<br />
				<p class="pic">Person In Charge</p>
				<p><b>Name:</b> {p.pic_name ?? '-'}</p>
				<p><b>Position:</b> {p.pic_position ?? '-'}</p>
			</div>
			<div class="button-edit">
				<button id="button-edit" on:click={() => openEditModal(p)}>Edit</button>
			</div>
		</div>
	{/each}
</div>

{#if showCreateModal}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Create project">
			<button class="modal-close" on:click={closeCreateModal} disabled={isSaving}>
				<Close size={18} />
			</button>
			<h2>New Project</h2>
			<div class="modal-body">
				<label>
					Project Name:
					<input type="text" bind:value={createForm.project_name} />
				</label>
				<label>
					Project ID:
					<input type="text" bind:value={createForm.project_id} />
				</label>
				<label>
					Status:
					<input type="text" bind:value={createForm.status} />
				</label>
				<label>
					Region:
					<input type="text" bind:value={createForm.region} />
				</label>
				<label>
					Location:
					<input type="text" bind:value={createForm.location} />
				</label>
				<label>
					Start Date:
					<input
						type="date"
						class="forms-date"
						bind:value={createForm.start_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
				<label>
					End Date:
					<input
						type="date"
						class="forms-date"
						bind:value={createForm.end_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
			</div>
			<br />
			<h2>Person In Charge Information</h2>
			<div class="modal-body">
				<label>
					Full Name:
					<input type="text" bind:value={createForm.pic_name} />
				</label>
				<label>
					Position:
					<input type="text" bind:value={createForm.pic_position} />
				</label>
				<label>
					Start Date:
					<input
						type="date"
						class="forms-date"
						bind:value={createForm.pic_start_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
				<label>
					End Date:
					<input
						type="date"
						class="forms-date"
						bind:value={createForm.pic_end_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
			</div>
			<div class="modal-actions">
				<button class="button-inverted" on:click={closeCreateModal} disabled={isSaving}>
					Cancel
				</button>
				<button on:click={createProject} disabled={isSaving}>
					{isSaving ? 'Saving...' : 'Confirm'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showEditModal}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Edit project information">
			<button class="modal-close" on:click={closeEditModal} disabled={isSaving}>
				<Close size={18} />
			</button>
			<h2>Edit Project Information</h2>
			<div class="modal-body">
				<label>
					Project Name:
					<input type="text" bind:value={editForm.project_name} />
				</label>
				<label>
					Project ID:
					<input type="text" bind:value={editForm.project_id} />
				</label>
				<label>
					Status:
					<input type="text" bind:value={editForm.status} />
				</label>
				<label>
					Region:
					<input type="text" bind:value={editForm.region} />
				</label>
				<label>
					Location:
					<input type="text" bind:value={editForm.location} />
				</label>
				<label>
					Start Date:
					<input
						type="date"
						class="forms-date"
						bind:value={editForm.start_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
				<label>
					End Date:
					<input
						type="date"
						class="forms-date"
						bind:value={editForm.end_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
			</div>
			<br />
			<h2>Edit Person In Charge Information</h2>
			<div class="modal-body">
				<label>
					Full Name:
					<input type="text" bind:value={editForm.pic_name} />
				</label>
				<label>
					Position:
					<input type="text" bind:value={editForm.pic_position} />
				</label>
				<label>
					Start Date:
					<input
						type="date"
						class="forms-input"
						bind:value={editForm.pic_start_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
				<label>
					End Date:
					<input
						type="date"
						class="forms-input"
						bind:value={editForm.pic_end_date}
						on:focus={(e) => e.target.showPicker?.()}
					/>
				</label>
			</div>
			<div class="modal-actions">
				<button class="button-inverted" on:click={closeEditModal} disabled={isSaving}>
					Cancel
				</button>
				<button on:click={saveProject} disabled={isSaving}>
					{isSaving ? 'Saving...' : 'Confirm'}
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
		border: 2px solid #ffffff;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #064c6da4;
	}

	.button-assign {
		width: 150px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.button-assign span {
		color: #ffffff;
	}

	.button-download {
		background-color: #31b647;
		width: 150px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.button-download span {
		color: #ffffff;
	}

	.button-download:hover {
		background-color: #31b647bd;
	}

	.button-edit {
		width: 20%;
		align-self: flex-start;
	}

	#button-edit {
		width: 100%;
	}

	.button-inverted {
		background-color: #ffffff;
		color: #064c6dd7;
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
		padding: 10px;
		justify-content: space-between;
	}

	.button-primary {
		background-color: #091747;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	#button-search {
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px;
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

	.forms-date {
		cursor: pointer;
	}

	.forms-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.hidden {
		opacity: 0;
	}

	h2 {
		font-weight: bold;
	}

	h3 {
		margin-bottom: 10px;
		font-size: 16px;
		font-weight: bold;
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
		margin-bottom: 10px;
		font-weight: bold;
	}

	.project-card {
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

	.project-info {
		width: 80%;
	}

	.project-info p {
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
			flex-wrap: wrap;
			gap: 12px;
		}

		.filter-bar > div {
			flex: 1 1 220px;
			min-width: 220px;
		}

		.status-select,
		.option-select,
		.filter-input {
			width: 100%;
		}

		.button-modify {
			flex-direction: column;
			gap: 10px;
		}

		.button-assign,
		.button-download {
			width: 100%;
		}

		.card-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.project-card {
			flex-direction: column;
			align-items: flex-start;
		}

		.project-info {
			width: 100%;
		}

		.project-info h3,
		.project-info p {
			word-break: break-word;
			overflow-wrap: anywhere;
			white-space: normal;
		}

		.button-edit {
			width: 100%;
			margin-top: 10px;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

		.button-primary {
			width: 100%;
			justify-content: center;
		}

		.filter-bar {
			flex-wrap: wrap;
			gap: 12px;
			padding: 0;
		}

		.filter-bar > div {
			flex: 1 1 220px;
			min-width: 220px;
		}

		.status-select,
		.option-select,
		.filter-input {
			width: 100%;
		}

		.card-grid {
			grid-template-columns: 1fr;
		}

		.project-card {
			padding: 12px;
			margin: 8px;
		}

		.project-info h3 {
			font-size: 16px;
		}

		.project-info p {
			font-size: 13px;
		}

		#button-edit {
			width: 100%;
		}

		.modal {
			padding: 16px;
		}

		.modal-actions {
			flex-direction: column;
			gap: 8px;
		}

		.modal-actions button {
			width: 100%;
		}

		.modal-backdrop {
			padding: 16px 12px;
		}

		.modal-body {
			gap: 10px;
		}

		.modal-body input {
			width: 100%;
		}
	}
</style>
