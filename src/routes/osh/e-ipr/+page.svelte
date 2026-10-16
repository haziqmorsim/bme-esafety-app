<script>
	import Search from '@lucide/svelte/icons/search';
	import FileText from '@lucide/svelte/icons/file-text';
	import { supabase } from '$lib/supabase';
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
	let activity_date = '';
	let observations = '';
	let acknowledged = false;
	let created_at = '';
	let created_by = '';

	let ipr_checklist_file;
	let ipr_activity_file;

	function onFile(e, setter) {
		setter(e.currentTarget.files?.[0] ?? null);
	}

	// let confirmPassword = '';

	// if (!confirmPassword) {
	// 	throw new Error('Please confirm your login password.');
	// }

	let errorMsg = '';
	let saving = false;

	function withTimeout(promise, ms = 20000) {
		return Promise.race([
			promise,
			new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timed out')), ms))
		]);
	}

	async function uploadToBucket(file, folder) {
		if (!file) return null;

		const ext = file.name.split('.').pop() || 'bin';
		const fileName = `${crypto.randomUUID()}.${ext}`;
		const path = `${folder}/${fileName}`;

		const { data, error } = await supabase.storage
			.from('ipr_uploads')
			.upload(path, file, { upsert: false });

		if (error) {
			console.error('[upload error', error);
			throw error;
		}

		return data.path;
	}

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

			const ipr_checklist_path = await withTimeout(
				uploadToBucket(ipr_checklist_file, 'ipr_checklist'),
				60000
			);

			const ipr_activity_path = await withTimeout(
				uploadToBucket(ipr_activity_file, 'ipr_activity'),
				60000
			);

			const payload = {
				project_name,
				project_no,
				activity_date,
				ipr_checklist_path,
				ipr_activity_path,
				observations,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { error: insErr } = await withTimeout(
				supabase.from('ipr_submissions').insert(payload),
				15000
			);
			if (insErr) throw insErr;

			toast.success('Inspection Record (e-IPR) submitted successfully.');
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
			.select('project_name, project_id')
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
		closeProjectModal();
	}
</script>

<h1 class="title">Inspection Record (e-IPR) Submission</h1>

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
			<label for="project-date" class="forms-label">Activity Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={activity_date}
				onfocus={(e) => e.target.showPicker?.()}
				required
			/>
		</div>
		<Modal open={showProjectModal} title="Select a Project" onclose={closeProjectModal}>
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
			{#snippet footer()}
				<button type="button" class="button-secondary" onclick={closeProjectModal}>
					Cancel
				</button>
			{/snippet}
		</Modal>
		<br />
		<hr />
		<h2 class="heading">Inspection Details</h2>
		<h3>Please upload the required documentation photos for this inspection record.</h3>
		<p class="image-text">Checklist Image</p>
		<div class="upload">
			<p class="upload-text">
				<input
					type="file"
					id="ipr_checklist"
					name="ipr_checklist"
					accept="image/png, image/jpeg"
					multiple
					onchange={(e) => (ipr_checklist_file = e.target.files[0])}
					required
				/>
			</p>
		</div>
		<p class="image-text">Activity Image</p>
		<div class="upload">
			<p class="upload-text">
				<input
					type="file"
					id="ipr_activity"
					name="ipr_activity"
					accept="image/png, image/jpeg"
					multiple
					onchange={(e) => (ipr_activity_file = e.target.files[0])}
					required
				/>
			</p>
		</div>
		<br />
		<hr />
		<h2 class="heading">Additional Observations</h2>
		<p>
			<textarea
				name="observations"
				id="observations"
				cols="30"
				rows="10"
				class="observations"
				placeholder="Observations"
				bind:value={observations}
			></textarea>
		</p>
		<h2 class="heading">Acknowledgement and Submission</h2>
		<div class="container">
			<div class="checkbox">
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Inspection Record as below:</p>
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

	.image-text {
		margin-top: 10px;
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

	.observations {
		width: 100%;
		height: 200px;
	}

	.project-box {
		margin: 10px;
		border: 1px solid #091747;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
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

	.upload {
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 10px;
		border: 1px solid #091747;
		border-radius: 2px;
	}

	.upload-text {
		width: fit-content;
	}

	.upload-text input[type='file'] {
		font-size: 14px;
	}

	.upload-text input[type='file']::file-selector-button {
		background-color: #091747;
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		margin-right: 10px;
	}

	.upload-text input[type='file']::file-selector-button:hover {
		background-color: #091747b9;
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

		.forms-input {
			width: 100%;
			max-width: 100%;
		}

		.forms-label {
			width: 180px;
		}

		.forms-p {
			align-items: flex-start;
		}

		.upload {
			height: 180px;
		}

		.observations {
			height: 180px;
		}

		.declaration {
			padding-left: 8px;
		}

		.declaration p {
			word-break: break-word;
			overflow-wrap: anywhere;
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

		.button-primary,
		.button-submit {
			width: 100%;
			justify-content: center;
		}

		.project-box {
			margin: 6px;
			padding: 8px;
		}

		.forms-p {
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}

		.forms-label {
			width: 100%;
			font-size: 13px;
		}

		.forms-input {
			width: 100%;
			height: 34px;
			font-size: 13px;
		}

		.image-text {
			font-size: 13px;
		}

		.upload {
			height: 160px;
		}

		.upload-text input[type='file'] {
			font-size: 13px;
		}

		.observations {
			height: 160px;
			font-size: 13px;
		}

		.container {
			gap: 10px;
		}

		.declaration {
			padding: 0;
			font-size: 13px;
		}

		.declaration p {
			font-size: 13px;
		}

		.submit {
			justify-content: center;
		}

		.button-submit {
			width: 100%;
			justify-content: center;
		}
	}
</style>