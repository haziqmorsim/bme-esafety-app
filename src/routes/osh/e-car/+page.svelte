<script>
	import Search from '@lucide/svelte/icons/search';
	import FileText from '@lucide/svelte/icons/file-text';
	import FileClock from '@lucide/svelte/icons/file-clock';
	import Check from '@lucide/svelte/icons/check';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';

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

	// let confirmPassword = '';

	// if (!confirmPassword) {
	// 	throw new Error('Please confirm your login password.');
	// }

	let errorMsg = '';
	let saving = false;

	let showSuccess = false;
	let successTimer;

	const getUserName = (user) => {
		const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
		return name || user.email || 'Unknown';
	};

	async function handleSubmit(e) {
		e.preventDefault();
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

			const { error, insErr } = await withTimeout(
				supabase.from('car_submissions').insert(payload),
				15000
			);
			if (insErr) throw insErr;

			showSuccess = true;

			setTimeout(() => {
				showSuccess = false;
				goto('/');
			}, 3000);
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

		const { supabase, user } = auth;

		const { data, error } = await supabase
			.from('profiles')
			.select('id, first_name, last_name, email, menu_access, created_at')
			.order('first_name', { ascending: true });

		if (error) {
			errorMsg = error.message;
			users = [];
			return;
		}

		users = data ?? [];
		syncSelectedMenuAccess();
	});
</script>

<h1 class="title">Corrective Action Report (e-CAR) Submission</h1>

<div class="history">
	<button class="button-primary" id="button-history" onclick={() => goto('/osh/e-car-history')}
		><FileClock /><span>History</span></button
	>
</div>

<div class="project-box">
	<form class="forms" onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}
			><Search />Search Project</button
		>
		<div class="forms-p">
			<label for="project-name" class="forms-label">Project Name:</label>
			<input type="text" class="forms-input" bind:value={project_name} />
		</div>
		<div class="forms-p">
			<label for="project-no" class="forms-label">Project No.:</label>
			<input type="text" class="forms-input" bind:value={project_no} />
		</div>
		<div class="forms-p">
			<label for="project-region" class="forms-label">Region:</label>
			<input type="text" class="forms-input" bind:value={region} />
		</div>
		<div class="forms-p">
			<label for="project-location" class="forms-label">Location:</label>
			<input type="text" class="forms-input" bind:value={location} />
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
		{#if showProjectModal}
			<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Select project">
				<div class="modal">
					<h3>Select a Project</h3>
					<div class="project-search">
						<input
							type="text"
							placeholder="Project Name/Project ID"
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
							<span>Project ID</span>
						</div>
						{#if projectLoading}
							<p class="project-status">Loading projects...</p>
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
					<div class="modal-actions">
						<button type="button" class="button-secondary" onclick={closeProjectModal}>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}
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
			<select bind:value={assigned_to} class="user-select">
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
		<h2 class="heading">Acknowledgement and Submission</h2>
		<div class="container">
			<div class="checkbox">
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} />
			</div>
			<div class="declaration">
				<p>The declaration for the Corrective Action Report as below:</p>
				<p>
					I hereby acknowledge that I have conducted a thorough check and confirm the following:
				</p>
				<p>>> All information in this report is accurate and up to date.</p>
				<p>>> All personnel working on site are registered and have appropriate permits.</p>
				<p>
					By entering my password below, I confirm my identity and consent as a digital
					acknowledgment.
				</p>
				<p>I understand that this action may be recorded as part of the official audit trail.</p>
			</div>
		</div>
		<p>Note: Double check if content is correct before submitting.</p>
		<!-- <div class="forms-p">
			<p><b>Confirm Login Password</b></p>
			<input type="password" class="forms-input" bind:value={confirmPassword} />
		</div> -->
		{#if errorMsg}
			<p class="error">{errorMsg}</p>
		{/if}
		<div class="submit">
			<button type="submit" class="button-submit" disabled={saving}
				><FileText />{saving ? 'Submitting...' : 'Submit'}</button
			>
		</div>
	</form>
	{#if showSuccess}
		<div class="success-overlay">
			<div class="success-popup">
				<h3>Success! <Check strokeWidth={4} /></h3>
				<p>Your form submission was successful.</p>
			</div>
		</div>
	{/if}
</div>

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

	#button-history {
		background-color: #064c6dd7;
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
		background-color: #064c6da4;
	}

	#button-history span {
		color: #ffffff;
	}

	.button-primary {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: #091747;
		margin: 10px 0 20px 0;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.button-submit {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: #091747;
		font-weight: bold;
		margin: 5px;
		padding: 10px 20px;
	}

	.button-submit:hover {
		background-color: #091747b9;
	}

	.button-secondary {
		background-color: #ffffff;
		color: #091747;
		border: 1px solid #091747;
		padding: 8px 18px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: bold;
	}

	.button-secondary:hover {
		background-color: #dedede;
	}

	.container {
		display: flex;
		margin: 10px 0;
	}

	.declaration {
		padding: 0 10px;
		font-weight: bold;
	}

	.declaration p {
		margin-bottom: 10px;
	}

	.forms {
		margin: 0;
		position: relative;
	}

	.forms-date {
		cursor: pointer;
	}

	.forms-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.forms-input {
		height: 30px;
		width: 500px;
		font-size: 14px;
	}

	.forms-label {
		width: 150px;
		font-size: 14px;
	}

	.forms-p {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;
	}

	.heading {
		margin: 10px 0;
		font-size: 20px;
		font-weight: bold;
	}

	.history {
		display: flex;
		margin: 10px;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(9, 23, 71, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		z-index: 50;
	}

	.modal {
		background: #ffffff;
		border-radius: 10px;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
		padding: 20px;
		width: min(600px, 95vw);
	}

	.modal h3 {
		margin: 0 0 16px 0;
		font-size: 20px;
	}

	.project-search {
		display: flex;
		gap: 10px;
		margin-bottom: 16px;
	}

	.project-search-input {
		flex: 1;
		height: 36px;
		padding: 0 10px;
		border: 1px solid #cfd6e4;
		border-radius: 6px;
		font-size: 14px;
	}

	.project-search-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 36px;
		padding: 0;
		background-color: #091747;
		border-radius: 6px;
	}

	.project-search-button:hover {
		background-color: #091747b9;
	}

	.project-list {
		border: 1px solid #cfd6e4;
		border-radius: 8px;
		overflow: hidden;
		max-height: 320px;
		overflow-y: auto;
	}

	.project-list-header,
	.project-row {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 10px;
		padding: 10px 12px;
	}

	.project-list-header {
		background-color: #f2f4f9;
		font-weight: bold;
		border-bottom: 1px solid #cfd6e4;
		text-align: center;
	}

	.project-row {
		width: 100%;
		text-align: left;
		background: #ffffff;
		border: none;
		border-bottom: 1px solid #e3e8f0;
		cursor: pointer;
	}

	.project-row:last-child {
		border-bottom: none;
	}

	.project-row:hover {
		background-color: #dedede;
	}

	.project-row-id {
		text-align: center;
	}

	.project-status {
		padding: 12px;
		margin: 0;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-start;
		margin-top: 16px;
	}

	.project-box {
		margin: 10px;
		border: 1px solid #091747;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
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

	.submit {
		display: flex;
		justify-content: flex-end;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.user-select {
		font-size: 14px;
		width: 40%;
		cursor: pointer;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.project-box {
			margin: 8px;
			padding: 10px;
		}

		.forms-p {
			flex-wrap: wrap;
			align-items: flex-start;
			row-gap: 6px;
		}

		.forms-label {
			width: auto;
			min-width: 180px;
			white-space: normal;
			word-break: break-word;
		}

		.forms-input {
			width: 100%;
			max-width: 520px;
		}

		#button-history {
			margin-left: 0;
			width: 100%;
		}

		textarea {
			width: 100%;
			max-width: 100%;
			box-sizing: border-box;
		}

		.declaration {
			padding: 0;
		}

		.declaration p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.submit {
			justify-content: flex-end;
		}

		.user-select {
			width: 100%;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

		.heading {
			font-size: 18px;
		}

		.project-box {
			margin: 6px;
			padding: 8px;
		}

		.forms-p {
			flex-direction: column;
			align-items: stretch;
			gap: 6px;
		}

		.forms-label {
			width: 100%;
		}

		.forms-input {
			width: 100%;
			max-width: 100%;
		}

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

		.button-primary,
		.button-submit {
			width: 100%;
			justify-content: center;
		}

		.container {
			gap: 10px;
		}

		.declaration,
		.declaration p {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.submit {
			justify-content: stretch;
		}
	}
</style>
