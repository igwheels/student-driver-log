/**
 * Fills a state's own official PDF with the details the app holds, and hands
 * it back to the parent to finish and sign.
 *
 * The state's file is the document. Nothing here redraws or reconstructs a
 * form — it writes into the fields the publisher provided, or draws onto the
 * page at measured positions where the publisher provided none. Signature
 * lines are never touched.
 *
 * See src/data/stateFormTemplates.js for what each state's template does and
 * public/forms/README.md for how the assets were prepared.
 */
import { stateFormTemplateFor } from '../data/stateFormTemplates';
import { downloadFileName } from './fileName';

// pdf-lib is around half a megabyte and only needed when someone actually
// asks for a state form, so it is fetched on demand rather than shipped to
// every visitor who opens a dashboard.
const loadPdfLib = () => import('pdf-lib');

/** Does this state have a fillable official form in the app? */
export function hasStateForm(stateCode) {
  return stateFormTemplateFor(stateCode) != null;
}

export function stateFormLabel(stateCode) {
  return stateFormTemplateFor(stateCode)?.formLabel ?? null;
}

async function loadTemplateBytes(asset) {
  const url = `${import.meta.env.BASE_URL}${asset}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load the state form (${response.status}). It may not have been deployed.`);
  }
  return response.arrayBuffer();
}

function fillAcroForm(pdf, template, ctx) {
  const form = pdf.getForm();
  const missing = [];

  for (const field of template.fields) {
    const value = field.value(ctx);
    if (!value) continue;
    try {
      form.getTextField(field.name).setText(String(value));
    } catch {
      // The published form changed its field names. Better to produce the
      // form with that blank empty than to guess at a different field.
      missing.push(field.name);
    }
  }

  // Deliberately not flattened: the parent still has to add whatever the app
  // cannot know, and may need to correct what it filled.
  return missing;
}

async function drawOverlay(pdf, template, ctx, { StandardFonts, rgb }) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.getPages()[0];
  for (const item of template.overlay) {
    const value = item.value(ctx);
    if (!value) continue;
    page.drawText(String(value), {
      x: item.x,
      y: item.y,
      size: item.size ?? 11,
      font,
      color: rgb(0, 0, 0),
    });
  }
  return [];
}

/**
 * Produces the filled form as bytes. Separated from the download so it can be
 * exercised without a browser.
 */
export async function buildFilledStateForm({ student, parentName, today = new Date() }) {
  const template = stateFormTemplateFor(student.state);
  if (!template) throw new Error(`No official form is available for ${student.state}.`);

  const ctx = { student, parentName: parentName || '', today };
  const [{ PDFDocument, StandardFonts, rgb }, bytes] = await Promise.all([
    loadPdfLib(),
    loadTemplateBytes(template.asset),
  ]);
  const pdf = await PDFDocument.load(bytes);

  const missing =
    template.kind === 'acroform'
      ? fillAcroForm(pdf, template, ctx)
      : await drawOverlay(pdf, template, ctx, { StandardFonts, rgb });

  return { bytes: await pdf.save(), missing, template };
}

export async function exportFilledStateForm({ student, parentName, today = new Date() }) {
  const { bytes, template } = await buildFilledStateForm({ student, parentName, today });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName(
    [student.firstName, student.lastName, student.state, 'form'],
    'pdf'
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return template;
}
