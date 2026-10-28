<script>
	import { validation, checkSubmit } from '$lib/validation';
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
		if (!checkSubmit(e)) return;
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
	<form class="forms" use:validation onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}>
			<Search />Search Project
		</button>
		<div class="forms-p">
			<label for="project-name" class="forms-label">Project Name:</label>
			<input data-message="Select a project using Search Project." required type="text" class="forms-input" bind:value={project_name} readonly />
		</div>
		<div class="forms-p">
			<label for="project-no" class="forms-label">Project No.:</label>
			<input required type="text" class="forms-input" bind:value={project_no} readonly />
		</div>
		<div class="forms-p">
			<label for="project-region" class="forms-label">Region:</label>
			<input required type="text" class="forms-input" bind:value={region} readonly />
		</div>
		<div class="forms-p">
			<label for="project-location" class="forms-label">Location:</label>
			<input required type="text" class="forms-input" bind:value={location} readonly />
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
		<h2 class="heading" data-label-for="meeting-topics">Meeting Topics</h2>
		<div class="topics-grid" data-checkbox-group="meeting-topics"
			data-required
			data-message="Select at least one meeting topic."
		>
			{#each topics as topic}
				<label for="" class="topic-item">
					<input type="checkbox" value={topic} bind:group={meeting_topics} />
					{topic}
				</label>
			{/each}
			<div class="topic-other">
				<label class="topic-item">
					<input type="checkbox" bind:checked={otherTopicChecked} />
					Other Topics
				</label>
				{#if otherTopicChecked}
					<input
						type="text"
						class="topic-input"
						placeholder="Please specify"
						aria-label="Other topic"
						bind:value={other_topic}
						required
					/>
				{/if}
			</div>
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
		<div class="competency-grid" data-field>
			<p data-label-for="cp-1">1) Mobile Crane - Operator Certificate</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="cp-2">2) Mobile Crane - Perakuan Mesin Angkat (PMA)</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="cp-3">3) Sky Lift Operator- Perakuan Mesin Angkat (PMA)</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="cp-4">4) Scaffold Inspector Level 2 / 3</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="cp-5">5) Scaffold Inspector Level 1</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="cp-6">6) Authorised Gas Tester</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="cp-7">7) Entry Supervisor</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="tp-1">1) Lifting Supervisor</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="tp-2">2) Signalman</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="tp-3">3) Rigger and Slinger</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="tp-4">4) Backhoe</p>
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
		<div class="competency-grid" data-field>
			<p data-label-for="tp-5">5) Forklift</p>
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
		<h2 class="heading" data-label-for="tbm_form">Photo of Filled TBM Form</h2>
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
		<h2 class="heading" data-label-for="tbm_photo">Photos of TBM in Session</h2>
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
		<h2 class="heading" data-label-for="ptw_form">Photo of Filled PTW Form</h2>
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
		<h2 class="heading" data-label-for="checkbox">Acknowledgement and Submission</h2>
		<div class="container" data-field>
			<div class="checkbox">
				<input data-label="Acknowledgement" type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Tool Box Meeting Report is as below.</p>
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
	.attendance-count {
		width: 64px;
		height: 40px;
		font-size: 14px;
		padding: 0 6px;
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

	.categories {
		margin: 10px 0;
		display: grid;
		grid-template-columns: minmax(280px, 1.3fr) 1fr 1fr 1.3fr;
		font-weight: 600;
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
		border: 1px solid var(--line-strong);
		border-radius: var(--r-sm);
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

	hr {
		color: var(--ink);
	}

	.note {
		margin-bottom: 10px;
	}

	.topics-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 10px 20px;
		align-items: start;
	}

	.topic-other {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.topic-input {
		width: 100%;
		font-size: 14px;
	}

	.topic-item {
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	ul {
		list-style-type: circle;
		margin: 0 0 10px 15px;
	}

	@media (max-width: 1024px) {
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
	}
</style>