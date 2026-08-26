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

  // New Hampshire's DSMV 509 asks for running totals ("Cumulative Hours")
  // rather than each row's own duration, so the day/night figures are
  // computed over the FULL sorted history before any truncation — a row
  // kept after older rows are dropped for space still shows the true
  // cumulative total up to that point, not a total that silently resets.
  let cumulativeDay = 0;
  let cumulativeNight = 0;
  const withCumulative = sorted.map((log) => {
    if (log.timeOfDay === 'night') cumulativeNight += log.durationMinutes ?? 0;
    else cumulativeDay += log.durationMinutes ?? 0;
    return { log, cumulativeDay, cumulativeNight };
  });

  const rows =
    withCumulative.length > capacity
      ? withCumulative.slice(withCumulative.length - capacity)
      : withCumulative;
  const omittedCount = Math.max(0, withCumulative.length - capacity);

  rows.forEach(({ log, cumulativeDay: day, cumulativeNight: night }, i) => {
    const names = rowFieldNames[i];
    trySet(names.date, formatLogDate(log));
    if (names.start || names.end) {
      const offset = log.startOffsetMinutes ?? localOffsetMinutes();
      if (names.start) trySet(names.start, formatClockTime(new Date(log.startTime), offset));
      if (names.end) trySet(names.end, formatClockTime(new Date(log.endTime), offset));
    }
    if (template.log.cumulative) {
      trySet(names.day, formatLogHours(day));
      trySet(names.night, formatLogHours(night));
    } else if (names.dayTime || names.nightTime) {
      // North Carolina's DL-4A wants a clock-time stamp in whichever of
      // "Time of Day"/"Time of Night" applies, plus an always-filled hours
      // column — not a duration split across two hour cells like every
      // other acroform-log here.
      const offset = log.startOffsetMinutes ?? localOffsetMinutes();
      const stamp = formatClockTime(new Date(log.startTime), offset);
      if (log.timeOfDay === 'night') {
        if (names.nightTime) trySet(names.nightTime, stamp);
      } else if (names.dayTime) {
        trySet(names.dayTime, stamp);
      }
      if (names.hours) trySet(names.hours, formatLogHours(log.durationMinutes));
    } else {
      const hours = formatLogHours(log.durationMinutes);
      if (log.timeOfDay === 'night') {
        trySet(names.night, hours);
      } else {
        trySet(names.day, hours);
      }
    }
  });

  if (template.totals) {
    trySet(template.totals.total, formatLogHours(ctx.totals?.totalMinutes));
    trySet(template.totals.night, formatLogHours(ctx.totals?.nightMinutes));
    if (template.totals.day) {
      trySet(
        template.totals.day,
        formatLogHours((ctx.totals?.totalMinutes ?? 0) - (ctx.totals?.nightMinutes ?? 0))
      );
    }
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
  const size = template.log.size ?? 9;
  const byTimeAsc = (a, b) => new Date(a.startTime) - new Date(b.startTime);

  // Kentucky's Practice Driving Log takes the day/night split a step
  // further than Nevada's: day and night aren't just separate columns, they
  // are separate PAGES, each with its own row count and its own single
  // Amount-of-Driving-Time column (no begin/end times at all). `tracks`
  // covers that: each side of the split gets its own page, row positions,
  // and column layout, rather than assuming both share one page and one
  // rowYs array the way Nevada's `columns` shape does.
  if (template.log.tracks) {
    const pages = pdf.getPages();
    const placeOnTrack = (log, y, trackPage, columns) => {
      const offset = log.startOffsetMinutes ?? localOffsetMinutes();
      const d = (text, x) => {
        if (!text) return;
        trackPage.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
      };
      if (columns.date) d(formatShortDate(log), columns.date.x);
      if (columns.begin) d(formatClockTime(new Date(log.startTime), offset), columns.begin.x);
      if (columns.end) d(formatClockTime(new Date(log.endTime), offset), columns.end.x);
      if (columns.minutes) d(String(Math.round(log.durationMinutes ?? 0)), columns.minutes.x);
      if (columns.hours) d(formatLogHours(log.durationMinutes), columns.hours.x);
    };

    const dayLogs = logs.filter((l) => l.timeOfDay !== 'night').sort(byTimeAsc);
    const nightLogs = logs.filter((l) => l.timeOfDay === 'night').sort(byTimeAsc);
    const dayCapacity = template.log.tracks.day.rowYs.length;
    const nightCapacity = template.log.tracks.night.rowYs.length;

    const dayRows =
      dayLogs.length > dayCapacity ? dayLogs.slice(dayLogs.length - dayCapacity) : dayLogs;
    const nightRows =
      nightLogs.length > nightCapacity ? nightLogs.slice(nightLogs.length - nightCapacity) : nightLogs;
    const omittedCount =
      Math.max(0, dayLogs.length - dayCapacity) + Math.max(0, nightLogs.length - nightCapacity);

    dayRows.forEach((log, i) =>
      placeOnTrack(
        log,
        template.log.tracks.day.rowYs[i],
        pages[template.log.tracks.day.page ?? 0],
        template.log.tracks.day.columns
      )
    );
    nightRows.forEach((log, i) =>
      placeOnTrack(
        log,
        template.log.tracks.night.rowYs[i],
        pages[template.log.tracks.night.page ?? 0],
        template.log.tracks.night.columns
      )
    );

    return { missing: [], omittedCount };
  }

  const page = pdf.getPages()[template.log.page ?? 0];
  const rowYs = template.log.rowYs;

  const draw = (text, x, y) => {
    if (!text) return;
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };

  const capacity = rowYs.length;

  if (template.log.fields) {
    const sorted = [...logs].sort(byTimeAsc);
    const rows = sorted.length > capacity ? sorted.slice(sorted.length - capacity) : sorted;
    const omittedCount = Math.max(0, sorted.length - capacity);
    const fields = template.log.fields;

    // Most single-pool forms fit their whole log on one page (Kansas,
    // D.C.), but West Virginia's DMV-10-GDL runs the same row shape across
    // two pages, so a row entry may be a plain y (this page) or a
    // `{ page, y }` pair naming which page it belongs to.
    const pages = pdf.getPages();
    const rowOn = (entry) =>
      typeof entry === 'number'
        ? { rowPage: page, y: entry }
        : { rowPage: pages[entry.page ?? template.log.page ?? 0], y: entry.y };

    rows.forEach((log, i) => {
      const { rowPage, y } = rowOn(rowYs[i]);
      const drawRow = (text, x) => {
        if (!text) return;
        rowPage.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
      };
      const offset = log.startOffsetMinutes ?? localOffsetMinutes();
      if (fields.date) drawRow(formatShortDate(log), fields.date.x);
      if (fields.time) {
        const range =
          `${formatClockTime(new Date(log.startTime), offset)} - ` +
          formatClockTime(new Date(log.endTime), offset);
        drawRow(range, fields.time.x);
      }
      if (fields.hours) drawRow(formatHoursWords(log.durationMinutes), fields.hours.x);
      // A single pool of rows, but each has its own day-hours/night-hours
      // cells (Kansas's DE-IB01) rather than one duration column (DC's
      // GRAD-HR40) — a drive counts entirely as one or the other, same as
      // every acroform-log, so only one of the two is ever filled, and
      // Total mirrors whichever one that was.
      if (fields.day || fields.night) {
        const hours = formatLogHours(log.durationMinutes);
        if (log.timeOfDay === 'night') {
          if (fields.night) drawRow(hours, fields.night.x);
        } else if (fields.day) {
          drawRow(hours, fields.day.x);
        }
        if (fields.total) drawRow(hours, fields.total.x);
      }
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
