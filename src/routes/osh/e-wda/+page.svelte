<script>
	import { untrack } from 'svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';
	import Pagination, { pageSlice } from '$lib/components/Pagination.svelte';

	function todayKey() {
		const now = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	}

	let selectedDate = $state(todayKey());
	let rows = $state([]);
	let errorMsg = $state('');
	let loading = $state(false);

	let currentPage = $state(1);
	const pageSize = 10;

	const records = $derived.by(() => rows);
	const paginated = $derived(pageSlice(records, currentPage, pageSize));
	let loadToken = 0;

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
		const token = ++loadToken;
		const date = selectedDate;
		loading = true;
		errorMsg = '';
		rows = [];

		try {
			const user = await ensureSignedIn();
			if (!user || token !== loadToken) return;

			const { data: users, error: usersErr } = await supabase
				.from('profiles')
				.select('id, nickname, first_name, last_name, email, position')
				.eq('position', 'Site Safety Supervisor')
				.order('first_name', { ascending: true });

			if (usersErr) throw usersErr;

			const { startISO, endISO } = localDayRangeISO(date);

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

			if (token !== loadToken) return;
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
					id: u.id,
					date,
					name: displayName(u),
					etbm: etbm ? 'Yes' : 'No',
					eppe: eppe ? 'Yes' : 'No',
					ehkp: ehkp ? 'Yes' : 'No',
					status: etbm && eppe && ehkp ? 'Present' : 'Absent'
				};
			});
		} catch (e) {
			if (token === loadToken) errorMsg = e?.message ?? String(e);
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	$effect(() => {
		const date = selectedDate;
		currentPage = 1;
		if (date) untrack(() => loadAttendance());
	});
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
				{#each paginated as r (r.id)}
					<tr>
						<td class="center" data-label="Date">{formatDate(r.date)}</td>
						<td data-label="Supervisor">{r.name}</td>
						<td class="center" data-label="eTBM">{r.etbm}</td>
						<td class="center" data-label="ePPE">{r.eppe}</td>
						<td class="center" data-label="eHKP">{r.ehkp}</td>
						<td
							class="center"
							class:present={r.status === 'Present'}
							class:absent={r.status === 'Absent'}
							data-label="Status">{r.status}</td
						>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="empty">
							{#if loading}
								<Spinner inline size={140} label="Loading attendance" />
							{:else}
								No Site Safety Supervisors found.
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<Pagination
			bind:page={currentPage}
			totalItems={records.length}
			{pageSize}
			showSummary={false}
		/>
	</div>
</div>

<style>
	.wda-table .present {
		color: var(--success);
		font-weight: 600;
	}

	.wda-table .absent {
		color: var(--danger);
		font-weight: 600;
	}

	.empty {
		text-align: center;
		padding: 16px;
		color: var(--muted);
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

	.records {
		font-size: 12px;
	}

	@media (max-width: 1024px) {
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
	}

	@media (max-width: 600px) {
		.date-records {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.filter-date {
			width: 100%;
			font-size: 13px;
		}

		.records {
			font-size: 12px;
		}

		.table-container {
			overflow: visible;
		}

		.wda-table {
			min-width: 0;
		}

		.wda-table thead {
			display: none;
		}

		.wda-table,
		.wda-table tbody,
		.wda-table tr,
		.wda-table td {
			display: block;
			width: 100%;
		}

		.wda-table tbody tr {
			margin-bottom: 10px;
			padding: 8px 12px;
			border: 1px solid var(--line);
			border-radius: var(--r-md);
			background-color: var(--surface);
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		}

		.wda-table tbody tr:nth-child(even) {
			background-color: var(--surface);
		}

		.wda-table td,
		.wda-table .center {
			display: grid;
			grid-template-columns: 96px minmax(0, 1fr);
			gap: 8px;
			padding: 4px 0;
			border: none;
			font-size: 14px;
			text-align: left;
			white-space: normal;
			overflow-wrap: anywhere;
		}

		.wda-table td::before {
			content: attr(data-label);
			font-weight: 600;
			color: var(--ink);
		}

		.wda-table td.empty {
			display: block;
			text-align: center;
		}

		.wda-table td.empty::before {
			content: none;
		}
	}

	.wda-table .present {
		color: var(--success);
		font-weight: 600;
	}

	.wda-table .absent {
		color: var(--danger);
		font-weight: 600;
	}

	.empty {
		text-align: center;
		padding: 16px;
		color: var(--muted);
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

	.records {
		font-size: 12px;
	}

	@media (max-width: 1024px) {
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
	}

	@media (max-width: 600px) {
		.date-records {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.filter-date {
			width: 100%;
			font-size: 13px;
		}

		.records {
			font-size: 12px;
		}

		.table-container {
			overflow: visible;
		}

		.wda-table {
			min-width: 0;
		}

		.wda-table thead {
			display: none;
		}

		.wda-table,
		.wda-table tbody,
		.wda-table tr,
		.wda-table td {
			display: block;
			width: 100%;
		}

		.wda-table tbody tr {
			margin-bottom: 10px;
			padding: 8px 12px;
			border: 1px solid var(--line);
			border-radius: var(--r-md);
			background-color: var(--surface);
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		}

		.wda-table tbody tr:nth-child(even) {
			background-color: var(--surface);
		}

		.wda-table td,
		.wda-table .center {
			display: grid;
			grid-template-columns: 96px minmax(0, 1fr);
			gap: 8px;
			padding: 4px 0;
			border: none;
			font-size: 14px;
			text-align: left;
			white-space: normal;
			overflow-wrap: anywhere;
		}

		.wda-table td::before {
			content: attr(data-label);
			font-weight: 600;
			color: var(--ink);
		}

		.wda-table td.empty {
			display: block;
			text-align: center;
		}

		.wda-table td.empty::before {
			content: none;
		}
	}
</style>