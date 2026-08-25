/**
 * What each jurisdiction requires by way of certifying supervised driving
 * hours: whether a specific official form must be presented, whether it must
 * be notarized, and whether the state wants a running per-drive log or just a
 * signed total.
 *
 * WHY THIS HOLDS NO HOURS FIGURES: hours live in stateRequirements.js, sourced
 * from the IIHS table. Duplicating them here would let the gauge on the
 * dashboard and the number on the affidavit drift apart, which on a sworn
 * document is the worst place for it. Where a source disagrees with IIHS the
 * discrepancy belongs in that file, resolved once.
 *
 * WHY THERE ARE NO REPLICA FORMS HERE: where a state mandates a specific
 * numbered form, this app cannot substitute for it. Reproducing an official
 * DMV form from anything less than the current official PDF risks a wrong
 * field, a stale revision, or altered certification language on a document
 * someone swears to and a clerk rejects. So the app names the form, links the
 * state's own copy, and presents its own output as a supporting record — see
 * `kind: 'specific'` handling in utils/pdfExport.js.
 *
 * `verify: true` marks entries the underlying research flagged as
 * low-confidence. Those are shown with a caution rather than stated flatly.
 *
 * Sourced from a state-by-state review dated mid-2026. Requirements change:
 * re-check against the linked official page before relying on any entry.
 */

// kind:   'specific' — a named/numbered official form must be presented
//         'generic'  — hours required, but a signed statement or unnumbered log is accepted
//         'none'     — no logged-hours requirement
// shape:  'per-drive' — the state wants each session dated and listed
//         'summary'   — a signed total is what is certified
//         'either'    — both shapes are accepted
// notary: 'required'  — always notarized
//         'or-official' — notary OR signing before a license examiner
//         'conditional' — only in certain circumstances (see notaryNote)
export const STATE_AFFIDAVITS = {
  AL: { kind: 'generic', shape: 'summary', verify: true,
        note: 'ALEA indicates no official numbered hours form, and possibly no log requirement at all.' },
  AK: { kind: 'specific', form: 'Parent/Guardian Consent', number: 'Form 433', shape: 'summary',
        url: 'https://dmv.alaska.gov/media/cuebehop/433.pdf' },
  AZ: { kind: 'specific', form: 'Supervised Driving Practice Certificate', number: '96-0223', shape: 'summary',
        url: 'https://apps.azdot.gov/files/mvd/mvd-forms-lib/96-0223.pdf' },
  AR: { kind: 'none' },
  CA: { kind: 'generic', shape: 'summary',
        note: 'The parent certifies the hours on the instruction permit application; no separate form is submitted.' },
  CO: { kind: 'specific', form: 'Drive Time Log Sheet', number: 'DR 2324', shape: 'per-drive',
        url: 'https://dmv.colorado.gov/sites/dmv/files/documents/DR2324_2022.pdf',
        conditional: 'Rises to 62 hours if 12 behind-the-wheel hours were completed with a parent.' },
  CT: { kind: 'generic', shape: 'per-drive',
        note: 'Home-training log signed by a parent. CS-1 is the driver-education certificate, not an hours form.' },
  DE: { kind: 'generic', shape: 'summary', verify: true,
        note: 'A DMV/Department of Education certification with no public form number, submitted to the Department of Education.' },
  DC: { kind: 'specific', form: 'Certification of Eligibility', shape: 'summary',
        url: 'https://dmv.dc.gov/service/learner-permits-and-provisional-licenses', verify: true,
        note: 'A 40-hour certification plus a separate 10-hour night certification. Exact form identifiers need confirming.' },
  FL: { kind: 'specific', form: 'Certification of Minor Driving Experience', number: 'HSMV 71143', shape: 'summary',
        url: 'https://www.flhsmv.gov/driver-licenses-id-cards/general-information/required-documents-teen-drivers/',
        notary: 'or-official',
        notaryNote: 'Must be signed in front of a driver license examiner, or notarized if the parent or guardian will not be present.' },
  GA: { kind: 'specific', form: 'Driving Experience Affidavit', number: 'DDS-7', shape: 'summary',
        url: 'https://dds.georgia.gov/teen-drivers',
        notaryNote: 'Completed at a DDS office.' },
  HI: { kind: 'generic', shape: 'per-drive', notary: 'required',
        url: 'https://hidot.hawaii.gov/highways/programs/graduated-drivers-licensing/',
        notaryNote: 'A notarized supervised-driving-log affidavit, per HRS 286-102.6.' },
  ID: { kind: 'generic', shape: 'summary',
        note: 'The parent signs a GDL Requirements Verification statement.' },
  IL: { kind: 'specific', form: '50-Hour Practice Driving Log', number: 'DSD X 152', shape: 'per-drive',
        url: 'https://www.ilsos.gov/publications/pdf_publications/dsd_x152.pdf' },
  IN: { kind: 'specific', form: 'Log of Supervised Driving Practice', number: 'State Form 54706', shape: 'per-drive',
        url: 'https://forms.in.gov/Download.aspx?id=9758',
        note: 'Use the current R5/8-24 revision; older revisions are not accepted.' },
  IA: { kind: 'generic', shape: 'per-drive',
        note: "A generic log plus Parent's Written Consent, Form 430018." },
  KS: { kind: 'specific', form: '50-Hour Affidavit / Teen Driving Experience Log', number: 'DE-IB01', shape: 'summary',
        url: 'https://www.ksrevenue.gov/dovgdl.html' },
  KY: { kind: 'specific', form: 'Practice Driving Log', shape: 'per-drive',
        url: 'https://drive.ky.gov/Drivers/Pages/GDLP.aspx',
        note: 'An official log, but unnumbered.' },
  LA: { kind: 'generic', shape: 'summary',
        note: 'A parent or guardian signed statement, per RS 32:405.1.' },
  ME: { kind: 'specific', form: 'Permittee Driving Log', number: 'MVE-21', shape: 'per-drive',
        url: 'https://www.maine.gov/sos/bmv/' },
  MD: { kind: 'generic', shape: 'per-drive', verify: true,
        note: 'Rookie Driver Practice & Skills Log with a certification page; referenced as DL-195, which needs confirming.' },
  MA: { kind: 'generic', shape: 'per-drive',
        url: 'https://www.mass.gov/doc/supervised-driving-log',
        note: 'A published Supervised Driving Log with no form number; the parent certifies on road-test day.',
        conditional: 'Reduced with a driver skills development course.' },
  MI: { kind: 'specific', form: 'Michigan Supervised Driving Log', shape: 'per-drive',
        url: 'https://www.michigan.gov/sos',
        conditional: '30 of the hours must be completed before Segment 2.' },
  MN: { kind: 'specific', form: 'Supervised Driving Log', shape: 'per-drive',
        url: 'https://dps.mn.gov/divisions/dvs/Pages/default.aspx',
        note: 'The DPS format is mandatory.',
        conditional: 'Reduced if a parent completes the supervising-driver class.' },
  MS: { kind: 'generic', shape: 'summary', verify: true,
        note: 'A parent-certified affidavit; no distinct numbered form was located on an official page.' },
  MO: { kind: 'generic', shape: 'summary',
        note: 'Certified by signature on the intermediate licence application; Driver Experience Log Form 4901 is optional.' },
  MT: { kind: 'specific', form: 'Graduated Driver Licensing Certification', number: '21-1600', shape: 'summary',
        url: 'https://mvdmt.gov/drivers-under-18/' },
  NE: { kind: 'specific', form: '50-Hour Certification', number: 'DMV 06-91', shape: 'summary',
        url: 'https://dmv.nebraska.gov/' },
  NV: { kind: 'specific', form: 'Beginning Driver Experience Log', number: 'DLD-130', shape: 'per-drive',
        url: 'https://dmv.nv.gov/nvdlteens.htm',
        conditional: 'Rises to 100 hours where driver education is unavailable.' },
  NH: { kind: 'specific', form: "Driver's Out-of-Class Log Sheet", number: 'DSMV 509', shape: 'per-drive',
        url: 'https://www.dmv.nh.gov/' },
  NJ: { kind: 'specific', form: 'Certification of Supervised Driving', number: 'BA-CSD', shape: 'per-drive',
        url: 'https://www.nj.gov/mvc/',
        effectiveFrom: '2025-02-01',
        note: 'Applies only to permits issued on or after 1 February 2025. Only a signed BA-CSD satisfies the requirement.' },
  NM: { kind: 'generic', shape: 'per-drive', note: 'A GDL driving log signed by a parent; no form number.' },
  NY: { kind: 'specific', form: 'Certification of Supervised Driving', number: 'MV-262', shape: 'summary',
        url: 'https://dmv.ny.gov/forms/mv262.pdf',
        note: 'The parent or guardian must give the completed MV-262 to the license examiner at every road test.' },
  NC: { kind: 'specific', form: 'Driving Log to Advance to Level 2', number: 'DL-4A', shape: 'per-drive',
        url: 'https://www.ncdot.gov/dmv/',
        note: 'DHSR-100 relates to a licensed driving-school pathway, not the standard parent-supervised log.' },
  ND: { kind: 'generic', shape: 'per-drive', verify: true,
        note: 'A signed log. No discrete night-hour figure surfaced from an official source.' },
  OH: { kind: 'specific', form: 'Fifty-Hour Affidavit', number: 'BMV 5791', shape: 'per-drive',
        url: 'https://bmv.ohio.gov/dl-gdl.aspx',
        notary: 'required',
        notaryNote: 'Ohio always requires this affidavit to be sworn before a notary.',
        note: 'Updated in 2025 to require a detailed log of each session, not only a signed total.' },
  OK: { kind: 'specific', form: 'Affidavit of Driver Training', number: '50HD', shape: 'summary',
        url: 'https://oklahoma.gov/', verify: true,
        conditional: 'Rises to 55 hours on the parent-taught pathway.' },
  OR: { kind: 'generic', shape: 'per-drive',
        url: 'https://www.oregon.gov/odot/dmv/pages/teen/index.aspx',
        note: 'The parent certifies on the application; an official Practice Driving Log is published.',
        conditional: 'Doubles without driver education.' },
  PA: { kind: 'specific', form: 'Parent or Guardian Certification Form', number: 'DL-180C', shape: 'summary',
        url: 'https://www.dmv.pa.gov/',
        notary: 'conditional',
        notaryNote: 'Notarization is required only if the parent or guardian is not accompanying the teen to the Driver License Center.',
        note: 'DL-180TD is the separate parent/guardian consent form; DL-180C is the hours certification.',
        conditional: 'Includes a bad-weather hours component in addition to night hours.' },
  RI: { kind: 'generic', shape: 'summary', note: 'A parent-signed affidavit or log, per RIGL 31-10-6.' },
  SC: { kind: 'specific', form: 'Certification', number: 'PDLA', shape: 'summary',
        url: 'https://www.scdmvonline.com/', verify: true,
        note: 'Log Form DL-008A is optional. Form identifiers need confirming.' },
  SD: { kind: 'generic', shape: 'per-drive',
        note: 'A parent Supervised Driving Statement affidavit plus a log, per SDCL 32-12.',
        conditional: 'Includes an inclement-weather hours component.' },
  TN: { kind: 'specific', form: 'Certification of 50 Hours Behind the Wheel', number: 'SF-1256', shape: 'summary',
        url: 'https://www.tn.gov/safety/driver-services.html' },
  TX: { kind: 'specific', form: 'Behind-the-Wheel Instruction Log', shape: 'per-drive',
        url: 'https://www.tdlr.texas.gov/',
        note: 'A TDLR/DPS format rather than a numbered form.' },
  UT: { kind: 'generic', shape: 'per-drive', note: 'A parent-certified driving log; no numbered form.' },
  VT: { kind: 'specific', form: 'Driving Practice Log Sheet', number: 'VN-210', shape: 'per-drive',
        url: 'https://dmv.vermont.gov/',
        note: 'Required by 23 V.S.A. 607.' },
  VA: { kind: 'generic', shape: 'summary',
        note: 'Certified on the driver-education completion certificate, per 46.2-335.' },
  WA: { kind: 'specific', form: 'Parental Authorization Affidavit', number: 'DLE-520-003', shape: 'summary',
        url: 'https://dol.wa.gov/',
        note: 'Required by RCW 46.20.075.' },
  WV: { kind: 'specific', form: '50-Hour Certification Log (Under Age 18)', number: 'DMV-10-GDL', shape: 'per-drive',
        url: 'https://transportation.wv.gov/DMV/' },
  WI: { kind: 'specific', form: 'Supervised Driving Log', number: 'HS303', shape: 'per-drive',
        url: 'https://wisconsindot.gov/Documents/dmv/shared/hs303.pdf' },
  WY: { kind: 'specific', form: 'Behind-the-Wheel Driving Certification', number: 'FSGDL-01', shape: 'per-drive',
        url: 'https://www.dot.state.wy.us/' },
};

/** Everything the affidavit and the dashboard need to know, with safe defaults. */
export function affidavitRulesFor(stateCode) {
  const entry = STATE_AFFIDAVITS[stateCode] ?? { kind: 'generic', shape: 'either' };
  return {
    kind: entry.kind ?? 'generic',
    shape: entry.shape ?? 'either',
    form: entry.form ?? null,
    number: entry.number ?? null,
    url: entry.url ?? null,
    notary: entry.notary ?? null,
    notaryNote: entry.notaryNote ?? null,
    note: entry.note ?? null,
    conditional: entry.conditional ?? null,
    effectiveFrom: entry.effectiveFrom ?? null,
    verify: entry.verify === true,
    /** A display label like "Form MV-262" or "Certification of Supervised Driving". */
    formLabel: entry.number
      ? `${entry.form ? `${entry.form}, ` : ''}Form ${entry.number}`
      : entry.form ?? null,
  };
}
