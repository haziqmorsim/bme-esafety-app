<script>
	import User from '@lucide/svelte/icons/user-round';
</script>

<h1 class="title">Corrective Action Report (e-CAR) History</h1>

<div class="project-box">
	<div class="info">
		<div class="report-overview">
			<h2>Report Overview</h2>
			<p class="label">Project Name</p>
			<p>ABC Plantation Sdn Bhd</p>
			<p class="label">Project No.</p>
			<p>PB1234</p>
			<p class="label">Submitted By</p>
			<p>Haziq Morsim</p>
			<p class="label">Submission Date</p>
			<p>09 Jan 2026</p>
			<p class="label">Current Status</p>
			<p>Pending</p>
			<p class="label">Current Level</p>
			<p>Level 1</p>
			<p class="label">Times Rejected</p>
			<p>0</p>
		</div>
		<div class="approval-timeline">
			<h2>Approval Timeline</h2>
			<div class="timeline">
				<div class="submitted-level">
					<p><b>Submitted</b></p>
					<p>Level 1</p>
					<div class="profile">
						<User />
						<p>Haziq Morsim</p>
					</div>
				</div>
				<div class="submitted-date">
					<p>09 Jan 2026 at 9:30 AM</p>
				</div>
			</div>
			<div class="timeline">
				<div class="submitted-level">
					<p><b>Submitted</b></p>
					<p>Level 2</p>
					<div class="profile">
						<User />
						<p>Chong Wen Yang</p>
					</div>
				</div>
				<div class="submitted-date">
					<p>09 Jan 2026 at 12:00 PM</p>
				</div>
			</div>
			<div class="timeline">
				<div class="submitted-level">
					<p><b>Submitted</b></p>
					<p>Level 3</p>
					<div class="profile">
						<User />
						<p>Wong Jun Ying</p>
					</div>
				</div>
				<div class="submitted-date">
					<p>09 Jan 2026 at 2:45 PM</p>
				</div>
			</div>
			<div class="timeline">
				<div class="submitted-level">
					<p><b>Submitted</b></p>
					<p>Level 4</p>
					<div class="profile">
						<User />
						<p>Goh Kok Ghee</p>
					</div>
				</div>
				<div class="submitted-date">
					<p>09 Jan 2026 at 4:15 PM</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.approval-timeline,
	.report-overview {
		width: 50%;
		padding: 10px;
		border: 1px solid var(--line-strong);
	}

	h2 {
		font-size: 20px;
		font-weight: 600;
	}

	.info {
		display: flex;
		flex-direction: row;
	}

	.label {
		margin-top: 10px;
		font-weight: 600;
	}

	.profile {
		display: flex;
		gap: 10px;
		margin-top: 5px;
	}

	.timeline {
		display: flex;
		justify-content: space-between;
		margin-top: 15px;
	}

	@media (max-width: 1024px) {
		.info {
			flex-direction: column;
			gap: 12px;
		}

		.report-overview,
		.approval-timeline {
			width: 100%;
		}

		h2 {
			font-size: 18px;
		}

		.timeline {
			flex-direction: column;
			gap: 6px;
			padding: 8px;
			border-bottom: 1px solid var(--line-strong);
		}

		.profile {
			align-items: center;
			flex-wrap: wrap;
		}

		.submitted-date {
			font-size: 13px;
			color: #444;
		}
	}

	@media (max-width: 600px) {
		h2 {
			font-size: 17px;
		}

		.info {
			flex-direction: column;
			gap: 10px;
		}

		.report-overview,
		.approval-timeline {
			width: 100%;
			padding: 8px;
		}

		.label {
			margin-top: 8px;
		}

		.timeline {
			flex-direction: column;
			gap: 4px;
			padding: 8px 0;
		}

		.submitted-level p,
		.submitted-date p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.profile {
			gap: 6px;
		}

		.profile p {
			font-size: 13px;
		}

		.submitted-date {
			font-size: 12px;
			color: #555;
		}
	}
</style>