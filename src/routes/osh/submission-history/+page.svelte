<script>
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { onMount } from 'svelte';
	import { requireUser } from '$lib/auth-guard';
	import Modal from '$lib/components/Modal.svelte';
	import { validation } from '$lib/validation';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toast } from '$lib/stores/toast';
	import { sendToMake } from '$lib/make';

	let rows = $state({});
	let sectionErrors = $state({});
	let errorMsg = $state('');
	let loading = $state(false);
	let fromDate = $state('');
	let toDate = $state('');
	let open = $state({});

	function toggle(key) {
		open = { ...open, [key]: !open[key] };
	}

	function formatDateTime(iso) {
		if (!iso) return '';

		const date = new Date(iso);
		const gmt8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		const day = String(gmt8.getUTCDate()).padStart(2, '0');
		const month = gmt8.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
		const year = gmt8.getUTCFullYear();

		const hours = String(gmt8.getUTCHours()).padStart(2, '0');
		const minutes = String(gmt8.getUTCMinutes()).padStart(2, '0');

		return `${day} ${month} ${year} ${hours}:${minutes}`;
	}

	function formatDate(iso) {
		if (!iso) return '';

		const date = new Date(iso);
		const gmt8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		const day = String(gmt8.getUTCDate()).padStart(2, '0');
		const month = gmt8.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
		const year = gmt8.getUTCFullYear();

		return `${day} ${month} ${year}`;
	}

	function withinRange(iso) {
		const d = new Date(iso);
		const fromOk = !fromDate || d >= new Date(fromDate + 'T00:00:00');
		const toOk = !toDate || d <= new Date(toDate + 'T23:59:59.999');
		return fromOk && toOk;
	}

	const BASE = 'id, created_at, created_by_name';
	const projectFields = [
		['Project Name', (r) => r.project_name],
		['Submission Date', (r) => formatDateTime(r.created_at)]
	];
	const INDUCTION_TYPE = { visitor: 'Visitor', conductor: 'Contractor', contractor: 'Contractor' };
	const TRAVEL_MODE = { Road: 'Road', 'Company-Vehicle': 'Company Vehicle', Air: 'Air' };
	const CLAIM_TYPE = { Overtime: 'Overtime', 'Duty-Allowance': 'Duty Allowance' };

	const amount = (v) => {
		const n = parseFloat(v);
		return Number.isFinite(n) ? n : 0;
	};
	const claimTotal = (r) =>
		[
			r.site_allowance,
			r.accommodation,
			r.toll_fare,
			r.claim_mileage,
			r.fuel_cost,
			r.site_purchase,
			r.claim_other
		]
			.map(amount)
			.reduce((a, b) => a + b, 0)
			.toFixed(2);

	const SECTIONS = [
		{
			key: 'TBM',
			title: 'Tool Box Meeting (e-TBM)',
			table: 'tbm_submissions',
			bucket: 'tbm_uploads',
			columns: `${BASE}, project_no, project_name, meeting_date, tbm_form_path, tbm_photo_path, ptw_form_path, other_doc_path`,
			cardTitle: (r) => r.project_no,
			fields: [...projectFields, ['Meeting Date', (r) => formatDate(r.meeting_date)]],
			files: [
				['Photo of Filled TBM Form', 'tbm_form_path'],
				['Photo(s) of TBM in Session', 'tbm_photo_path'],
				['Photo of Filled PTW Form', 'ptw_form_path'],
				['Another Document', 'other_doc_path']
			],
			email: true
		},
		{
			key: 'PPE',
			title: 'PPE Visual Inspections (e-PPE)',
			table: 'ppe_submissions',
			bucket: 'ppe_uploads',
			columns: `${BASE}, project_no, project_name, activity_date, ppe_photo_path`,
			cardTitle: (r) => r.project_no,
			fields: [...projectFields, ['Activity Date', (r) => formatDate(r.activity_date)]],
			files: [['Photos of Wearing PPE on Site', 'ppe_photo_path']],
			email: true
		},
		{
			key: 'HKP',
			title: 'Housekeeping Report (e-HKP)',
			table: 'hkp_submissions',
			bucket: 'hkp_uploads',
			columns: `${BASE}, project_no, project_name, activity_date, hkp_photo_path`,
			cardTitle: (r) => r.project_no,
			fields: [...projectFields, ['Activity Date', (r) => formatDate(r.activity_date)]],
			files: [['Photo of Housekeeping', 'hkp_photo_path']],
			email: true
		},
		{
			key: 'CTR',
			title: 'Competency Register (e-CTR)',
			table: 'ctr_submissions',
			columns: `${BASE}, project_no, project_name, kickoff_date, staff_name, supervisor_name, contractor_name, contractor_company`,
			cardTitle: (r) => r.project_no,
			fields: [
				...projectFields,
				['Kick-off Date', (r) => formatDate(r.kickoff_date)],
				['Staff Name', (r) => r.staff_name],
				['Supervisor Name', (r) => r.supervisor_name],
				['Contractor Name', (r) => r.contractor_name],
				['Contractor Company', (r) => r.contractor_company]
			]
		},
		{
			key: 'CAR',
			title: 'Corrective Action Report (e-CAR)',
			table: 'car_submissions',
			columns: `${BASE}, project_no, project_name, date, form_no, assigned_to`,
			cardTitle: (r) => r.project_no,
			fields: [
				...projectFields,
				['Date', (r) => formatDate(r.date)],
				['Form No.', (r) => r.form_no],
				['Assigned To', (r) => r.assigned_to]
			]
		},
		{
			key: 'HWA',
			title: 'Hot Work Activities Permit (e-HWA)',
			table: 'hwa_submissions',
			columns: `${BASE}, permit_date, location_allowed, contractor_name, company_name, coordinator_name, officer_name`,
			cardTitle: (r) => r.company_name || r.contractor_name,
			fields: [
				['Submission Date', (r) => formatDateTime(r.created_at)],
				['Permit Date', (r) => formatDate(r.permit_date)],
				['Location Allowed', (r) => r.location_allowed],
				['Contractor Name', (r) => r.contractor_name],
				['Coordinator Name', (r) => r.coordinator_name],
				['Officer Name', (r) => r.officer_name]
			]
		},
		{
			key: 'IDF',
			title: 'Induction Form (e-IDF)',
			table: 'idf_submissions',
			bucket: 'idf_uploads',
			columns: `${BASE}, project_no, project_name, activity_date, contractors, induction_type, idf_form_path, idf_activity_path`,
			cardTitle: (r) => r.project_no,
			fields: [
				...projectFields,
				['Activity Date', (r) => formatDate(r.activity_date)],
				['Induction Type', (r) => INDUCTION_TYPE[r.induction_type] ?? r.induction_type],
				['No. of Contractors', (r) => r.contractors]
			],
			files: [
				['Induction Form Image', 'idf_form_path'],
				['Activity Image', 'idf_activity_path']
			]
		},
		{
			key: 'ORA',
			title: 'Overtime Requisition and Approval Form (e-ORA)',
			table: 'ora_submissions',
			columns: `${BASE}, employee_name, employee_no, department, claim_type, overtime_date, overtime_hours`,
			cardTitle: (r) => r.employee_name,
			fields: [
				['Submission Date', (r) => formatDateTime(r.created_at)],
				['Employee No.', (r) => r.employee_no],
				['Department', (r) => r.department],
				['Claim Type', (r) => CLAIM_TYPE[r.claim_type] ?? r.claim_type],
				['Overtime Date', (r) => formatDate(r.overtime_date)],
				['Overtime Hours', (r) => r.overtime_hours]
			]
		},
		{
			key: 'SAC',
			title: 'Safety Audit Checklist (e-SAC)',
			table: 'sac_submissions',
			bucket: 'sac_uploads',
			columns: `${BASE}, project_no, project_name, activity_date, sac_image_path`,
			cardTitle: (r) => r.project_no,
			fields: [...projectFields, ['Activity Date', (r) => formatDate(r.activity_date)]],
			files: [['Safety Audit Document or Image', 'sac_image_path']]
		},
		{
			key: 'IPR',
			title: 'Safety Inspection Record (e-IPR)',
			table: 'ipr_submissions',
			bucket: 'ipr_uploads',
			columns: `${BASE}, project_no, project_name, activity_date, ipr_checklist_path, ipr_activity_path`,
			cardTitle: (r) => r.project_no,
			fields: [...projectFields, ['Activity Date', (r) => formatDate(r.activity_date)]],
			files: [
				['Checklist Image', 'ipr_checklist_path'],
				['Activity Image', 'ipr_activity_path']
			]
		},
		{
			key: 'SOA',
			title: 'Safety Officer Audit (e-SOA)',
			table: 'soa_submissions',
			columns: `${BASE}, project_no, project_name, date, weather`,
			cardTitle: (r) => r.project_no,
			fields: [
				...projectFields,
				['Audit Date', (r) => formatDate(r.date)],
				['Weather', (r) => r.weather]
			]
		},
		{
			key: 'TNR',
			title: 'Safety Training Record (e-TNR)',
			table: 'tnr_submissions',
			bucket: 'tnr_uploads',
			columns: `${BASE}, project_no, project_name, activity_date, topic, tnr_attendance_path, tnr_activity_path`,
			cardTitle: (r) => r.project_no,
			fields: [
				...projectFields,
				['Activity Date', (r) => formatDate(r.activity_date)],
				['Topic', (r) => r.topic]
			],
			files: [
				['Attendance List Image', 'tnr_attendance_path'],
				['Activity Image', 'tnr_activity_path']
			]
		},
		{
			key: 'SCF',
			title: 'Staff Claim Form (e-SCF)',
			table: 'scf_submissions',
			bucket: 'scf_uploads',
			columns: '*',
			cardTitle: (r) => r.project_no,
			fields: [
				['Submission Date', (r) => formatDateTime(r.created_at)],
				['Claim Date', (r) => formatDate(r.claim_date)],
				['Description', (r) => r.description],
				['Total Claim', (r) => `RM ${claimTotal(r)}`]
			],
			files: [['Attachment', 'maps_screenshot_path']]
		},
		{
			key: 'TRF',
			title: 'Travel Requisition Form (e-TRF)',
			table: 'trf_submissions',
			columns: `${BASE}, traveller_name, project_no, mode_of_travel, travel_origin, travel_destination, travel_date_time`,
			cardTitle: (r) => r.traveller_name,
			fields: [
				['Submission Date', (r) => formatDateTime(r.created_at)],
				['Project No.', (r) => r.project_no],
				['Mode of Travel', (r) => TRAVEL_MODE[r.mode_of_travel] ?? r.mode_of_travel],
				['Origin', (r) => r.travel_origin],
				['Destination', (r) => r.travel_destination],
				['Travel Date & Time', (r) => formatDateTime(r.travel_date_time)]
			]
		},
		{
			key: 'ZCA',
			title: 'Zero Compromise Audit (e-ZCA)',
			table: 'zca_submissions',
			columns: `${BASE}, project_no, project_name, audit_date, overall_total, overall_max, overall_percent`,
			cardTitle: (r) => r.project_no,
			fields: [
				...projectFields,
				['Audit Date', (r) => formatDate(r.audit_date)],
				[
					'Overall Score',
					(r) =>
						r.overall_percent === null || r.overall_percent === undefined
							? ''
							: `${r.overall_total ?? 0}/${r.overall_max ?? 0} (${r.overall_percent}%)`
				]
			]
		}
	].sort((a, b) => a.title.localeCompare(b.title));

	const show = (v) => (v === null || v === undefined || v === '' ? '-' : v);

	async function loadHistory() {
		loading = true;
		errorMsg = '';
		rows = {};
		sectionErrors = {};

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { supabase, user } = auth;
			if (!user) throw new Error('Not signed in.');

			const results = await Promise.all(
				SECTIONS.map(async (s) => {
					try {
						const { data, error } = await supabase
							.from(s.table)
							.select(s.columns)
							.eq('created_by', user.id)
							.order('created_at', { ascending: false });
						if (error) throw error;
						return { key: s.key, data: data ?? [] };
					} catch (e) {
						return { key: s.key, data: [], error: e?.message ?? String(e) };
					}
				})
			);

			const nextRows = {};
			const nextErrors = {};
			for (const r of results) {
				nextRows[r.key] =
					fromDate || toDate ? r.data.filter((x) => withinRange(x.created_at)) : r.data;
				if (r.error) nextErrors[r.key] = r.error;
			}
			rows = nextRows;
			sectionErrors = nextErrors;
		} catch (e) {
			errorMsg = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	}

	async function openFile(bucket, path) {
		if (!path) return;
		if (/^https?:\/\//i.test(path)) {
			window.open(path, '_blank', 'noopener');
			return;
		}

		const tab = window.open('', '_blank');
		try {
			const auth = await requireUser();
			const supabase = auth?.supabase;
			let url = '';
			if (supabase) {
				const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
				url =
					!error && data?.signedUrl
						? data.signedUrl
						: (supabase.storage.from(bucket).getPublicUrl(path).data?.publicUrl ?? '');
			}
			if (tab && url) tab.location.href = url;
			else {
				tab?.close();
				toast.error('Could not open the file.');
			}
		} catch (e) {
			tab?.close();
			toast.error(e?.message ?? 'Could not open the file.');
		}
	}

	let emailTarget = $state(null);
	let emailAddress = $state('');
	let emailSending = $state(false);

	async function openEmail(type, row) {
		emailTarget = { type, id: row.id, project_no: row.project_no };
		if (!emailAddress) {
			const auth = await requireUser();
			emailAddress = auth?.user?.email ?? '';
		}
	}

	function closeEmail() {
		if (emailSending) return;
		emailTarget = null;
	}

	async function sendEmailCopy(e) {
		e.preventDefault();
		if (!emailTarget || emailSending) return;

		emailSending = true;
		const res = await sendToMake(emailTarget.type.toLowerCase(), emailTarget.id, {
			send: 'to',
			emailTo: emailAddress.trim()
		});
		emailSending = false;

		if (res.ok) {
			toast.success(`The e-${emailTarget.type} PDF will be e-mailed to ${emailAddress.trim()} shortly.`);
			emailTarget = null;
		} else {
			toast.error(res.error);
		}
	}

	onMount(loadHistory);
</script>

<h1 class="title">Submission History</h1>

<div class="submissions-filter">
	<div>
		<p>From Date</p>
		<input
			type="date"
			class="date-from forms-date"
			bind:value={fromDate}
			onchange={loadHistory}
			onfocus={(e) => e.target.showPicker?.()}
		/>
	</div>
	<div>
		<p>To Date</p>
		<input
			type="date"
			class="date-to forms-date"
			bind:value={toDate}
			onchange={loadHistory}
			onfocus={(e) => e.target.showPicker?.()}
		/>
	</div>
</div>

<div class="project-box">
	{#if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	{#if loading}
		<Spinner inline size={140} label="Loading submissions" />
	{/if}

	<div class="accordion" class:is-loading={loading}>
		{#each SECTIONS as s (s.key)}
			{@const list = rows[s.key] ?? []}
			<div class="acc-section">
				<button type="button" class="acc-header" onclick={() => toggle(s.key)}>
					<span>{s.title} ({list.length})</span>
					<span class="acc-icon">
						{#if open[s.key]}
							<ChevronDown />
						{:else}
							<ChevronLeft />
						{/if}
					</span>
				</button>

				{#if open[s.key]}
					<div class="acc-body">
						{#if sectionErrors[s.key]}
							<p class="error">Could not load {s.title}: {sectionErrors[s.key]}</p>
						{:else if list.length === 0}
							<p class="empty">No submissions</p>
						{:else}
							<div class="card-grid">
								{#each list as r (r.id)}
									<div class="history-card">
										<p class="card-title">{show(s.cardTitle(r))}</p>
										{#each s.fields as [label, get] (label)}
											<p><b>{label}:</b> {show(get(r))}</p>
										{/each}

										{#each s.files ?? [] as [label, column] (column)}
											<p class="doc-line">
												<b>{label}:</b>
												{#if r[column]}
													<button
														type="button"
														class="photo-link"
														onclick={() => openFile(s.bucket, r[column])}>View Photo</button
													>
												{:else}
													-
												{/if}
											</p>
										{/each}

										{#if s.email}
											<button type="button" class="button-email" onclick={() => openEmail(s.key, r)}>
												E-mail PDF
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<Modal
	open={!!emailTarget}
	title="E-mail PDF Report"
	subtitle={emailTarget ? `e-${emailTarget.type} · ${emailTarget.project_no ?? ''}` : ''}
	busy={emailSending}
	onclose={closeEmail}
>
	<form id="email-copy-form" class="email-form" use:validation onsubmit={sendEmailCopy}>
		<label for="email-copy-to">Send the PDF to</label>
		<input id="email-copy-to" type="email" bind:value={emailAddress} required />
	</form>
	{#snippet footer()}
		<button type="button" class="button-secondary" onclick={closeEmail} disabled={emailSending}>
			Cancel
		</button>
		<button type="submit" form="email-copy-form" class="button-primary" disabled={emailSending}>
			{emailSending ? 'Sending...' : 'Send'}
		</button>
	{/snippet}
</Modal>

<style>
	.submissions-filter {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin: 10px;
		padding: 10px;
	}

	.photo-link {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--link);
		text-align: left;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.accordion {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.accordion.is-loading {
		display: none;
	}

	.acc-section {
		width: 100%;
	}

	.acc-header {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 13px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--mist);
		color: var(--ink);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.acc-header:hover:not(:disabled) {
		background: var(--mist-2);
		border-color: var(--line-strong);
	}

	.acc-icon :global(svg) {
		width: 18px;
		height: 18px;
	}

	.acc-body {
		padding: 14px 0 0;
	}

	.empty {
		color: var(--muted);
		padding: 10px 2px;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
	}

	.button-email {
		margin-top: 12px;
	}

	.button-primary:disabled,
	.button-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.email-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.email-form input {
		width: 100%;
	}

	.history-card {
		border: 1px solid var(--line-soft);
		border-radius: var(--r-lg);
		background: var(--mist);
		box-shadow: var(--shadow-sm);
		padding: 18px;
		min-height: 240px;
	}

	.card-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 10px;
	}

	.doc-line {
		margin: 8px 0;
	}

	@media (max-width: 1024px) {
		.submissions-filter {
			flex-wrap: wrap;
			gap: 12px;
		}

		.submissions-filter > div {
			min-width: 220px;
			flex: 1 1 220px;
		}
	}

	@media (max-width: 768px) {
		.submissions-filter {
			gap: 8px;
		}

		.submissions-filter p {
			margin: 0 0 4px 0;
			line-height: 1.2;
		}

		.submissions-filter > div {
			margin: 0;
			padding: 0;
		}

		.date-from,
		.date-to {
			width: 100%;
		}

		.acc-header {
			padding: 10px;
			font-size: 14px;
			gap: 10px;
		}

		.acc-body {
			padding: 10px 0 0;
		}

		.card-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.history-card {
			min-height: auto;
			padding: 12px;
		}

		.card-title {
			font-size: 16px;
			word-break: break-word;
		}

		.history-card p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.doc-line {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.photo-link {
			display: inline-block;
			max-width: 100%;
			word-break: break-all;
		}

		.acc-icon :global(svg) {
			width: 16px;
			height: 16px;
		}
	}
</style>