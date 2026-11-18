<script>
	import { validation, checkSubmit } from '$lib/validation';
	import Search from '@lucide/svelte/icons/search';
	import Spinner from '$lib/components/Spinner.svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { requireUser } from '$lib/auth-guard';
	import Modal from '$lib/components/Modal.svelte';
	import { toast } from '$lib/stores/toast';
	import { getSubmitLocation, sendToMake, warnIfNoLocation } from '$lib/make';

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
	let activity_date = '';
	let weather = '';
	let hkp_photo_path = '';
	let report_day = {
		site_walk: 0,
		high_risk: 0,
		uauc: 0,
		good_practice: 0,
		stop_work: 0,
		lt_injuries: 0,
		nlt_injuries: 0,
		opd: 0,
		near_miss: 0,
		non_compliance: 0,
		sd_occurrence: 0
	};
	let remarks = '';

	let uauc_description = '';
	let uauc_corrective_action = '';
	let good_practice_details = '';
	let stop_work_description = '';
	let injury_remarks = '';
	let acknowledged = false;
	let created_at = '';
	let created_by = '';

	const reportBlocks = [
		{
			title: '',
			items: [
				{ key: 'site_walk', label: 'No. of Site Walk:' },
				{ key: 'high_risk', label: 'No. of High-risk Activities Observed:' },
				{ key: 'uauc', label: 'No. of Unsafe Act Unsafe Condition (UAUC):' },
				{ key: 'good_practice', label: 'Good Practice:' },
				{ key: 'stop_work', label: 'No. of Stop Work:' }
			]
		},
		{
			title: 'Injuries',
			items: [
				{ key: 'lt_injuries', label: 'No. of Accidents (Lost Time Injuries):' },
				{ key: 'nlt_injuries', label: 'No. of Accidents (No Lost Time Injuries):' }
			]
		},
		{
			title: 'Non-Injuries',
			items: [
				{ key: 'opd', label: 'No. of Established Occupational Poisoning or Disease (OPD):' },
				{ key: 'near_miss', label: 'No. of Near Miss Incident:' },
				{ key: 'non_compliance', label: 'No. of Non Compliance:' }
			]
		},
		{
			title: '',
			items: [
				{
					key: 'sd_occurrence',
					label: 'No. of Significant Safety Occurrence / Dangerous Occurrence:'
				}
			]
		}
	];

	const INJURY_KEYS = ['lt_injuries', 'nlt_injuries', 'opd', 'near_miss', 'non_compliance'];

	function toCount(value) {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}

	$: showUauc = toCount(report_day.uauc) >= 1;
	$: showGoodPractice = toCount(report_day.good_practice) >= 1;
	$: showStopWork = toCount(report_day.stop_work) >= 1;
	$: showInjuryRemarks = INJURY_KEYS.some((key) => toCount(report_day[key]) >= 1);

	let uaucSection;
	let goodPracticeSection;
	let stopWorkSection;
	let injurySection;

	const wasShown = {};
	async function revealSection(name, shown, getElement) {
		const justOpened = shown && !wasShown[name];
		wasShown[name] = shown;
		if (!justOpened) return;
		await tick();
		const el = getElement();
		if (!el) return;
		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
	}

	$: revealSection('uauc', showUauc, () => uaucSection);
	$: revealSection('good_practice', showGoodPractice, () => goodPracticeSection);
	$: revealSection('stop_work', showStopWork, () => stopWorkSection);
	$: revealSection('injury', showInjuryRemarks, () => injurySection);

	let uauc_photo_file = null;
	let good_practice_photo_file = null;
	let stop_work_photo_file = null;

	$: if (!showUauc) {
		uauc_photo_file = null;
		uauc_description = '';
		uauc_corrective_action = '';
	}
	$: if (!showGoodPractice) {
		good_practice_photo_file = null;
		good_practice_details = '';
	}
	$: if (!showStopWork) {
		stop_work_photo_file = null;
		stop_work_description = '';
	}
	$: if (!showInjuryRemarks) injury_remarks = '';

	let hkp_photo_file;

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
			.from('hkp_uploads')
			.upload(path, file, { upsert: false });

		if (error) {
			console.error('[upload error', error);
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
				supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single(),
				15000
			);

			if (profileError) throw profileError;

			const submitterName =
				`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;

			const hkp_photo_path = await withTimeout(uploadToBucket(hkp_photo_file, 'hkp_site'));

			const [uauc_photo_path, good_practice_photo_path, stop_work_photo_path] = await Promise.all([
				showUauc ? withTimeout(uploadToBucket(uauc_photo_file, 'hkp_uauc')) : null,
				showGoodPractice
					? withTimeout(uploadToBucket(good_practice_photo_file, 'hkp_good_practice'))
					: null,
				showStopWork ? withTimeout(uploadToBucket(stop_work_photo_file, 'hkp_stop_work')) : null
			]);

			const submit_location = await locationPromise;
			warnIfNoLocation(submit_location);

			const payload = {
				project_name,
				project_no,
				region,
				location,
				activity_date,
				weather,
				hkp_photo_path,
				report_day,
				uauc_description: showUauc ? uauc_description.trim() : null,
				uauc_corrective_action: showUauc ? uauc_corrective_action.trim() : null,
				uauc_photo_path,
				good_practice_details: showGoodPractice ? good_practice_details.trim() : null,
				good_practice_photo_path,
				stop_work_description: showStopWork ? stop_work_description.trim() : null,
				stop_work_photo_path,
				injury_remarks: showInjuryRemarks ? injury_remarks.trim() : null,
				remarks,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName,
				submit_location: submit_location || null
			};

			const { data: saved, error: insErr } = await withTimeout(
				supabase.from('hkp_submissions').insert(payload).select('id').single(),
				15000
			);
			if (insErr) throw insErr;

			const sent = await sendToMake('hkp', saved.id, {
				submitLocation: submit_location
			});
			if (sent.ok) toast.success('e-HKP submitted successfully.');
			else toast.error(`e-HKP was saved, but it could not be sent to Make: ${sent.error}`);
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

<h1 class="title">Housekeeping Report (e-HKP) Submission</h1>

<div class="project-box">
	<form class="forms" use:validation onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}
			><Search />Search Project</button
		>
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
			<label for="project-date" class="forms-label">Activity Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={activity_date}
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
		<h2 class="heading" data-label-for="hkp_photo">Photos of Housekeeping</h2>
		<div class="upload">
			<p class="upload-text">
				<input
					type="file"
					id="hkp_photo"
					name="hkp_photo"
					accept="image/png, image/jpeg"
					multiple
					onchange={(e) => (hkp_photo_file = e.target.files[0])}
					required
				/>
			</p>
		</div>
		<br />
		<hr />
		<h2 class="heading">Report for the Day</h2>
		<div class="report-group">
			{#each reportBlocks as block}
				<div class="report-block" class:report-category={block.title}>
					{#if block.title}
						<h3 class="report-category-title">{block.title}</h3>
					{/if}
					<div class="report-grid">
						{#each block.items as item (item.key)}
							<div class="report-type">
								<label for={item.key} class="report-label"><b>{item.label}</b></label>
								<input required
									type="number"
									id={item.key}
									min="0"
									pattern="[0-9]*"
									class="report-count"
									bind:value={report_day[item.key]}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		{#if showUauc}
			<div class="detail-box" bind:this={uaucSection}>
				<h3 class="detail-title">Unsafe Act Unsafe Conditions Details</h3>
				<div class="detail-field">
					<label for="uauc_description" class="forms-label">Description:</label>
					<textarea
						id="uauc_description"
						rows="4"
						class="remarks"
						placeholder="Description"
						bind:value={uauc_description}
						required
					></textarea>
				</div>
				<div class="detail-field">
					<label for="uauc_corrective_action" class="forms-label">Corrective Action:</label>
					<textarea
						id="uauc_corrective_action"
						rows="4"
						class="remarks"
						placeholder="Corrective Action"
						bind:value={uauc_corrective_action}
						required
					></textarea>
				</div>
				<div class="detail-field">
					<h4 class="detail-label" data-label-for="uauc_photo">Photo of UAUC:</h4>
					<div class="upload">
						<p class="upload-text">
							<input
								type="file"
								id="uauc_photo"
								name="uauc_photo"
								accept="image/png, image/jpeg"
								onchange={(e) => onFile(e, (f) => (uauc_photo_file = f))}
								required
							/>
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if showGoodPractice}
			<div class="detail-box" bind:this={goodPracticeSection}>
				<h3 class="detail-title">Good Practice</h3>
				<div class="detail-field">
					<label for="good_practice_details" class="forms-label">Details:</label>
					<textarea
						id="good_practice_details"
						rows="4"
						class="remarks"
						placeholder="Details"
						bind:value={good_practice_details}
						required
					></textarea>
				</div>
				<div class="detail-field">
					<h4 class="detail-label" data-label-for="good_practice_photo">Photo of Practice:</h4>
					<div class="upload">
						<p class="upload-text">
							<input
								type="file"
								id="good_practice_photo"
								name="good_practice_photo"
								accept="image/png, image/jpeg"
								onchange={(e) => onFile(e, (f) => (good_practice_photo_file = f))}
								required
							/>
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if showStopWork}
			<div class="detail-box" bind:this={stopWorkSection}>
				<h3 class="detail-title">Stop Work Details</h3>
				<div class="detail-field">
					<label for="stop_work_description" class="forms-label">Description:</label>
					<textarea
						id="stop_work_description"
						rows="4"
						class="remarks"
						placeholder="Description"
						bind:value={stop_work_description}
						required
					></textarea>
				</div>
				<div class="detail-field">
					<h4 class="detail-label" data-label-for="stop_work_photo">Photo of Stop Work:</h4>
					<div class="upload">
						<p class="upload-text">
							<input
								type="file"
								id="stop_work_photo"
								name="stop_work_photo"
								accept="image/png, image/jpeg"
								onchange={(e) => onFile(e, (f) => (stop_work_photo_file = f))}
								required
							/>
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if showInjuryRemarks}
			<div class="detail-box" bind:this={injurySection}>
				<h3 class="detail-title">Injuries or Non-Injuries Details</h3>
				<div class="detail-field">
					<label for="injury_remarks" class="forms-label">Remark:</label>
					<textarea
						id="injury_remarks"
						rows="4"
						class="remarks"
						placeholder="Remark"
						bind:value={injury_remarks}
						required
					></textarea>
				</div>
			</div>
		{/if}
		<hr />
		<h2 class="heading">Remarks</h2>
		<p>
			<textarea
				name="remarks"
				id="remarks"
				cols="30"
				rows="5"
				class="remarks"
				placeholder="Remarks"
				bind:value={remarks}
			></textarea>
		</p>
		<p class="note">
			For any case reported above, please attached the Incident Reporting Form which can be obtained <a
				href="https://boilermechhr.com/databases/intranet-employee-view?open-modal=3712&resource=intranet-employee-view"
				>here</a
			>.
		</p>
		<h2 class="heading" data-label-for="checkbox">Acknowledgement and Submission</h2>
		<div class="container" data-field>
			<div class="checkbox">
				<input data-label="Acknowledgement" type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Housekeeping Report is as below.</p>
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
	a {
		text-decoration: underline;
		font-weight: 600;
	}

	.container {
		display: flex;
		margin: 10px 0;
	}

	.note {
		margin-bottom: 10px;
	}

	.report-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.report-category {
		margin: 14px 0 6px;
	}

	.report-category-title {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
	}

	.report-category .report-label::before {
		content: "\2022";
		font-weight: bold;
		display: inline-block;
		width: 1em;
	}

	.detail-box {
		margin: 18px 0;
		padding: 16px 18px;
		border: 2px solid var(--brand);
		border-radius: var(--r-lg);
		background-color: var(--surface);
		scroll-margin-top: 90px;
	}

	.detail-title {
		margin: 0 0 12px;
		font-size: 17px;
		font-weight: 700;
	}

	.detail-field {
		margin-bottom: 14px;
	}

	.detail-field .forms-label,
	.detail-label {
		display: block;
		width: auto;
		margin: 0 0 6px;
		font-size: 14px;
		font-weight: 600;
	}

	.report-count {
		width: 64px;
		height: 30px;
		font-size: 14px;
		padding: 1px;
		text-align: center;
	}

	.report-label {
		width: 450px;
		font-size: 14px;
	}

	.report-type {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;
	}

	ul {
		list-style-type: circle;
		margin: 0 0 10px 15px;
	}

	@media (max-width: 1024px) {
		.report-type {
			align-items: flex-start;
			justify-content: space-between;
			gap: 10px;
		}

		.report-label {
			width: auto;
			max-width: 75%;
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.report-count {
			width: 70px;
		}

		p,
		label,
		.note,
		.declaration p,
		a {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}
	}

	@media (max-width: 600px) {
		.container {
			gap: 10px;
		}

		.report-grid {
			display: block;
		}

		.report-type {
			gap: 20px;
		}
	}
</style>