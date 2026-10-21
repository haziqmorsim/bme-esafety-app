<script>
	/**
	 * @typedef {{ score: number | null }} AuditItem
	 * @typedef {{ items: AuditItem[] }} Subsection
	 */

	import Search from '@lucide/svelte/icons/search';
	import Spinner from '$lib/components/Spinner.svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import Info from '@lucide/svelte/icons/info';
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
	let audit_date = '';
	let showInfo = false;
	let remarks = '';
	let acknowledged = false;
	let created_at = '';
	let created_by = '';

	const MAX_SCORE_PER_ITEM = 5;

	let subsections = [
		{
			key: 'docs',
			title: 'Documentation & Approvals',
			items: [
				{
					label: 'Approved Safety Plan & Risk Assessment (HIRARC) on site',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Document exists but is lacking critical sections or less relevant to current site work.',
						'Incomplete or draft version is available; approval status unclear or still pending.',
						'Document is available but either: Outdated, Unsigned, or Partially approved.',
						'Latest and signed document is available, but accessibility is limited (e.g. only in digital format or stored but not communicated to workers).',
						'Latest version, signed and dated, clearly approved, physically available at the site office, and known to site personnel.'
					]
				},
				{
					label: 'Approved SOPs',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'SOPs exist, but are generic, outdated, or not relevant to current site activities.',
						'Draft or incomplete SOPs are present; site team is unclear on SOPs approval or usage.',
						'SOPs are available but either:Missing one or more activity areas (e.g., no Confined Space SOP), Not specific to site, or Not signed by both Safety & PM.',
						'All SOPs listed are approved and signed, but partially generic (not fully tailored to the site).',
						'All SOPs listed are site-specific, signed by Safety & Project Manager, and accessible on-site.'
					]
				},
				{
					label: 'Daily Toolbox Briefing Records',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Toolbox briefing done verbally but not documented properly or missing signatures/topics.',
						'Some briefings done but records are incomplete, rarely signed, or topics generic.',
						'Briefings conducted irregularly or with partial attendance; some missing signatures or unclear topics.',
						'Briefings are conducted and signed, but some records have less relevant or repeated topics, or occasional missing days.',
						'Daily toolbox briefings are well-documented with relevant topics and full attendance (with signatures) for each day. Consistent practice.'
					]
				},
				{
					label: 'Work Permit Process (Hot works, Confined Space, etc.)',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Work is done without permits, or permits are used only occasionally, with minimal oversight.',
						'Permit system exists but is poorly implemented (e.g., only used reactively or permits are poorly filled and not reviewed).',
						'Work permits are used, but inconsistently (e.g., some high-risk jobs done without permit, or records incomplete).',
						'Permit system is in place and mostly followed, but some minor inconsistencies (e.g., permit not displayed, or missing one signature).',
						'Work permit system is fully implemented and strictly followed for all high-risk work. All permits are complete, signed, and aligned with actual site conditions.'
					]
				}
			]
		},
		{
			key: 'manpower',
			title: 'Safety Manpower Coverage',
			items: [
				{
					label: 'Presence of Competent Safety Supervisor on Site',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Supervisor name is mentioned, but no real presence or engagement at site.',
						'Supervisor is rarely on site, or unclear if one is officially assigned.',
						'Supervisor is assigned but only part-time or shared with more than 2 projects.',
						'Safety Supervisor is assigned and generally present, but some gaps in enforcement or site visibility, or Safety Supervisor is assigned, shared by 2 projects.',
						'Competent Safety Supervisor is officially assigned, present full-time, actively involved in enforcement and safety audits.'
					]
				},
				{
					label: 'Project Supervisor/Engineer Responsible in Absence of Safety Supervisor',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Team assumes Safety Supervisor will handle all safety; no one steps in during absence.',
						'Ad-hoc safety supervision occurs, only when issues arise. No clear person-in-charge is designated during absence.',
						'Project personnel attempt to manage safety, but with limited consistency or documentation.',
						'Responsibility is informally taken up by a Project Supervisor/Engineer, who generally monitors safety but may lack structured follow-through.',
						'Substitution protocol is in place and actively practiced. Project Supervisor/Engineer is briefed and consistently performs safety duties during Safety Supervisor’s absence. Team is aware of this role.'
					]
				},
				{
					label: 'Safety Officer Attendance at High-Risk Activities',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Rarely present during high-risk activities; only appears after issues arise or for brief checks.',
						'Occasionally present or only visits site after works have started.',
						'Present for major high-risk works only; relies on supervisors for others. Monitoring inconsistent.',
						'Generally present for high-risk works but misses some less frequent or minor activities (e.g. short WAH tasks).',
						'Safety Officer is consistently present and actively supervises all high-risk activities. Attendance is well-documented.'
					]
				}
			]
		},
		{
			key: 'workforce',
			title: 'Workforce Safety Compliance',
			items: [
				{
					label: 'Full PPE Compliance (Helmet, Harness, Vest, Boots, Gloves)',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Less than 50% compliance. Widespread non-use of PPE, even during hazardous tasks. Unsafe behavior common.',
						'50–69% compliance. PPE use is inconsistent across work areas. Little to no enforcement.',
						'70–84% compliance. Noticeable lapses in one or more PPE items. Repeated reminders needed.',
						'85–94% compliance. Minor lapses observed (e.g., helmet not strapped, gloves missing), but mostly well-managed.',
						'≥95% of site workforce is fully PPE compliant at all times. Non-compliances are rare and corrected immediately.'
					]
				},
				{
					label: 'Workers briefed & aware of Safety SOPs',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Very few workers aware of SOPs. Briefings are rare or inconsistent understanding.',
						'Briefings are irregular. Workers show limited awareness of SOPs. Many unsure what procedures apply.',
						'Briefings are conducted, but some workers are unsure of SOPs. Records may be incomplete or outdated.',
						'Most workers understand SOPs and can explain key points. Minor gaps in records or some newer workers not yet briefed.',
						'Workers are well-briefed and aware. Can explain SOPs clearly. Toolbox talks and safety induction records are complete and signed.'
					]
				},
				{
					label: 'Workers possess valid CIDB/OSH/Safety Cards/NIOSH passport',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Less than 50% compliant. Most workers are unverified, expired cards, or no records at all.',
						'50–74% of workers have valid cards.',
						'75–89% of workers have valid cards. Several missing or expired, but rectification is ongoing.',
						'90–99% of workers have valid cards. A few pending replacements or newly joined workers in progress.',
						'All workers have valid CIDB/Safety cards. Site keeps records and tracks expiry.'
					]
				},
				{
					label: 'No unauthorized personal on site',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Regular presence of unregistered or unknown individuals on site. Serious lapse in control.',
						'Frequent unauthorized entries, especially among subcontractor or logistics personnel.',
						'Occasional unauthorized individuals observed (e.g., unfamiliar subcontractors or unescorted visitors).',
						'Minor lapse (e.g. unclear ID on 1 person), but no safety risk. System is working, just needs minor tightening.',
						'Site is fully secured. All personnel authorized, with ID. No unauthorized presence observed.'
					]
				}
			]
		},
		{
			key: 'vetting',
			title: 'Subcontractor Vetting',
			items: [
				{
					label: "Subcontractors's OSH Qualifications Verified",
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Minimal verification done. Documents unclear, outdated, or not project-specific.',
						'Several key documents missing or expired. Verification incomplete for most workers.',
						'Partial verification. Some missing green cards or competencies documents.',
						'Minor gaps (e.g. 1–2 documents pending but follow-up in progress), most requirements fulfilled.',
						'All required HSE qualifications verified. Green cards, competency certs, and engagement documents complete and valid for current project.'
					]
				},
				{
					label: 'OSH Terms Embedded in Subcontract Agreement',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'HSE terms mostly absent or not project-specific.',
						'HSE terms vague or minimal.',
						'General HSE terms present, but no specific reference to site rules or enforcement clauses.',
						'HSE clauses included but with minor gaps (e.g. not tailored to site or missing 1–2 elements).',
						'All HSE terms clearly defined, site-specific, signed, and cover full scope of engagement.'
					]
				}
			]
		},
		{
			docs: 'c&c',
			title: 'Site Condition & Controls',
			items: [
				{
					label: 'Housekeeping & Waste Disposal',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Poor housekeeping at all. Severe safety hazards due to waste and obstruction.',
						'Multiple zones with poor housekeeping. Obstructions or tripping hazards observed. Waste not regularly removed.',
						'Some areas cluttered or with unmanaged waste. Walkways partially blocked. Housekeeping inconsistent.',
						'Generally clean, but minor scattered debris or untidy zones observed. No major risk. Housekeeping evident.',
						'Site fully clean and orderly. Waste managed well. No visible hazards or obstructions. Housekeeping is routine.'
					]
				},
				{
					label: 'Edge & Fall Protection',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Severe lack of fall protection.',
						'Significant areas without fall protection. Some workers are exposed.',
						'Some edges or work areas lack proper fall protection. Relevant nets or harness points not consistently provided.',
						'Edge protection mostly complete, with only minor gaps. Harness points available.',
						'Full edge protection provided. All safety measures (relevant barricades, nets, harness points) are in place and effective.'
					]
				},
				{
					label: 'Equipment & Machinery Safety',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Significant equipment lacks safety tags or guards. Multiple instances of unsafe machinery.',
						'Majority of machinery lacks inspection tags or safety guards. Equipment shows visible defects.',
						'Several pieces of equipment without proper inspection tags, or missing guards. Maintenance records incomplete.',
						'Minor issues (e.g., one or two pieces missing tags or guards). Inspection tags mostly up-to-date.',
						'All machinery/equipment inspected, tagged, and guarded. No visible defects or safety concerns. Maintenance logs available.'
					]
				},
				{
					label: 'Signage & Emergency Access',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Critical emergency signage is missing or insufficient. Workers unaware of key emergency procedures.',
						'Significant gaps in signage. Emergency exits obstructed or poorly marked.',
						'Some key signs (e.g., exit routes, first aid) missing or hard to read. Minor obstruction of emergency exits.',
						'Most signage in place and visible. Minor issues with visibility or placement of some signs.',
						'All signage and emergency access points are clearly marked and functional. No obstructions or gaps.'
					]
				},
				{
					label: 'Presence of lifting crew (competent person)',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Aware but no lifting crew present during ongoing lifting activities. High-risk non-compliance. Immediate action required.',
						'Lifting crew present but not competent (expired certs, roles unclear, or not formally appointed). Unsafe practices noted.',
						'Only partial crew available, with some roles not clearly assigned or present. Lifting operations continue under minimal oversight.',
						'Competent lifting crew present with minor gaps (e.g., one role temporarily not on-site but coverage is arranged). No impact on safety observed.',
						'Full team of competent lifting crew (e.g., lifting supervisor, rigger, signaler) is present, roles clearly defined, and actively managing all lifting operations.'
					]
				},
				{
					label: 'Scaffold & ladder',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Personnel are aware of requirements, but usage is clearly unsafe — e.g., unstable scaffolds, broken ladders, or work done without fall protection/supervision. Immediate stop-work required.',
						'Unsafe or poorly maintained scaffold/ladder found. Evidence of improper use or lack of access control. High potential risk present.',
						'Some non-compliant usage or equipment found (e.g., workers using untagged or makeshift ladders/scaffold), but no immediate hazard.',
						'Minor issues observed (e.g., one ladder not tagged or a scaffold without recent inspection), but overall setup remains safe and compliant.',
						'All scaffolds and ladders are in excellent condition, fully compliant with safety standards, inspected regularly, and tagged.'
					]
				}
			]
		},
		{
			key: 'l&r',
			title: 'Safety Leadership & Reporting',
			items: [
				{
					label: 'Stop Work Authority (SWA) Exercised Where Needed',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'SWA not included in documentation, but some awareness exists, typically through informal channels or past experience.',
						'SWA not actively communicated. Workers unaware of their right to stop unsafe work.',
						'SWA mentioned in plan, but limited awareness among workers, or no visible evidence of briefing or procedure circulation.',
						'SWA case occurred but Documentation is incomplete (e.g. missing signatures, unclear description), or No actual SWA case, but clear system in place, workers briefed, and preparedness demonstrated.',
						'SWA exercised recently with proper documentation and follow-up action. All workers aware of their authority. Or No actual SWA case, but all workers aware of their authority.'
					]
				},
				{
					label: 'Near Miss & Incident Reporting',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Reporting culture weak. Many incidents or near misses are not reported.',
						'Some reports filed, but inconsistent or incomplete. Follow-up actions are slow or unclear.',
						'Near misses and incidents reported, but some delays in follow-up actions.',
						'Active reporting, but minor gaps in follow-up or reporting consistency.',
						'Strong, active reporting culture. All incidents and near misses logged, with clear follow-up actions and regular reviews.'
					]
				},
				{
					label: 'Disciplinary Action Taken on Violations',
					score: null,
					remarks: '',
					showInfo: false,
					infoDetails: [
						'Very few disciplinary actions taken or penalties are not properly documented.',
						'Limited disciplinary actions taken, with incomplete or inconsistent documentation on penalties.',
						'Some violations lead to disciplinary actions, but inconsistencies or missing documentation on show-cause letters or suspension records.',
						'Disciplinary actions are mostly consistent, but some minor gaps in documentation or follow-up actions.',
						'All violations consistently result in show-cause letters or suspension, with corrective actions documented.'
					]
				}
			]
		}
	];

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
			const locationPromise = getSubmitLocation();

			const auth = await requireUser();
			if (!auth) return;

			const { supabase, user } = auth;
			if (!user) throw new Error('Not signed in.');

			const { data: profile, error: profileError } = await supabase
				.from('profiles')
				.select('first_name, last_name')
				.eq('id', user.id)
				.single();

			if (profileError) throw profileError;

			const submitterName =
				`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;

			const payload = {
				project_name,
				project_no,
				region,
				location,
				audit_date,
				subsections,
				remarks,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName,
				overall_total: calculateOverallTotal(subsections),
				overall_max: calculateOverallMax(subsections),
				overall_percent: calculateOverallPercentage(subsections)
			};

			const { data: saved, error: insError } = await supabase
				.from('zca_submissions')
				.insert(payload)
				.select('id')
				.single();
			if (insError) throw insError;

			const sent = await sendToMake('zca', saved.id, {
				submitLocation: await locationPromise
			});
			if (sent.ok) toast.success('e-ZCA submitted successfully.');
			else toast.error(`e-ZCA was saved, but it could not be sent to Make: ${sent.error}`);
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

	/**
	 * @param {{ items: { score: number | null }[] }} subsection
	 */
	function calculatePercentage(subsection) {
		const validScores = subsection.items.filter((item) => item.score !== null);

		if (validScores.length === 0) return 0;

		const total = validScores.reduce((sum, item) => sum + Number(item.score), 0);

		const max = subsection.items.length * MAX_SCORE_PER_ITEM;

		return Math.round((total / max) * 100);
	}

	/**
	 * @param {Subsection[]} subsections
	 */
	function calculateOverallTotal(subsections) {
		return subsections.reduce(
			/** @param {number} total @param {Subsection} subsection */
			(total, subsection) =>
				total +
				subsection.items.reduce(
					/** @param {number} sum @param {AuditItem} item */
					(sum, item) => sum + Number(item.score ?? 0),
					0
				),
			0
		);
	}

	/**
	 * @param {Subsection[]} subsections
	 */
	function calculateOverallMax(subsections) {
		return subsections.reduce(
			/** @param {number} max @param {Subsection} subsection */
			(max, subsection) => max + subsection.items.length * MAX_SCORE_PER_ITEM,
			0
		);
	}

	/**
	 * @param {Subsection[]} subsections
	 */
	function calculateOverallPercentage(subsections) {
		const total = calculateOverallTotal(subsections);
		const max = calculateOverallMax(subsections);

		if (max === 0) return 0;

		return Math.round((total / max) * 100);
	}
</script>

<h1 class="title">Zero Compromise Audit Report (e-ZCA) Submission</h1>

<div class="project-box">
	<form class="forms" onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}
			><Search />Search Project</button
		>
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
			<label for="project-date" class="forms-label">Audit Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={audit_date}
				onfocus={(e) => e.target.showPicker?.()}
				required
			/>
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
		{#each subsections as subsection, sIndex}
			<h2 class="heading">{subsection.title}</h2>
			<div class="categories">
				<p>No.</p>
				<p>Item</p>
				<p></p>
				<p>Score</p>
				<p></p>
			</div>
			<div class="audit-grid">
				{#each subsection.items as item, iIndex}
					<p class="index">{iIndex + 1}</p>
					<p class="audit-label">{item.label}</p>
					<div class="audit-select info-wrapper">
						<button type="button" class="info-button"><Info /></button>
						<div class="info-popup" role="dialog" aria-label="Score guidance">
							{#each item.infoDetails as text, idx}
								<p class="info-details">
									<span class={['one', 'two', 'three', 'four', 'five'][idx]}>{idx + 1}</span>
									{text}
								</p>
							{/each}
						</div>
					</div>
					<p class="audit-select">
						<select
							bind:value={subsections[sIndex].items[iIndex].score}
							class="audit-count"
							required
						>
							<option value={null}></option>
							<option value={1}>1</option>
							<option value={2}>2</option>
							<option value={3}>3</option>
							<option value={4}>4</option>
							<option value={5}>5</option>
						</select>
					</p>
					<input
						type="text"
						class="audit-remarks"
						placeholder="Remarks"
						bind:value={subsections[sIndex].items[iIndex].remarks}
					/>
				{/each}
			</div>
			<div class="subsection-type">
				<label for="" class="subsection-label heading">Subsection</label>
				<input
					type="text"
					class="subsection-count"
					value="{calculatePercentage(subsection)}%"
					readonly
				/>
			</div>
		{/each}
		<hr />
		<div class="overall-summary">
			<label for="" class="overall-label heading">Total / {calculateOverallMax(subsections)}</label>
			<input
				type="text"
				class="overall-count"
				value={calculateOverallTotal(subsections)}
				readonly
			/>
		</div>
		<div class="overall-summary">
			<label for="" class="overall-label heading">Overall</label>
			<input
				type="text"
				class="overall-count"
				value="{calculateOverallPercentage(subsections)}%"
				readonly
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
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Zero Compromise Audit Report as below:</p>
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
		<p class="note">Note: Double check if content is correct before submitting.</p>
		<!-- <div class="forms-p">
			<p><b>Confirm Login Password</b></p>
			<input type="password" class="forms-input" />
		</div> -->
		{#if errorMsg}
			<p class="error">{errorMsg}</p>
		{/if}
		<div class="submit">
			<button type="submit" class="button-submit"
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

	.audit-count {
		width: 50px;
		height: 30px;
		font-size: 14px;
		padding: 5px;
	}

	.audit-grid {
		margin-top: 15px;
		display: grid;
		grid-template-columns: 40px 3fr 50px 50px 3fr;
		align-items: center;
		gap: 10px;
	}

	.audit-remarks {
		width: 100%;
		height: 30px;
		padding: 6px 10px;
		font-size: 14px;
	}

	.audit-select {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
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
		grid-template-columns: 40px 3fr 50px 50px 3fr;
		text-align: center;
		font-weight: bold;
		align-items: center;
		gap: 10px;
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

	.index {
		text-align: center;
	}

	.info-button {
		background-color: #ffffff;
		color: #091747;
		cursor: pointer;
		padding: 0;
		border: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.info-details {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 3px 0;
		font-size: 14px;
	}

	.info-details span {
		font-weight: bold;
		min-width: 18px;
		text-align: center;
	}

	.info-popup {
		display: none;
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		background: #ffffff;
		border: 1px solid #091747;
		border-radius: 6px;
		padding: 12px;
		width: max-content;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
	}

	.info-wrapper {
		position: relative;
		display: inline-block;
	}

	.info-wrapper:hover .info-popup,
	.info-wrapper:focus-within .info-popup {
		display: block;
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

	.one,
	.two,
	.three,
	.four,
	.five {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 36px;
		height: 36px;
		color: #091747;
	}

	.one {
		background-color: #d60000d2;
	}

	.two {
		background-color: #f4bb44;
	}

	.three {
		background-color: #fff132;
	}

	.four {
		background-color: #51e951da;
	}

	.five {
		background-color: #40dd40;
	}

	.subsection-count,
	.overall-count {
		width: 50px;
		height: 40px;
		font-size: 14px;
		padding: 1px;
		text-align: center;
	}

	.subsection-label,
	.overall-label {
		width: 100px;
	}

	.subsection-type,
	.overall-summary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 15px;
		margin: 20px auto;
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

		.forms-input {
			width: 100%;
			max-width: 100%;
		}

		.forms-label {
			width: 180px;
		}

		.categories,
		.audit-grid {
			min-width: 780px;
		}

		.project-box {
			overflow-x: auto;
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
			overflow-x: visible;
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

		.forms-input {
			width: 100%;
			height: 34px;
			font-size: 13px;
		}

		.categories {
			display: none;
		}

		.audit-grid {
			grid-template-columns: auto 1fr;
			gap: 8px 10px;
			align-items: start;
		}

		.index {
			grid-column: 1;
			font-weight: bold;
		}

		.audit-label {
			grid-column: 2;
			font-weight: 600;
			word-break: break-word;
			overflow-wrap: break-word;
			white-space: normal;
		}

		.info-wrapper {
			grid-column: 1;
			display: flex;
			align-items: center;
			align-self: center;
		}

		.info-popup {
			position: fixed;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			width: 90vw;
			max-height: 70vh;
			overflow-y: auto;
			padding: 16px;
			border-radius: 10px;
			background: white;
			box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
			z-index: 2000;
		}

		.audit-select:not(.info-wrapper) {
			width: 50px;
			display: flex;
			align-items: center;
		}

		.audit-remarks {
			grid-column: 1 / -1;
			width: 100%;
			box-sizing: border-box;
			height: 38px;
			padding: 6px 10px;
			border-radius: 6px;
			border: 1px solid #ccc;
		}

		.categories,
		.audit-grid {
			min-width: 0;
		}

		.subsection-type,
		.overall-summary {
			margin: 14px 0;
		}

		.subsection-label,
		.overall-label {
			width: auto;
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
	}
</style>