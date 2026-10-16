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
	let region = '';
	let location = '';
	let kickoff_date = '';
	let weather = '';
	let supervisor_name = '';
	let start_date = '';
	let end_date = '';
	let staff_name = '';
	let workday_date = '';
	let hours_worked = '';
	let workday_day = '';
	let actual_hours_worked = '';
	let travel_date = '';
	let travel_origin = '';
	let travel_destination = '';
	let travel_allowance = '';
	let contractor_name = '';
	let contractor_phone_no = '';
	let contractor_email = '';
	let contractor_company = '';
	let contractor_certification = '';
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
				kickoff_date,
				weather,
				supervisor_name,
				start_date,
				end_date,
				staff_name,
				workday_date,
				hours_worked,
				workday_day,
				actual_hours_worked,
				travel_date,
				travel_origin,
				travel_destination,
				travel_allowance,
				contractor_name,
				contractor_phone_no,
				contractor_email,
				contractor_company,
				contractor_certification,
				remarks,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { error: insErr } = await withTimeout(
				supabase.from('ctr_submissions').insert(payload),
				15000
			);
			if (insErr) throw insErr;

			toast.success('Competency Register Report (e-CTR) submitted successfully.');
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
</script>

<h1 class="title">Competency Register Report (e-CTR) Submission</h1>

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
			<label for="kickoff-date" class="forms-label">Kick-off Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={kickoff_date}
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
		<h2 class="heading">Site Safety Supervisor Allocation</h2>
		<div class="forms-p">
			<label for="supervisor-name" class="forms-label">Supervisor Name:</label>
			<input type="text" class="forms-input" bind:value={supervisor_name} />
		</div>
		<div class="forms-p">
			<label for="start-date" class="forms-label">Start Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={start_date}
				onfocus={(e) => e.target.showPicker?.()}
			/>
		</div>
		<div class="forms-p">
			<label for="end-date" class="forms-label">End Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={end_date}
				onfocus={(e) => e.target.showPicker?.()}
			/>
		</div>
		<br />
		<hr />
		<h2 class="heading">Staff Information</h2>
		<h3 class="subheading">Workday</h3>
		<div class="forms-p">
			<label for="staff-name" class="forms-label">Staff Name:</label>
			<input type="text" class="forms-input" bind:value={staff_name} />
		</div>
		<div class="forms-p">
			<label for="workday-date" class="forms-label">Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={workday_date}
				onfocus={(e) => e.target.showPicker?.()}
			/>
		</div>
		<div class="forms-p">
			<label for="hours-worked" class="forms-label">Hours Worked:</label>
			<input type="text" class="forms-input" bind:value={hours_worked} />
		</div>
		<h3 class="subheading">Overtime (OT) Claim</h3>
		<div class="forms-p">
			<label for="workday-day" class="forms-label">Workday:</label>
			<input type="text" class="forms-input" bind:value={workday_day} />
		</div>
		<div class="forms-p">
			<label for="hours-worked" class="forms-label">Hours Worked:</label>
			<input type="text" class="forms-input" bind:value={actual_hours_worked} />
		</div>
		<h3 class="subheading">Travel Details</h3>
		<div class="forms-p">
			<label for="travel-date" class="forms-label">Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={travel_date}
				onfocus={(e) => e.target.showPicker?.()}
			/>
		</div>
		<div class="forms-p">
			<label for="travel-origin" class="forms-label">Origin:</label>
			<input type="text" class="forms-input" bind:value={travel_origin} />
		</div>
		<div class="forms-p">
			<label for="travel-destination" class="forms-label">Destination:</label>
			<input type="text" class="forms-input" bind:value={travel_destination} />
		</div>
		<div class="forms-p">
			<label for="travel-allowance" class="forms-label">Allowance:</label>
			<input type="text" class="forms-input" bind:value={travel_allowance} />
		</div>
		<br />
		<hr />
		<h2 class="heading">Contractor Information</h2>
		<div class="forms-p">
			<label for="contractor-name" class="forms-label">Contractor Name:</label>
			<input type="text" class="forms-input" bind:value={contractor_name} />
		</div>
		<div class="forms-p">
			<label for="contractor-phone-no" class="forms-label">Phone No.:</label>
			<input type="text" class="forms-input" bind:value={contractor_phone_no} />
		</div>
		<div class="forms-p">
			<label for="contractor-company" class="forms-label">Company:</label>
			<input type="text" class="forms-input" bind:value={contractor_company} />
		</div>
		<div class="forms-p">
			<label for="contractor-email" class="forms-label">Email:</label>
			<input type="email" class="forms-input" bind:value={contractor_email} />
		</div>
		<div class="forms-p">
			<label for="contractor-certification" class="forms-label">Certification Expiry Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={contractor_certification}
				onfocus={(e) => e.target.showPicker?.()}
			/>
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
				<p>The declaration for the Competency Register Report as below:</p>
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
			<input type="password" class="forms-input" />
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

	.project-box {
		margin: 10px;
		border: 1px solid #091747;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
	}

	.remarks {
		width: 100%;
		height: 200px;
	}

	.subheading {
		margin: 10px 0;
		font-size: 16px;
		font-weight: bold;
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
			max-width: 520px;
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

		.button-primary,
		.button-submit {
			width: fit-content;
		}

		.remarks {
			height: 180px;
		}

		.project-list-header,
		.project-row {
			grid-template-columns: 1.4fr 1fr;
		}

		p,
		label,
		.declaration p {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

		.project-box {
			margin: 6px;
			padding: 8px;
		}

		.heading {
			font-size: 18px;
		}

		.subheading {
			font-size: 15px;
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

		.remarks {
			height: 160px;
		}

		.container {
			gap: 10px;
		}

		.button-primary,
		.button-submit {
			width: 100%;
			justify-content: center;
		}

		.submit {
			justify-content: stretch;
		}

		.declaration,
		.declaration p {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}
	}
</style>