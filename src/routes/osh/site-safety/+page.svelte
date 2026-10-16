<script>
	import Search from '@lucide/svelte/icons/search';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import { supabase } from '$lib/supabase';
	import Modal from '$lib/components/Modal.svelte';

	let formType = '';
	let fromDate = '';
	let toDate = '';
	let searchText = '';

	let loading = false;
	let errorMsg = '';
	let rows = [];

	let showDetailsModal = false;
	let modalLoading = false;
	let modalError = '';
	let details = null;
	let activeRow = null;

	const tableMap = {
		eTBM: 'tbm_submissions',
		ePPE: 'ppe_submissions',
		eHKP: 'hkp_submissions',
		eZCA: 'zca_submissions'
	};

	const selectMap = {
		eTBM: `
			id, created_at, created_by_name,
			project_no, project_name,
			meeting_date,
			tbm_form_path, tbm_photo_path, ptw_form_path
		`,
		ePPE: `
			id, created_at, created_by_name,
			project_no, project_name,
			activity_date,
			ppe_photo_path
		`,
		eHKP: `
			id, created_at, created_by_name,
			project_no, project_name,
			activity_date,
			hkp_photo_path
		`,
		eZCA: `
			id, created_at, created_by_name,
			project_no, project_name,
			audit_date
		`
	};

	const detailsSelectMap = {
		eTBM: 'meeting_topics, competency, attendance',
		ePPE: 'attendance',
		eHKP: 'report_day',
		eZCA: 'subsections'
	};

	const searchCols = {
		eTBM: ['project_no', 'project_name', 'created_by_name'],
		ePPE: ['project_no', 'project_name', 'created_by_name'],
		eHKP: ['project_no', 'project_name', 'created_by_name'],
		eZCA: ['project_no', 'project_name', 'created_by_name']
	};

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

	const bucketMap = {
		eTBM: { tbm_form_path: 'tbm_form', tbm_photo_path: 'tbm_session', ptw_form_path: 'ptw_form' },
		ePPE: { ppe_photo_path: 'ppe_photo' },
		eHKP: { hkp_photo_path: 'hkp_photo' }
	};

	function fileUrlFor(type, colName, path) {
		if (!path) return '';
		const bucket = bucketMap[type]?.[colName];
		if (!bucket) return '';
		const { data } = supabase.storage.from(bucket).getPublicUrl(path);
		return data?.publicUrl ?? '';
	}

	function fileName(path) {
		if (!path) return '';
		const p = String(path);
		return p.split('/').pop() || p;
	}

	async function loadForms() {
		loading = true;
		errorMsg = '';
		rows = [];

		try {
			const table = tableMap[formType];
			const selectCols = selectMap[formType];

			if (!table || !selectCols) {
				loading = false;
				return;
			}

			let q = supabase.from(table).select(selectCols).order('created_at', { ascending: false });

			const startISO = toISOStart(fromDate);
			const endISO = toISOEnd(toDate);
			if (startISO) q = q.gte('created_at', startISO);
			if (endISO) q = q.lte('created_at', endISO);

			const { data, error } = await q;
			if (error) throw error;

			let list = data ?? [];
			const s = searchText.trim().toLowerCase();
			if (s) {
				const cols = searchCols[formType];
				list = list.filter((r) =>
					cols.some((c) =>
						String(r?.[c] ?? '')
							.toLowerCase()
							.includes(s)
					)
				);
			}

			rows = list;
		} catch (e) {
			errorMsg = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	}

	async function openDetailsModal(row) {
		showDetailsModal = true;
		modalLoading = true;
		modalError = '';
		details = null;
		activeRow = row;

		try {
			const table = tableMap[formType];
			const detailsSelect = detailsSelectMap[formType] || '';

			if (!detailsSelect) {
				details = {};
				return;
			}

			const { data, error } = await supabase
				.from(table)
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

	function formatSubsections(subsections) {
		if (!Array.isArray(subsections) || subsections.length === 0) return '-';

		const sectionText = subsections
			.map((section) => {
				const title = (section?.title ?? '').trim();
				const items = Array.isArray(section?.items) ? section.items : [];

				const lines = items.map((item) => {
					const label = (item?.label ?? '').trim();
					const score = item?.score ?? '';
					const remarks = (item?.remarks ?? '').trim();

					return `• ${label} — Score: ${score}`;
				});

				return [title, ...lines].filter(Boolean).join('\n');
			})
			.filter(Boolean);

		return sectionText.join('\n\n');
	}

	loadForms();
</script>

<h1 class="title">Site Safety eForm Information</h1>

<div class="container">
	<label class="radio-item">
		<input type="radio" name="eForm-type" value="eTBM" bind:group={formType} onchange={loadForms} />
		<span>e-TBM Data</span>
	</label>

	<label class="radio-item">
		<input type="radio" name="eForm-type" value="ePPE" bind:group={formType} onchange={loadForms} />
		<span>e-PPE Data</span>
	</label>

	<label class="radio-item">
		<input type="radio" name="eForm-type" value="eHKP" bind:group={formType} onchange={loadForms} />
		<span>e-HKP Data</span>
	</label>

	<label class="radio-item">
		<input type="radio" name="eForm-type" value="eZCA" bind:group={formType} onchange={loadForms} />
		<span>e-ZCA Data</span>
	</label>
</div>

<div class="filter-bar">
	<div>
		<p>Project ID/Project Name</p>
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
	<button class="button-download"><CloudDownload /><span>Excel</span></button>
</div>

{#if !formType}
	<p class="hint">Please choose an eForm data.</p>
{:else if loading}
	<p>Loading...</p>
{:else if errorMsg}
	<p class="error">{errorMsg}</p>
{:else if rows.length === 0}
	<p>No records found.</p>
{:else}
	{#each rows as r (r.id)}
		<div class="project-box">
			<div class="project-box-top">
				<p class="project-name">{r.project_no ?? '-'} {formType}</p>
				<button
					class="button-primary"
					id="button-details"
					type="button"
					onclick={() => openDetailsModal(r)}
				>
					View Details
				</button>
			</div>
			<p><b>Project Name:&nbsp;</b>{r.project_name ?? '-'}</p>
			<p><b>Project ID:&nbsp;</b>{r.project_no ?? '-'}</p>
			<p><b>Submitted By:&nbsp;</b>{r.created_by_name ?? '-'}</p>
			<p><b>Created Date:&nbsp;</b>{formatDateTime(r.created_at)}</p>
			{#if formType === 'eTBM'}
				<p><b>Meeting Date:&nbsp;</b>{formatDate(r.meeting_date)}</p>

				<p class="doc-line">
					<b>TBM Form:&nbsp;</b>
					{#if r.tbm_form_path}
						<a
							href={fileUrlFor('eTBM', 'tbm_form_path', r.tbm_form_path)}
							target="_blank"
							class="file-url"
						>
							{fileName(r.tbm_form_path)}
						</a>
					{:else}
						-
					{/if}
				</p>
				<p class="doc-line">
					<b>TBM Photo:&nbsp;</b>
					{#if r.tbm_photo_path}
						<a
							href={fileUrlFor('eTBM', 'tbm_photo_path', r.tbm_photo_path)}
							target="_blank"
							class="file-url"
						>
							{fileName(r.tbm_photo_path)}
						</a>
					{:else}
						-
					{/if}
				</p>
				<p class="doc-line">
					<b>PTW Form:&nbsp;</b>
					{#if r.ptw_form_path}
						<a
							href={fileUrlFor('eTBM', 'ptw_form_path', r.ptw_form_path)}
							target="_blank"
							class="file-url"
						>
							{fileName(r.ptw_form_path)}
						</a>
					{:else}
						-
					{/if}
				</p>
			{:else if formType === 'ePPE'}
				<p><b>Activity Date:&nbsp;</b>{formatDate(r.activity_date)}</p>
				<p class="doc-line">
					<b>PPE Photo:&nbsp;</b>
					{#if r.ppe_photo_path}
						<a
							href={fileUrlFor('ePPE', 'ppe_photo_path', r.ppe_photo_path)}
							target="_blank"
							class="file-url"
						>
							{fileName(r.ppe_photo_path)}
						</a>
					{:else}
						-
					{/if}
				</p>
			{:else if formType === 'eHKP'}
				<p><b>Activity Date:&nbsp;</b>{formatDate(r.activity_date)}</p>
				<p class="doc-line">
					<b>HKP Photo:&nbsp;</b>
					{#if r.hkp_photo_path}
						<a
							href={fileUrlFor('eHKP', 'hkp_photo_path', r.hkp_photo_path)}
							target="_blank"
							class="file-url"
						>
							{fileName(r.hkp_photo_path)}
						</a>
					{:else}
						-
					{/if}
				</p>
			{:else if formType === 'eZCA'}
				<p><b>Audit Date:&nbsp;</b>{formatDate(r.audit_date)}</p>
			{/if}
		</div>
	{/each}
	<Modal open={showDetailsModal} title="eForm Details" onclose={closeDetailsModal} closeOnBackdrop>
		{#if modalLoading}
			<p>Loading...</p>
		{:else if modalError}
			<p class="error">{modalError}</p>
		{:else if formType === 'eTBM'}
			<p><b>Meeting Topics:</b></p>
			<p class="form-details">{formatArray(details?.meeting_topics ?? '-')}</p>
			<p><b>Competency:</b></p>
			<p class="form-details">{formatCompetency(details?.competency ?? '-')}</p>
			<p><b>Attendance:</b></p>
			<p class="form-details">{formatAttendance(details?.attendance ?? '-')}</p>
		{:else if formType === 'ePPE'}
			<p><b>Attendance:</b></p>
			<p class="form-details">{formatAttendance(details?.attendance ?? '-')}</p>
		{:else if formType === 'eHKP'}
			<p><b>Report Day:</b></p>
			<p class="form-details">{formatReportDay(details?.report_day ?? '-')}</p>
		{:else if formType === 'eZCA'}
			<p><b>Subsections:</b></p>
			<p class="form-details subsections-text">
				{formatSubsections(details?.subsections ?? '-')}
			</p>
		{/if}

		{#snippet footer()}
			<button type="button" class="button-primary" onclick={closeDetailsModal}>Close</button>
		{/snippet}
	</Modal>
{/if}

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

	button:hover {
		background-color: #064c6da4;
	}

	.button-download {
		background-color: #31b647;
		width: 150px;
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

	.button-primary {
		background-color: #091747;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.container {
		display: flex;
		flex-wrap: wrap;
		margin: 0 10px 20px 10px;
		gap: 10px 16px;
		align-items: center;
	}

	.date-from,
	.date-to {
		height: 40px;
		padding: 0 10px;
		font-size: 14px;
	}

	.file-url {
		text-decoration: underline;
		color: #064c6dd7;
	}

	.file-url:hover {
		color: #064c6da4;
	}

	.filter-bar {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin: 10px;
	}

	.filter-bar p {
		margin: 0 0 6px 0;
	}

	.filter-input {
		width: 350px;
		height: 40px;
		padding: 0 10px;
		font-size: 14px;
	}

	.form-details {
		margin-bottom: 10px;
	}

	.forms-date {
		cursor: pointer;
	}

	.forms-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.hint {
		margin: 10px;
	}

	.project-box {
		margin: 10px;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
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
		font-weight: bold;
	}

	.radio-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
	}

	.radio-item input[type='radio'] {
		margin: 0;
	}

	.site-safety-download {
		display: flex;
		margin: 10px;
	}

	.subsections-text {
		white-space: pre-wrap;
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

		.filter-bar {
			flex-wrap: wrap;
			gap: 12px;
		}

		.filter-bar > div {
			min-width: 220px;
		}

		.filter-input,
		.date-from,
		.date-to {
			width: 100%;
		}

		.container {
			flex-wrap: wrap;
			gap: 8px 12px;
		}

		.radio-item {
			flex: 0 0 calc(33.333% - 16px);
		}

		.filter-bar {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.filter-input {
			width: 100%;
		}

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

		.project-box {
			margin: 8px;
			padding: 10px;
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
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

		.filter-bar {
			flex-direction: column;
			align-items: stretch;
			margin: 8px;
			padding: 8px 0;
			gap: 12px;
		}

		.filter-bar > div {
			width: 100%;
		}

		.filter-input,
		.date-from,
		.date-to {
			width: 100%;
		}

		.container {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 8px 12px;
			align-items: center;
		}

		.container input[type='radio'] {
			margin: 0;
			grid-column: span 1;
		}

		.radio-item {
			flex: 0 0 calc(33.333% - 16px);
		}

		.container label {
			margin-left: 4px;
		}

		.filter-input {
			font-size: 13px;
		}

		button,
		.button-primary,
		.button-download {
			width: 100%;
		}

		#button-details {
			margin-bottom: 10px;
		}

		.project-box {
			padding: 8px;
		}

		.project-box p {
			font-size: 13px;
		}

		.project-name {
			font-size: 15px;
		}
	}
</style>