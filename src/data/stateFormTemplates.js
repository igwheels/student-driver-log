/**
 * Per-state official forms the app can fill in, and how to fill each one.
 *
 * Two shapes, because states publish two kinds of PDF:
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
 * The app fills only what it actually holds. Every other blank is left for
 * the parent, and signatures are always left blank — a signature is the one
 * thing this app must never produce.
 *
 * ENCRYPTED SOURCES: New York publishes MV-262 with AES-256 encryption whose
 * permissions allow form filling but forbid modifying content. No browser PDF
 * library can decrypt that, so the asset in public/forms/ is decrypted once
 * ahead of time — see public/forms/README.md for the command. Filling is the
 * operation the state's own permission bits allow.
 *
 * Adding a state means adding an entry here plus its PDF in public/forms/.
 * Re-check the form against the state's current published revision first:
 * a superseded revision is worse than no template at all.
 */

const fullName = (ctx) => `${ctx.student.firstName} ${ctx.student.lastName}`.trim();
const today = (ctx) =>
  ctx.today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

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
};

export function stateFormTemplateFor(stateCode) {
  return STATE_FORM_TEMPLATES[stateCode] ?? null;
}
