<script>
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import { supabase } from '$lib/supabase';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let formType = '';
	let fromDate = '';
	let toDate = '';
	let searchText = '';

	let loading = false;
	let errorMsg = '';
	let allRows = [];

	let showDetailsModal = false;
	let modalLoading = false;
	let modalError = '';
	let details = null;
	let activeRow = null;

	let loadToken = 0;

	const FORMS = {
		eTBM: {
			label: 'e-TBM',
			table: 'tbm_submissions',
			bucket: 'tbm_uploads',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			summary: [{ label: 'Meeting Date', key: 'meeting_date', type: 'date' }],
			files: [
				{ label: 'TBM Form', key: 'tbm_form_path' },
				{ label: 'TBM Photo', key: 'tbm_photo_path' },
				{ label: 'PTW Form', key: 'ptw_form_path' }
			],
			details: [
				{ label: 'Meeting Topics', key: 'meeting_topics', type: 'array' },
				{ label: 'Competency', key: 'competency', type: 'competency' },
				{ label: 'Attendance', key: 'attendance', type: 'attendance' }
			]
		},
		ePPE: {
			label: 'e-PPE',
			table: 'ppe_submissions',
			bucket: 'ppe_uploads',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			summary: [{ label: 'Activity Date', key: 'activity_date', type: 'date' }],
			files: [{ label: 'PPE Photo', key: 'ppe_photo_path' }],
			details: [{ label: 'Attendance', key: 'attendance', type: 'attendance' }]
		},
		eHKP: {
			label: 'e-HKP',
			table: 'hkp_submissions',
			bucket: 'hkp_uploads',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			summary: [{ label: 'Activity Date', key: 'activity_date', type: 'date' }],
			files: [{ label: 'HKP Photo', key: 'hkp_photo_path' }],
			details: [{ label: 'Report Day', key: 'report_day', type: 'reportday' }]
		},
		eZCA: {
			label: 'e-ZCA',
			table: 'zca_submissions',
			bucket: 'zca_uploads',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			summary: [{ label: 'Audit Date', key: 'audit_date', type: 'date' }],
			files: [],
			details: [{ label: 'Subsections', key: 'subsections', type: 'subsections' }]
		},
		eCAR: {
			label: 'e-CAR',
			table: 'car_submissions',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			summary: [
				{ label: 'Date', key: 'date', type: 'date' },
				{ label: 'Form No.', key: 'form_no' },
				{ label: 'Assigned To', key: 'assigned_to' }
			],
			files: [],
			details: [
				{ label: 'Region', key: 'region' },
				{ label: 'Location', key: 'location' },
				{ label: 'Weather', key: 'weather' },
				{ label: 'Form Description', key: 'form_description' },
				{ label: 'Action Taken', key: 'action_taken' },
				{ label: 'Remarks', key: 'remarks' }
			],
			search: ['form_no', 'assigned_to']
		},
		eCTR: {
			label: 'e-CTR',
			table: 'ctr_submissions',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			summary: [
				{ label: 'Kickoff Date', key: 'kickoff_date', type: 'date' },
				{ label: 'Supervisor', key: 'supervisor_name' },
				{ label: 'Contractor', key: 'contractor_name' }
			],
			files: [],
			details: [
				{ label: 'Region', key: 'region' },
				{ label: 'Location', key: 'location' },
				{ label: 'Weather', key: 'weather' },
				{ label: 'Start Date', key: 'start_date', type: 'date' },
				{ label: 'End Date', key: 'end_date', type: 'date' },
				{ label: 'Staff Name', key: 'staff_name' },
				{ label: 'Workday Date', key: 'workday_date', type: 'date' },
				{ label: 'Workday Day', key: 'workday_day' },
				{ label: 'Hours Worked', key: 'hours_worked' },
				{ label: 'Actual Hours Worked', key: 'actual_hours_worked' },
				{ label: 'Travel Date', key: 'travel_date', type: 'date' },
				{ label: 'Travel Origin', key: 'travel_origin' },
				{ label: 'Travel Destination', key: 'travel_destination' },
				{ label: 'Travel Allowance', key: 'travel_allowance', type: 'money' },
				{ label: 'Contractor Company', key: 'contractor_company' },
				{ label: 'Contractor Phone No.', key: 'contractor_phone_no' },
				{ label: 'Contractor E-mail', key: 'contractor_email' },
				{ label: 'Contractor Certification', key: 'contractor_certification', type: 'date' },
				{ label: 'Remarks', key: 'remarks' }
			],
			search: ['contractor_name', 'supervisor_name']
		},
		eHWA: {
			label: 'e-HWA',
			table: 'hwa_submissions',
			titleKey: 'contractor_name',
			submittedBy: true,
			summary: [
				{ label: 'Permit Date', key: 'permit_date', type: 'date' },
				{ label: 'Location Allowed', key: 'location_allowed' },
				{ label: 'Contractor', key: 'contractor_name' },
				{ label: 'Company', key: 'company_name' }
			],
			files: [],
			details: [
				{ label: 'Contractor Employees', key: 'contractor_employees' },
				{ label: 'Emergency Number', key: 'emergency_number' },
				{ label: 'Contractor ID', key: 'contractor_id' },
				{ label: 'Phone No.', key: 'phone_no' },
				{ label: 'Coordinator Name', key: 'coordinator_name' },
				{ label: 'Officer Name', key: 'officer_name' },
				{ label: 'Hot Work Checklist', key: 'subsections', type: 'subsections' }
			],
			search: ['contractor_name', 'company_name', 'location_allowed']
		},
		eIDF: {
			label: 'e-IDF',
			table: 'idf_submissions',
			bucket: 'idf_uploads',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			report: true,
			summary: [
				{ label: 'Activity Date', key: 'activity_date', type: 'date' },
				{ label: 'Induction Type', key: 'induction_type' }
			],
			files: [
				{ label: 'IDF Form', key: 'idr_form_path' },
				{ label: 'IDF Activity', key: 'idr_activity_path' }
			],
			details: [
				{ label: 'Contractors', key: 'contractors' },
				{ label: 'Remarks', key: 'remarks' },
				{ label: 'Submit Location', key: 'submit_location' },
				{ label: 'Report ID', key: 'report_id' }
			],
			search: ['induction_type']
		},
		eIPR: {
			label: 'e-IPR',
			table: 'ipr_submissions',
			bucket: 'ipr_uploads',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			report: true,
			summary: [{ label: 'Activity Date', key: 'activity_date', type: 'date' }],
			files: [
				{ label: 'IPR Checklist', key: 'ipr_checklist_path' },
				{ label: 'IPR Activity', key: 'ipr_activity_path' }
			],
			details: [
				{ label: 'Observations', key: 'observations' },
				{ label: 'Submit Location', key: 'submit_location' },
				{ label: 'Report ID', key: 'report_id' }
			]
		},
		eORA: {
			label: 'e-ORA',
			table: 'ora_submissions',
			titleKey: 'employee_name',
			submittedBy: true,
			summary: [
				{ label: 'Employee Name', key: 'employee_name' },
				{ label: 'Employee No.', key: 'employee_no' },
				{ label: 'Department', key: 'department' },
				{ label: 'Claim Type', key: 'claim_type' },
				{ label: 'Overtime Date', key: 'overtime_date', type: 'date' }
			],
			files: [],
			details: [
				{ label: 'Overtime Day', key: 'overtime_day' },
				{ label: 'Overtime Hours', key: 'overtime_hours' },
				{ label: 'Actual Date', key: 'actual_date', type: 'date' },
				{ label: 'Actual Day', key: 'actual_day' },
				{ label: 'Actual In Time', key: 'actual_in_time' },
				{ label: 'Actual Out Time', key: 'actual_out_time' },
				{ label: 'Actual Hours', key: 'actual_hours' },
				{ label: 'Reason', key: 'reason' },
				{ label: 'Remarks', key: 'remarks' }
			],
			search: ['employee_name', 'employee_no', 'department', 'claim_type']
		},
		eSAC: {
			label: 'e-SAC',
			table: 'sac_submissions',
			bucket: 'sac_uploads',
			projectNo: true,
			projectName: true,
			summary: [{ label: 'Activity Date', key: 'activity_date', type: 'date' }],
			files: [{ label: 'SAC Image', key: 'sac_image_path' }],
			details: [{ label: 'Remarks', key: 'remarks' }]
		},
		eSCF: {
			label: 'e-SCF',
			table: 'scf_submissions',
			bucket: 'scf_uploads',
			projectNo: true,
			report: true,
			summary: [
				{ label: 'Staff Name', key: 'staff_name' },
				{ label: 'Department', key: 'department' },
				{ label: 'Claim Date', key: 'claim_date', type: 'date' },
				{ label: 'Description', key: 'description' }
			],
			files: [{ label: 'Maps Screenshot', key: 'maps_screenshot_path' }],
			details: [
				{ label: 'Staff Position', key: 'staff_position' },
				{ label: 'Site Allowance', key: 'site_allowance', type: 'money' },
				{ label: 'Accommodation', key: 'accommodation', type: 'money' },
				{ label: 'Toll Fare', key: 'toll_fare', type: 'money' },
				{ label: 'Fuel Cost', key: 'fuel_cost', type: 'money' },
				{ label: 'Claim Mileage', key: 'claim_mileage', type: 'km' },
				{ label: 'Site Purchase', key: 'site_purchase', type: 'money' },
				{ label: 'Other Claim', key: 'claim_other', type: 'money' },
				{ label: 'Claim Remarks', key: 'claim_remarks' },
				{ label: 'Submit Location', key: 'submit_location' },
				{ label: 'Report ID', key: 'report_id' }
			],
			search: ['staff_name', 'department', 'description']
		},
		eSOA: {
			label: 'e-SOA',
			table: 'soa_submissions',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			summary: [
				{ label: 'Date', key: 'date', type: 'date' },
				{ label: 'Weather', key: 'weather' }
			],
			files: [],
			details: [
				{ label: 'Remarks', key: 'remarks' },
				{ label: 'Subsections', key: 'subsections', type: 'subsections' }
			]
		},
		eTNR: {
			label: 'e-TNR',
			table: 'tnr_submissions',
			bucket: 'tnr_uploads',
			projectNo: true,
			projectName: true,
			submittedBy: true,
			report: true,
			summary: [
				{ label: 'Activity Date', key: 'activity_date', type: 'date' },
				{ label: 'Topic', key: 'topic' }
			],
			files: [
				{ label: 'TNR Attendance', key: 'tnr_attendance_path' },
				{ label: 'TNR Activity', key: 'tnr_activity_path' }
			],
			details: [
				{ label: 'Description', key: 'description' },
				{ label: 'Remarks', key: 'remarks' },
				{ label: 'Submit Location', key: 'submit_location' },
				{ label: 'Report ID', key: 'report_id' }
			],
			search: ['topic']
		},
		eTRF: {
			label: 'e-TRF',
			table: 'trf_submissions',
			projectNo: true,
			submittedBy: true,
			summary: [
				{ label: 'Requestor', key: 'requestor_name' },
				{ label: 'Traveller', key: 'traveller_name' },
				{ label: 'Mode of Travel', key: 'mode_of_travel' },
				{ label: 'Travel Date & Time', key: 'travel_date_time', type: 'datetime' },
				{ label: 'Origin', key: 'travel_origin' },
				{ label: 'Destination', key: 'travel_destination' }
			],
			files: [],
			details: [
				{ label: 'Requestor Position', key: 'requestor_position' },
				{ label: 'Requestor Department', key: 'requestor_department' },
				{ label: 'Traveller ID', key: 'traveller_id' },
				{ label: 'Traveller Company', key: 'traveller_company' },
				{ label: 'Traveller Position', key: 'traveller_position' },
				{ label: 'Traveller Department', key: 'traveller_department' },
				{ label: 'Traveller Phone No.', key: 'traveller_phone_no' },
				{ label: 'Fare To Be Borne By', key: 'fare_to_be_borne_by' },
				{ label: 'Purpose of Travel', key: 'travel_purpose' },
				{ label: 'Airline', key: 'travel_airline' },
				{ label: 'Flight No.', key: 'travel_flight_no' },
				{ label: 'Baggage Required', key: 'travel_baggage_required' },
				{ label: 'Meal Onboard Required', key: 'meal_onboard_required' }
			],
			search: ['requestor_name', 'traveller_name']
		}
	};

	const formOptions = Object.entries(FORMS).map(([key, form]) => ({ key, label: form.label }));

	const REPORT_STATUS = {
		pending: 'Pending',
		sent: 'Processing',
		done: 'Ready',
		failed: 'Failed'
	};

	function listColumns(form) {
		const cols = new Set(['id', 'created_at']);
		if (form.submittedBy) cols.add('created_by_name');
		if (form.projectNo) cols.add('project_no');
		if (form.projectName) cols.add('project_name');
		if (form.titleKey) cols.add(form.titleKey);
		if (form.report) {
			cols.add('report_url');
			cols.add('make_status');
		}
		for (const f of form.summary) cols.add(f.key);
		for (const f of form.files) cols.add(f.key);
		for (const c of searchColumns(form)) cols.add(c);
		return [...cols].join(', ');
	}

	function searchColumns(form) {
		const cols = [];
		if (form.projectNo) cols.push('project_no');
		if (form.projectName) cols.push('project_name');
		if (form.submittedBy) cols.push('created_by_name');
		return [...cols, ...(form.search ?? [])];
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

	function toISOStart(dateStr) {
		return dateStr ? new Date(dateStr + 'T00:00:00').toISOString() : null;
	}
	function toISOEnd(dateStr) {
		return dateStr ? new Date(dateStr + 'T23:59:59.999').toISOString() : null;
	}

	function publicFileUrl(bucket, path) {
		if (!bucket || !path) return '';
		const { data } = supabase.storage.from(bucket).getPublicUrl(path);
		return data?.publicUrl ?? '';
	}

	async function openFile(event, bucket, path) {
		event.preventDefault();
		const fallbackUrl = event.currentTarget.href;
		const tab = window.open('', '_blank');

		let url = fallbackUrl;
		try {
			const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
			if (!error && data?.signedUrl) url = data.signedUrl;
		} catch {
			// fall back to the public URL
		}

		if (tab) {
			tab.opener = null;
			tab.location.href = url;
		} else {
			window.open(url, '_blank');
		}
	}

	function fileName(path) {
		if (!path) return '';
		const p = String(path);
		return p.split('/').pop() || p;
	}

	function cardTitle(row) {
		const form = FORMS[formType];
		const head = form.projectNo ? (row.project_no ?? '-') : (row[form.titleKey] ?? '-');
		return `${head} ${formType}`;
	}

	function filterRows(list, text, type) {
		const form = FORMS[type];
		const s = text.trim().toLowerCase();
		if (!form || !s) return list;

		const cols = searchColumns(form);
		return list.filter((r) =>
			cols.some((c) =>
				String(r?.[c] ?? '')
					.toLowerCase()
					.includes(s)
			)
		);
	}

	$: rows = filterRows(allRows, searchText, formType);

	async function loadForms() {
		const token = ++loadToken;
		const form = FORMS[formType];

		loading = true;
		errorMsg = '';
		allRows = [];

		if (!form) {
			loading = false;
			return;
		}

		try {
			let q = supabase
				.from(form.table)
				.select(listColumns(form))
				.order('created_at', { ascending: false });

			const startISO = toISOStart(fromDate);
			const endISO = toISOEnd(toDate);
			if (startISO) q = q.gte('created_at', startISO);
			if (endISO) q = q.lte('created_at', endISO);

			const { data, error } = await q;
			if (token !== loadToken) return;
			if (error) throw error;

			allRows = data ?? [];
		} catch (e) {
			if (token === loadToken) errorMsg = e?.message ?? String(e);
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	async function openDetailsModal(row) {
		showDetailsModal = true;
		modalLoading = true;
		modalError = '';
		details = null;
		activeRow = row;

		try {
			const form = FORMS[formType];
			const detailsSelect = form.details.map((d) => d.key).join(', ');

			if (!detailsSelect) {
				details = {};
				return;
			}

			const { data, error } = await supabase
				.from(form.table)
				.select(detailsSelect)
				.eq('id', row.id)
				.single();

			if (error) throw error;
			details = data ?? {};
		} catch (e) {
			modalError = e?.message ?? String(e);
		} finally {
			modalLoading = false;
		}
	}

	function closeDetailsModal() {
		showDetailsModal = false;
		details = null;
		activeRow = null;
		modalError = '';
		modalLoading = false;
	}

	function formatArray(value) {
		if (!value) return '-';
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}

	function formatAttendance(attendance) {
		if (!attendance || typeof attendance !== 'object') return '-';

		return Object.entries(attendance)
			.filter(([, value]) => Number(value) > 0)
			.map(
				([key, value]) =>
					`${key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}: ${value}`
			)
			.join(', ');
	}

	function formatCompetency(obj) {
		if (!obj || typeof obj !== 'object') return '-';

		return Object.entries(obj)
			.filter(([, value]) => value && value !== 'no_activity')
			.map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
			.join(', ');
	}

	function formatReportDay(reportDay) {
		if (!reportDay || typeof reportDay !== 'object') return '-';

		const labelMap = {
			opd: 'OPD',
			uauc: 'UAUC',
			high_risk: 'High Risk',
			near_miss: 'Near Miss',
			site_walk: 'Site Walk',
			stop_work: 'Stop Work',
			lt_injuries: 'LT Injuries',
			nlt_injuries: 'NLT Injuries',
			sd_occurrence: 'SD Occurrence',
			non_compliance: 'Non-Compliance'
		};

		const parts = Object.entries(reportDay)
			.filter(([, value]) => Number(value) > 0)
			.map(([key, value]) => `${labelMap[key] ?? key}: ${value}`);

		return parts.length ? parts.join(', ') : 'None';
	}

	function itemResult(item) {
		if (item?.score !== undefined && item?.score !== null && item?.score !== '') {
			return `Score: ${item.score}`;
		}
		if (typeof item?.checked === 'boolean') return item.checked ? 'Checked' : 'Not checked';
		if (item?.value !== undefined && item?.value !== null && item?.value !== '') {
			return `Answer: ${item.value}`;
		}
		return '';
	}

	function formatSubsections(subsections) {
		if (!Array.isArray(subsections) || subsections.length === 0) return '-';

		const sectionText = subsections
			.map((section) => {
				const title = (section?.title ?? '').trim();
				const items = Array.isArray(section?.items) ? section.items : [];

				const lines = items.map((item) => {
					const label = (item?.label ?? '').trim();
					const result = itemResult(item);
					const remarks = (item?.remarks ?? '').trim();

					return ['•', label, result && `— ${result}`, remarks && `— Remarks: ${remarks}`]
						.filter(Boolean)
						.join(' ');
				});

				return [title, ...lines].filter(Boolean).join('\n');
			})
			.filter(Boolean);

		return sectionText.length ? sectionText.join('\n\n') : '-';
	}

	function formatMoney(value) {
		if (value === null || value === undefined || value === '') return '-';
		const n = Number(value);
		return Number.isFinite(n) ? `RM ${n.toFixed(2)}` : String(value);
	}

	function formatKm(value) {
		if (value === null || value === undefined || value === '') return '-';
		return `${value} km`;
	}

	function formatValue(value, type) {
		switch (type) {
			case 'date':
				return formatDate(value) || '-';
			case 'datetime':
				return formatDateTime(value) || '-';
			case 'array':
				return formatArray(value);
			case 'money':
				return formatMoney(value);
			case 'km':
				return formatKm(value);
			case 'attendance':
				return formatAttendance(value);
			case 'competency':
				return formatCompetency(value);
			case 'reportday':
				return formatReportDay(value);
			case 'subsections':
				return formatSubsections(value);
			default:
				return value === null || value === undefined || value === '' ? '-' : String(value);
		}
	}

	loadForms();
</script>

<h1 class="title">Site Safety eForm Information</h1>

<div class="filter-bar">
	<div>
		<p>eForm Type</p>
		<select id="eform-type" class="form-select" bind:value={formType} onchange={loadForms}>
			<option value="">Select eForm</option>
			{#each formOptions as option (option.key)}
				<option value={option.key}>{option.label} Data</option>
			{/each}
		</select>
	</div>
	<div>
		<p>Project No./Project Name</p>
		<input type="text" placeholder="MP1234" class="filter-input" bind:value={searchText} />
	</div>
	<div>
		<p>From Date</p>
		<input
			type="date"
			name="created-date"
			id="date-from"
			class="date-from forms-date"
			bind:value={fromDate}
			onchange={loadForms}
			onfocus={(e) => e.target.showPicker?.()}
		/>
	</div>
	<div>
		<p>To Date</p>
		<input
			type="date"
			name="created-date"
			id="date-to"
			class="date-to forms-date"
			bind:value={toDate}
			onchange={loadForms}
			onfocus={(e) => e.target.showPicker?.()}
		/>
	</div>
</div>

<div class="site-safety-download">
	<button class="button-download"><ArrowDownToLine size={20} /><span>Excel</span></button>
</div>

{#if !formType}
	<p class="hint">Please choose an eForm data.</p>
{:else if loading}
	<Spinner inline size={140} label="Loading eForm data" />
{:else if errorMsg}
	<p class="error">{errorMsg}</p>
{:else if rows.length === 0}
	<p class="hint">No records found.</p>
{:else}
	{#each rows as r (r.id)}
		{@const form = FORMS[formType]}
		<div class="project-box">
			<div class="project-box-top">
				<p class="project-name">{cardTitle(r)}</p>
				<button
					class="button-primary"
					id="button-details"
					type="button"
					onclick={() => openDetailsModal(r)}
				>
					View Details
				</button>
			</div>
			{#if form.projectName}
				<p><b>Project Name:&nbsp;</b>{r.project_name ?? '-'}</p>
			{/if}
			{#if form.projectNo}
				<p><b>Project No.:&nbsp;</b>{r.project_no ?? '-'}</p>
			{/if}
			{#if form.submittedBy}
				<p><b>Submitted By:&nbsp;</b>{r.created_by_name ?? '-'}</p>
			{/if}
			<p><b>Created Date:&nbsp;</b>{formatDateTime(r.created_at)}</p>
			{#each form.summary as field (field.key)}
				<p><b>{field.label}:&nbsp;</b>{formatValue(r[field.key], field.type)}</p>
			{/each}
			{#each form.files as file (file.key)}
				<p class="doc-line">
					<b>{file.label}:&nbsp;</b>
					{#if r[file.key]}
						<a
							href={publicFileUrl(form.bucket, r[file.key])}
							target="_blank"
							rel="noopener"
							class="file-url"
							onclick={(e) => openFile(e, form.bucket, r[file.key])}
						>
							{fileName(r[file.key])}
						</a>
					{:else}
						-
					{/if}
				</p>
			{/each}
			{#if form.report}
				<p class="doc-line">
					<b>Report:&nbsp;</b>
					{#if r.report_url}
						<a href={r.report_url} target="_blank" rel="noopener" class="file-url">View report</a>
					{:else}
						{REPORT_STATUS[r.make_status] ?? '-'}
					{/if}
				</p>
			{/if}
		</div>
	{/each}
	<Modal open={showDetailsModal} title="eForm Details" onclose={closeDetailsModal} closeOnBackdrop>
		{#if modalLoading}
			<Spinner inline size={140} label="Loading details" />
		{:else if modalError}
			<p class="error">{modalError}</p>
		{:else}
			{#each FORMS[formType].details as field (field.key)}
				<p><b>{field.label}:</b></p>
				<p class="form-details">{formatValue(details?.[field.key], field.type)}</p>
			{/each}
		{/if}

		{#snippet footer()}
			<button type="button" class="button-primary" onclick={closeDetailsModal}>Close</button>
		{/snippet}
	</Modal>
{/if}

<style>
	.button-download {
		background-color: #31b647;
		width: 100px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-left: auto;
	}

	.button-download span {
		color: #ffffff;
	}

	.button-download:hover {
		background-color: #31b647bd;
	}

	.form-select {
		width: 220px;
		height: 40px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
	}

	.date-from,
	.date-to {
		height: 40px;
		padding: 0 10px;
		font-size: 14px;
	}

	.file-url {
		text-decoration: underline;
		color: var(--link);
	}

	.file-url:hover {
		color: color-mix(in srgb, var(--link) 64%, transparent);
	}

	.form-details {
		margin-bottom: 10px;
		white-space: pre-wrap;
	}

	.hint {
		margin: 10px;
	}

	.project-box-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}

	.project-name {
		font-size: 16px;
		font-weight: 600;
	}

	.site-safety-download {
		display: flex;
		margin: 10px;
	}

	@media (max-width: 1024px) {
		.filter-input,
		.date-from,
		.date-to {
			width: 100%;
		}

		.form-select,
		.date-from,
		.date-to {
			width: 100%;
			margin: 4px 0;
		}

		.site-safety-download {
			justify-content: flex-start;
		}

		.button-download {
			margin-left: 0;
			width: 100%;
		}

		.project-box-top {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.project-name {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.project-box p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.form-details {
			word-break: break-word;
		}
	}

	@media (max-width: 600px) {
		.filter-input,
		.form-select,
		.date-from,
		.date-to {
			width: 100%;
		}

		button,
		.button-primary,
		.button-download {
			width: 100%;
		}

		#button-details {
			margin-bottom: 10px;
		}

		.project-box p {
			font-size: 13px;
		}

		.project-name {
			font-size: 15px;
		}
	}
</style>