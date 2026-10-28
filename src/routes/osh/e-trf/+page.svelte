<script>
	import { validation, checkSubmit } from '$lib/validation';
	import FileText from '@lucide/svelte/icons/file-text';
	import Spinner from '$lib/components/Spinner.svelte';
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

	function toMalaysiaTimestamp(value) {
		if (!value) return null;
		const withSeconds = value.length === 16 ? `${value}:00` : value;
		return `${withSeconds}+08:00`;
	}

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
				travel_date_time: toMalaysiaTimestamp(travel_date_time),
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

			toast.success('e-TRF submitted successfully.');
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
		project_no = project.project_id ?? '';
		closeProjectModal();
	}
</script>

<h1 class="title">Travel Requisition Form Report (e-TRF) Submission</h1>

<div class="project-box">
	<form class="forms" use:validation onsubmit={handleSubmit}>
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
			<input type="text" class="forms-input" bind:value={traveller_phone_no} />
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
			<input
				type="datetime-local"
				id="travel-date-time"
				class="forms-input"
				bind:value={travel_date_time}
				required
			/>
		</div>
		<div class="forms-p">
			<label for="travel-purpose" class="forms-label">Purpose of Travel:</label>
			<input type="text" class="forms-input" bind:value={travel_purpose} required />
		</div>
		<div class="forms-p">
			<label for="project-id" class="forms-label">Project No.:</label>
			<input required type="text" class="forms-input" bind:value={project_no} readonly />
			<button type="button" class="button-primary" onclick={openProjectModal} id="button-search"
				><Search size={16} />Search Project</button
			>
		</div>
		<div class="forms-p">
			<label for="travel-airline" class="forms-label">Preferred Airline:</label>
			<input type="text" class="forms-input" bind:value={travel_airline} />
		</div>
		<div class="forms-p">
			<label for="travel-flight-no" class="forms-label">Flight No.:</label>
			<input type="text" class="forms-input" bind:value={travel_flight_no} />
		</div>
		<div class="forms-p">
			<span class="forms-label" data-label-for="baggage-weight">Baggage Required (kg):</span>
			<input required
				type="radio"
				name="baggage-weight"
				id="15-kg"
				value="15"
				bind:group={travel_baggage_required}
			/>
			<label for="15-kg" class="label">15</label>
			<input
				type="radio"
				name="baggage-weight"
				id="20-kg"
				value="20"
				bind:group={travel_baggage_required}
			/>
			<label for="20-kg" class="label">20</label>
			<input
				type="radio"
				name="baggage-weight"
				id="30-kg"
				value="30"
				bind:group={travel_baggage_required}
			/>
			<label for="30-kg" class="label">30</label>
		</div>
		<div class="forms-p">
			<span class="forms-label" data-label-for="meal-onboard">Meal Onboard Required:</span>
			<input required
				type="radio"
				name="meal-onboard"
				id="meal-yes"
				value="Yes"
				bind:group={meal_onboard_required}
			/>
			<label for="meal-yes" class="label">Yes</label>
			<input
				type="radio"
				name="meal-onboard"
				id="meal-no"
				value="No"
				bind:group={meal_onboard_required}
			/>
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
		{#if showAdditionalTraveller}
			<h3 class="heading">Additional Traveller Information</h3>
			<div class="forms-p">
				<label for="traveller-2-name" class="forms-label">Traveller Name:</label>
				<input required id="traveller-2-name" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-ic-passport" class="forms-label">IC or Passport No.:</label>
				<input required id="traveller-2-ic-passport" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-company" class="forms-label">Company:</label>
				<input required id="traveller-2-company" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-position" class="forms-label">Position:</label>
				<input required id="traveller-2-position" type="text" class="forms-input" />
			</div>
			<div class="forms-p">
				<label for="traveller-2-department" class="forms-label">Department:</label>
				<select required id="traveller-2-department" class="select">
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
				<select required id="traveller-2-mode-of-travel" class="select">
					<option value="" disabled selected></option>
					<option value="Road">Road</option>
					<option value="Company-Vehicle">Company Vehicle</option>
					<option value="Air">Air</option>
				</select>
			</div>
			<div class="forms-p">
				<label for="traveller-2-fare-borne-by" class="forms-label">Fare to be Borne by:</label>
				<select required id="traveller-2-fare-borne-by" class="select">
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
		<h2 class="heading" data-label-for="checkbox">Acknowledgement and Submission</h2>
		<div class="container" data-field>
			<div class="checkbox">
				<input data-label="Acknowledgement" required type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} />
			</div>
			<div class="declaration">
				<p>The declaration for the Travel Requisition Form is as below.</p>
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
	#button-search {
		height: 30px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.container {
		display: flex;
		margin: 10px 0;
	}

	.select {
		height: 30px;
		width: 500px;
		font-size: 14px;
	}

	ul {
		list-style-type: circle;
		margin: 0 0 10px 15px;
	}

	@media (max-width: 1024px) {
		.forms-input,
		.select {
			width: 100%;
			max-width: 100%;
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

		p,
		label,
		.declaration p {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}
	}

	@media (max-width: 600px) {
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

		.container {
			gap: 10px;
		}
	}
</style>