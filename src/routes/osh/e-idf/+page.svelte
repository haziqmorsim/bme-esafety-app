<script>
    import Search from '@lucide/svelte/icons/search';
    import Spinner from '$lib/components/Spinner.svelte';
    import FileText from '@lucide/svelte/icons/file-text';
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
    let activity_date = '';
    let contractors = '';
    let induction_type = '';
    let remarks = '';
    let acknowledged = false;
    let created_at = '';
    let created_by = '';

    let idf_form_file;
    let idf_activity_file;

    function onFile(e, setter) {
        setter(e.currentTarget.files?.[0] ?? null);
    }

    let errorMsg = '';
    let saving = false;

    function withTimeout(promise, ms = 20000) {
        return Promise.race([
            promise, 
            new Promise((_, reject) => setTimeout(() => reject(new Error ('Upload timed out'), ms)))
        ]);
    }

    async function uploadToBucket(file, folder) {
        if (!file) return null;

        const ext = file.name.split('.').pop() || 'bin';
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const path = `${folder}/${fileName}`;

        const { data, error } = await supabase.storage 
            .from('idf_uploads')
            .upload(path, file, { upsert: false });

        if (error) {
            console.error('[upload error', error);
            throw error;
        }

        return data.path;
    }

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

            const { data: profile, error: profileError } = await withTimeout
            (
                supabase.from('profiles').select('first_name, last_name').eq
                ('id', user.id).single(),
                15000
            );

            if (profileError) throw profileError;

            const submitterName = 
                `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;

            const idf_form_path = await withTimeout(
                uploadToBucket(idf_form_file, 'idf_form'), 
                60000
            );

            const idf_activity_path = await withTimeout(
                uploadToBucket(idf_activity_file, 'idf_activity'), 
                60000
            );

            const payload = {
                project_name, 
                project_no, 
                activity_date, 
                contractors, 
                induction_type, 
                idf_form_path, 
                idf_activity_path, 
                remarks, 
                acknowledged, 
                created_by: user.id, 
                created_by_name: submitterName
            };

            const { data: saved, error: insErr } = await withTimeout(
                supabase.from('idf_submissions').insert(payload).select('id').single(), 
                15000
            );
            if (insErr) throw insErr;

            const sent = await sendToMake('idf', saved.id, {
                submitLocation: await locationPromise
            });
            if (sent.ok) toast.success('e-IDF submitted successfully.');
            else toast.error(`e-IDF was saved, but it could not be sent to Make: ${sent.error}`);
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
            .select('project_name, project_id')
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
        closeProjectModal();
    }
</script>

<h1 class="title">Induction Form (e-IDF) Submission</h1>

<div class="project-box">
    <form class="forms" onsubmit={handleSubmit}>
        <h2 class="heading">General Information</h2>
        <button type="button" class="button-primary" onclick={openProjectModal}>
            <Search />Search Project
        </button>
        <div class="forms-p">
            <label for="project-name" class="forms-label">Project Name:</label>
            <input type="text" class="forms-input" bind:value={project_name} />
        </div>
        <div class="forms-p">
            <label for="project-date" class="forms-label">Activity Date:</label>
            <input type="date" class="forms-input forms-date" bind:value={activity_date} onfocus={(e) => e.target.showPicker?.()} required />
        </div>
        <Modal open={showProjectModal} title="Select a Project" onclose={closeProjectModal}>
            <div class="project-search">
                <input type="text" class="project-search-input" placeholder="Project Name/Project No." bind:value={projectSearch} oninput={filterProjects} />
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
        <hr />
        <h2 class="heading">Induction Details</h2>
        <div class="forms-p">
            <label for="contractors" class="forms-label">Total Number of Contractors Inducted</label>
            <input type="text" class="forms-input" bind:value={contractors} required />
        </div>
        <div class="forms-p">
            <label for="induction-type" class="forms-label">Induction Type:</label>
            <select class="type-select" bind:value={induction_type}>
                <option value=""></option>
                <option value="visitor">Visitor</option>
                <option value="conductor">Contractor</option>
            </select>
        </div>
        <p class="image-text">Induction Form Image</p>
        <div class="upload">
            <p class="upload-text">
                <input type="file" name="idf_form" id="idf_form" accept="image/png, image/jpeg" multiple onchange={(e) => (idf_form_file = e.target.files[0])} required />
            </p>
        </div>
        <p class="image-text">Activity Image</p>
        <div class="upload">
            <p class="upload-text">
                <input type="file" name="idf_activity" id="idf_activity" accept="image/png, image/jpeg" multiple onchange={(e) => (idf_activity_file = e.target.files[0])} required />
            </p>
        </div>
        <br />
        <hr />
        <h2 class="heading">Remarks</h2>
        <p>
            <textarea name="remarks" id="remarks" cols="30" rows="10" class="remarks" placeholder="Remarks" bind:value={remarks}></textarea>
        </p>
        <h2 class="heading">Acknowledgement and Submission</h2>
        <div class="container">
            <div class="checkbox">
                <input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
            </div>
            <div class="declaration">
                <p>The declaration for the Induction Form as below:</p>
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
        <p>Note: Double check if content is correct before submitting.</p>
        {#if errorMsg}
            <p class="error">{errorMsg}</p>
        {/if}
        <div class="submit">
            <button type="submit" class="button-submit" disabled={saving}><FileText />{saving ? 'Submitting...' : 'Submit'}</button>
        </div>
    </form>
</div>

<style>
	.container {
		display: flex;
		margin: 10px 0;
	}

	.type-select {
		height: 40px;
		width: 150px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
	}

	.image-text {
		margin-top: 10px;
	}

	@media (max-width: 600px) {
		.type-select {
			width: 100%;
		}

		.image-text {
			font-size: 13px;
		}

		.container {
			gap: 10px;
		}
	}
</style>