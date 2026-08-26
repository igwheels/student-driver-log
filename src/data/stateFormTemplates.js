/**
 * Per-state official forms the app can fill in, and how to fill each one.
 *
 * Three shapes, because states publish three kinds of PDF:
 *
 *  kind: 'acroform' — the PDF carries real form fields. Values are written
 *        into the named fields and the form is left unflattened, so the
 *        parent can correct anything and supply the fields the app has no
 *        way to know (permit numbers, addresses).
 *
 *  kind: 'overlay'  — a flat scan with no fields. Text is drawn at measured
 *        coordinates on the state's own page. Coordinates are in PDF points
 *        from the bottom-left, taken by locating the printed rules in a
 *        rendering of the page rather than by estimate.
 *
 *  kind: 'acroform-log' — an AcroForm whose bulk is a repeating driving-log
 *        grid (one row per drive: date, day hours, night hours). `fields` is
 *        filled the same way as 'acroform'; `log` additionally maps the
 *        student's actual logged drives onto the grid's rows, most recent
 *        first, up to however many rows the state's own PDF provides. A
 *        student with more logged drives than the form has rows gets the
 *        most recent ones filled and the rest left for the CSV export — the
 *        state's own instructions on these forms already anticipate this by
 *        telling the parent to attach a duplicate log if one page isn't
 *        enough, which a single PDF template can't do on its own.
 *
 *  kind: 'overlay-log' — the flat-scan equivalent of 'acroform-log': a
 *        repeating log grid with no fields, so rows are drawn at measured y
 *        positions (`log.rowYs`, one per row, same reasoning as 'overlay'
 *        coordinates) rather than written into named fields. Used where the
 *        state's own log additionally splits day and night drives into two
 *        separate side-by-side columns (`log.columns.day` / `.night`) with
 *        independent row pools rather than one shared date column — each
 *        column overflows on its own, same most-recent-first rule as
 *        'acroform-log'.
 *
 * The app fills only what it actually holds. Every other blank is left for
 * the parent, and signatures are always left blank — a signature is the one
 * thing this app must never produce.
 *
 * ENCRYPTED SOURCES: New York's MV-262, Indiana's State Form 54706, and
 * Arizona's 96-0223 all publish with AES-256 encryption whose permissions
 * allow form filling but forbid modifying content. No browser PDF library
 * can decrypt that, so the asset in public/forms/ is decrypted once ahead of
 * time — see public/forms/README.md for the command. Filling is the
 * operation the state's own permission bits allow. Ohio's BMV 5791 was
 * evaluated and skipped for the opposite reason: its permission bits forbid
 * form-filling and content modification both, so there is no operation this
 * app is allowed to perform on it — it stays on the generic affidavit.
 *
 * Adding a state means adding an entry here plus its PDF in public/forms/.
 * Re-check the form against the state's current published revision first:
 * a superseded revision is worse than no template at all.
 */

const fullName = (ctx) => `${ctx.student.firstName} ${ctx.student.lastName}`.trim();
const lastFirst = (ctx) => `${ctx.student.lastName}, ${ctx.student.firstName}`.trim();
const today = (ctx) =>
  ctx.today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

// The app only ever collects one free-text name for the supervising parent
// or guardian (the account's display name), but a few states' own forms ask
// for it as separate First/Last fields. Splitting on the last space is a
// guess, not a lookup — same as every other field here, the form is left
// unflattened so the parent can fix it before signing.
const parentLast = (ctx) => ctx.parentName.trim().split(/\s+/).slice(-1)[0] ?? '';
const parentFirst = (ctx) => ctx.parentName.trim().split(/\s+/).slice(0, -1).join(' ');

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

// Indiana's 108 rows print as four blocks of a left/right column pair (two
// per page): Row1-31 and Row1_2-31_2 on page one, Row1_3-23_3 and
// Row1_4-23_4 on page two. Order matches how the rows actually read on the
// printed page, top to bottom then left column before right.
const inRowSuffixes = [
  ...range(1, 31).map(String),
  ...range(1, 31).map((n) => `${n}_2`),
  ...range(1, 23).map((n) => `${n}_3`),
  ...range(1, 23).map((n) => `${n}_4`),
];

// Maine's 50 rows are a single column of 25 continued onto a second page.
const meRowSuffixes = [...range(1, 25).map(String), ...range(1, 25).map((n) => `${n}_2`)];

// Nevada's DLD130 log rows are measured from the printed grid lines in a
// rendering of page 2 (public/forms/nv-dld130.pdf), not estimated: 18 equal
// rows between the header and the subtotal band, each 18.3-18.7pt tall.
// rowYs is the baseline for each row (4pt above its bottom rule, same
// convention as every other overlay coordinate here), top row first.
const nvRowYs = [
  512.2, 493.8, 475.2, 456.8, 438.2, 419.8, 401.5, 383.2, 364.5,
  346.2, 327.8, 309.2, 290.8, 272.5, 253.8, 235.5, 216.8, 198.5,
];

// DC's DMV-GRAD-HR40 log rows, measured the same way as Nevada's: from the
// printed grid lines in a rendering of page 1 (10 rows, ~14.3-15.4pt each).
const dcRowYs = [469.5, 455.2, 440.8, 426.2, 410.8, 396.5, 382.2, 367.8, 352.5, 338.2];

// Colorado's DR 2324 pads row numbers inconsistently between its four field
// types for the same row (Date_02 next to Driving Time_2, Night Driving_02),
// so each row is listed explicitly by field name rather than generated from
// one shared suffix — confirmed against the published PDF's own field names,
// typos and all.
const coRows = [
  { date: 'Date', day: 'Driving Time', night: 'Night Driving' },
  ...range(2, 13).map((n) => ({
    date: `Date_${String(n).padStart(2, '0')}`,
    day: `Driving Time_${n}`,
    night: `Night Driving_${String(n).padStart(2, '0')}`,
  })),
];

export const STATE_FORM_TEMPLATES = {
  NY: {
    kind: 'acroform',
    asset: 'forms/ny-mv-262.pdf',
    formLabel: 'MV-262 Certification of Supervised Driving',
    revision: 'as published; verify against dmv.ny.gov/forms/mv262.pdf',
    // Field names are those in the published PDF, typos and all — they are
    // the document's own identifiers, not ours to tidy.
    fields: [
      { name: 'Applicant Name', value: fullName },
      {
        name: 'Printed Name of ParentGuardian or Representative of a Government AgencyFacility',
        value: (ctx) => ctx.parentName,
      },
      { name: 'Date', value: today },
    ],
    // Left for the parent: the app holds neither, and guessing on a form
    // that warns false information may be a crime is not a risk to take.
    leftBlank: ['Learner Permit ID Identification Number', 'Address'],
    note:
      'The table of driving-school instructor hours is left blank. It is for hours certified by a ' +
      'licensed instructor, which this app does not record.',
  },

  NJ: {
    kind: 'overlay',
    asset: 'forms/nj-ba-csd.pdf',
    formLabel: 'BA-CSD Certification of Supervised Driving',
    revision: 'rev 1/25',
    // Positions measured from the printed rules on the page: the name rule
    // sits at y=327.5 spanning x 73-307, the date rule at y=287 spanning
    // x 432.5-541. Text is placed 4pt above each rule so it sits on the line
    // rather than through it.
    overlay: [
      { x: 78, y: 331.5, size: 11, value: (ctx) => ctx.parentName },
      { x: 437, y: 291, size: 11, value: today },
    ],
    note:
      'The form instructs that it be printed and signed by hand. The signature line is left blank ' +
      'for exactly that.',
  },

  AZ: {
    kind: 'acroform',
    asset: 'forms/az-96-0223.pdf',
    formLabel: '96-0223 Driving Practice Certificate',
    revision: 'R07/25',
    fields: [
      { name: 'Applicant Name first middle last suffix', value: fullName },
      { name: 'Parent or Guardian Name first middle last suffix', value: (ctx) => ctx.parentName },
    ],
    // Date of birth: the app doesn't collect it. The three checkboxes each
    // certify a different pathway (base 30/10, reduced 20/6 with driver ed,
    // or a driver-ed-program waiver) — which one applies is a fact about the
    // family, not the logged hours, so all three are left for the parent to
    // check themselves rather than guessed from the total on file.
    leftBlank: [
      'Date of Birth',
      'I certify that The applicant completed at least 30 hours of supervised driving practice including at least 10 hours at',
      'I certify that the applicant completed at least 20 hours of supervised driving practice including at least 6 hours at night if',
      'I certify that the minor has completed a High School Driver Education or Authorized Third Party Driver License Driver',
    ],
    note:
      'This document must be acknowledged before a notary or MVD agent, per the form’s own ' +
      'instructions — that block and the signature line are left blank for that.',
  },

  FL: {
    kind: 'acroform',
    asset: 'forms/fl-71143.pdf',
    formLabel: 'HSMV 71143 Certification of Driving Experience of a Minor',
    revision: 'Rev 01/11',
    fields: [
      { name: 'First', value: (ctx) => ctx.student.firstName },
      { name: 'Last', value: (ctx) => ctx.student.lastName },
      { name: 'Print Name of Parent or Legal Guardian', value: (ctx) => ctx.parentName },
    ],
    // Middle name and date of birth: the app collects neither. Everything
    // from "STATE OF FLORIDA / COUNTY OF" down is the notary or DL
    // examiner's own block, including the second occurrence of the parent's
    // name inside the sworn-before-me line.
    leftBlank: [
      'Middle', 'DOB',
      'COUNTY OF', 'Month', 'Day', 'Year', 'Name of Parent or Legal Guardian', 'Identification Type',
      'Print Type or Stamp Commissioned Name of Notary Public',
    ],
    note:
      'This document must be signed in front of a notary or a driver license examiner, per the ' +
      'form’s own instructions — the entire notary block and both signature lines are left blank ' +
      'for that.',
  },

  OK: {
    kind: 'acroform',
    asset: 'forms/ok-affidavit.pdf',
    formLabel: 'Affidavit of Driver Training',
    revision: 'SOK 12/2025',
    fields: [
      { name: 'Last Name', value: (ctx) => ctx.student.lastName },
      { name: 'First Name', value: (ctx) => ctx.student.firstName },
      { name: 'Last Name_2', value: parentLast },
      { name: 'First Name_2', value: parentFirst },
      { name: 'Date', value: today },
    ],
    // Middle names and driver's license numbers: the app collects neither.
    // Everything from "State of" down is the notary's own block.
    leftBlank: [
      'Middle Name', 'Driver License', 'Date of Birth',
      'Middle Name_2', 'Driver License_2', 'Date of Birth_2',
      'State of', 'County of', 'COUNTY OF',
    ],
    note:
      'This document must be signed in front of a notary, per the form’s own instructions — ' +
      'the entire notary block and the signature line are left blank for that.',
  },

  PA: {
    kind: 'acroform',
    asset: 'forms/pa-dl-180c.pdf',
    formLabel: 'DL-180C Parent or Guardian Certification Form',
    revision: '6-25',
    fields: [
      { name: 'PRINT NAME OF MINOR', value: fullName },
      // The one generic text field on this form ("Text1") sits directly on
      // the "(print name as it appears in signature)" line under the
      // parent/guardian signature block — confirmed against the rendered
      // page, not assumed from the field's name.
      { name: 'Text1', value: (ctx) => ctx.parentName },
    ],
    leftBlank: ['LEARNERS PERMIT NUMBER', 'EXAM CENTER', 'EXAMINER', 'INSTRUCTOR'],
    note:
      'Signing in the presence of a notary, driver license examiner, end-of-course skill test ' +
      'teacher, certified third-party examiner, or motorcycle safety instructor is required, per ' +
      'the form’s own instructions — that block and both signature lines are left blank for that.',
  },

  IN: {
    kind: 'acroform-log',
    asset: 'forms/in-54706.pdf',
    formLabel: 'State Form 54706 Log of Supervised Driving Practice',
    revision: 'R5 / 8-24, matching the state’s current download at forms.in.gov',
    // The driver-name/DLN header repeats once per page of the log.
    fields: [
      { name: 'Driver Name last first middle initial', value: lastFirst },
      { name: 'Driver Name last first middle initial_2', value: lastFirst },
    ],
    log: {
      datePrefix: 'DATE mmddyyyyRow',
      dayPrefix: 'DAYRow',
      nightPrefix: 'NIGHTRow',
      rowSuffixes: inRowSuffixes,
    },
    leftBlank: ['Drivers License Number DLN', 'Bioptic Drivers are not required to drive at night'],
    note:
      'Section 2’s affirmation and both signature lines (driver, and parent/guardian if under 18) ' +
      'are left blank for signing by hand.',
  },

  ME: {
    kind: 'acroform-log',
    asset: 'forms/me-mve21.pdf',
    formLabel: 'MVE-21 Driving Log',
    revision: 'Rev. 10/25',
    fields: [
      { name: 'Name', value: fullName },
      // The certifying parent/guardian's printed name and the date, same as
      // every other state's cover page — the signature itself stays blank.
      { name: 'Print Name', value: (ctx) => ctx.parentName },
      { name: 'Date', value: today },
    ],
    log: {
      datePrefix: 'Date and TimeRow',
      dayPrefix: 'Number of Driving HoursRow',
      nightPrefix: 'Number of After Dark Driving HoursRow',
      rowSuffixes: meRowSuffixes,
    },
    totals: {
      total: 'TOTAL HOURS OF PRACTICE DRIVING',
      night: 'TOTAL HOURS OF NIGHT DRIVING',
    },
    leftBlank: [
      'Date of Birth', 'Mailing Address', 'Telephone Number', 'History Number', 'Relationship',
    ],
    note:
      'Every row’s Supervising Driver name/age and license number are left blank — the app ' +
      'doesn’t record which specific supervising driver rode along on a given drive.',
  },

  NV: {
    kind: 'overlay-log',
    asset: 'forms/nv-dld130.pdf',
    formLabel: 'DLD130 Beginning Driver Experience Log',
    revision: '(1/2023)',
    // The Applicant's Name rule repeats on both pages, each measured
    // separately — the header text wraps differently on page 2, so the rule
    // doesn't sit at the same x-span as page 1's.
    overlay: [
      { page: 0, x: 50, y: 629, size: 10, value: fullName },
      { page: 1, x: 50, y: 731.5, size: 10, value: fullName },
    ],
    log: {
      page: 1,
      rowYs: nvRowYs,
      size: 9,
      // Column x positions measured the same way as rowYs: from the printed
      // grid's vertical rules, a few points right of each column's left edge.
      columns: {
        day: { date: { x: 50 }, begin: { x: 110 }, end: { x: 182 }, minutes: { x: 270 } },
        night: { date: { x: 316 }, begin: { x: 375 }, end: { x: 438 }, minutes: { x: 530 } },
      },
    },
    leftBlank: ['Instruction Permit or Restricted License No.', 'Relationship'],
    note:
      'The parent/guardian certification (relationship, signature) and the notary or Field ' +
      'Services block are left blank for signing in person — this form explicitly rejects ' +
      'photocopied signatures.',
  },

  CO: {
    kind: 'acroform-log',
    asset: 'forms/co-dr2324.pdf',
    formLabel: 'DR 2324 Drive Time Log Sheet',
    revision: '02/11/22',
    fields: [
      { name: 'Students name', value: fullName },
      // The printed name and date on the closing certification, same as
      // every other state's cover page — the signature stays blank.
      { name: 'Name', value: (ctx) => ctx.parentName },
      { name: 'Date_2', value: today },
    ],
    log: { rows: coRows },
    totals: {
      total: 'Grand Total Driving Time',
      night: 'Grand Total Night Driving Time',
    },
    // Each row also has a Comments cell (Comments, Comments_2 ... _13) —
    // left blank, same reasoning as Maine's Supervising Driver column: the
    // app has nothing to say there beyond the date and duration it already
    // fills.
    leftBlank: ['Permit number'],
    note:
      'Every row’s Comments cell is left blank — the app records when and how long a drive was, ' +
      'not freeform notes about it.',
  },

  NE: {
    kind: 'overlay',
    asset: 'forms/ne-dmv0691.pdf',
    formLabel: 'DMV 06-91 50 Hour Certification',
    revision: '1/08',
    // Measured from the printed blank line on the "I certify that ___"
    // line — the permit-number blank on the next line is left for the
    // parent, and the signature/date line below is untouched.
    overlay: [{ x: 214, y: 558, size: 11, value: fullName }],
    note:
      'This is a single certification paragraph, not a driving log — the signature and date line ' +
      'at the bottom is left blank for the parent to sign.',
  },

  DC: {
    kind: 'overlay-log',
    asset: 'forms/dc-grad-hr40.pdf',
    formLabel: 'DMV-GRAD-HR40 Certification of Eligibility for Provisional License',
    revision: 'Rev.08/24/09',
    // The Applicant Full Name / Learner Permit No. box sits below its own
    // two-line header, measured the same way as the log rows below it.
    overlay: [{ page: 0, x: 46, y: 641.7, size: 10, value: fullName }],
    log: {
      page: 0,
      rowYs: dcRowYs,
      size: 9,
      // This form's log has no separate night column at all — the DMV
      // just wants 40 hours total (see the note on the requirement figure
      // below) — so every drive draws into the same single row pool
      // regardless of time of day.
      fields: {
        date: { x: 46 },
        time: { x: 352 },
        hours: { x: 491 },
      },
    },
    // Tutor's Name: the app doesn't record which specific supervising adult
    // rode along on a given drive, the same gap as every other state's log.
    leftBlank: ['Learner Permit No.', "Tutor's Name"],
    note:
      'The printed document only asks for 40 total hours, with no separate night-time column or ' +
      'requirement — unlike stateRequirements.js’s current 10-hour night figure for DC, which is ' +
      'worth re-confirming against current DC law rather than this form alone.',
  },

  VT: {
    kind: 'acroform',
    asset: 'forms/vt-vn210.pdf',
    formLabel: 'VN-210 Driving Practice Log Sheet',
    revision: '2M 07/2019',
    // The name splits into three character-cell fields in printed order
    // (Last, First, Middle) rather than one combined field — confirmed by
    // their x-positions in the rendered page, left to right in that order.
    fields: [
      { name: 'Name.0', value: (ctx) => ctx.student.lastName },
      { name: 'Name.1', value: (ctx) => ctx.student.firstName },
      { name: 'Printed Name of ParentGuardian', value: (ctx) => ctx.parentName },
    ],
    // Deliberately not an 'acroform-log': unlike Indiana or Maine, this
    // log's rows ask for Skills Practiced and Driving Environment — a
    // qualitative description of each session, not just its date and
    // length — which the app has never recorded. Filling only Practice
    // Duration and leaving those two blank would read as a broken row on
    // every line, not a helpfully partial one, so the whole grid is left
    // for the parent instead.
    leftBlank: [
      'Name.2', 'Date of Birth', 'Learners Permit Number', 'Date Permit Issued', 'ParentGuardian License',
    ],
    note:
      'The driving-practice grid (date, skills practiced, driving environment, duration) is left ' +
      'entirely blank — it records what was practiced and where, not just how long, which this ' +
      'app doesn’t track. The conviction and hours-certification questions are also left blank: ' +
      'they’re the parent’s own attestation under penalty of perjury, not the app’s to answer.',
  },
};

export function stateFormTemplateFor(stateCode) {
  return STATE_FORM_TEMPLATES[stateCode] ?? null;
}
