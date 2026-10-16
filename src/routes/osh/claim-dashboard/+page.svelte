<script>
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import Mails from '@lucide/svelte/icons/mails';
	import Files from '@lucide/svelte/icons/files';
	import Mail from '@lucide/svelte/icons/mail';
	import FileIcon from '@lucide/svelte/icons/file';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Close from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';

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

	const totalPages = $derived(Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE)));

	const paginated = $derived(
		filteredClaims.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
	);

	const pageItems = $derived.by(() => {
		const items = [];
		let last = 0;
		for (let p = 1; p <= totalPages; p++) {
			if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2) {
				if (last && p - last > 1) items.push('gap-' + p);
				items.push(p);
				last = p;
			}
		}
		return items;
	});

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

	function gotoPage(n) {
		currentPage = Math.min(Math.max(1, n), totalPages);
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

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
	});

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

	function onWindowKeydown(event) {
		if (event.key === 'Escape' && showDetailsModal) closeDetails();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

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
		<button class="action-button bg-teal" aria-label="Mails" title="Mails"><Mails /></button>
		<button class="action-button bg-navy" aria-label="Files" title="Files"><Files /></button>
		<button class="action-button bg-teal" aria-label="Mail" title="Mail"><Mail /></button>
		<button class="action-button bg-navy" aria-label="File" title="File"><FileIcon /></button>
		<button class="action-button bg-green" aria-label="Download" title="Download"><ArrowDownToLine /></button>
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
						<td class="col-no">{(currentPage - 1) * PAGE_SIZE + i + 1}.</td>
						<td>{claimantName(claim)}</td>
						<td class="center">{formatLongDate(claim.claim_date)}</td>
						<td class="center">{claim.project_no ?? '-'}</td>
						<td class="center">{money(claimAmount(claim))}</td>
						<td class="col-action">
							<button class="button-details" onclick={() => openDetails(claim)}>
								View Details
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="empty">
							{loading ? 'Loading claims...' : 'No claims submitted for this month.'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if totalPages > 1}
		<div class="pagination">
			<button onclick={() => gotoPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
				<ChevronsLeft />
			</button>
			{#each pageItems as item (item)}
				{#if typeof item === 'number'}
					<button class:active={item === currentPage} onclick={() => gotoPage(item)}>{item}</button>
				{:else}
					<span class="page-gap">…</span>
				{/if}
			{/each}
			<button
				onclick={() => gotoPage(currentPage + 1)}
				disabled={currentPage === totalPages}
				aria-label="Next page"
			>
				<ChevronsRight />
			</button>
		</div>
	{/if}
</div>

{#if showDetailsModal && selectedClaim}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Claim details">
			<button class="modal-close" onclick={closeDetails} aria-label="Close">
				<Close size={18} />
			</button>
			<h2>Claim Details ({formatShortDate(selectedClaim.claim_date)})</h2>
			<p class="modal-subtitle">{claimantName(selectedClaim)}</p>

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

			<div class="modal-actions">
				<button class="button-primary" onclick={closeDetails}>Close</button>
			</div>
		</div>
	</div>
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
		color: #064c6dd7;
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

	.bg-teal,
	.bg-teal:hover {
		background-color: #064c6dd7;
	}

	.bg-navy,
	.bg-navy:hover {
		background-color: #091747;
	}

	.bg-green,
	.bg-green:hover {
		background-color: #31b647;
	}

	/* ---------- Table (same look as e-WDA) ---------- */

	.records {
		font-size: 12px;
		margin-top: 12px;
	}

	.table-container {
		position: relative; /* keeps the hidden "Actions" header label inside the scroll area */
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

	/* ---------- Pagination (same look as e-WDA) ---------- */

	.pagination {
		display: flex;
		align-items: center;
		gap: 6px;
		justify-content: flex-end;
		margin-top: 12px;
		flex-wrap: wrap;
	}

	.pagination button {
		min-width: 34px;
		height: 34px;
		border-radius: 4px;
		border: 1px solid #283a5a33;
		background: white;
		color: #091747;
		padding: 0 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.pagination button.active,
	.pagination button.active:focus {
		background: #091747;
		color: white;
		border-color: #091747;
	}

	.pagination button:hover:not([disabled]) {
		background: #091747b9;
		color: white;
	}

	.page-gap {
		padding: 0 4px;
	}

	/* ---------- Details modal ---------- */

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(9, 23, 71, 0.45);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 32px 20px;
		z-index: 10;
	}

	.modal {
		position: relative;
		width: min(460px, 100%);
		max-height: calc(100vh - 64px);
		overflow: auto;
		background: #ffffff;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.modal-close {
		position: absolute;
		top: 20px;
		right: 12px;
		background: transparent;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #091747;
	}

	.modal-close:hover {
		background: rgba(0, 0, 0, 0.05);
		border-radius: 50%;
	}

	.modal h2 {
		margin: 0 32px 2px 0;
		font-size: 18px;
		font-weight: bold;
	}

	.modal-subtitle {
		margin: 0 0 12px;
		font-size: 16px;
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
		color: #064c6dd7;
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

	.modal-actions {
		margin-top: 12px;
	}

	.modal-actions button {
		width: 100%;
	}

	/* ---------- Responsive ---------- */

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

		.modal-backdrop {
			padding: 16px 10px;
		}

		.modal {
			padding: 16px;
			max-height: calc(100vh - 32px);
		}
	}
</style>