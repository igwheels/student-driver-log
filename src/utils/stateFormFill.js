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
import { localOffsetMinutes, toZonedDateInput } from './driveTime';

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

/** A drive's date, in the zone it was logged in, as the form's own mm/dd/yyyy. */
function formatLogDate(log) {
  const offset = log.startOffsetMinutes ?? localOffsetMinutes();
  const [year, month, day] = toZonedDateInput(new Date(log.startTime), offset).split('-');
  return `${month}/${day}/${year}`;
}

/** Minutes as decimal hours, trimmed to at most two places. */
function formatLogHours(minutes) {
  return String(Math.round(((minutes ?? 0) / 60) * 100) / 100);
}

// Maps the student's actual logged drives onto a repeating date/day-hours/
// night-hours grid. Each drive counts entirely as day or night, matching how
// the app itself categorises a drive (see guessTimeOfDay in LogDrive.jsx) —
// there is no per-minute day/night split to draw on.
//
// A state's own paper form has a fixed number of rows. When there are more
// drives than rows, the most recent ones win: they're the ones most likely
// still relevant to an examiner, and the form's own instructions already
// anticipate overflow by telling the parent to attach a duplicate log, which
// a single PDF template can't do on its own — the omitted count is returned
// so the caller can point the parent at the full CSV export instead.
function fillLogRows(pdf, template, ctx, logs) {
  const form = pdf.getForm();
  const missing = [];
  const trySet = (name, value) => {
    if (value === '' || value == null) return;
    try {
      form.getTextField(name).setText(String(value));
    } catch {
      missing.push(name);
    }
  };

  // Most states name their rows with one consistent prefix+suffix, but a
  // few (Colorado's DR 2324) pad row numbers inconsistently between field
  // types — Date_02 alongside Driving Time_2 for the same row — so an
  // explicit per-row list of field names (`log.rows`) is supported as an
  // alternative to the shared prefix+suffix pattern.
  const rowFieldNames = template.log.rows ?? template.log.rowSuffixes.map((suffix) => ({
    date: `${template.log.datePrefix}${suffix}`,
    day: `${template.log.dayPrefix}${suffix}`,
    night: `${template.log.nightPrefix}${suffix}`,
  }));

  const sorted = [...logs].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const capacity = rowFieldNames.length;
  const rows = sorted.length > capacity ? sorted.slice(sorted.length - capacity) : sorted;
  const omittedCount = Math.max(0, sorted.length - capacity);

  rows.forEach((log, i) => {
    const names = rowFieldNames[i];
    trySet(names.date, formatLogDate(log));
    const hours = formatLogHours(log.durationMinutes);
    if (log.timeOfDay === 'night') {
      trySet(names.night, hours);
    } else {
      trySet(names.day, hours);
    }
  });

  if (template.totals) {
    trySet(template.totals.total, formatLogHours(ctx.totals?.totalMinutes));
    trySet(template.totals.night, formatLogHours(ctx.totals?.nightMinutes));
  }

  return { missing, omittedCount };
}

async function drawOverlay(pdf, template, ctx, { StandardFonts, rgb }) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  for (const item of template.overlay) {
    const value = item.value(ctx);
    if (!value) continue;
    pages[item.page ?? 0].drawText(String(value), {
      x: item.x,
      y: item.y,
      size: item.size ?? 11,
      font,
      color: rgb(0, 0, 0),
    });
  }
  return [];
}

/** A drive's start time, in the zone it was logged in, as 'h:mm am/pm' (no leading zero, no military time). */
function formatClockTime(instant, offsetMinutes) {
  const d = new Date(instant.getTime() + offsetMinutes * 60000);
  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const meridiem = hours < 12 ? 'am' : 'pm';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${meridiem}`;
}

/** A drive's date, in the zone it was logged in, as 'MM/DD/YY'. */
function formatShortDate(log) {
  const offset = log.startOffsetMinutes ?? localOffsetMinutes();
  const [year, month, day] = toZonedDateInput(new Date(log.startTime), offset).split('-');
  return `${month}/${day}/${year.slice(2)}`;
}

/** Minutes as 'Xh Ym', matching the app's own duration display elsewhere. */
function formatHoursWords(minutes) {
  const m = Math.round(minutes ?? 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Some states' own log is a flat scan with two separate day/night columns
// rather than one shared date column (Nevada's DLD130) — each column has its
// own row pool, so a student's day drives and night drives are placed and
// overflow independently, most recent first in each, same reasoning as
// fillLogRows above.
//
// Others (DC's DMV-GRAD-HR40) don't split day and night at all — one shared
// pool of rows, no per-minute distinction the form asks for — so `columns`
// (day/night) and `fields` (one pool) are two different shapes of the same
// 'overlay-log' kind, told apart by which one the template sets.
async function drawOverlayLog(pdf, template, ctx, { StandardFonts, rgb }, logs) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.getPages()[template.log.page ?? 0];
  const rowYs = template.log.rowYs;
  const size = template.log.size ?? 9;

  const draw = (text, x, y) => {
    if (!text) return;
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };

  const byTimeAsc = (a, b) => new Date(a.startTime) - new Date(b.startTime);
  const capacity = rowYs.length;

  if (template.log.fields) {
    const sorted = [...logs].sort(byTimeAsc);
    const rows = sorted.length > capacity ? sorted.slice(sorted.length - capacity) : sorted;
    const omittedCount = Math.max(0, sorted.length - capacity);
    const fields = template.log.fields;

    rows.forEach((log, i) => {
      const y = rowYs[i];
      const offset = log.startOffsetMinutes ?? localOffsetMinutes();
      if (fields.date) draw(formatShortDate(log), fields.date.x, y);
      if (fields.time) {
        const range =
          `${formatClockTime(new Date(log.startTime), offset)} - ` +
          formatClockTime(new Date(log.endTime), offset);
        draw(range, fields.time.x, y);
      }
      if (fields.hours) draw(formatHoursWords(log.durationMinutes), fields.hours.x, y);
    });

    return { missing: [], omittedCount };
  }

  const place = (log, i, columns) => {
    const y = rowYs[i];
    const offset = log.startOffsetMinutes ?? localOffsetMinutes();
    draw(formatShortDate(log), columns.date.x, y);
    draw(formatClockTime(new Date(log.startTime), offset), columns.begin.x, y);
    draw(formatClockTime(new Date(log.endTime), offset), columns.end.x, y);
    draw(String(Math.round(log.durationMinutes ?? 0)), columns.minutes.x, y);
  };

  const dayLogs = logs.filter((l) => l.timeOfDay !== 'night').sort(byTimeAsc);
  const nightLogs = logs.filter((l) => l.timeOfDay === 'night').sort(byTimeAsc);

  const dayRows = dayLogs.length > capacity ? dayLogs.slice(dayLogs.length - capacity) : dayLogs;
  const nightRows = nightLogs.length > capacity ? nightLogs.slice(nightLogs.length - capacity) : nightLogs;
  const omittedCount =
    Math.max(0, dayLogs.length - capacity) + Math.max(0, nightLogs.length - capacity);

  dayRows.forEach((log, i) => place(log, i, template.log.columns.day));
  nightRows.forEach((log, i) => place(log, i, template.log.columns.night));

  return { missing: [], omittedCount };
}

/**
 * Produces the filled form as bytes. Separated from the download so it can be
 * exercised without a browser.
 */
export async function buildFilledStateForm({
  student,
  parentName,
  today = new Date(),
  logs = [],
  totals,
}) {
  const template = stateFormTemplateFor(student.state);
  if (!template) throw new Error(`No official form is available for ${student.state}.`);

  const ctx = { student, parentName: parentName || '', today, totals };
  const [{ PDFDocument, StandardFonts, rgb }, bytes] = await Promise.all([
    loadPdfLib(),
    loadTemplateBytes(template.asset),
  ]);
  const pdf = await PDFDocument.load(bytes);

  let missing = [];
  let omittedCount = 0;
  if (template.kind === 'overlay' || template.kind === 'overlay-log') {
    missing = await drawOverlay(pdf, template, ctx, { StandardFonts, rgb });
    if (template.kind === 'overlay-log') {
      const rows = await drawOverlayLog(pdf, template, ctx, { StandardFonts, rgb }, logs);
      omittedCount = rows.omittedCount;
    }
  } else {
    missing = fillAcroForm(pdf, template, ctx);
    if (template.kind === 'acroform-log') {
      const rows = fillLogRows(pdf, template, ctx, logs);
      missing = [...missing, ...rows.missing];
      omittedCount = rows.omittedCount;
    }
  }

  return { bytes: await pdf.save(), missing, omittedCount, template };
}

export async function exportFilledStateForm({
  student,
  parentName,
  today = new Date(),
  logs = [],
  totals,
}) {
  const { bytes, template, omittedCount } = await buildFilledStateForm({
    student,
    parentName,
    today,
    logs,
    totals,
  });
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
  return { template, omittedCount };
}
