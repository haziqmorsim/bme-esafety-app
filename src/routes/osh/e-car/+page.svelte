<script>
	import { validation, checkSubmit } from '$lib/validation';
	import Search from '@lucide/svelte/icons/search';
	import Spinner from '$lib/components/Spinner.svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import FileClock from '@lucide/svelte/icons/file-clock';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';
	import Modal from '$lib/components/Modal.svelte';
	import { toast } from '$lib/stores/toast';

	let showProjectModal = false;
	let projects = [];
	let filteredProjects = [];
	let projectSearch = '';
	let projectLoading = false;
	let projectError = '';

	let project_name = '';
	let project_no = '';
	let region = '';
	let location = '';
	let date = '';
	let weather = '';
	let form_no = '';
	let form_description = '';
	let action_taken = '';
	let users = [];
	let assigned_to = '';
	let remarks = '';
	let acknowledged = false;
	let created_at = '';
	let created_by = '';


	let errorMsg = '';
	let saving = false;

	function withTimeout(promise, ms = 20000) {
		return Promise.race([
			promise,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('The request timed out. Please try again.')), ms)
			)
		]);
	}

	const getUserName = (user) => {
		const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
		return name || user.email || 'Unknown';
	};

	async function handleSubmit(e) {
		e.preventDefault();
		if (!checkSubmit(e)) return;
		errorMsg = '';
		saving = true;

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { supabase, user } = auth;
			if (!user) throw new Error('Not signed in.');

			const { data: profile, error: profileError } = await withTimeout(
				supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single(),
				15000
			);

			if (profileError) throw profileError;

			const submitterName =
				`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;

			const payload = {
				project_name,
				project_no,
				region,
				location,
				date,
				weather,
				form_no,
				form_description,
				action_taken,
				assigned_to,
				remarks,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { error: insErr } = await withTimeout(
				supabase.from('car_submissions').insert(payload),
				15000
			);
			if (insErr) throw insErr;

			toast.success('e-CAR submitted successfully.');
			goto('/');
		} catch (error) {
			errorMsg = error?.message ?? String(error);
		} finally {
			saving = false;
		}
	}

	async function loadProjects() {
		projectLoading = true;
		projectError = '';

		const { data, error } = await supabase
			.from('projects')
			.select('project_name, project_id, region, location')
			.order('project_name', { ascending: true });

		if (error) {
			projectError = error.message;
			projects = [];
			filteredProjects = [];
		} else {
			projects = data ?? [];
			filterProjects();
		}

		projectLoading = false;
	}

	function filterProjects() {
		const query = projectSearch.trim().toLowerCase();
		if (!query) {
			filteredProjects = projects;
			return;
		}

		filteredProjects = projects.filter((project) => {
			const name = project.project_name ?? '';
			const id = project.project_id ?? '';
			return `${name} ${id}`.toLowerCase().includes(query);
		});
	}

	async function openProjectModal() {
		showProjectModal = true;
		if (projects.length === 0 && !projectLoading) {
			await loadProjects();
		}
	}

	function closeProjectModal() {
		showProjectModal = false;
	}

	function selectProject(project) {
		project_name = project.project_name ?? '';
		project_no = project.project_id ?? '';
		region = project.region ?? '';
		location = project.location ?? '';
		closeProjectModal();
	}

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;

		const { data, error } = await auth.supabase
			.from('profiles')
			.select('id, first_name, last_name, email')
			.order('first_name', { ascending: true });

		if (error) {
			errorMsg = error.message;
			users = [];
			return;
		}

		users = data ?? [];
	});
</script>

<h1 class="title">Corrective Action Report (e-CAR) Submission</h1>

<div class="history">
	<button class="button-primary" id="button-history" onclick={() => goto('/osh/e-car-history')}
		><FileClock size={20} /><span>History</span></button
	>
</div>

<div class="project-box">
	<form class="forms" use:validation onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}
			><Search />Search Project</button
		>
		<div class="forms-p">
			<label for="project-name" class="forms-label">Project Name:</label>
			<input data-message="Select a project using Search Project." required type="text" class="forms-input" bind:value={project_name} />
		</div>
		<div class="forms-p">
			<label for="project-no" class="forms-label">Project No.:</label>
			<input required type="text" class="forms-input" bind:value={project_no} />
		</div>
		<div class="forms-p">
			<label for="project-region" class="forms-label">Region:</label>
			<input required type="text" class="forms-input" bind:value={region} />
		</div>
		<div class="forms-p">
			<label for="project-location" class="forms-label">Location:</label>
			<input required type="text" class="forms-input" bind:value={location} />
		</div>
		<div class="forms-p">
			<label for="project-date" class="forms-label">Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={date}
				onfocus={(e) => e.target.showPicker?.()}
				required
			/>
		</div>
		<div class="forms-p">
			<label for="project-weather" class="forms-label">Weather:</label>
			<input type="text" class="forms-input" bind:value={weather} required />
		</div>
		<Modal open={showProjectModal} title="Select a Project" onclose={closeProjectModal}>
			<div class="project-search">
				<input
					type="text"
					placeholder="Project Name/Project No."
					class="project-search-input"
					bind:value={projectSearch}
					oninput={filterProjects}
				/>
				<button type="button" class="project-search-button" onclick={filterProjects}>
					<Search />
				</button>
			</div>
			<div class="project-list">
				<div class="project-list-header">
					<span>Project Name</span>
					<span>Project No.</span>
				</div>
				{#if projectLoading}
					<div class="project-status">
						<Spinner inline size={140} label="Loading projects" />
					</div>
				{:else if projectError}
					<p class="project-status error">{projectError}</p>
				{:else if filteredProjects.length === 0}
					<p class="project-status">No projects found.</p>
				{:else}
					{#each filteredProjects as project}
						<button type="button" class="project-row" onclick={() => selectProject(project)}>
							<span>{project.project_name ?? '-'}</span>
							<span class="project-row-id">{project.project_id ?? '-'}</span>
						</button>
					{/each}
				{/if}
			</div>
			{#snippet footer()}
				<button type="button" class="button-secondary" onclick={closeProjectModal}>
					Cancel
				</button>
			{/snippet}
		</Modal>
		<br />
		<hr />
		<h2 class="heading">Corrective Action Information</h2>
		<div class="forms-p">
			<label for="iso-no" class="forms-label">ISO Form No.:</label>
			<input type="text" class="forms-input" bind:value={form_no} required />
		</div>
		<div class="section">
			<label for="issue-description" class="forms-label">Issue Description:</label>
			<p>
				<textarea
					name="description"
					id="description"
					cols="30"
					rows="10"
					class="issue"
					placeholder="Issue"
					bind:value={form_description}
					required
				></textarea>
			</p>
		</div>
		<div class="section">
			<label for="action-taken" class="forms-label">Action Taken:</label>
			<p>
				<textarea
					name="action"
					id="action"
					cols="30"
					rows="10"
					class="action"
					placeholder="Action Taken"
					bind:value={action_taken}
					required
				></textarea>
			</p>
		</div>
		<div class="forms-p">
			<label for="iso-no" class="forms-label">Assigned To:</label>
			<select required bind:value={assigned_to} class="user-select">
				<option value="" disabled selected>Select User</option>
				{#each users as item}
					<option value={item.id}>{getUserName(item)}</option>
				{/each}
			</select>
		</div>
		<hr />
		<h2 class="heading">Remarks</h2>
		<p>
			<textarea
				name="remarks"
				id="remarks"
				cols="30"
				rows="10"
				class="remarks"
				placeholder="Remarks"
				bind:value={remarks}
			></textarea>
		</p>
		<h2 class="heading" data-label-for="checkbox">Acknowledgement and Submission</h2>
		<div class="container" data-field>
			<div class="checkbox">
				<input data-label="Acknowledgement" required type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} />
			</div>
			<div class="declaration">
				<p>The declaration for the Corrective Action Report is as below.</p>
				<p>
					I hereby acknowledge that I have conducted a thorough check and confirm the following:
				</p>
				<ul>
					<li>All information in this report is accurate and up to date.</li>
					<li>All personnel working on site are registered and have appropriate permits.</li>
				</ul>
				<p>I understand that this action may be recorded as part of the official audit trail.</p>
			</div>
		</div>
		<p>Note: Double check if content is correct before submitting.</p>
		{#if errorMsg}
			<p class="error">{errorMsg}</p>
		{/if}
		<div class="submit">
			<button type="submit" class="button-submit" disabled={saving}
				><FileText />{saving ? 'Submitting...' : 'Submit'}</button
			>
		</div>
	</form>
</div>

<style>
	#button-history {
		background-color: var(--brand);
		color: #ffffff;
		width: 200px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin: 0 0 0 auto;
	}

	#button-history:hover {
		background-color: var(--brand-deep);
	}

	#button-history span {
		color: #ffffff;
	}

	.container {
		display: flex;
		margin: 10px 0;
	}

	.history {
		display: flex;
		margin: 10px;
	}

	.issue,
	.action,
	.remarks {
		width: 100%;
		height: 200px;
	}

	.section {
		margin-bottom: 10px;
	}

	.user-select {
		font-size: 14px;
		width: 40%;
		cursor: pointer;
	}

	ul {
		list-style-type: circle;
		margin: 0 0 10px 15px;
	}

	@media (max-width: 1024px) {
		#button-history {
			margin-left: 0;
			width: 100%;
		}

		textarea {
			width: 100%;
			max-width: 100%;
			box-sizing: border-box;
		}

		.user-select {
			width: 100%;
		}
	}

	@media (max-width: 600px) {
		.history {
			margin: 8px;
		}

		#button-history {
			width: 100%;
			margin-right: 0;
		}

		textarea {
			width: 100%;
			min-height: 160px;
		}

		.container {
			gap: 10px;
		}
	}
</style>