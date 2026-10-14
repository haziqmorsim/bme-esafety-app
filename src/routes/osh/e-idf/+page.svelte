<script>
    import Search from '@lucide/svelte/icons/search';
    import FileText from '@lucide/svelte/icons/file-text';
    import Check from '@lucide/svelte/icons/check';
    import { supabase } from '$lib/supabase';
    import { goto } from '$app/navigation';
    import { requireUser } from '$lib/auth-guard';

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

    let showSuccess = false;
    let successTimer;

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

            const { error, insErr } = await withTimeout(
                supabase.from('idf_submissions').insert(payload), 
                15000
            );
            if (insErr) throw insErr;

            showSuccess = true;

            setTimeout(() => {
                showSuccess = false;
                goto('/');
            }, 3000);
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
        {#if showProjectModal}
            <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Select project">
                <div class="modal">
                    <h3>Select a Project</h3>
                    <div class="project-search">
                        <input type="text" class="project-search-input" placeholder="Project Name/Project ID" bind:value={projectSearch} oninput={filterProjects} />
                        <button type="button" class="project-search-button" onclick={filterProjects}>
                            <Search />
                        </button>
                    </div>
                    <div class="project-list">
                        <div class="project-list-header">
                            <span>Project Name</span>
                            <span>Project ID</span>
                        </div>
                        {#if projectLoading}
                            <p class="project-status">Loading projects...</p>
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
                    <div class="modal-actions">
                        <button type="button" class="button-secondary" onclick={closeProjectModal}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        {/if}
        <br />
        <hr />
        <h2 class="heading">Induction Details</h2>
        <div class="forms-p">
            <label for="contractors" class="forms-label">Total Number of Contractors Inducted</label>
            <input type="text" class="forms-input" bind:value={contractors} required />
        </div>
        <div class="forms-p">
            <label for="induction-type" class="forms-label">Induction Type:</label>
            <select bind:value={induction_type}>
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
                <p>The declaration for the Inspection Record as below:</p>
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
    {#if showSuccess}
        <div class="success-overlay">
            <div class="success-popup">
                <h3>Success! <Check strokeWidth={4} /></h3>
                <p>Your form submission was successful.</p>
            </div>
        </div>
    {/if}
</div>

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

	.button-primary {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: #091747;
		margin: 10px 0 20px 0;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.button-submit {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: #091747;
		font-weight: bold;
		margin: 5px;
		padding: 10px 20px;
	}

	.button-submit:hover {
		background-color: #091747b9;
	}

	.button-secondary {
		background-color: #ffffff;
		color: #091747;
		border: 1px solid #091747;
		padding: 8px 18px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: bold;
	}

	.button-secondary:hover {
		background-color: #dedede;
	}

	.container {
		display: flex;
		margin: 10px 0;
	}

	.declaration {
		padding: 0 10px;
		font-weight: bold;
	}

	.declaration p {
		margin-bottom: 10px;
	}

	.forms {
		margin: 0;
		position: relative;
	}

	.forms-date {
		cursor: pointer;
	}

	.forms-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.forms-input {
		height: 30px;
		width: 500px;
		font-size: 14px;
	}

	.forms-label {
		width: 150px;
		font-size: 14px;
	}

	.forms-p {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;
	}

	.heading {
		margin: 10px 0;
		font-size: 20px;
		font-weight: bold;
	}

	.image-text {
		margin-top: 10px;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(9, 23, 71, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		z-index: 50;
	}

	.modal {
		background: #ffffff;
		border-radius: 10px;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
		padding: 20px;
		width: min(600px, 95vw);
	}

	.modal h3 {
		margin: 0 0 16px 0;
		font-size: 20px;
	}

	.project-search {
		display: flex;
		gap: 10px;
		margin-bottom: 16px;
	}

	.project-search-input {
		flex: 1;
		height: 36px;
		padding: 0 10px;
		border: 1px solid #cfd6e4;
		border-radius: 6px;
		font-size: 14px;
	}

	.project-search-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 36px;
		padding: 0;
		background-color: #091747;
		border-radius: 6px;
	}

	.project-search-button:hover {
		background-color: #091747b9;
	}

	.project-list {
		border: 1px solid #cfd6e4;
		border-radius: 8px;
		overflow: hidden;
		max-height: 320px;
		overflow-y: auto;
	}

	.project-list-header,
	.project-row {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 10px;
		padding: 10px 12px;
	}

	.project-list-header {
		background-color: #f2f4f9;
		font-weight: bold;
		border-bottom: 1px solid #cfd6e4;
		text-align: center;
	}

	.project-row {
		width: 100%;
		text-align: left;
		background: #ffffff;
		border: none;
		border-bottom: 1px solid #e3e8f0;
		cursor: pointer;
	}

	.project-row:last-child {
		border-bottom: none;
	}

	.project-row:hover {
		background-color: #dedede;
	}

	.project-row-id {
		text-align: center;
	}

	.project-status {
		padding: 12px;
		margin: 0;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-start;
		margin-top: 16px;
	}

	.remarks {
		width: 100%;
		height: 200px;
	}

	.project-box {
		margin: 10px;
		border: 1px solid #091747;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
	}

	.submit {
		display: flex;
		justify-content: flex-end;
	}

	.success-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.success-popup {
		height: 250px;
		background: #ffffff;
		padding: 25px 35px;
		border: 1px solid #091747;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		animation: fadeIn 0.3s ease;
	}

	.success-popup h3 {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: #2e7d32;
		font-size: 20px;
		font-weight: bold;
		margin-bottom: 15px;
	}

	.success-popup h3 :global(svg) {
		display: block;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.upload {
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 10px;
		border: 1px solid #091747;
		border-radius: 2px;
	}

	.upload-text {
		width: fit-content;
	}

	.upload-text input[type='file'] {
		font-size: 14px;
	}

	.upload-text input[type='file']::file-selector-button {
		background-color: #091747;
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		margin-right: 10px;
	}

	.upload-text input[type='file']::file-selector-button:hover {
		background-color: #091747b9;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.project-box {
			margin: 8px;
			padding: 10px;
		}

		.forms-input {
			width: 100%;
			max-width: 100%;
		}

		.forms-label {
			width: 180px;
		}

		.forms-p {
			align-items: flex-start;
		}

		.upload {
			height: 180px;
		}

		.remarks {
			height: 180px;
		}

		.declaration {
			padding-left: 8px;
		}

		.declaration p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.modal {
			max-height: 85vh;
			overflow-y: auto;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

		.heading {
			font-size: 18px;
		}

		.button-primary,
		.button-submit {
			width: 100%;
			justify-content: center;
		}

		.project-box {
			margin: 6px;
			padding: 8px;
		}

		.forms-p {
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}

		.forms-label {
			width: 100%;
			font-size: 13px;
		}

		.forms-input {
			width: 100%;
			height: 34px;
			font-size: 13px;
		}

		.image-text {
			font-size: 13px;
		}

		.upload {
			height: 160px;
		}

		.upload-text input[type='file'] {
			font-size: 13px;
		}

		.remarks {
			height: 160px;
			font-size: 13px;
		}

		.container {
			gap: 10px;
		}

		.declaration {
			padding: 0;
			font-size: 13px;
		}

		.declaration p {
			font-size: 13px;
		}

		.submit {
			justify-content: center;
		}

		.button-submit {
			width: 100%;
			justify-content: center;
		}
	}
</style>