<script>
	import FileText from '@lucide/svelte/icons/file-text';
	import Search from '@lucide/svelte/icons/search';
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

	let requestor_name = '';
	let requestor_position = '';
	let requestor_department = '';
	let traveller_name = '';
	let traveller_id = '';
	let traveller_company = '';
	let traveller_position = '';
	let traveller_department = '';
	let traveller_phone_no = '';
	let mode_of_travel = '';
	let fare_to_be_borne_by = '';
	let travel_origin = '';
	let travel_destination = '';
	let travel_date_time = '';
	let travel_purpose = '';
	let project_no = '';
	let travel_airline = '';
	let travel_flight_no = '';
	let travel_baggage_required = '';
	let meal_onboard_required = '';
	let showAdditionalTraveller = false;
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
				supabase
					.from('profiles')
					.select('first_name, last_name, nickname')
					.eq('id', user.id)
					.single(),
				15000
			);

			if (profileError) throw profileError;

			const submitterName =
				`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;

			const payload = {
				requestor_name,
				requestor_position,
				requestor_department,
				traveller_name,
				traveller_id,
				traveller_company,
				traveller_position,
				traveller_department,
				traveller_phone_no,
				mode_of_travel,
				fare_to_be_borne_by,
				travel_origin,
				travel_destination,
				travel_date_time,
				travel_purpose,
				project_no,
				travel_airline,
				travel_flight_no,
				travel_baggage_required,
				meal_onboard_required,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { error: insErr } = await withTimeout(
				supabase.from('trf_submissions').insert(payload),
				15000
			);
			if (insErr) throw insErr;

			toast.success('Travel Requisition Form Report (e-TRF) submitted successfully.');
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

<h1 class="title">Travel Requisition Form Report (e-TRF) Submission</h1>

<div class="project-box">
	<form class="forms" onsubmit={handleSubmit}>
		<h2 class="heading">Requestor Information</h2>
		<div class="forms-p">
			<label for="requestor-name" class="forms-label">Requestor Name:</label>
			<input type="text" class="forms-input" bind:value={requestor_name} required />
		</div>
		<div class="forms-p">
			<label for="requestor-position" class="forms-label">Position:</label>
			<input type="text" class="forms-input" bind:value={requestor_position} required />
		</div>
		<div class="forms-p">
			<label for="department" class="forms-label">Department:</label>
			<select class="select" bind:value={requestor_department} required>
				<option value="" disabled selected></option>
				<option value="Project">Project</option>
				<option value="OSH">OSH</option>
			</select>
		</div>
		<br />
		<hr />
		<h2 class="heading">Traveller Information</h2>
		<div class="forms-p">
			<label for="traveller-name" class="forms-label">Traveller Name:</label>
			<input type="text" class="forms-input" bind:value={traveller_name} required />
		</div>
		<div class="forms-p">
			<label for="traveller-ic-passport" class="forms-label">IC or Passport No.:</label>
			<input type="text" class="forms-input" bind:value={traveller_id} required />
		</div>
		<div class="forms-p">
			<label for="traveller-company" class="forms-label">Company:</label>
			<input type="text" class="forms-input" bind:value={traveller_company} required />
		</div>
		<div class="forms-p">
			<label for="traveller-position" class="forms-label">Position:</label>
			<input type="text" class="forms-input" bind:value={traveller_position} required />
		</div>
		<div class="forms-p">
			<label for="department" class="forms-label">Department:</label>
			<select class="select" bind:value={traveller_department} required>
				<option value="" disabled selected></option>
				<option value="Project">Project</option>
				<option value="OSH">OSH</option>
			</select>
		</div>
		<div class="forms-p">
			<label for="traveller-phone-no" class="forms-label">Phone No.:</label>
			<input type="text" class="forms-input" bind:value={traveller_phone_no} required />
		</div>
		<div class="forms-p">
			<label for="mode-of-travel" class="forms-label">Mode of Travel:</label>
			<select class="select" bind:value={mode_of_travel} required>
				<option value="" disabled selected></option>
				<option value="Road">Road</option>
				<option value="Company-Vehicle">Company Vehicle</option>
				<option value="Air">Air</option>
			</select>
		</div>
		<div class="forms-p">
			<label for="fare-to-be-borne-by" class="forms-label">Fare to be Borne by:</label>
			<select class="select" bind:value={fare_to_be_borne_by} required>
				<option value="" disabled selected></option>
				<option value="boilermech">Boilermech Sdn Bhd</option>
				<option value="bm-greentech">BM GreenTech Bhd</option>
				<option value="zenith">Zenith Index Sdn Bhd</option>
				<option value="others">Others - Clients/Sub-Contractor/Supplier</option>
				<option value="oretech">Boilermech Oretech Sdn Bhd</option>
			</select>
		</div>
		<br />
		<hr />
		<h2 class="heading">Business Trip Details</h2>
		<div class="forms-p">
			<label for="travel-origin" class="forms-label">Origin:</label>
			<input type="text" class="forms-input" bind:value={travel_origin} required />
		</div>
		<div class="forms-p">
			<label for="travel-destination" class="forms-label">Destination:</label>
			<input type="text" class="forms-input" bind:value={travel_destination} required />
		</div>
		<div class="forms-p">
			<label for="travel-date-time" class="forms-label">Departure Date & Time:</label>
			<input type="datetime-local" class="forms-input" bind:value={travel_date_time} required />
		</div>
		<div class="forms-p">
			<label for="travel-purpose" class="forms-label">Purpose of Travel:</label>
			<input type="text" class="forms-input" bind:value={travel_purpose} required />
		</div>
		<div class="forms-p">
			<label for="project-id" class="forms-label">Project ID:</label>
			<input type="text" class="forms-input" bind:value={project_no} disabled />
			<button type="button" class="button-primary" onclick={openProjectModal} id="button-search"
				><Search size={16} />Search Project</button
			>
		</div>
		<div class="forms-p">
			<label for="travel-airline" class="forms-label">Preferred Airline:</label>
			<input type="text" class="forms-input" bind:value={travel_airline} required />
		</div>
		<div class="forms-p">
			<label for="travel-flight-no" class="forms-label">Flight No.:</label>
			<input type="text" class="forms-input" bind:value={travel_flight_no} required />
		</div>
		<div class="forms-p">
			<label for="travel-baggage-required" class="forms-label">Baggage Required (kg):</label>
			<input type="radio" name="baggage-weight" id="15-kg" bind:value={travel_baggage_required} />
			<label for="15-kg" class="label">15</label>
			<input type="radio" name="baggage-weight" id="20-kg" bind:value={travel_baggage_required} />
			<label for="20-kg" class="label">20</label>
			<input type="radio" name="baggage-weight" id="30-kg" bind:value={travel_baggage_required} />
			<label for="30-kg" class="label">30</label>
		</div>
		<div class="forms-p">
			<label for="meal-onboard-required" class="forms-label">Meal Onboard Required:</label>
			<input type="radio" name="baggage-weight" id="meal-yes" bind:value={meal_onboard_required} />
			<label for="meal-yes" class="label">Yes</label>
			<input type="radio" name="baggage-weight" id="meal-no" bind:value={meal_onboard_required} />
			<label for="meal-no" class="label">No</label>
		</div>
		<br />
		<hr />
		<h2 class="heading">Additional Traveller</h2>
		<p>
			<input type="checkbox" bind:checked={showAdditionalTraveller} />
			&nbsp;&nbsp;Should there be more than one (1) traveller
		</p>
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
		{#if showAdditionalTraveller}
			<h3 class="heading">Additional Traveller Information</h3>
			<div class="forms-p">
				<label for="traveller-2-name" class="forms-label">Traveller Name:</label>
				<input id="traveller-2-name" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-ic-passport" class="forms-label">IC or Passport No.:</label>
				<input id="traveller-2-ic-passport" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-company" class="forms-label">Company:</label>
				<input id="traveller-2-company" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-position" class="forms-label">Position:</label>
				<input id="traveller-2-position" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-department" class="forms-label">Department:</label>
				<select id="traveller-2-department" class="select">
					<option value="" disabled selected></option>
					<option value="Project">Project</option>
					<option value="OSH">OSH</option>
				</select>
			</div>
			<div class="forms-p">
				<label for="traveller-2-phone-no" class="forms-label">Phone No.:</label>
				<input id="traveller-2-phone-no" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-mode-of-travel" class="forms-label">Mode of Travel:</label>
				<select id="traveller-2-mode-of-travel" class="select">
					<option value="" disabled selected></option>
					<option value="Road">Road</option>
					<option value="Company-Vehicle">Company Vehicle</option>
					<option value="Air">Air</option>
				</select>
			</div>
			<div class="forms-p">
				<label for="traveller-2-fare-borne-by" class="forms-label">Fare to be Borne by:</label>
				<select id="traveller-2-fare-borne-by" class="select">
					<option value="" disabled selected></option>
					<option value="boilermech">Boilermech Sdn Bhd</option>
					<option value="bm-greentech">BM GreenTech Bhd</option>
					<option value="zenith">Zenith Index Sdn Bhd</option>
					<option value="others">Others - Clients/Sub-Contractor/Supplier</option>
					<option value="oretech">Boilermech Oretech Sdn Bhd</option>
				</select>
			</div>
		{/if}
		<br />
		<hr />
		<h2 class="heading">Acknowledgement and Submission</h2>
		<div class="container">
			<div class="checkbox">
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} />
			</div>
			<div class="declaration">
				<p>The declaration for the Staff Claim Form Report as below:</p>
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
		background-color: #091747;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	#button-search {
		height: 30px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
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

	.forms-input {
		height: 30px;
		width: 500px;
		font-size: 14px;
	}

	.forms-label {
		width: 200px;
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

	.select {
		height: 30px;
		width: 500px;
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

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.project-box {
			margin: 8px;
			padding: 10px;
		}

		.heading {
			font-size: 18px;
		}

		.forms-input,
		.select {
			width: 100%;
			max-width: 100%;
		}

		.forms-label {
			width: 200px;
		}

		#button-search {
			height: 34px;
		}

		.forms-p:has(input[type='radio']) {
			flex-wrap: wrap;
			align-items: flex-start;
		}

		.label {
			white-space: nowrap;
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

		.heading {
			font-size: 17px;
		}

		.project-box {
			margin: 6px;
			padding: 8px;
		}

		.forms-p {
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
		}

		.forms-label {
			width: 100%;
			font-size: 13px;
		}

		.forms-input,
		.select {
			width: 100%;
			height: 34px;
			font-size: 13px;
		}

		.forms-p:has(#button-search) {
			flex-direction: row;
			align-items: center;
			flex-wrap: wrap;
			gap: 8px;
		}

		.forms-p:has(#button-search) .forms-label {
			flex-basis: 100%;
		}

		#button-search {
			height: 34px;
			min-width: 44px;
		}

		.forms-p:has(input[type='radio']) {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
		}

		.forms-p:has(input[type='radio']) .forms-label {
			flex-basis: 100%;
		}

		.label {
			margin-right: 6px;
		}

		.button-primary,
		.button-submit {
			width: 100%;
			justify-content: center;
		}

		.submit {
			justify-content: center;
		}

		.container {
			gap: 10px;
		}

		.declaration {
			padding: 0;
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