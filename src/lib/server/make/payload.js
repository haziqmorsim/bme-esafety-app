import {
    compactDate,
    compactTime,
    displayDate,
    displayDateTime,
    fileDate,
    monthLabelFromDate,
    num,
    safeName,
    text
} from './format.js';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif)$/i;

const COMPETENCY_LABEL = { yes: 'Yes', no: 'No', no_activity: 'No Activity' };
const INDUCTION_LABEL = { visitor: 'Visitor', conductor: 'Contractor', contractor: 'Contractor' };

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const imagesOnly = (paths) => asList(paths).filter((p) => IMAGE_EXT.test(String(p)));
const label = (map, v) => map[v] ?? text(v);

function conductor(ctx) {
    const { row, profile } = ctx;
    const profileName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
    return {
        name: text(row.conducted_by || row.created_by_name || profileName),
        position: text(row.conducted_position || profile?.position)
    };
}

const projectLocation = (ctx) => text(ctx.row.location || ctx.project?.location);

export function makeReportId(prefix, row, activityDate) {
    const parts = [
        prefix,
        row.project_no,
        compactDate(activityDate) || compactDate(row.created_at),
        compactTime(row.created_at)
    ].filter(Boolean);
    return safeName(parts.join('_'));
}

export function commonFields(ctx) {
    return {
        form: ctx.form,
        UniqueID: ctx.row.id,
        ReportID: ctx.reportId,
        SubmissionTime: displayDateTime(ctx.row.created_at),
        LocationSubmit: text(ctx.row.submit_location, '-'),
        EmailTo: text(ctx.emailTo),
        send: ctx.send
    };
}

// e-HKP
async function hkp(ctx) {
    const { row } = ctx;
    const rd = row.report_day ?? {};
    const who = conductor(ctx);

    return {
        ProjectName: text(row.project_name),
		ProjectNo: text(row.project_no),
		Location: projectLocation(ctx),
		ActivityDate: displayDate(row.activity_date),
		Weather: text(row.weather),
		ConductedBy: who.name,
		Position: who.position,
		Sitewalk: num(rd.site_walk),
		Highrisk: num(rd.high_risk),
		UAUC: num(rd.uauc),
		Stopwork: num(rd.stop_work),
		LostTimeInjuries: num(rd.lt_injuries),
		NoLostTimeInjuries: num(rd.nlt_injuries),
		OPD: num(rd.opd),
		NearMissIncident: num(rd.near_miss),
		NonCompliance: num(rd.non_compliance),
		SignificantSafety: num(rd.sd_occurrence),
        InjuriesRemark: text(row.injuries_remark),
		UCACDescription: text(row.uauc_description),
		UCACCorrectionAction: text(row.uauc_corrective_action),
		StopWorkDescription: text(row.stop_work_description),
		practice: text(row.practice),
		practiceDetails: text(row.practice_details),
		Remarks: text(row.remarks),
		Housekeepingimage: await ctx.sign(imagesOnly(row.hkp_photo_path))
    };
}

// e-PPE
async function ppe(ctx) {
    const { row } = ctx;
    const a = row.attendance ?? {};
    const who = conductor(ctx);

    return {
        projectName: text(row.project_name),
		projectNo: text(row.project_no),
		location: projectLocation(ctx),
		activityDate: displayDate(row.activity_date),
		weather: text(row.weather),
		conductedBy: who.name,
		position: who.position,
        BMEAttendee: num(a.bme ?? a.bme_attendees),
		SubconAttendee: num(a.subcon ?? a.subcon_attendees),
		VisitorAttendee: num(a.visitor ?? a.other_attendees),
		remarks: text(row.remarks),
		PPEimageUrl: await ctx.sign(imagesOnly(row.ppe_photo_path))
    };
}

// e-TBM
async function tbm(ctx) {
    const { row } = ctx;
    const c = row.competence ?? {};
    const a = row.attendance ?? {};
    const who = conductor(ctx);

    const topics = asList(row.meeting_topics).map((t) => 
        t === 'Other' && row.other_topic ? `Other: ${row.other_topic}` : t
    );

    const attendance = {
        pe: num(a.project_engineer),
		ps: num(a.project_supervisor),
		sho: num(a.sho),
		sss: num(a.sss),
		'cs(OSH)': num(a.oshc_supervisor),
		'cw(OSH)': num(a.oshc_worker),
		'cs(X_OSH)': num(a.non_oshc_supervisor),
		'cw(X_OSH)': num(a.non_oshc_worker),
		bmeworker: num(a.bme_worker),
		visitor: num(a.other)
    };

    return {
        projectName: text(row.project_name),
		projectNo: text(row.project_no),
		location: projectLocation(ctx),
		meetingDate: displayDate(row.meeting_date),
		weather: text(row.weather),
		conductedBy: who.name,
		position: who.position,
		tbmTopics: topics.join(', '),
		'MobileCrane-OperatorCertificate': label(COMPETENCY_LABEL, c.mobile_crane_operator),
		'MobileCrane-PerakuanMesinAngkat': label(COMPETENCY_LABEL, c.mobile_crane_pma),
		'SkyLiftOperator-PerakuanMesinAngkat': label(COMPETENCY_LABEL, c.sky_lift_operator),
		'ScaffoldInspectorLevel2/3': label(COMPETENCY_LABEL, c.scaffold_inspector_2_3),
		ScaffoldErectorLevel: label(COMPETENCY_LABEL, c.scaffold_inspector_1),
		AuthorisedGasTester: label(COMPETENCY_LABEL, c.authorised_gas_tester),
		EntrySupervisor: label(COMPETENCY_LABEL, c.entry_supervisor),
		LiftingSupervisor: label(COMPETENCY_LABEL, c.lifting_supervisor),
		Signalman: label(COMPETENCY_LABEL, c.signalman),
		RiggerAndSlinger: label(COMPETENCY_LABEL, c.rigger_slinger),
		Backhoe: label(COMPETENCY_LABEL, c.backhoe),
		Forklift: label(COMPETENCY_LABEL, c.forklift),
		...attendance,
		total: Object.values(attendance).reduce((s, n) => s + n, 0),
		remarks: text(row.remarks),
		image: await ctx.sign(
			imagesOnly([row.tbm_photo_path, row.tbm_form_path, row.ptw_form_path, row.other_doc_path])
		)
    };
}

// e-IDF / e-IPR / e-TNR
function folderRecordBase(ctx) {
    const { row } = ctx;
    const who = conductor(ctx);
    return {
        projectName: text(row.project_name),
		projectNo: text(row.project_no),
		location: projectLocation(ctx),
		activityDate: displayDate(row.activity_date),
		date: fileDate(row.activity_date),
		conductedBy: who.name,
		position: who.position
    };
}

async function idf(ctx) {
    const { row } = ctx;
    return {
        ...folderRecordBase(ctx),
		type: label(INDUCTION_LABEL, row.induction_type),
		total: text(row.contractors),
		remark: text(row.remarks),
		image: await ctx.sign(asList([row.idf_form_path, row.idf_activity_path]))
    };
}

async function ipr(ctx) {
    const { row } = ctx;
    return {
        ...folderRecordBase(ctx),
		remark: text(row.observations),
		image: await ctx.sign(asList([row.ipr_checklist_path, row.ipr_activity_path]))
    };
}

async function tnr(ctx) {
    const { row } = ctx;
    return {
        ...folderRecordBase(ctx),
		topic: text(row.topic),
		description: text(row.description),
		remark: text(row.remarks),
		image: await ctx.sign(asList([row.tnr_attendance_path, row.tnr_activity_path]))
    };
}

// e-ZCA
const ZCA_SECTIONS = [
    { letter: 'a', remark: 'DA' }, // Documentation & Approvals (4 items)
	{ letter: 'b', remark: 'SMC' }, // Safety Manpower Coverage (3)
	{ letter: 'c', remark: 'WSC' }, // Workforce Safety Compliance (4)
	{ letter: 'd', remark: 'SV' }, // Subcontractor Vetting (2)
	{ letter: 'e', remark: 'SCC' }, // Site Condition & Controls (6)
	{ letter: 'f', remark: 'SLR' } // Safety Leadership & Reporting (3)
];
const ZCA_MAX_PER_ITEM = 5;

async function zca(ctx) {
    const { row } = ctx;
    const who = conductor(ctx);
    const sections = asList(row.subsections);
    const out = {};
    let total = 0;
    let max = 0;

    ZCA_SECTIONS.forEach((meta, i) => {
        const items = asList(sections[i]?.items);
        let sectionTotal = 0;

        items.forEach((item, j) => {
            const score = item?.score === null || item?.score === undefined ? '' : num(item.score);
            out[`${meta.letter}${j + 1}`] = score;
			out[`${meta.remark}_R${j + 1}`] = text(item?.remarks);
			sectionTotal += num(item?.score);
        });

        const sectionMax = items.length * ZCA_MAX_PER_ITEM;
        out[`${meta.letter}${items.length + 1}`] = sectionMax
			? `${Math.round((sectionTotal / sectionMax) * 100)}%`
			: '';
		total += sectionTotal;
		max += sectionMax;
    });

    return {
        ProjectName: text(row.project_name),
		ProjectNo: text(row.project_no),
		Location: projectLocation(ctx),
		ActivityDate: displayDate(row.audit_date),
		ConductedBy: who.name,
		...out,
		Scoretotal: total,
		ScoreMaxTotal: max,
		Overall: max ? `${Math.round((total / max) * 100)}%` : '0%',
		Remarks: text(row.remarks)
    };
}

// e-SCF
async function scf(ctx) {
    const { row, profile } = ctx;
    const profileName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
    const [file] = await ctx.sign(asList(row.maps_screenshot_path));

    return {
        name: text(row.staff_name || profileName),
		month: monthLabelFromDate(row.claim_date),
		file: text(file),
		claimDate: displayDate(row.claim_date),
		projectNo: text(row.project_no)
    };
}

export const FORMS = {
    hkp: {
		label: 'e-HKP',
		table: 'hkp_submissions',
		bucket: 'hkp_uploads',
		webhookEnv: 'MAKE_WEBHOOK_EHKP',
		dateColumn: 'activity_date',
		emailCopy: true,
		build: hkp
	},
	ppe: {
		label: 'e-PPE',
		table: 'ppe_submissions',
		bucket: 'ppe_uploads',
		webhookEnv: 'MAKE_WEBHOOK_EPPE',
		dateColumn: 'activity_date',
		emailCopy: true,
		build: ppe
	},
	tbm: {
		label: 'e-TBM',
		table: 'tbm_submissions',
		bucket: 'tbm_uploads',
		webhookEnv: 'MAKE_WEBHOOK_ETBM',
		dateColumn: 'meeting_date',
		emailCopy: true,
		build: tbm
	},
	idf: {
		label: 'e-IDF',
		table: 'idf_submissions',
		bucket: 'idf_uploads',
		webhookEnv: 'MAKE_WEBHOOK_EIDF',
		dateColumn: 'activity_date',
		build: idf
	},
	ipr: {
		label: 'e-IPR',
		table: 'ipr_submissions',
		bucket: 'ipr_uploads',
		webhookEnv: 'MAKE_WEBHOOK_EIPR',
		dateColumn: 'activity_date',
		build: ipr
	},
	tnr: {
		label: 'e-TNR',
		table: 'tnr_submissions',
		bucket: 'tnr_uploads',
		webhookEnv: 'MAKE_WEBHOOK_ETNR',
		dateColumn: 'activity_date',
		build: tnr
	},
	zca: {
		label: 'e-ZCA',
		table: 'zca_submissions',
		bucket: null,
		webhookEnv: 'MAKE_WEBHOOK_EZCA',
		dateColumn: 'audit_date',
		build: zca
	},
	scf: {
		label: 'e-SCF',
		table: 'scf_submissions',
		bucket: 'scf_uploads',
		webhookEnv: 'MAKE_WEBHOOK_ESCF',
		dateColumn: 'claim_date',
		requires: (row) => !!row.maps_screenshot_path,
		build: scf
	}
};