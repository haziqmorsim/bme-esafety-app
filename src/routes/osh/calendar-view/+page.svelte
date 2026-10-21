<script>
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import Spinner from '$lib/components/Spinner.svelte';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import Mails from '@lucide/svelte/icons/mails';
	import Files from '@lucide/svelte/icons/files';
	import FileIcon from '@lucide/svelte/icons/file';
	import Mail from '@lucide/svelte/icons/mail';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import Download from '@lucide/svelte/icons/download';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';
	import Modal from '$lib/components/Modal.svelte';
	import Pagination, { pageSlice } from '$lib/components/Pagination.svelte';
	import { sendReport, downloadReport } from '$lib/make';

	const startYear = 2026;
	const endYear = 2028;

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

	const REGIONS = [
		'Sabah',
		'Sarawak',
		'Selangor',
		'Melaka',
		'Pulau Pinang',
		'Johor',
		'Kedah',
		'Kelantan',
		'Negeri Sembilan',
		'Pahang',
		'Perak',
		'Perlis',
		'Terengganu',
		'W.P Kuala Lumpur',
		'W.P Labuan',
		'W.P Putrajaya'
	].sort((a, b) => a.localeCompare(b));

	let showSubmissionsModal = $state(false);
	let selectedDay = $state(null);
	let selectedDateKey = $state('');
	let submissionStatus = $state({ tbm: false, ppe: false, hkp: false });
	let submissionsLoading = $state(false);
	let submissionsError = $state('');
	let dayStatusByDate = $state({});
	let monthStatusError = $state('');
	let monthLoadToken = 0;

	let users = $state([]);
	let usersLoading = $state(false);
	let selectedUserId = $state('');
	let usersError = $state('');

	let currentUserId = $state('');
	let isAdmin = $state(false);
	let accessError = $state('');

	const viewUserId = $derived(isAdmin ? selectedUserId : currentUserId);

	function hasAdminDepartment(department) {
		const list = Array.isArray(department) ? department : [department];
		return list.some((d) => String(d ?? '').trim().toLowerCase() === 'admin');
	}

	// @ts-ignore
	const months = [];
	for (let y = startYear; y <= endYear; y++) {
		for (let m = 0; m < 12; m++) {
			months.push({ year: y, month: m });
		}
	}

	const today = new Date();

	const currentIndex = months.findIndex(
		(m) => m.year === today.getFullYear() && m.month === today.getMonth()
	);

	let index = $state(currentIndex !== -1 ? currentIndex : 0);

	const viewYear = $derived(months[index].year);

	let holidays = $state([]);
	let holidaysLoading = $state(false);
	let holidaysError = $state('');
	let holidayLoadToken = 0;

	let showHolidayModal = $state(false);
	let holidayMode = $state('create');
	let editingHoliday = $state(null);
	let holidayForm = $state({ holiday_date: '', name: '', regions: [] });
	let regionPick = $state('');
	let holidayFormError = $state('');
	let holidaySaving = $state(false);

	let showDeleteHolidayModal = $state(false);
	let deletingHoliday = $state(null);
	let holidayDeleting = $state(false);
	let holidayDeleteError = $state('');

	const availableRegions = $derived(REGIONS.filter((r) => !holidayForm.regions.includes(r)));
	const allRegionsSelected = $derived(REGIONS.every((r) => holidayForm.regions.includes(r)));

	const HOLIDAY_PAGE_SIZE = 10;
	let holidayPage = $state(1);

	const pagedHolidays = $derived(pageSlice(holidays, holidayPage, HOLIDAY_PAGE_SIZE));

	const holidayNamesByDate = $derived.by(() => {
		const map = {};
		for (const h of holidays) {
			(map[h.holiday_date] ??= []).push(h.name);
		}
		return map;
	});

	function prev() {
		if (index > 0) index -= 1;
	}

	function next() {
		if (index < months.length - 1) index += 1;
	}

	function isToday(day, year, month) {
		if (!day) return false;
		const today = new Date();
		return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
	}

	function getDateKey(year, month, day) {
		const mm = String(month + 1).padStart(2, '0');
		const dd = String(day).padStart(2, '0');
		return `${year}-${mm}-${dd}`;
	}

	function formatSelectedDate(day, year, month) {
		if (!day) return '';
		const date = new Date(year, month, day);
		const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
		const dateStr = date.toLocaleDateString('en-GB');
		return `${weekday}, ${dateStr}`;
	}

	function localDayRangeISO(year, month, day) {
		const start = new Date(year, month, day, 0, 0, 0, 0);
		const end = new Date(year, month, day, 23, 59, 59, 999);
		return { startISO: start.toISOString(), endISO: end.toISOString() };
	}

	function monthRangeISO(year, month) {
		const start = new Date(year, month, 1, 0, 0, 0, 0);
		const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
		return { startISO: start.toISOString(), endISO: end.toISOString() };
	}

	// @ts-ignore
	function getWeeks(year, month) {
		const first = new Date(year, month, 1);
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const weeks = [];
		let week = new Array(7).fill(null);

		let dayOfWeek = (first.getDay() + 6) % 7;
		let dayCounter = 1;

		for (let i = dayOfWeek; i < 7 && dayCounter <= daysInMonth; i++) {
			week[i] = dayCounter++;
		}
		weeks.push(week.slice());

		while (dayCounter <= daysInMonth) {
			week = new Array(7).fill(null);
			for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
				week[i] = dayCounter++;
			}
			weeks.push(week.slice());
		}

		while (weeks.length < 6) {
			weeks.push(new Array(7).fill(null));
		}

		return weeks;
	}

	function dayState(status) {
		if (!status) return 'not-working';
		const count = [status.tbm, status.ppe, status.hkp].filter(Boolean).length;
		if (count === 3) return 'working';
		if (count > 0) return 'incomplete';
		return 'not-working';
	}

	const STATE_LABEL = {
		working: 'Working',
		incomplete: 'Incomplete',
		'not-working': 'Not Working'
	};

	function getUserName(user) {
		return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || '-';
	}

	const openSubmissionsModal = (day) => {
		if (!day) return;
		const year = months[index].year;
		const month = months[index].month;
		selectedDay = day;
		selectedDateKey = getDateKey(year, month, day);
		loadSubmissionStatus(day, year, month);
		showSubmissionsModal = true;
	};

	const handleCellKeydown = (event, day) => {
		if (!day) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openSubmissionsModal(day);
		}
	};

	const closeSubmissionsModal = () => {
		showSubmissionsModal = false;
	};

	const loadSubmissionStatus = async (day, year, month) => {
		submissionsLoading = true;
		submissionsError = '';
		submissionStatus = { tbm: false, ppe: false, hkp: false };

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { supabase } = auth;
			const userId = isAdmin ? selectedUserId || auth.user.id : auth.user.id;

			const { startISO, endISO } = localDayRangeISO(year, month, day);

			const [tbmRes, ppeRes, hkpRes] = await Promise.all([
				supabase
					.from('tbm_submissions')
					.select('id')
					.eq('created_by', userId)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
					.limit(1),
				supabase
					.from('ppe_submissions')
					.select('id')
					.eq('created_by', userId)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
					.limit(1),
				supabase
					.from('hkp_submissions')
					.select('id')
					.eq('created_by', userId)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
					.limit(1)
			]);

			if (tbmRes.error) throw tbmRes.error;
			if (ppeRes.error) throw ppeRes.error;
			if (hkpRes.error) throw hkpRes.error;

			const status = {
				tbm: (tbmRes.data ?? []).length > 0,
				ppe: (ppeRes.data ?? []).length > 0,
				hkp: (hkpRes.data ?? []).length > 0
			};
			submissionStatus = status;
			dayStatusByDate = { ...dayStatusByDate, [getDateKey(year, month, day)]: status };
		} catch (error) {
			submissionsError = error?.message ?? String(error);
		} finally {
			submissionsLoading = false;
		}
	};

	const loadMonthStatuses = async (year, month, userId) => {
		const token = ++monthLoadToken;
		monthStatusError = '';
		dayStatusByDate = {};

		if (!userId) return;

		try {
			const { startISO, endISO } = monthRangeISO(year, month);

			const [tbmRes, ppeRes, hkpRes] = await Promise.all([
				supabase
					.from('tbm_submissions')
					.select('created_at')
					.eq('created_by', userId)
					.gte('created_at', startISO)
					.lte('created_at', endISO),
				supabase
					.from('ppe_submissions')
					.select('created_at')
					.eq('created_by', userId)
					.gte('created_at', startISO)
					.lte('created_at', endISO),
				supabase
					.from('hkp_submissions')
					.select('created_at')
					.eq('created_by', userId)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
			]);

			if (token !== monthLoadToken) return;

			if (tbmRes.error) throw tbmRes.error;
			if (ppeRes.error) throw ppeRes.error;
			if (hkpRes.error) throw hkpRes.error;

			const statusMap = {};

			const mark = (row, key) => {
				const date = new Date(row.created_at);
				const dateKey = getDateKey(date.getFullYear(), date.getMonth(), date.getDate());
				statusMap[dateKey] = statusMap[dateKey] || { tbm: false, ppe: false, hkp: false };
				statusMap[dateKey][key] = true;
			};

			(tbmRes.data ?? []).forEach((row) => mark(row, 'tbm'));
			(ppeRes.data ?? []).forEach((row) => mark(row, 'ppe'));
			(hkpRes.data ?? []).forEach((row) => mark(row, 'hkp'));

			dayStatusByDate = statusMap;
		} catch (error) {
			if (token === monthLoadToken) monthStatusError = error?.message ?? String(error);
		}
	};

	async function loadUsers() {
		if (!isAdmin) return;
		usersError = '';
		usersLoading = true;

		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('id, first_name, last_name, email')
				.order('first_name');

			if (error) {
				usersError = error.message;
				users = [];
				return;
			}

			users = data ?? [];
			if (!selectedUserId) selectedUserId = currentUserId;
		} finally {
			usersLoading = false;
		}
	}

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;

		currentUserId = auth.user.id;
		selectedUserId = auth.user.id;

		const { data: profile, error } = await supabase
			.from('profiles')
			.select('department')
			.eq('id', auth.user.id)
			.maybeSingle();

		if (error) {
			accessError = error.message;
			isAdmin = false;
			return;
		}

		isAdmin = hasAdminDepartment(profile?.department);
		if (isAdmin) loadUsers();
	});

	$effect(() => {
		loadMonthStatuses(months[index].year, months[index].month, viewUserId);
	});

	$effect(() => {
		loadHolidays(viewYear);
	});

	$effect(() => {
		holidayForm.holiday_date;
		holidayForm.name;
		holidayForm.regions.length;
		holidayFormError = '';
	});

	let reportBusy = $state('');

	async function runReportAction(action, scope) {
		if (reportBusy) return;
		const userId = selectedUserId || currentUserId;
		if (scope === 'one' && !userId) {
			toast.error('Select a user first.');
			return;
		}

		const year = months[index].year;
		const month = months[index].month;
		const period = `${monthNames[month]} ${year}`;
		reportBusy = `${action}-${scope}`;

		try {
			if (action === 'download') {
				toast.info('Preparing the Working Day Record...');
				const res = await downloadReport('working-days', { year, month, userId: scope === 'one' ? userId : null });
				if (res.ok) toast.success(`Downloaded ${res.fileName}`);
				else toast.error(res.error);
				return;
			}

			const res = await sendReport({
				report: 'ot',
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
			toast.success(`${count} OT claim report${count === 1 ? '' : 's'} for ${period} will be sent to ${target} shortly.`);
			if (res.data?.skipped?.length) toast.info(`No e-mail address for: ${res.data.skipped.join(', ')}`);
		} finally {
			reportBusy = '';
		}
	}

	function formatHolidayDate(key) {
		if (!key) return '';
		const [y, m, d] = key.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
		return `${weekday}, ${String(d).padStart(2, '0')} ${monthNames[m - 1]} ${y}`;
	}

	async function loadHolidays(year) {
		const token = ++holidayLoadToken;
		holidaysLoading = true;
		holidaysError = '';
		holidayPage = 1;

		try {
			const { data, error } = await supabase
				.from('holidays')
				.select('*')
				.gte('holiday_date', `${year}-01-01`)
				.lte('holiday_date', `${year}-12-31`)
				.order('holiday_date', { ascending: true })
				.order('name', { ascending: true });

			if (token !== holidayLoadToken) return;
			if (error) throw error;

			holidays = data ?? [];
		} catch (error) {
			if (token === holidayLoadToken) holidaysError = error?.message ?? String(error);
		} finally {
			if (token === holidayLoadToken) holidaysLoading = false;
		}
	}

	function sortHolidays(list) {
		return [...list].sort(
			(a, b) => a.holiday_date.localeCompare(b.holiday_date) || a.name.localeCompare(b.name)
		);
	}

	function openCreateHoliday() {
		if (!isAdmin) return;
		holidayMode = 'create';
		editingHoliday = null;
		holidayForm = { holiday_date: '', name: '', regions: [] };
		regionPick = '';
		holidayFormError = '';
		showHolidayModal = true;
	}

	function openEditHoliday(holiday) {
		if (!isAdmin) return;
		holidayMode = 'edit';
		editingHoliday = holiday;
		holidayForm = {
			holiday_date: holiday.holiday_date,
			name: holiday.name ?? '',
			regions: [...(holiday.regions ?? [])]
		};
		regionPick = '';
		holidayFormError = '';
		showHolidayModal = true;
	}

	function closeHolidayModal() {
		if (holidaySaving) return;
		showHolidayModal = false;
	}

	function addRegion() {
		if (regionPick && !holidayForm.regions.includes(regionPick)) {
			holidayForm.regions = [...holidayForm.regions, regionPick];
		}
		regionPick = '';
	}

	function removeRegion(region) {
		holidayForm.regions = holidayForm.regions.filter((r) => r !== region);
	}

	function toggleAllRegions(event) {
		holidayForm.regions = event.currentTarget.checked ? [...REGIONS] : [];
	}

	async function saveHoliday(event) {
		event.preventDefault();
		if (!isAdmin) return;
		holidayFormError = '';

		const name = holidayForm.name.trim();
		if (!holidayForm.holiday_date) return (holidayFormError = 'Please choose a date.');
		if (!name) return (holidayFormError = 'Please enter the holiday name.');
		if (holidayForm.regions.length === 0) {
			return (holidayFormError = 'Please choose at least one region.');
		}

		holidaySaving = true;

		try {
			const auth = await requireUser();
			if (!auth) return;

			const fields = {
				holiday_date: holidayForm.holiday_date,
				name,
				regions: holidayForm.regions
			};

			let saved;
			if (holidayMode === 'create') {
				const { data, error } = await supabase
					.from('holidays')
					.insert({ ...fields, created_by: auth.user.id })
					.select()
					.single();
				if (error) throw error;
				saved = data;
				holidays = sortHolidays([...holidays, saved]);
			} else {
				const { data, error } = await supabase
					.from('holidays')
					.update(fields)
					.eq('id', editingHoliday.id)
					.select();
				if (error) throw error;
				if (!data || data.length === 0) {
					throw new Error('The holiday was not updated. You may not have permission to edit it.');
				}
				saved = data[0];
				holidays = sortHolidays(holidays.map((h) => (h.id === saved.id ? saved : h)));
			}

			if (!saved.holiday_date.startsWith(String(viewYear))) {
				holidays = holidays.filter((h) => h.id !== saved.id);
			} else {
				const position = holidays.findIndex((h) => h.id === saved.id);
				if (position !== -1) holidayPage = Math.floor(position / HOLIDAY_PAGE_SIZE) + 1;
			}

			const wasCreate = holidayMode === 'create';
			holidaySaving = false;
			closeHolidayModal();

			let message = `Holiday "${saved.name}" ${wasCreate ? 'created' : 'updated'} successfully.`;
			if (!saved.holiday_date.startsWith(String(viewYear))) {
				message += ` It is listed under ${saved.holiday_date.slice(0, 4)}.`;
			}
			toast.success(message);
		} catch (error) {
			const msg = error?.message ?? String(error);
			holidayFormError =
				error?.code === '23505' ? 'A holiday with this name already exists on this date.' : msg;
		} finally {
			holidaySaving = false;
		}
	}

	function openDeleteHoliday(holiday) {
		if (!isAdmin) return;
		deletingHoliday = holiday;
		holidayDeleteError = '';
		showDeleteHolidayModal = true;
	}

	function closeDeleteHoliday() {
		if (holidayDeleting) return;
		showDeleteHolidayModal = false;
		deletingHoliday = null;
	}

	async function deleteHoliday() {
		if (!isAdmin || !deletingHoliday) return;
		holidayDeleting = true;
		holidayDeleteError = '';

		try {
			const { data, error } = await supabase
				.from('holidays')
				.delete()
				.eq('id', deletingHoliday.id)
				.select('id');

			if (error) throw error;
			if (!data || data.length === 0) {
				throw new Error('The holiday was not deleted. You may not have permission to delete it.');
			}

			const removedId = deletingHoliday.id;
			const removedName = deletingHoliday.name;
			holidays = holidays.filter((h) => h.id !== removedId);
			holidayDeleting = false;
			closeDeleteHoliday();
			toast.success(`Holiday "${removedName}" deleted successfully.`);
		} catch (error) {
			holidayDeleteError = error?.message ?? String(error);
		} finally {
			holidayDeleting = false;
		}
	}
</script>

<h1 class="title">Calendar View</h1>

<div class="project-box">
	<p>
		Note: Only submitting Tool Box Meeting, PPE Visual Inspections and Housekeeping forms will
		become Working Day (Starting from December 2025)
	</p>

	{#if isAdmin}
		<div class="user-filter">
			<div>
				<p class="filter-label">User</p>
				<div class="user-select-row">
					<select bind:value={selectedUserId} class="user-select">
						{#if users.length === 0}
							<option value={selectedUserId}>{usersLoading ? '' : 'No users found'}</option>
						{/if}
						{#each users as item (item.id)}
							<option value={item.id}>{getUserName(item)}</option>
						{/each}
					</select>
					{#if usersLoading}
						<Spinner inline size={140} label="Loading users" />
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if accessError}
		<p class="status-error">{accessError}</p>
	{/if}
	{#if usersError}
		<p class="status-error">{usersError}</p>
	{/if}
	{#if monthStatusError}
		<p class="status-error">{monthStatusError}</p>
	{/if}

	<div class="calendar">
		<div class="calendar-header">
			<button class="nav" onclick={prev} disabled={index === 0}><ChevronsLeft /></button>
			<div class="month-label">{monthNames[months[index].month]} {months[index].year}</div>
			<button class="nav" onclick={next} disabled={index === months.length - 1}
				><ChevronsRight /></button
			>
		</div>

		<div class="weekdays">
			<div><span class="wd-full">Monday</span><span class="wd-short">Mon</span></div>
			<div><span class="wd-full">Tuesday</span><span class="wd-short">Tue</span></div>
			<div><span class="wd-full">Wednesday</span><span class="wd-short">Wed</span></div>
			<div><span class="wd-full">Thursday</span><span class="wd-short">Thu</span></div>
			<div><span class="wd-full">Friday</span><span class="wd-short">Fri</span></div>
			<div><span class="wd-full">Saturday</span><span class="wd-short">Sat</span></div>
			<div><span class="wd-full">Sunday</span><span class="wd-short">Sun</span></div>
		</div>

		{#each getWeeks(months[index].year, months[index].month) as week}
			<div class="week">
				{#each week as day}
					{@const dateKey = day ? getDateKey(months[index].year, months[index].month, day) : ''}
					{@const cellState = dayState(dayStatusByDate[dateKey])}
					{@const holidayNames = dateKey ? holidayNamesByDate[dateKey] : undefined}
					<div
						class="cell {day ? `state-${cellState}` : ''}"
						class:today={isToday(day, months[index].year, months[index].month)}
						class:clickable={day}
						role="button"
						tabindex={day ? 0 : -1}
						onclick={() => openSubmissionsModal(day)}
						onkeydown={(event) => handleCellKeydown(event, day)}
					>
						{#if day}
							{#if holidayNames}
								<span
									class="holiday-dot"
									title={holidayNames.join(', ')}
									aria-label={`Public holiday: ${holidayNames.join(', ')}`}
								></span>
							{/if}
							<div
								class="cell-status"
								class:status-ok={cellState === 'working'}
								class:status-incomplete={cellState === 'incomplete'}
								class:status-bad={cellState === 'not-working'}
							>
								<span class="status-full">{STATE_LABEL[cellState]}</span>
								<span class="status-icon" aria-hidden="true">
									{#if cellState === 'working'}
										<Check size={16} strokeWidth={3} />
									{:else if cellState === 'incomplete'}
										<Minus size={16} strokeWidth={3} />
									{:else}
										<X size={16} strokeWidth={3} />
									{/if}
								</span>
							</div>
							<div class="day-num">{String(day).padStart(2, '0')}</div>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<ul class="legend" aria-label="Calendar legend">
		<li class="legend-state"><span class="legend-swatch state-working"></span>Working</li>
		<li class="legend-state"><span class="legend-swatch state-incomplete"></span>Incomplete</li>
		<li class="legend-state"><span class="legend-swatch state-not-working"></span>Not Working</li>
		<li><span class="legend-dot"></span>Holiday</li>
	</ul>

	{#if isAdmin}
		<div class="action-buttons">
			<button
				class="action-button bg-teal"
				aria-label="Mails"
				title="Send OT Claim Report to All Users' E-mails"
				disabled={!!reportBusy}
				onclick={() => runReportAction('staff', 'all')}
			>
				{#if reportBusy === 'staff-all'}<span class="busy-dot"></span>{:else}<Mails />{/if}
			</button>
			<button
				class="action-button bg-navy"
				aria-label="Files"
				title="Send All OT Claim Reports to My E-mail"
				disabled={!!reportBusy}
				onclick={() => runReportAction('me', 'all')}
			>
				{#if reportBusy === 'me-all'}<span class="busy-dot"></span>{:else}<Files />{/if}
			</button>
			<button
				class="action-button bg-green"
				aria-label="Download"
				title="Download All Users' Working Day Records in Excel"
				disabled={!!reportBusy}
				onclick={() => runReportAction('download', 'all')}
			>
				{#if reportBusy === 'download-all'}<span class="busy-dot"></span>{:else}<Download />{/if}
			</button>
			<button
				class="action-button bg-teal"
				aria-label="Mail"
				title="Send OT Claim Report to This User's E-mail"
				disabled={!!reportBusy}
				onclick={() => runReportAction('staff', 'one')}
			>
				{#if reportBusy === 'staff-one'}<span class="busy-dot"></span>{:else}<Mail />{/if}
			</button>
			<button
				class="action-button bg-navy"
				aria-label="File"
				title="Send This User's OT Claim Report to My E-mail"
				disabled={!!reportBusy}
				onclick={() => runReportAction('me', 'one')}
			>
				{#if reportBusy === 'me-one'}<span class="busy-dot"></span>{:else}<FileIcon />{/if}
			</button>
			<button
				class="action-button bg-green"
				aria-label="Arrow down to line"
				title="Download This User's Working Day Record in Excel"
				disabled={!!reportBusy}
				onclick={() => runReportAction('download', 'one')}
			>
				{#if reportBusy === 'download-one'}<span class="busy-dot"></span>{:else}<ArrowDownToLine />{/if}
			</button>
		</div>
	{/if}

	<section class="holidays">
		<div class="holidays-header">
			<h2>Holidays ({viewYear})</h2>
			{#if isAdmin}
				<button class="button-create" onclick={openCreateHoliday}>
					<Plus size={20} /><span>New Holiday</span>
				</button>
			{/if}
		</div>

		{#if holidaysError}
			<p class="status-error">{holidaysError}</p>
		{/if}

		<div class="holiday-list" class:is-loading={holidaysLoading}>
			{#each pagedHolidays as holiday, i (holiday.id)}
				<div class="holiday-card">
					<div class="holiday-card-header">
						<h3>{(holidayPage - 1) * HOLIDAY_PAGE_SIZE + i + 1}. {holiday.name}</h3>
						{#if isAdmin}
							<div class="holiday-actions">
								<button
									class="icon-button bg-danger"
									onclick={() => openDeleteHoliday(holiday)}
									aria-label="Delete holiday"
									title="Delete holiday"
								>
									<Trash2 size={18} />
								</button>
								<button
									class="icon-button bg-teal"
									onclick={() => openEditHoliday(holiday)}
									aria-label="Edit holiday"
									title="Edit holiday"
								>
									<Pencil size={18} />
								</button>
							</div>
						{/if}
					</div>
					<div class="holiday-row">
						<span class="holiday-label">Date:</span>
						<span>{formatHolidayDate(holiday.holiday_date)}</span>
					</div>
					<div class="holiday-row">
						<span class="holiday-label">Region(s):</span>
						<span>{(holiday.regions ?? []).join(', ')}</span>
					</div>
				</div>
			{:else}
				{#if holidaysLoading}
					<Spinner inline size={140} label="Loading holidays" />
				{:else}
					<p class="holiday-empty">No public holidays recorded for {viewYear}.</p>
				{/if}
			{/each}
		</div>

		<Pagination
			bind:page={holidayPage}
			totalItems={holidays.length}
			pageSize={HOLIDAY_PAGE_SIZE}
			itemLabel="holidays"
		/>
	</section>

	<Modal
		open={showSubmissionsModal}
		title={formatSelectedDate(selectedDay, months[index].year, months[index].month)}
		size="sm"
		onclose={closeSubmissionsModal}
		closeOnBackdrop
	>
		{#if submissionsError}
			<p class="status-error">{submissionsError}</p>
		{:else if submissionsLoading}
			<Spinner inline size={140} label="Loading submissions" />
		{:else}
			<div class="submissions-info">
				<p>Tool Box Meeting (e-TBM):</p>
				<p class:status-ok={submissionStatus.tbm} class:status-bad={!submissionStatus.tbm}>
					{submissionStatus.tbm ? 'Submitted' : 'Not submitted'}
				</p>
			</div>
			<div class="submissions-info">
				<p>PPE Visual Inspections (e-PPE):</p>
				<p class:status-ok={submissionStatus.ppe} class:status-bad={!submissionStatus.ppe}>
					{submissionStatus.ppe ? 'Submitted' : 'Not submitted'}
				</p>
			</div>
			<div class="submissions-info">
				<p>Housekeeping (e-HKP):</p>
				<p class:status-ok={submissionStatus.hkp} class:status-bad={!submissionStatus.hkp}>
					{submissionStatus.hkp ? 'Submitted' : 'Not submitted'}
				</p>
			</div>
		{/if}
	</Modal>
</div>

<Modal
	open={isAdmin && showHolidayModal}
	title={holidayMode === 'create' ? 'Create Holiday' : 'Edit Holiday'}
	busy={holidaySaving}
	onclose={closeHolidayModal}
>
	<form id="holiday-form" class="holiday-form" onsubmit={saveHoliday} novalidate>
		<label class="field">
			<span>Date</span>
			<input
				type="date"
				bind:value={holidayForm.holiday_date}
				onfocus={(e) => e.currentTarget.showPicker?.()}
			/>
		</label>

		<label class="field">
			<span>Name</span>
			<input type="text" bind:value={holidayForm.name} />
		</label>

		<div class="field">
			<label for="holiday-region">Region</label>
			<select
				id="holiday-region"
				bind:value={regionPick}
				onchange={addRegion}
				disabled={availableRegions.length === 0}
			>
				<option value="">
					{availableRegions.length === 0 ? 'All regions selected' : 'Choose an option...'}
				</option>
				{#each availableRegions as region (region)}
					<option value={region}>{region}</option>
				{/each}
			</select>

			<label class="checkbox-row">
				<input type="checkbox" checked={allRegionsSelected} onchange={toggleAllRegions} />
				All Regions
			</label>

			{#if holidayForm.regions.length > 0}
				<div class="region-list">
					{#each holidayForm.regions as region, i (region)}
						<div class="region-row">
							<span class="region-no">{i + 1}.</span>
							<span class="region-name">{region}</span>
							<button
								type="button"
								class="icon-button bg-danger"
								onclick={() => removeRegion(region)}
								aria-label={`Remove ${region}`}
								title="Remove region"
							>
								<Trash2 size={16} />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if holidayFormError}
			<p class="status-error">{holidayFormError}</p>
		{/if}
	</form>

	{#snippet footer()}
		<button type="button" class="button-inverted" onclick={closeHolidayModal} disabled={holidaySaving}>
			Cancel
		</button>
		<button type="submit" form="holiday-form" class="button-primary" disabled={holidaySaving}>
			{#if holidaySaving}
				Saving...
			{:else}
				{holidayMode === 'create' ? 'Create' : 'Update'}
			{/if}
		</button>
	{/snippet}
</Modal>

<Modal
	open={isAdmin && showDeleteHolidayModal && !!deletingHoliday}
	title="Delete Holiday"
	size="sm"
	busy={holidayDeleting}
	onclose={closeDeleteHoliday}
>
	<p>Are you sure you want to delete this holiday?</p>
	{#if deletingHoliday}
		<div class="delete-summary">
			<p><b>Name:</b> {deletingHoliday.name}</p>
			<p><b>Date:</b> {formatHolidayDate(deletingHoliday.holiday_date)}</p>
			<p>
				<b>Region ({deletingHoliday.regions?.length ?? 0}):</b>
				{(deletingHoliday.regions ?? []).join(', ')}
			</p>
		</div>
	{/if}
	<p class="hint">This action cannot be undone.</p>
	{#if holidayDeleteError}
		<p class="status-error">{holidayDeleteError}</p>
	{/if}

	{#snippet footer()}
		<button class="button-inverted" onclick={closeDeleteHoliday} disabled={holidayDeleting}>
			Cancel
		</button>
		<button class="button-danger" onclick={deleteHoliday} disabled={holidayDeleting}>
			{holidayDeleting ? 'Deleting...' : 'Delete'}
		</button>
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

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.button-primary {
		background-color: #091747;
		font-weight: bold;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.button-inverted {
		background-color: #ffffff;
		color: #093d85;
		font-weight: bold;
		padding: 8px 18px;
		border: 2px solid #093d85;
	}

	.button-inverted:hover {
		background-color: #dedede;
	}

	.button-danger {
		background-color: #c62828;
		font-weight: bold;
		padding: 10px 20px;
	}

	.button-danger:hover {
		background-color: #c62828c7;
	}

	.calendar {
		margin-top: 10px;
		border: 1px solid #b0b0b0;
		border-radius: 6px;
		overflow: hidden;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 10px 0;
		font-weight: bold;
	}

	.calendar-header .month-label {
		font-size: 16px;
	}

	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 90px;
		padding: 8px;
		border-right: 1px solid #b0b0b0;
		border-bottom: 1px solid #b0b0b0;
		position: relative;
		background: #fff;
	}

	.cell.clickable {
		cursor: pointer;
	}

	.cell.today {
		box-shadow: inset 0 0 0 2px #091747;
	}

	.cell:last-child {
		border-right: none;
	}

	.day-num {
		position: absolute;
		bottom: 6px;
		right: 8px;
		font-weight: bold;
		color: #093d85;
	}

	.status-icon {
		display: none;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.legend-swatch {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		border: 1px solid #b0b0b0;
	}

	.legend-swatch.state-working {
		background-color: #e6f4ea;
		border-color: #0f8f2f;
	}

	.legend-swatch.state-incomplete {
		background-color: #fff2e0;
		border-color: #e67e00;
	}

	.legend-swatch.state-not-working {
		background-color: #fdecec;
		border-color: #c62828;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background-color: #f57c00;
	}

	.legend-state {
		display: none !important;
	}

	.status-full,
	.status-icon {
		color: inherit;
		font-size: inherit;
		font-weight: inherit;
	}

	.cell-status {
		text-align: center;
		margin-top: 6px;
	}

	.holiday-dot {
		position: absolute;
		top: 6px;
		right: 8px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background-color: #f57c00;
	}

	.nav {
		background: none;
		color: #093d85;
		border: none;
		font-size: 18px;
		cursor: pointer;
		padding: 6px 12px;
	}

	.nav:disabled {
		color: #b0b0b0;
		cursor: default;
	}

	.project-box {
		margin: 10px;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
	}

	.submissions-info {
		display: flex;
		justify-content: space-between;
		margin-bottom: 5px;
	}

	.status-ok {
		color: #0f8f2f;
		font-weight: bold;
	}

	.status-incomplete {
		color: #e67e00;
		font-weight: bold;
	}

	.status-bad {
		color: #c62828;
		font-weight: bold;
	}

	.status-error {
		color: #c62828;
		font-weight: bold;
		margin: 8px 0;
	}

	.hint {
		font-size: 12px;
		color: #5b6480;
		margin: 8px 0 0;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		background: #f7fbff;
		border-top: 1px solid #b0b0b0;
		border-bottom: 1px solid #b0b0b0;
	}

	.weekdays > div {
		padding: 10px;
		text-align: center;
		font-weight: bold;
		color: #091747;
	}

	.week {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
	}

	.wd-short {
		display: none;
	}

	.user-filter {
		display: flex;
		justify-content: flex-end;
		margin-top: 10px;
	}

	.filter-label {
		margin: 0 0 6px 0;
	}

	.user-select-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.user-select-row :global(.spinner-inline) {
		padding: 0;
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
		gap: 8px;
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

	.action-button:hover,
	.icon-button:hover,
	.button-create:hover {
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

	.bg-teal {
		background-color: #093d85;
	}

	.bg-navy {
		background-color: #091747;
	}

	.bg-green {
		background-color: #31b647;
	}

	.bg-danger {
		background-color: #c62828;
	}

	.holidays {
		margin-top: 24px;
	}

	.holidays-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 6px;
	}

	.holidays-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: bold;
	}

	.button-create {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background-color: #093d85;
		font-weight: bold;
		padding: 8px 16px;
		color: #ffffff;
	}

	.button-create span {
		color: #ffffff;
	}

	.holiday-list {
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		background-color: #ffffff;
	}

	.holiday-list.is-loading {
		opacity: 0.6;
	}

	.holiday-card {
		padding: 10px 12px;
		border-bottom: 1px solid #dcdcdc;
	}

	.holiday-card:last-child {
		border-bottom: none;
	}

	.holiday-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 6px;
	}

	.holiday-card-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: normal;
	}

	.holiday-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.icon-button {
		width: 40px;
		height: 32px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		flex-shrink: 0;
	}

	.holiday-row {
		display: grid;
		grid-template-columns: 110px 1fr;
		gap: 6px;
		margin-top: 2px;
	}

	.holiday-row span {
		font-size: 13px;
	}

	.holiday-label {
		font-weight: bold;
	}

	.holiday-empty {
		padding: 16px;
		margin: 0;
		text-align: center;
	}


	.holiday-form {
		display: grid;
		gap: 14px;
	}

	.field {
		display: grid;
		gap: 6px;
	}

	.field > span,
	.field > label {
		font-size: 13px;
		font-weight: bold;
	}

	.field input[type='date'],
	.field input[type='text'],
	.field select {
		width: 100%;
		height: 40px;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 14px;
		background-color: #ffffff;
	}

	.field input[type='date'] {
		cursor: pointer;
	}

	.checkbox-row {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		cursor: pointer;
		width: fit-content;
	}

	.region-list {
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		max-height: 260px;
		overflow-y: auto;
	}

	.region-row {
		display: grid;
		grid-template-columns: 36px 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-bottom: 1px solid #e3e8f0;
	}

	.region-row:last-child {
		border-bottom: none;
	}

	.region-row .icon-button {
		width: 32px;
		height: 30px;
	}

	.delete-summary {
		margin: 12px 0;
		padding: 10px 12px;
		background-color: #f2f4f9;
		border-radius: 4px;
	}

	.delete-summary p {
		margin: 2px 0;
		word-break: break-word;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.project-box p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.calendar {
			overflow-x: auto;
		}

		.calendar-header {
			flex-wrap: wrap;
			gap: 8px;
		}

		.calendar-header .month-label {
			font-size: 15px;
			text-align: center;
			width: 100%;
		}

		.cell {
			min-height: 70px;
			padding: 6px;
		}

		.cell-status {
			font-size: 12px;
			word-break: break-word;
		}

		.day-num {
			font-size: 12px;
		}

		.user-filter {
			justify-content: flex-start;
		}

		.user-filter > div {
			width: 100%;
		}

		.user-select {
			width: 100%;
		}

		.submissions-info {
			gap: 10px;
		}
	}
	@media (max-width: 600px) {
		.title {
			font-size: 22px;
		}

		.calendar-header {
			flex-wrap: nowrap;
			justify-content: space-between;
			gap: 8px;
			padding: 10px 12px;
		}

		.weekdays > div {
			padding: 6px 2px;
			font-size: 11px;
		}

		.week {
			grid-template-columns: repeat(7, minmax(44px, 1fr));
		}

		.wd-full {
			display: none;
		}

		.wd-short {
			display: inline;
		}

		.cell {
			min-height: 60px;
			padding: 4px;
		}

		.status-full {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}

		.status-icon {
			display: flex;
			justify-content: center;
		}

		.cell-status {
			margin-top: -10px;
		}

		.cell.state-working {
			background-color: #e6f4ea;
		}

		.cell.state-incomplete {
			background-color: #fff2e0;
		}

		.cell.state-not-working {
			background-color: #fdecec;
		}

		.legend-state {
			display: inline-flex !important;
		}

		.day-num {
			font-size: 11px;
			right: 4px;
			bottom: 4px;
		}

		.holiday-dot {
			top: 4px;
			right: 4px;
			width: 9px;
			height: 9px;
		}

		.nav {
			font-size: 16px;
			padding: 4px 8px;
		}

		.action-buttons {
			justify-content: space-between;
		}

		.action-button {
			flex: 1;
			width: auto;
		}

		.holidays-header h2 {
			font-size: 17px;
		}

		.holiday-row {
			grid-template-columns: 1fr;
			gap: 0;
			margin-top: 4px;
		}

		.submissions-info {
			align-items: center;
		}

		.submissions-info p {
			font-size: 13px;
		}
	}
</style>