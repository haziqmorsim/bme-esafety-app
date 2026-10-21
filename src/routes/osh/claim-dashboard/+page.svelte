<script>
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import Spinner from '$lib/components/Spinner.svelte';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import Mails from '@lucide/svelte/icons/mails';
	import Files from '@lucide/svelte/icons/files';
	import Mail from '@lucide/svelte/icons/mail';
	import FileIcon from '@lucide/svelte/icons/file';
	import Download from '@lucide/svelte/icons/download';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';
	import Modal from '$lib/components/Modal.svelte';
	import Pagination, { pageSlice } from '$lib/components/Pagination.svelte';
	import { toast } from '$lib/stores/toast';
	import { sendReport, downloadReport } from '$lib/make';

	const BUCKET = 'scf_uploads';
	const PAGE_SIZE = 20;

	const AMOUNT_FIELDS = [
		{ key: 'site_allowance', label: 'Site Allowance' },
		{ key: 'accommodation', label: 'Accommodation' },
		{ key: 'toll_fare', label: 'Toll Fare' },
		{ key: 'claim_mileage', label: 'Mileage' },
		{ key: 'fuel_cost', label: 'Fuel Cost' },
		{ key: 'site_purchase', label: 'Site Purchase' },
		{ key: 'claim_other', label: 'Other' }
	];

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	const monthShort = monthNames.map((m) => m.slice(0, 3));

	const today = new Date();
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	let users = $state([]);
	let selectedUser = $state(''); // '' = all users

	let claims = $state([]);
	let loading = $state(false);
	let errorMsg = $state('');
	let loadToken = 0;

	let currentPage = $state(1);

	let showDetailsModal = $state(false);
	let selectedClaim = $state(null);

	const userNameById = $derived.by(() => {
		const map = {};
		for (const u of users) map[u.id] = getUserName(u);
		return map;
	});

	const filteredClaims = $derived(
		selectedUser ? claims.filter((c) => c.created_by === selectedUser) : claims
	);

	const monthlyTotal = $derived(filteredClaims.reduce((sum, c) => sum + claimAmount(c), 0));

	const paginated = $derived(pageSlice(filteredClaims, currentPage, PAGE_SIZE));

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function dateKey(year, month, day) {
		return `${year}-${pad(month + 1)}-${pad(day)}`;
	}

	function formatShortDate(key) {
		if (!key) return '';
		const [y, m, d] = key.split('-').map(Number);
		return `${pad(d)} ${monthShort[m - 1]} ${y}`;
	}

	function formatLongDate(key) {
		if (!key) return '';
		const [y, m, d] = key.split('-').map(Number);
		return `${monthNames[m - 1]} ${d}, ${y}`;
	}

	function formatDateTime(iso) {
		if (!iso) return '-';
		const date = new Date(iso);
		const datePart = `${monthShort[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
		const timePart = date
			.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
			.toLowerCase();
		return `${datePart} ${timePart}`;
	}

	function getUserName(user) {
		return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || '-';
	}

	function claimantName(claim) {
		return userNameById[claim.created_by] || claim.staff_name || '-';
	}

	function hasValue(v) {
		return v !== null && v !== undefined && String(v).trim() !== '';
	}

	function toNumber(v) {
		const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
		return Number.isFinite(n) ? n : 0;
	}

	function claimAmount(claim) {
		return AMOUNT_FIELDS.reduce((sum, f) => sum + toNumber(claim[f.key]), 0);
	}

	function money(n) {
		return n.toFixed(2);
	}

	function fileName(path) {
		return path ? String(path).split('/').pop() : '';
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
		currentPage = 1;
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
		currentPage = 1;
	}

	function onUserChange() {
		currentPage = 1;
	}

	async function loadUsers() {
		const { data, error } = await supabase
			.from('profiles')
			.select('id, first_name, last_name, email')
			.order('first_name');

		if (error) {
			errorMsg = error.message;
			users = [];
			return;
		}
		users = data ?? [];
	}

	async function loadClaims(year, month) {
		const token = ++loadToken;
		loading = true;
		errorMsg = '';

		try {
			const auth = await requireUser();
			if (!auth) return;

			const start = dateKey(year, month, 1);
			const end = dateKey(year, month, new Date(year, month + 1, 0).getDate());

			const { data, error } = await supabase
				.from('scf_submissions')
				.select('*')
				.gte('claim_date', start)
				.lte('claim_date', end)
				.order('claim_date', { ascending: true })
				.order('created_at', { ascending: true });

			if (token !== loadToken) return; // a newer month was requested meanwhile
			if (error) throw error;

			claims = data ?? [];
		} catch (error) {
			if (token === loadToken) errorMsg = error?.message ?? String(error);
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;
		loadUsers();
	});

	$effect(() => {
		loadClaims(viewYear, viewMonth);
	});

	let reportBusy = $state('');

	async function runReportAction(action, scope) {
		if (reportBusy) return;
		const userId = selectedUser;
		if (scope === 'one' && !userId) {
			toast.error('Select a user first.');
			return;
		}

		const year = viewYear;
		const month = viewMonth;
		const period = `${monthNames[month]} ${year}`;
		reportBusy = `${action}-${scope}`;

		try {
			if (action === 'download') {
				toast.info('Preparing the Staff Claim Form(s) in Make. This can take a minute...');
				const res = await downloadReport('claim-forms', { year, month, userId: scope === 'one' ? userId : null });
				if (res.ok) toast.success(`Downloaded ${res.fileName}`);
				else toast.error(res.error);
				return;
			}

			const res = await sendReport({
				report: 'claim',
				year,
				month,
				userId: scope === 'one' ? userId : null,
				recipient: action // 'staff' | 'me'
			});
			if (!res.ok) {
				toast.error(res.error);
				return;
			}

			const count = res.data?.sent ?? 0;
			const target = action === 'me' ? 'your e-mail' : count === 1 ? "the user's e-mail" : "each user's e-mail";
			toast.success(`${count} Staff Claim Form${count === 1 ? '' : 's'} for ${period} will be sent to ${target} shortly.`);
			if (res.data?.skipped?.length) toast.info(`No e-mail address for: ${res.data.skipped.join(', ')}`);
		} finally {
			reportBusy = '';
		}
	}

	function openDetails(claim) {
		selectedClaim = claim;
		showDetailsModal = true;
	}

	function closeDetails() {
		showDetailsModal = false;
		selectedClaim = null;
	}

	async function openAttachment(path) {
		if (!path) return;
		const tab = window.open('', '_blank');

		let url = '';
		const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
		if (!error && data?.signedUrl) {
			url = data.signedUrl;
		} else {
			url = supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? '';
		}

		if (tab && url) tab.location.href = url;
		else if (tab) tab.close();
	}
</script>

<h1 class="title">Staff Claim Dashboard</h1>

<div class="project-box">
	<div class="total-card">
		<p class="total-label">Monthly Total Claim</p>
		<p class="total-value">RM {money(monthlyTotal)}</p>
	</div>

	<div class="toolbar">
		<div class="month-nav">
			<button class="nav" onclick={prevMonth} aria-label="Previous month">
				<ChevronsLeft />
			</button>
			<div class="month-label">{monthNames[viewMonth]} {viewYear}</div>
			<button class="nav" onclick={nextMonth} aria-label="Next month">
				<ChevronsRight />
			</button>
		</div>

		<div class="user-filter">
			<p>User</p>
			<select bind:value={selectedUser} onchange={onUserChange} class="user-select">
				<option value="">All Users</option>
				{#each users as item (item.id)}
					<option value={item.id}>{getUserName(item)}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="action-buttons">
		<button
			class="action-button bg-teal"
			aria-label="Mails"
			title="Send Staff Claim Form to the Users' E-mails"
			disabled={!!reportBusy}
			onclick={() => runReportAction('staff', 'all')}
		>
			{#if reportBusy === 'staff-all'}<span class="busy-dot"></span>{:else}<Mails />{/if}
		</button>
		<button
			class="action-button bg-navy"
			aria-label="Files"
			title="Send All Staff Claim Forms to My E-mail"
			disabled={!!reportBusy}
			onclick={() => runReportAction('me', 'all')}
		>
			{#if reportBusy === 'me-all'}<span class="busy-dot"></span>{:else}<Files />{/if}
		</button>
		<button
			class="action-button bg-green"
			aria-label="Download"
			title="Download All Staff Claim Forms in Excel"
			disabled={!!reportBusy}
			onclick={() => runReportAction('download', 'all')}
		>
			{#if reportBusy === 'download-all'}<span class="busy-dot"></span>{:else}<Download />{/if}
		</button>
		<button
			class="action-button bg-teal"
			aria-label="Mail"
			title="Send Staff Claim Form to This User's E-mail"
			disabled={!!reportBusy || !selectedUser}
			onclick={() => runReportAction('staff', 'one')}
		>
			{#if reportBusy === 'staff-one'}<span class="busy-dot"></span>{:else}<Mail />{/if}
		</button>
		<button
			class="action-button bg-navy"
			aria-label="File"
			title="Send This User's Staff Claim Form to My E-mail"
			disabled={!!reportBusy || !selectedUser}
			onclick={() => runReportAction('me', 'one')}
		>
			{#if reportBusy === 'me-one'}<span class="busy-dot"></span>{:else}<FileIcon />{/if}
		</button>
		<button
			class="action-button bg-green"
			aria-label="Download"
			title="Download This User's Staff Claim Form in Excel"
			disabled={!!reportBusy || !selectedUser}
			onclick={() => runReportAction('download', 'one')}
		>
			{#if reportBusy === 'download-one'}<span class="busy-dot"></span>{:else}<ArrowDownToLine />{/if}
		</button>
	</div>

	{#if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	<div class="records">
		Showing <b>{paginated.length}</b> of <b>{filteredClaims.length}</b> claims
	</div>

	<div class="table-container" class:is-loading={loading}>
		<table class="claim-table">
			<thead>
				<tr>
					<th class="col-no">No</th>
					<th>Name</th>
					<th>Claim Date</th>
					<th>Project</th>
					<th>Amount (RM)</th>
					<th class="col-action"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each paginated as claim, i (claim.id)}
					<tr>
						<td class="col-no" data-label="No">{(currentPage - 1) * PAGE_SIZE + i + 1}.</td>
						<td data-label="Name">{claimantName(claim)}</td>
						<td class="center" data-label="Claim Date">{formatLongDate(claim.claim_date)}</td>
						<td class="center" data-label="Project">{claim.project_no ?? '-'}</td>
						<td class="center" data-label="Amount (RM)">{money(claimAmount(claim))}</td>
						<td class="col-action">
							<button class="button-details" onclick={() => openDetails(claim)}>
								View Details
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="empty">
							{#if loading}
								<Spinner inline size={140} label="Loading claims" />
							{:else}
								No claims submitted for this month.
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<Pagination
		bind:page={currentPage}
		totalItems={filteredClaims.length}
		pageSize={PAGE_SIZE}
		showSummary={false}
	/>
</div>

<Modal
	open={showDetailsModal && !!selectedClaim}
	title={selectedClaim ? `Claim Details (${formatShortDate(selectedClaim.claim_date)})` : ''}
	subtitle={selectedClaim ? claimantName(selectedClaim) : ''}
	onclose={closeDetails}
	closeOnBackdrop
>
	{#if selectedClaim}
		<div class="details-box">
			<div class="detail">
				<p class="detail-label">Project:</p>
				<p>{selectedClaim.project_no ?? '-'}</p>
			</div>

			<div class="detail">
				<p class="detail-label">Travel Location:</p>
				<p>{selectedClaim.description ?? '-'}</p>
			</div>

			{#each AMOUNT_FIELDS.filter((f) => hasValue(selectedClaim[f.key])) as field (field.key)}
				<div class="detail">
					<p class="detail-label">{field.label}:</p>
					<p>RM {selectedClaim[field.key]}</p>
				</div>
			{/each}

			<div class="detail">
				<p class="detail-label">Total Amount:</p>
				<p>RM {money(claimAmount(selectedClaim))}</p>
			</div>

			{#if hasValue(selectedClaim.claim_remarks)}
				<div class="detail">
					<p class="detail-label">Remarks:</p>
					<p>{selectedClaim.claim_remarks}</p>
				</div>
			{/if}

			{#if hasValue(selectedClaim.staff_position)}
				<div class="detail">
					<p class="detail-label">Position:</p>
					<p>{selectedClaim.staff_position}</p>
				</div>
			{/if}

			{#if hasValue(selectedClaim.department)}
				<div class="detail">
					<p class="detail-label">Department:</p>
					<p>{selectedClaim.department}</p>
				</div>
			{/if}

			<div class="detail">
				<p class="detail-label">Created Date:</p>
				<p>{formatDateTime(selectedClaim.created_at)}</p>
			</div>

			<div class="detail">
				<p class="detail-label">Acknowledged:</p>
				<p>{selectedClaim.acknowledged ? 'Yes' : 'No'}</p>
			</div>

			<div class="detail">
				<p class="detail-label">Attachment:</p>
				{#if selectedClaim.maps_screenshot_path}
					<button
						class="link-button"
						onclick={() => openAttachment(selectedClaim.maps_screenshot_path)}
					>
						<Paperclip size={14} />
						{fileName(selectedClaim.maps_screenshot_path)}
					</button>
				{:else}
					<p>-</p>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<button class="button-primary" onclick={closeDetails}>Close</button>
	{/snippet}
</Modal>

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
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

	button:hover {
		background-color: #093d85a4;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.button-primary {
		background-color: #091747;
		font-weight: bold;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.error {
		color: #c62828;
		font-weight: bold;
		margin: 8px 0;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		padding: 0 10px;
	}

	.project-box {
		margin: 10px;
		padding: 10px;
		font-size: 14px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	.total-card {
		display: inline-block;
		min-width: 250px;
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 10px 24px;
		text-align: center;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.total-label {
		margin: 0;
		font-size: 15px;
	}

	.total-value {
		margin: 2px 0 0;
		font-size: 24px;
		font-weight: bold;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px;
	}

	.month-nav {
		display: flex;
		align-items: center;
		gap: 4px;
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 4px 6px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.month-label {
		font-size: 16px;
		font-weight: bold;
		min-width: 140px;
		text-align: center;
	}

	.nav {
		background: none;
		color: #093d85;
		padding: 6px 10px;
		display: flex;
		align-items: center;
	}

	.nav:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.user-filter p {
		margin: 0 0 6px 0;
	}

	.user-select {
		height: 40px;
		width: 350px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
		background-color: #ffffff;
		color: #091747;
	}

	.user-select option {
		background-color: #ffffff;
		color: #091747;
	}

	.action-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 12px;
	}

	.action-button {
		width: 60px;
		height: 44px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
	}

	.action-button:hover {
		opacity: 0.8;
	}

	.action-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.busy-dot {
		width: 18px;
		height: 18px;
		border: 2px solid #ffffff;
		border-top-color: transparent;
		border-radius: 50%;
		animation: busy-spin 0.8s linear infinite;
	}

	@keyframes busy-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.bg-teal,
	.bg-teal:hover {
		background-color: #093d85;
	}

	.bg-navy,
	.bg-navy:hover {
		background-color: #091747;
	}

	.bg-green,
	.bg-green:hover {
		background-color: #31b647;
	}

	.records {
		font-size: 12px;
		margin-top: 12px;
	}

	.table-container {
		position: relative;
		margin-top: 8px;
		overflow-x: auto;
	}

	.table-container.is-loading {
		opacity: 0.6;
	}

	.claim-table {
		width: 100%;
		border-collapse: collapse;
	}

	.claim-table th,
	.claim-table td {
		border: 1px solid #091747b9;
		padding: 10px 16px;
		text-align: left;
		font-size: 14px;
	}

	.claim-table thead th {
		background-color: #091747;
		color: #ffffff;
		font-weight: 700;
		text-align: center;
	}

	.claim-table tbody tr:nth-child(even) {
		background-color: #ececec;
	}

	.claim-table .center {
		text-align: center;
	}

	.col-no {
		width: 60px;
	}

	.col-action {
		width: 130px;
		text-align: center !important;
	}

	.button-details {
		white-space: nowrap;
	}

	.empty {
		text-align: center !important;
		padding: 24px !important;
	}

	.details-box {
		border: 1px solid #091747b9;
		border-radius: 6px;
		padding: 10px 12px;
		display: grid;
		gap: 10px;
	}

	.detail p {
		margin: 0;
		word-break: break-word;
	}

	.detail-label {
		font-weight: bold;
	}

	.link-button {
		background: none;
		color: #093d85;
		padding: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: underline;
		font-style: italic;
		text-align: left;
		word-break: break-all;
	}

	.link-button:hover {
		background: none;
		color: #091747;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.claim-table {
			min-width: 820px;
		}

		.claim-table th,
		.claim-table td {
			padding: 8px 12px;
			font-size: 13px;
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

		.total-card {
			display: block;
		}

		.toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.month-nav {
			justify-content: space-between;
		}

		.user-select {
			width: 100%;
		}

		.action-buttons {
			justify-content: space-between;
		}

		.action-button {
			flex: 1;
			width: auto;
		}

		.table-container {
			overflow: visible;
		}

		.claim-table {
			min-width: 0;
		}

		.claim-table thead {
			display: none;
		}

		.claim-table,
		.claim-table tbody,
		.claim-table tr,
		.claim-table td {
			display: block;
			width: 100%;
		}

		.claim-table tbody tr {
			margin-bottom: 10px;
			padding: 8px 12px;
			border: 1px solid #dcdcdc;
			border-radius: 4px;
			background-color: #ffffff;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		}

		.claim-table tbody tr:nth-child(even) {
			background-color: #ffffff;
		}

		.claim-table td,
		.claim-table .center {
			display: grid;
			grid-template-columns: 104px minmax(0, 1fr);
			gap: 8px;
			padding: 4px 0;
			border: none;
			font-size: 14px;
			text-align: left;
			overflow-wrap: anywhere;
		}

		.claim-table td::before {
			content: attr(data-label);
			font-weight: bold;
		}

		.claim-table td.col-action {
			display: block;
			width: 100%;
			padding-top: 8px;
		}

		.claim-table td.col-action::before,
		.claim-table td.empty::before {
			content: none;
		}

		.button-details {
			width: 100%;
			padding: 9px 14px;
		}

		.claim-table td.empty {
			display: block;
		}
	}
</style>