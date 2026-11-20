<script>
    import { onMount, tick } from "svelte";
    import { beforeNavigate, goto } from "$app/navigation";
    import Clock from "@lucide/svelte/icons/clock";
    import Megaphone from "@lucide/svelte/icons/megaphone";
    import Wallet from "@lucide/svelte/icons/wallet";
    import Plus from "@lucide/svelte/icons/plus";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import ChevronUp from "@lucide/svelte/icons/chevron-up";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import Save from "@lucide/svelte/icons/save";
    import Info from "@lucide/svelte/icons/info";
    import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
    import Modal from "$lib/components/Modal.svelte";
    import { requireUser } from "$lib/auth-guard";
    import { hasAdminDepartment } from "$lib/admin";
    import { toast } from "$lib/stores/toast";
    import { ANNOUNCEMENT_MAX, DEFAULT_ROUTES, MAX_ROUTES, ROUTE_AMOUNT_MAX, ROUTE_NAME_MAX, SESION_TIMEOUT, cleanSettings, cloneSettings, fetchSettings, routeLabel, saveSettings, validateSettings } from "$lib/settings";
	import { invalid } from "@sveltejs/kit";

    let access = $state('checking');
    let loadFailed = $state(false);

    let baseline = $state(null);
    let draft = $state(null);

    let saving = $state(false);
    let submitted = $state(false);
    let saveError = $state('');

    const errors = $derived(draft ? validateSettings(draft) : {});
    const hasErrors = $derived(Object.keys(errors).length > 0);
    const dirty = $derived(draft !== null && baseline !== null && JSON.stringify(draft) !== JSON.stringify(baseline));
    const messageLength = $derived((draft?.announcement?.message ?? '').length);

    onMount(async () => {
        const auth = await requireUser();
        if (!auth) return;
        const { supabase, user } = auth;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('department')
            .eq('id', user.id)
            .maybeSingle();

        if(error || !hasAdminDepartment(profile?.department)) {
            access = 'denied';
            toast.error('Only users in the Admin department can open the settings page.');
            await goto('/', { replaceState: true });
            return;
        }

        access = 'granted';

        const result = await fetchSettings();
        loadFailed = !result.ok;
        baseline = cleanSettings(result.settings);
        draft = cloneSettings(baseline);
    });

    let showLeaveModal = $state(false);
    let pendingUrl = null;
    let leaveConfirmed = false;

    beforeNavigate((navigation) => {
        if (leaveConfirmed || !dirty) return;

        navigation.cancel();
        if (navigation.willUnload || !navigation.to) return;
        
        pendingUrl = navigation.to.url;
        showLeaveModal = true;
    });

    function cancelLeave() {
        showLeaveModal = false;
        pendingUrl = null;
    }

    async function confirmLeave() {
        const url = pendingUrl;
        leaveConfirmed = true;
        showLeaveModal = false;
        pendingUrl = null;
        if (url) await goto(url);
        else leaveConfirmed = false;
    }

    function onBeforeUnload(event) {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = '';
    }

    function nextRouteId() {
        const used = new Set(draft.site_allowance_routes.map((item) => item.id));
        let n = draft.site_allowance_routes.length + 1;
        while (used.has(`r${n}`)) n += 1;
        return `r${n}`;
    }

    function addRoute() {
        if (draft.site_allowance_routes.length >= MAX_ROUTES) return;
        draft.site_allowance_routes.push({ id: nextRouteId(), route: '', amount: null });
    }

    function removeRoute(index) {
        draft.site_allowance_routes.splice(index, 1);
    }

    function moveRoute(index, step) {
        const list = draft.site_allowance_routes;
        const target = index + step;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
    }

    function restoreDefaultRoutes() {
        draft.site_allowance_routes = DEFAULT_ROUTES.map((item) > ({ ...item }));
    }

    async function save() {
        submitted = true;
        saveError = '';

        if (hasErrors) {
            await tick();
            const first = document.querySelector('[data-settings-error]');
            first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
        }

        saving = true;
        try {
            const clean = cleanSettings(draft);
            await saveSettings(clean);
            baseline = clean;
            draft = cloneSettings(clean);
            submitted = false;
            loadFailed = false;
            toast.success('Settings saved.');
        } catch (error) {
            saveError = error?.message ?? String(error);
            if (/relation .*app_settings.* does not exist|schema cache/i.test(saveError)) {
                saveError = 'This app_settings table was not found. Run app_settings.sql in the SQL Editor first.';
            }
        } finally {
            saving = false;
        }

        function discard() {
            draft = cloneSettings(baseline);
            submitted = false;
            saveError = '';
        }
    }
</script>

<svelte:window onbeforeunload={onBeforeUnload} />

{#if access === 'granted' && draft}
    <h1 class="title">Settings</h1>

    {#if loadFailed}
        <p class="notice warn" role="alert">
            <TriangleAlert size={18} />
            <span>The saved settings could not be loaded, so the default values are shown. If the <code>app_settings</code> in the table does not exist yet, run <code>app_settings</code> in the SQL Editor before saving.</span>
        </p>
    {/if}

    <section class="project-box settings-card" aria-labelledby="session-heading">
        <h2 id="session-heading" class="card-title"><Clock size={20} /> Session &amp; Security</h2>

        <div class="field">
            <label for="session-timeout"> Sign out after inactivity (minutes)</label>
            <input 
                id="session-timeout"
                type="number"
                class="short"
                class:invalid={submitted && errors.timeout}
                min={SESION_TIMEOUT.min}
                max={SESION_TIMEOUT.max}
                step="1"
                inputmode="numeric"
                bind:value={draft.session_timeout_minutes}
            />
            {#if submitted && errors.timeout}
                <span class="field-err" data-settings-error>{errors.timeout}</span>
            {:else}
                <span class="hint">
                    Users are signed out after this many minutes without any activity ({SESION_TIMEOUT.min}-{SESION_TIMEOUT.max}). The default is {SESION_TIMEOUT.default}.
                </span>
            {/if}
        </div>
    </section>

    <section class="project-box settings-card" aria-labelledby="announcement-heading">
        <h2 id="announcement-heading" class="card-title">
            <Megaphone size={20} /> Announcement Banner
        </h2>
        <p class="note">
            Shows a mesage at the top of every page for signed-in users. Each user can close it until the next time they open the app.
        </p>

        <label class="check">
            <input type="checkbox" bind:checked={draft.announcement.enabled} />
            <span>Show the announcement banner</span>
        </label>

        <div class="field">
            <label for="announcement-level">Type</label>
            <select 
                id="announcement-level"
                class="short"
                bind:value={draft.announcement.level}
                disabled={!draft.announcement.enabled}    
            >
                <option value="info">Information</option>
                <option value="warning">Warning</option>
            </select>
        </div>

        <div class="field">
            <label for="announcement-message">Message</label>
            <textarea
                id="announcement-message"
                rows="3"
                maxlength={ANNOUNCEMENT_MAX}
                class:invalid={submitted && errors.announcement}
                placeholder="e.g. The app will be unavailable on Saturday from 10pm to 11pm for maintenance."
                bind:value={draft.announcement.message}
            ></textarea> 
            <span class="counter">{messageLength}/{ANNOUNCEMENT_MAX}</span>
            {#if submitted && errors.announcement}
                <span class="field-err" data-settings-error>{errors.announcement}</span>
            {/if}
        </div>

        {#if draft.announcement.message.trim()}
            <div class="field">
                <span class="preview-label">Preview</span>
                <div
                    class="banner-preview"
                    class:warning={draft.announcement.level === 'warning'}
                    class:off={!draft.announcement.enabled}
                >
                    {#if draft.announcement.level === 'warning'}
                        <TriangleAlert size={18} />
                    {:else}
                        <Info size={18} />
                    {/if}
                    <span>{draft.announcement.message.trim()}</span>
                </div>
                {#if !draft.announcement.enabled}
                    <span class="hint">The banner is turned off, so users will not see this yet.</span>
                {/if}
            </div>
        {/if}
    </section>

    <section class="project-box settings-card" aria-labelledby="routes-heading">
        <h2 id="routes-heading" class="card-title"><Wallet size={24} /> Staff Claim: Site Allowance</h2>
        <p class="note">
            The routes and daily rates staff pick from in the e-SCF form. Changing a rate only affects
			new claims. Claims that were already submitted keep the amount they were saved with.
        </p>

        <div class="routes" role="list">
            {#each draft.site_allowance_routes as item, index (item.id)}
                <div class="route-row" role="listitem">
                    <span class="route-no">{index + 1}.</span>

                    <div class="route-field route-name">
                        <label for="route-name-{item.id}">Route</label>
                        <input
                            id="route-name-{item.id}"
                            type="text"
                            maxlength={ROUTE_NAME_MAX}
                            placeholder="e.g. Selangor (Hometown) to Sabah (Site)"
                            class:invalid={submitted && errors.routes?.[index]?.route}
                            bind:value={item.route}
                        />
                        {#if submitted && errors.routes?.[index]?.route}
                            <span class="field-err" data-settings-error>{errors.routes[index].route}</span>
                        {/if}
                    </div>

                    <div class="route-field route-amount">
                        <label for="route-amount-{item.id}">Rate per day (RM)</label>
                        <input
                            id="route-amount-{item.id}"
                            type="number"
                            min="0.01"
                            max={ROUTE_AMOUNT_MAX}
                            step="0.01"
                            inputmode="decimal"
                            class:invalid={submitted && errors.routes?.[index]?.amount}
                            bind:value={item.amount}
                        />
                        {#if submitted && errors.routes?.[index]?.amount}
                            <span class="field-err" data-settings-error>{errors.routes[index].amount}</span>
                        {/if}
                    </div>

                    <div class="route-actions">
                        <button
                            type="button"
                            class="icon-button button-inverted"
                            aria-label="Move route {index + 1} up"
                            title="Move up"
                            disabled={index === 0}
                            onclick={() => moveRoute(index, -1)}
                        >
                            <ChevronUp size={16} />
                        </button>
                        <button
                            type="button"
                            class="icon-button button-inverted"
                            aria-label="Move route {index + 1} down"
                            title="Move down"
                            disabled={index === draft.site_allowance_routes.length - 1}
                            onclick={() => moveRoute(index, 1)}
                        >
                            <ChevronDown size={16} />
                        </button>
                        <button
                            type="button"
                            class="icon-button button-danger"
                            aria-label="Remove route {index + 1}"
                            title="Remove route"
                            onclick={() => removeRoute(index)}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>

                    {#if item.route.trim() && Number(item.amount) > 0}
                        <p class="route-preview">Users see: {routeLabel(item)}</p>
                    {/if}
                </div>
            {/each}
        </div>

        {#if errors.routesList}
            <span class="field-err" data-settings-error>{errors.routesList}</span>
        {/if}

        <div class="routes-tools">
            <button
                type="button"
                class="button-inverted"
                onclick={addRoute}
                disabled={draft.site_allowance_routes.length >= MAX_ROUTES}
            >
                <Plus size={16} /><span>Add Route</span>
            </button>
            <button type="button" class="button-inverted" onclick={restoreDefaultRoutes}>
                <RotateCcw size={16} /><span>Restore default rates</span>
            </button>
        </div>
    </section>

    {#if saveError}
        <p class="notice error" role="alert">{saveError}</p>
    {/if}

    <div class="save-bar">
        <span class="save-status" aria-live="polite">
            {#if dirty}You have unsaved changes.{:else}All changes saved.{/if}
        </span>
        <button
            type="button"
            class="button-inverted"
            onclick={discard}
            disabled={!dirty || saving}
        >
            Discard changes
        </button>
        <button
            type="button"
            class="button-primary save-button"
            onclick={save}
            disabled={!dirty || saving}
        >
            <Save size={16} /><span>{saving ? 'Saving...' : 'Save changes'}</span>
        </button>
    </div>
{:else if access === 'checking'}
    <p class="note status-note">Checking access…</p>
{:else if access === 'denied'}
    <p class="note status note">You do not have access to this page.</p>
{/if}

<Modal open={showLeaveModal} title="Unsaved Changes" size="sm" onclose={cancelLeave}>
    <p>Are you sure you want to leave this page? Your changes will not be saved.</p>

    {#snippet footer()}
        <button type="button" class="button-inverted" onclick={cancelLeave}>Cancel</button>
        <button type="button" class="button-primary button-confirm" onclick={confirmLeave}>Confirm</button>
    {/snippet}
</Modal>

<style>
	.status-note {
		margin: 8px 10px;
	}

	.settings-card {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.card-title {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--line-soft);
		font-size: 18px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.settings-card .note {
		margin: -4px 0 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
	}

	.field > label,
	.preview-label {
		font-size: 14px;
		font-weight: 600;
	}

	.field input.short,
	.field select.short {
		width: 200px;
		max-width: 100%;
	}

	.field textarea {
		width: 100%;
		max-width: 640px;
		resize: vertical;
	}

	.counter {
		align-self: flex-end;
		max-width: 640px;
		color: var(--muted);
		font-size: 12px;
	}

	.field > .hint,
	.field > .field-err {
		margin: 0;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.banner-preview {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: 100%;
		max-width: 640px;
		box-sizing: border-box;
		padding: 10px 14px;
		border: 1px solid var(--brand);
		border-radius: var(--r-md);
		background-color: var(--brand-tint);
		color: var(--ink);
		font-size: 14px;
		overflow-wrap: anywhere;
	}

	.banner-preview.warning {
		border-color: var(--warn);
		background-color: var(--warn-bg);
	}

	.banner-preview.off {
		opacity: 0.6;
	}

	.banner-preview :global(svg) {
		flex-shrink: 0;
		margin-top: 1px;
	}

	/* Routes */

	.routes {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.route-row {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr) 160px auto;
		align-items: start;
		gap: 4px 12px;
		padding: 12px;
		border: 1px solid var(--line-soft);
		border-radius: var(--r-md);
		background-color: var(--surface-alt);
	}

	.route-no {
		padding-top: 30px;
		color: var(--muted);
		font-size: 14px;
		font-weight: 600;
	}

	.route-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.route-field label {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
	}

	.route-field input {
		width: 100%;
		box-sizing: border-box;
	}

	.route-actions {
		display: flex;
		gap: 6px;
		padding-top: 22px;
	}

	.icon-button {
		min-height: 0;
		width: 36px;
		height: 36px;
		padding: 0;
	}

	.route-preview {
		grid-column: 2 / -1;
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 12px;
		overflow-wrap: anywhere;
	}

	.routes-tools {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.routes-tools button span {
		color: inherit;
	}

	/* Messages and save bar */

	.notice {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin: 0 10px 20px;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		font-size: 14px;
	}

	.notice.warn {
		border-color: var(--warn);
		background-color: var(--warn-bg);
	}

	.notice.error {
		border-color: var(--danger);
		background-color: var(--danger-bg);
		color: var(--danger);
	}

	.notice :global(svg) {
		flex-shrink: 0;
		margin-top: 1px;
	}

	.save-bar {
		position: sticky;
		bottom: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 12px;
		margin: 0 10px;
		padding: 14px 0;
		border-top: 1px solid var(--line-soft);
		background-color: var(--mist);
	}

	.save-status {
		margin-right: auto;
		color: var(--muted);
		font-size: 13px;
	}

	.save-button {
		margin: 0;
	}

	@media (max-width: 720px) {
		.route-row {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.route-no {
			display: none;
		}

		.route-name {
			grid-column: 1 / -1;
		}

		.route-amount {
			grid-column: 1;
		}

		.route-actions {
			grid-column: 2;
			align-self: end;
			padding-top: 0;
		}

		.route-preview {
			grid-column: 1 / -1;
		}

		.save-status {
			flex-basis: 100%;
		}
	}
</style>