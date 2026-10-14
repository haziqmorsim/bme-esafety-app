<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSupabase, supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';

	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';

	let selectedDate = $state(new Date().toISOString().slice(0, 10));
	let rows = $state([]);
	let errorMsg = $state('');
	let loading = $state(false);

	let currentPage = $state(1);
	const pageSize = 10;

	const records = $derived.by(() => rows);
	const totalPages = $derived.by(() => Math.max(1, Math.ceil(records.length / pageSize)));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, i) => i + 1));
	const paginated = $derived.by(() =>
		records.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	function localDayRangeISO(dateStr) {
		const start = new Date(dateStr + 'T00:00:00');
		const end = new Date(dateStr + 'T23:59:59.999');
		return { startISO: start.toISOString(), endISO: end.toISOString() };
	}

	function displayName(profile) {
		return `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email || '—';
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

	async function ensureSignedIn() {
		const auth = await requireUser();
		if (!auth) return null;
		return auth.user;
	}

	async function loadAttendance() {
		loading = true;
		errorMsg = '';
		rows = [];

		try {
			const user = await ensureSignedIn();
			if (!user) return;

			const { data: users, error: usersErr } = await supabase
				.from('profiles')
				.select('id, nickname, first_name, last_name, email, position')
				.eq('position', 'Site Safety Supervisor')
				.order('first_name', { ascending: true });

			if (usersErr) throw usersErr;

			const { startISO, endISO } = localDayRangeISO(selectedDate);

			const [tbmRes, ppeRes, hkpRes] = await Promise.all([
				supabase
					.from('tbm_submissions')
					.select('created_by')
					.gte('created_at', startISO)
					.lte('created_at', endISO),

				supabase
					.from('ppe_submissions')
					.select('created_by')
					.gte('created_at', startISO)
					.lte('created_at', endISO),

				supabase
					.from('hkp_submissions')
					.select('created_by')
					.gte('created_at', startISO)
					.lte('created_at', endISO)
			]);

			if (tbmRes.error) throw tbmRes.error;
			if (ppeRes.error) throw ppeRes.error;
			if (hkpRes.error) throw hkpRes.error;

			const tbmSet = new Set((tbmRes.data ?? []).map((r) => r.created_by));
			const ppeSet = new Set((ppeRes.data ?? []).map((r) => r.created_by));
			const hkpSet = new Set((hkpRes.data ?? []).map((r) => r.created_by));

			rows = (users ?? []).map((u) => {
				const etbm = tbmSet.has(u.id);
				const eppe = ppeSet.has(u.id);
				const ehkp = hkpSet.has(u.id);

				return {
					date: selectedDate,
					name: displayName(u),
					etbm: etbm ? 'Yes' : 'No',
					eppe: eppe ? 'Yes' : 'No',
					ehkp: ehkp ? 'Yes' : 'No',
					status: etbm && eppe && ehkp ? 'Present' : 'Absent'
				};
			});
		} catch (e) {
			errorMsg = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	}

	onMount(loadAttendance);

	$effect(() => {
		selectedDate;
		currentPage = 1;
		if (selectedDate) loadAttendance();
	});

	function gotoPage(n) {
		currentPage = Math.min(Math.max(1, n), totalPages);
	}
	function prev() {
		gotoPage(currentPage - 1);
	}
	function next() {
		gotoPage(currentPage + 1);
	}
</script>

<h1 class="title">Working Day Attendance (e-WDA) Record</h1>

<div class="project-box">
	<div class="date-records">
		<div class="forms-date">
			<p>Filter by Date</p>
			<input
				type="date"
				class="filter-date"
				bind:value={selectedDate}
				onchange={loadAttendance}
				onfocus={(e) => e.target.showPicker?.()}
			/>
		</div>
		<div class="records">
			Showing <b>{paginated.length}</b> of <b>{records.length}</b> records
		</div>
	</div>

	{#if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	<div class="table-container">
		<table class="wda-table">
			<thead>
				<tr>
					<th>Date</th>
					<th>Site Safety Supervisor Name</th>
					<th>eTBM</th>
					<th>ePPE</th>
					<th>eHKP</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each paginated as r (r.name)}
					<tr>
						<td style="text-align:center">{formatDate(r.date)}</td>
						<td>{r.name}</td>
						<td style="text-align:center">{r.etbm}</td>
						<td style="text-align:center">{r.eppe}</td>
						<td style="text-align:center">{r.ehkp}</td>
						<td style="text-align:center">{r.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="pagination">
			<button onclick={prev} disabled={currentPage === 1} aria-label="Previous"
				><ChevronsLeft /></button
			>
			{#each pages as p}
				<button class:active={p === currentPage} onclick={() => gotoPage(p)}>{p}</button>
			{/each}
			<button onclick={next} disabled={currentPage === totalPages} aria-label="Next"
				><ChevronsRight /></button
			>
		</div>
	</div>
</div>

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	.date-records {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 12px;
	}

	.filter-date {
		font-size: 12px;
		cursor: pointer;
	}

	.filter-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.pagination {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		margin-top: 12px;
	}

	.pagination button {
		min-width: 34px;
		height: 34px;
		border-radius: 4px;
		border: 1px solid #283a5a33;
		background: white;
		cursor: pointer;
		padding: 0 8px;
	}

	.pagination button[disabled] {
		opacity: 0.5;
		cursor: default;
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

	.project-box {
		margin: 10px;
		padding: 10px;
		font-size: 14px;
	}

	.records {
		font-size: 12px;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.table-container {
		margin-top: 12px;
	}

	.wda-table {
		width: 100%;
		border-collapse: collapse;
	}

	.wda-table th,
	.wda-table td {
		border: 1px solid #091747b9;
		padding: 12px 16px;
		text-align: left;
		font-size: 14px;
	}

	.wda-table thead th {
		background-color: #091747;
		color: #ffffff;
		font-weight: 700;
		text-align: center;
	}

	.wda-table tbody tr:nth-child(even) {
		background-color: #ececec;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 12px;
		}

		.date-records {
			flex-wrap: wrap;
			align-items: flex-start;
			gap: 10px;
		}

		.records {
			width: 100%;
			text-align: left;
		}

		.table-container {
			overflow-x: auto;
		}

		.wda-table {
			min-width: 900px;
		}

		.wda-table th,
		.wda-table td {
			padding: 10px 12px;
			font-size: 13px;
		}

		.pagination {
			flex-wrap: wrap;
			gap: 6px;
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

		.date-records {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.filter-date {
			width: 100%;
			font-size: 13px;
		}

		.forms-date {
			width: 100%;
		}

		.records {
			font-size: 12px;
		}

		.table-container {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.wda-table {
			min-width: 720px;
		}

		.wda-table th,
		.wda-table td {
			padding: 8px 10px;
			font-size: 12px;
			white-space: nowrap;
		}

		.pagination {
			flex-wrap: wrap;
		}

		.pagination button {
			min-width: 36px;
			height: 36px;
		}
	}
</style>
