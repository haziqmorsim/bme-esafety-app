export const menuSections = [
	{
		key: 'Admin',
		department: 'Admin',
		items: [
			// {
			// 	icon: '/icons/building.png',
			// 	title: 'Departments and Employees List',
			// 	description: 'For admins to view employee information',
			// 	route: '/admin/departments'
			// },
			{
				icon: '/icons/uim.png',
				title: 'User Information Management',
				description: 'For admins to edit user information',
				route: '/admin/user-information'
			},
			{
				icon: '/icons/uam.jpg',
				title: 'User Access Management',
				description: 'For admins to manage user access to various app features',
				route: '/admin/user-access'
			}
		]
	},
	{
		key: 'Project',
		department: 'Project Management',
		items: [
			{
				icon: '/icons/project_info.png',
				title: 'Project Information Management',
				description: 'For users to create and update project information',
				route: '/project/project-information'
			}
		]
	},
	{
		key: 'OSH',
		department: 'Occupational Safety & Health (OSH)',
		categories: [
			{ key: 'information', label: 'Information Section' },
			{ key: 'submission', label: 'Submission Section' }
		],
		items: [
			{
				icon: '/icons/database.png',
				title: 'Site Safety eForm Information',
				description: 'For admins to view site safety eForm data',
				route: '/osh/site-safety',
				category: 'information'
			},
			{
				icon: '/icons/eWDA.png',
				title: 'Working Day Attendance (e-WDA) Record',
				description: 'For admins to view site safety supervisor attendance record',
				route: '/osh/e-wda',
				category: 'information'
			},
			{
				icon: '/icons/claim.jpg',
				title: 'Staff Claim Dashboard',
				description: 'For admins to view staff claim submission details',
				route: '/osh/claim-dashboard',
				category: 'information'
			},
			{
				icon: '/icons/eCTR.jpg',
				title: 'Competency Register (e-CTR) Submission',
				description: 'For OSH engineers to submit competency register report',
				route: '/osh/e-ctr',
				category: 'submission'
			},
			{
				icon: '/icons/eCAR.png',
				title: 'Corrective Action Report (e-CAR) Submission',
				description: 'For OSH engineers to submit corrective action report',
				route: '/osh/e-car',
				category: 'submission'
			},
			{
				icon: '/icons/eHWA.png',
				title: 'Hot Work Activities Permit (e-HWA) Submission',
				description: 'For OSH engineers to submit hot work activities permit report',
				route: '/osh/e-hwa',
				category: 'submission'
			},
			{
				icon: '/icons/eHKP.jpg',
				title: 'Housekeeping Report (e-HKP) Submission',
				description: 'For OSH engineers to submit housekeeping report',
				route: '/osh/e-hkp',
				category: 'submission'
			},
			{
				icon: '/icons/eIDF.png',
				title: 'Induction Form (e-IDF) Submission',
				description: 'For OSH engineers to submit induction form',
				route: '/osh/e-idf',
				category: 'submission'
			},
			{
				icon: '/icons/eIPR.png',
				title: 'Inspection Record (e-IPR) Submission',
				description: 'For OSH engineers to submit safety inspection record',
				route: '/osh/e-ipr',
				category: 'submission'
			},
			{
				icon: '/icons/eORA.png',
				title: 'Overtime Requisition and Approval Form (e-ORA) Submission',
				description: 'For OSH engineers to submit overtime requisition and approval report',
				route: '/osh/e-ora',
				category: 'submission'
			},
			{
				icon: '/icons/ePPE.png',
				title: 'PPE Visual Inspections (e-PPE) Submission',
				description: 'For OSH engineers to submit PPE visual inspections report',
				route: '/osh/e-ppe',
				category: 'submission'
			},
			{
				icon: '/icons/eSAC.png',
				title: 'Safety Audit Checklist (e-SAC) Submission',
				description: 'For OSH engineers to submit safety audit checklist document',
				route: '/osh/e-sac',
				category: 'submission'
			},
			{
				icon: '/icons/eSOA.jpg',
				title: 'Safety Officer Audit (e-SOA) Submission',
				description: 'For OSH engineers to submit safety officer audit report',
				route: '/osh/e-soa',
				category: 'submission'
			},
			{
				icon: '/icons/eSCF.png',
				title: 'Staff Claim Form (e-SCF) Submission',
				description: 'For OSH engineers to submit staff claim form',
				route: '/osh/e-scf',
				category: 'submission'
			},
			{
				icon: '/icons/eTBM.jpg',
				title: 'Tool Box Meeting (e-TBM) Submission',
				description: 'For OSH engineers to submit tool box meeting report',
				route: '/osh/e-tbm',
				category: 'submission'
			},
			{
				icon: '/icons/eTNR.png',
				title: 'Training Record (e-TNR) Submission',
				description: 'For OSH engineers to submit safety training record',
				route: '/osh/e-tnr',
				category: 'submission'
			},
			{
				icon: '/icons/eTRF.png',
				title: 'Travel Requisition Form (e-TRF) Submission',
				description: 'For OSH engineers to submit travel requisition form',
				route: '/osh/e-trf',
				category: 'submission'
			},
			{
				icon: '/icons/eZCA.jpg',
				title: 'Zero Compromise Audit (e-ZCA) Submission',
				description: 'For OSH engineers to submit zero compromise audit report',
				route: '/osh/e-zca',
				category: 'submission'
			}
		]
	}
];