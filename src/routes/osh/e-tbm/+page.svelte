<script>
	import Search from '@lucide/svelte/icons/search';
	import Spinner from '$lib/components/Spinner.svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';
	import Modal from '$lib/components/Modal.svelte';
	import { toast } from '$lib/stores/toast';
	import { getSubmitLocation, sendToMake } from '$lib/make';

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
	let meeting_date = '';
	let weather = '';
	let meeting_topics = [];
	let other_topic = '';
	let otherTopicChecked = false;
	let competency = {
		mobile_crane_operator: '',
		mobile_crane_pma: '',
		sky_lift_operator: '',
		scaffold_inspector_2_3: '',
		scaffold_inspector_1: '',
		authorised_gas_tester: '',
		entry_supervisor: '',
		lifting_supervisor: '',
		signalman: '',
		rigger_slinger: '',
		backhoe: '',
		forklift: ''
	};
	let conducted_by = '';
	let conducted_position = '';
	let attendance = {
		project_engineer: 0,
		project_supervisor: 0,
		sho: 0,
		sss: 0,
		oshc_supervisor: 0,
		oshc_worker: 0,
		non_oshc_supervisor: 0,
		non_oshc_worker: 0,
		bme_worker: 0,
		other: 0
	};
	let tbm_form_path = '';
	let tbm_photo_path = '';
	let ptw_form_path = '';
	let other_doc_path = '';
	let remarks = '';
	let acknowledged = false;
	let created_at = '';
	let created_by = '';

	const topics = [
		'Basic First Aid',
		'Chemical Handling',
		'Company Policy and Rules',
		'Confined Space',
		'Electrical Safety',
		'Emergency Response Plan',
		'Equipment Inspection',
		'Evacuation Point',
		'Fire Emergency',
		'Heavy Lifting',
		'HIRARC',
		'Hot Work Procedure',
		'Housekeeping',
		'Material Handling / Storage',
		'Permit to Work',
		'Personal Protective Equipment',
		'Scaffolding',
		'Warning / Barricade / Signboard',
		'Working at Height'
	];
	const attendanceItem = [
		{ key: 'project_engineer', label: 'No. of Project Engineer:' },
		{ key: 'project_supervisor', label: 'No. of Project Supervisor:' },
		{ key: 'sho', label: 'No. of Safety & Health Officer:' },
		{ key: 'sss', label: 'No. of Site Safety Supervisor:' },
		{ key: 'oshc_supervisor', label: 'No. of Contractor Supervisor (OSH-C):' },
		{ key: 'oshc_worker', label: 'No. of Contractor Worker (OSH-C):' },
		{ key: 'non_oshc_supervisor', label: 'No. of Contractor Supervisor (non OSH-C):' },
		{ key: 'non_oshc_worker', label: 'No. of Contractor Worker (non OSH-C):' },
		{ key: 'bme_worker', label: 'No. of BME Worker:' },
		{ key: 'other', label: 'No. of Other:' }
	];

	let tbm_form_file;
	let tbm_photo_file;
	let ptw_form_file;
	let other_doc_file;

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
			.from('tbm_uploads')
			.upload(path, file, { upsert: false });

		if (error) {
			console.error('[upload] error', error);
			throw error;
		}

		return data.path;
	}

	async function handleSubmit(e) {
		e.preventDefault();
		errorMsg = '';
		saving = true;

		try {
			const locationPromise = getSubmitLocation();

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

			const [tbm_form_path, tbm_photo_path, ptw_form_path, other_doc_path] = await Promise.all([
				withTimeout(uploadToBucket(tbm_form_file, 'tbm_form')),
				withTimeout(uploadToBucket(tbm_photo_file, 'tbm_session')),
				withTimeout(uploadToBucket(ptw_form_file, 'ptw_form')),
				withTimeout(uploadToBucket(other_doc_file, 'other_doc'))
			]);

			const payload = {
				project_name,
				project_no,
				region,
				location,
				meeting_date,
				weather,
				meeting_topics: otherTopicChecked ? [...meeting_topics, 'Other'] : meeting_topics,
				other_topic: otherTopicChecked ? other_topic : null,
				competency,
				attendance,
				conducted_by,
				conducted_position,
				tbm_form_path,
				tbm_photo_path,
				ptw_form_path,
				other_doc_path,
				remarks,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { data: saved, error: insErr } = await withTimeout(
				supabase.from('tbm_submissions').insert(payload).select('id').single(),
				15000
			);
			if (insErr) throw insErr;

			const sent = await sendToMake('tbm', saved.id, {
				submitLocation: await locationPromise
			});
			if (sent.ok) toast.success('e-TBM submitted successfully.');
			else toast.error(`e-TBM was saved, but it could not be sent to Make: ${sent.error}`);
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

<h1 class="title">Tool Box Meeting Report (e-TBM) Submission</h1>

<div class="project-box">
	<form class="forms" onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}>
			<Search />Search Project
		</button>
		<div class="forms-p">
			<label for="project-name" class="forms-label">Project Name:</label>
			<input type="text" class="forms-input" bind:value={project_name} disabled />
		</div>
		<div class="forms-p">
			<label for="project-no" class="forms-label">Project No.:</label>
			<input type="text" class="forms-input" bind:value={project_no} disabled />
		</div>
		<div class="forms-p">
			<label for="project-region" class="forms-label">Region:</label>
			<input type="text" class="forms-input" bind:value={region} disabled />
		</div>
		<div class="forms-p">
			<label for="project-location" class="forms-label">Location:</label>
			<input type="text" class="forms-input" bind:value={location} disabled />
		</div>
		<div class="forms-p">
			<label for="project-date" class="forms-label">Meeting Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={meeting_date}
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
		<h2 class="heading">Meeting Topics</h2>
		<div class="topics-grid">
			{#each topics as topic}
				<label for="" class="topic-item">
					<input type="checkbox" value={topic} bind:group={meeting_topics} />
					{topic}
				</label>
			{/each}
			<label class="topic-item"
				><input type="checkbox" bind:checked={otherTopicChecked} />
				Other Topics: <input type="text" class="topic-input" bind:value={other_topic} />
			</label>
		</div>
		<br />
		<hr />
		<h2 class="heading">Competency</h2>
		<p class="note">
			Note: Please tick if these activities were performed for the day and if the Trained Person has
			the relevant Permit / License / Certificate of Attendance.
		</p>
		<div class="categories">
			<p class="categories-criteria">Competent Person</p>
			<p class="categories-radio">Permit/License</p>
		</div>
		<div class="competency-grid">
			<p>1) Mobile Crane - Operator Certificate</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-1"
					bind:group={competency.mobile_crane_operator}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-1"
					bind:group={competency.mobile_crane_operator}
					value="no"
				/>No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-1"
					bind:group={competency.mobile_crane_operator}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>2) Mobile Crane - Perakuan Mesin Angkat (PMA)</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-2"
					bind:group={competency.mobile_crane_pma}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="cp-2" bind:group={competency.mobile_crane_pma} value="no" />No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-2"
					bind:group={competency.mobile_crane_pma}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>3) Sky Lift Operator- Perakuan Mesin Angkat (PMA)</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-3"
					bind:group={competency.sky_lift_operator}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="cp-3" bind:group={competency.sky_lift_operator} value="no" />No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-3"
					bind:group={competency.sky_lift_operator}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>4) Scaffold Inspector Level 2 / 3</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-4"
					bind:group={competency.scaffold_inspector_2_3}
					value="yes"
					required
				/>Yes-Level 2
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-4"
					bind:group={competency.scaffold_inspector_2_3}
					value="no"
				/>Yes-Level 3
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-4"
					bind:group={competency.scaffold_inspector_2_3}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>5) Scaffold Inspector Level 1</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-5"
					bind:group={competency.scaffold_inspector_1}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="cp-5" bind:group={competency.scaffold_inspector_1} value="no" />No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-5"
					bind:group={competency.scaffold_inspector_1}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>6) Authorised Gas Tester</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-6"
					bind:group={competency.authorised_gas_tester}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-6"
					bind:group={competency.authorised_gas_tester}
					value="no"
				/>No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-6"
					bind:group={competency.authorised_gas_tester}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>7) Entry Supervisor</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-7"
					bind:group={competency.entry_supervisor}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="cp-7" bind:group={competency.entry_supervisor} value="no" />No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="cp-7"
					bind:group={competency.entry_supervisor}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<br />
		<div class="categories">
			<p class="categories-criteria">Trained Person</p>
			<p class="categories-radio">Certificate of Attendance</p>
		</div>
		<div class="competency-grid">
			<p>1) Lifting Supervisor</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="tp-1"
					bind:group={competency.lifting_supervisor}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-1" bind:group={competency.lifting_supervisor} value="no" />No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="tp-1"
					bind:group={competency.lifting_supervisor}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>2) Signalman</p>
			<p class="competency-radio">
				<input type="radio" name="tp-2" bind:group={competency.signalman} value="yes" required />Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-2" bind:group={competency.signalman} value="no" />No
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-2" bind:group={competency.signalman} value="no_activity" />No
				Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>3) Rigger and Slinger</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="tp-3"
					bind:group={competency.rigger_slinger}
					value="yes"
					required
				/>Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-3" bind:group={competency.rigger_slinger} value="no" />No
			</p>
			<p class="competency-radio">
				<input
					type="radio"
					name="tp-3"
					bind:group={competency.rigger_slinger}
					value="no_activity"
				/>No Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>4) Backhoe</p>
			<p class="competency-radio">
				<input type="radio" name="tp-4" bind:group={competency.backhoe} value="yes" required />Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-4" bind:group={competency.backhoe} value="no" />No
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-4" bind:group={competency.backhoe} value="no_activity" />No
				Activity
			</p>
		</div>
		<div class="competency-grid">
			<p>5) Forklift</p>
			<p class="competency-radio">
				<input type="radio" name="tp-5" bind:group={competency.forklift} value="yes" required />Yes
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-5" bind:group={competency.forklift} value="no" />No
			</p>
			<p class="competency-radio">
				<input type="radio" name="tp-5" bind:group={competency.forklift} value="no_activity" />No
				Activity
			</p>
		</div>
		<br />
		<hr />
		<h2 class="heading">Attendance Information</h2>
		<div class="forms-p">
			<label for="project-name" class="forms-label">Conducted By:</label>
			<input type="text" class="forms-input" bind:value={conducted_by} required />
		</div>
		<div class="forms-p">
			<label for="project-no" class="forms-label">Position:</label>
			<input type="text" class="forms-input" bind:value={conducted_position} required />
		</div>
		<div class="attendance-grid">
			{#each attendanceItem as item (item.key)}
				<div class="attendance-type">
					<label for={item.key} class="attendance-label">{item.label}</label>
					<input
						type="number"
						id={item.key}
						min="0"
						pattern="[0-9]*"
						class="attendance-count"
						bind:value={attendance[item.key]}
						required
					/>
				</div>
			{/each}
		</div>
		<br />
		<hr />
		<h2 class="heading">Daily Toolbox / Safety Briefing Attendance List</h2>
		<p class="note">
			Please upload photo to show a list of all the attendees i.e. name, designation, company and
			signature
		</p>
		<p><b><i>Sample:</i></b></p>
		<img src="/images/sample-attendees.png" alt="Sample Attendees Form" width="40%" />
		<h2 class="heading">Photo of Filled TBM Form</h2>
		<div class="upload">
			<p class="upload-text">
				<input
					type="file"
					id="tbm_form"
					name="tbm_form"
					accept="image/png, image/jpeg"
					multiple
					onchange={(e) => (tbm_form_file = e.target.files[0])}
					required
				/>
			</p>
		</div>
		<h2 class="heading">Photos of TBM in Session</h2>
		<p class="note">Note: All attending personnel should be in full PPE</p>
		<div class="upload">
			<p class="upload-text">
				<input
					type="file"
					id="tbm_photo"
					name="tbm_photo"
					accept="image/png, image/jpeg"
					multiple
					onchange={(e) => (tbm_photo_file = e.target.files[0])}
					required
				/>
			</p>
		</div>
		<h2 class="heading">Photo of Filled PTW Form</h2>
		<div class="upload">
			<p class="upload-text">
				<input
					type="file"
					id="ptw_form"
					name="ptw_form"
					accept="image/png, image/jpeg"
					multiple
					onchange={(e) => (ptw_form_file = e.target.files[0])}
					required
				/>
			</p>
		</div>
		<h2 class="heading">Another Document or Image</h2>
		<div class="upload">
			<p class="upload-text">
				<input
					type="file"
					id="other_doc"
					name="other_doc"
					accept="image/png, image/jpeg"
					multiple
					onchange={(e) => (other_doc_file = e.target.files[0])}
				/>
			</p>
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
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Tool Box Meeting Report as below:</p>
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

	.attendance-count {
		width: 30px;
		height: 30px;
		font-size: 14px;
		padding: 1px;
		text-align: center;
	}

	.attendance-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px 20px;
	}

	.attendance-label {
		width: 275px;
		font-size: 14px;
	}

	.attendance-type {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	button {
		background-color: #093d85;
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

	.categories {
		margin: 10px 0;
		display: grid;
		grid-template-columns: minmax(280px, 1.3fr) 1fr 1fr 1.3fr;
		font-weight: bold;
	}

	.categories-criteria {
		grid-column: 1;
		text-align: center;
	}

	.categories-radio {
		grid-column: 3;
		text-align: center;
	}

	.competency-grid {
		margin-top: 5px;
		display: grid;
		grid-template-columns: minmax(280px, 1.3fr) 1fr 1fr 1.3fr;
		border: 1px solid #091747b9;
		border-radius: 2px;
		padding: 10px;
	}

	.competency-radio {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
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

	hr {
		color: #091747;
	}

	.note {
		margin-bottom: 10px;
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

	.topics-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 10px 20px;
	}

	.topic-input {
		height: 25px;
		width: 150px;
		font-size: 14px;
	}

	.topic-item {
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
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
		.forms-input {
			width: 100%;
			max-width: 100%;
		}

		.project-box {
			margin: 8px;
			padding: 12px;
		}

		.title {
			font-size: 24px;
			margin-bottom: 12px;
		}

		.heading {
			font-size: 18px;
		}

		.forms-p {
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
		}

		.forms-label {
			width: auto;
		}

		.button-primary {
			width: 100%;
			justify-content: center;
		}

		.topics-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 10px 12px;
		}

		.topic-item {
			white-space: normal;
			align-items: flex-start;
		}

		.topic-input {
			width: 100%;
			max-width: 100%;
		}

		.attendance-grid {
			grid-template-columns: 1fr;
			gap: 10px;
		}

		.attendance-type {
			justify-content: space-between;
			width: 100%;
		}

		.attendance-label {
			width: auto;
			max-width: 75%;
			white-space: normal;
			word-break: break-word;
		}

		.attendance-count {
			width: 70px;
		}

		.categories,
		.competency-grid {
			grid-template-columns: 260px 90px 90px 120px;
		}

		.categories,
		.competency-grid {
			overflow-x: auto;
		}

		.upload {
			height: auto;
			min-height: 140px;
			padding: 14px;
		}

		.project-list-header,
		.project-row {
			grid-template-columns: 1.4fr 1fr;
		}

		p,
		label,
		.note,
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
			font-size: 16px;
		}

		.topics-grid {
			grid-template-columns: 1fr;
		}

		.categories {
			grid-template-columns: 1fr;
		}

		.categories-criteria {
			text-align: left;
		}

		.categories-radio {
			display: none;
		}

		.competency-grid {
			grid-template-columns: repeat(3, auto);
			justify-content: start;
			gap: 6px 18px;
			padding: 8px 10px;
			overflow: visible;
		}

		.competency-grid > p:first-child {
			grid-column: 1 / -1;
		}

		.competency-radio {
			justify-content: flex-start;
		}

		.container {
			gap: 10px;
		}

		.declaration {
			padding: 0;
		}

		.submit {
			justify-content: stretch;
		}

		.button-submit {
			width: 100%;
			justify-content: center;
		}
	}
</style>