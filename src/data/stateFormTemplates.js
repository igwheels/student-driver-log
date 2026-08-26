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
 *        'acroform-log'. Also covers two other row layouts: `log.tracks`
 *        (Kentucky) puts day and night rows on entirely separate pages, and
 *        `log.blocks` (Minnesota) repeats the same one-pool row shape in
 *        two side-by-side blocks on one page rather than splitting by
 *        day/night at all — the left block fills before the right.
 *
 *  kind: 'overlay-category-log' — Texas's DES150N: not organized by date at
 *        all, but by a fixed set of skill categories (`log.categories`,
 *        keyed the same as src/data/skillCategories.js), each with its own
 *        fixed number of day rows and night rows and the hours for every
 *        row already pre-printed by the state. Only date and time are
 *        drawn, one drive per row, pulled from whichever drives the parent
 *        tagged with that category — most recent first, same overflow rule
 *        as every other log shape here.
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

import { SKILL_CATEGORIES } from './skillCategories';

const fullName = (ctx) => `${ctx.student.firstName} ${ctx.student.lastName}`.trim();
const lastFirst = (ctx) => `${ctx.student.lastName}, ${ctx.student.firstName}`.trim();
const today = (ctx) =>
  ctx.today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

// Decimal hours, trimmed to at most two places — same rounding as the
// per-drive log fillers, duplicated here because a handful of plain
// 'acroform' certifications (no per-drive grid at all) still have their own
// total-hours fields to fill.
const formatHours = (minutes) => String(Math.round(((minutes ?? 0) / 60) * 100) / 100);
const totalHours = (ctx) => formatHours(ctx.totals?.totalMinutes);
const nightHours = (ctx) => formatHours(ctx.totals?.nightMinutes);
const dayHours = (ctx) => formatHours((ctx.totals?.totalMinutes ?? 0) - (ctx.totals?.nightMinutes ?? 0));

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
  { date: 'Date', day: 'Driving Time', night: 'Night Driving', skill: 'Comments' },
  ...range(2, 13).map((n) => ({
    date: `Date_${String(n).padStart(2, '0')}`,
    day: `Driving Time_${n}`,
    night: `Night Driving_${String(n).padStart(2, '0')}`,
    skill: `Comments_${n}`,
  })),
];

// Illinois' DSD X152 log rows are the messiest of any state here: page 1
// mixes an unlabeled first row with number-before-suffix names ("1 DAYTIME
// PAGE 29"), and page 2 switches to a cleaner RowN suffix. Names here are
// pdf-lib's own resolved field names — a couple of raw /T values in the
// published PDF carry a trailing "." (a PDF field-hierarchy separator,
// which pdf-lib strips as an empty child segment: "DateRow31." resolves to
// just "DateRow31"), confirmed by round-tripping through pdf-lib itself
// rather than trusting the raw name. Extracted programmatically from the
// published PDF's field list and rects, grouped into rows by y-position,
// not transcribed by hand.
const ilRows = [
  { date: 'DATE PAGE 29', day: 'DAYTIME PAGE 29', night: 'NIGHTTIME PAGE 29' },
  { date: 'DATE 1 PAGE 29', day: '1 DAYTIME PAGE 29', night: '1 NIGHTTIME PAGE 29' },
  { date: 'DATE 2 PAGE 29', day: '2 DAYTIME PAGE 29', night: '2 NIGHTTIME PAGE 29' },
  { date: 'DATE 3 PAGE 29', day: '3 DAYTIME PAGE 29', night: '3 NIGHTTIME PAGE 29' },
  { date: 'DATE 4 PAGE 29', day: '4 DAYTIME PAGE 29', night: '4 NIGHTTIME PAGE 29' },
  { date: 'DATE 5 PAGE 29', day: '5 DAYTIME PAGE 29', night: '5 NIGHTTIME PAGE 29' },
  { date: 'DATE 6 PAGE 29', day: '6 DAYTIME PAGE 29', night: '6 NIGHTTIME PAGE 29' },
  { date: 'DATE 7 PAGE 29', day: '7 DAYTIME PAGE 29', night: '7 NIGHTTIME PAGE 29' },
  { date: 'DATE 8 PAGE 29', day: '8 DAYTIME PAGE 29', night: '8 NIGHTTIME PAGE 29' },
  { date: 'DATE 9 PAGE 29', day: '9 DAYTIME PAGE 29', night: '9 NIGHTTIME PAGE 29' },
  { date: 'DATE 10 PAGE 29', day: '10 DAYTIME PAGE 29', night: '10 NIGHTTIME PAGE 29' },
  { date: 'DATE 11 PAGE 29', day: '11 DAYTIME PAGE 29', night: '11 NIGHTTIME PAGE 29' },
  { date: 'DATE 12 PAGE 29', day: '12 DAYTIME PAGE 29', night: '12 NIGHTTIME PAGE 29' },
  { date: 'DATE 13 PAGE 29', day: '13 DAYTIME PAGE 29', night: '13 NIGHTTIME PAGE 29' },
  { date: 'DATE 14 PAGE 29', day: '14 DAYTIME PAGE 29', night: '14 NIGHTTIME PAGE 29' },
  { date: 'DATE 15 PAGE 29', day: '15 DAYTIME PAGE 29', night: '15 NIGHTTIME PAGE 29' },
  { date: 'DATE 16 PAGE 29', day: '16 DAYTIME PAGE 29', night: '16 NIGHTTIME PAGE 29' },
  { date: 'DATE 17 PAGE 29', day: '17 DAYTIME PAGE 29', night: '17 NIGHTTIME PAGE 29' },
  { date: 'DATE 18 PAGE 29', day: '18 DAYTIME PAGE 29', night: '18 NIGHTTIME PAGE 29' },
  { date: 'DATE 19 PAGE 29', day: '19 DAYTIME PAGE 29', night: '19 NIGHTTIME PAGE 29' },
  { date: 'DATE 20 PAGE 29', day: '20 DAYTIME PAGE 29', night: '20 NIGHTTIME PAGE 29' },
  { date: 'DateRow1', day: 'DaytimeRow1', night: 'NighttimeRow1' },
  { date: 'DateRow2', day: 'DaytimeRow2', night: 'NighttimeRow2' },
  { date: 'DateRow3', day: 'DaytimeRow3', night: 'NighttimeRow3' },
  { date: 'DateRow4', day: 'DaytimeRow4', night: 'NighttimeRow4' },
  { date: 'DateRow5', day: 'DaytimeRow5', night: 'NighttimeRow5' },
  { date: 'DateRow6', day: 'DaytimeRow6', night: 'NighttimeRow6' },
  { date: 'DateRow7', day: 'DaytimeRow7', night: 'NighttimeRow7' },
  { date: 'DateRow8', day: 'DaytimeRow8', night: 'NighttimeRow8' },
  { date: 'DateRow9', day: 'DaytimeRow9', night: 'NighttimeRow9' },
  { date: 'DateRow10', day: 'DaytimeRow10', night: 'NighttimeRow10' },
  { date: 'DateRow11', day: 'DaytimeRow11', night: 'NighttimeRow11' },
  { date: 'DateRow12', day: 'DaytimeRow12', night: 'NighttimeRow12' },
  { date: 'DateRow13', day: 'DaytimeRow13', night: 'NighttimeRow13' },
  { date: 'DateRow14', day: 'DaytimeRow14', night: 'NighttimeRow14' },
  { date: 'DateRow15', day: 'DaytimeRow15', night: 'NighttimeRow15' },
  { date: 'DateRow16', day: 'DaytimeRow16', night: 'NighttimeRow16' },
  { date: 'DateRow17', day: 'DaytimeRow17', night: 'NighttimeRow17' },
  { date: 'DateRow18', day: 'DaytimeRow18', night: 'NighttimeRow18' },
  { date: 'DateRow19', day: 'DaytimeRow19', night: 'NighttimeRow19' },
  { date: 'DateRow20', day: 'DaytimeRow20', night: 'NighttimeRow20' },
  { date: 'DateRow21', day: 'DaytimeRow21', night: 'NighttimeRow21' },
  { date: 'DateRow22', day: 'DaytimeRow22', night: 'NighttimeRow22' },
  { date: 'DateRow23', day: 'DaytimeRow23', night: 'NighttimeRow23' },
  { date: 'DateRow24', day: 'DaytimeRow24', night: 'NighttimeRow24' },
  { date: 'DateRow25', day: 'DaytimeRow25', night: 'NighttimeRow25' },
  { date: 'DateRow26', day: 'DaytimeRow26', night: 'NighttimeRow26' },
  { date: 'DateRow27', day: 'DaytimeRow27', night: 'NighttimeRow27' },
  { date: 'DateRow28', day: 'DaytimeRow28', night: 'NighttimeRow28' },
  { date: 'DateRow29', day: 'DaytimeRow29', night: 'NighttimeRow29' },
  { date: 'DateRow30', day: 'DaytimeRow30', night: 'NighttimeRow30' },
  { date: 'DateRow31', day: 'DaytimeRow31', night: 'NighttimeRow31' },
  { date: 'DateRow32', day: 'DaytimeRow32', night: 'NighttimeRow32' },
  { date: 'DateRow33', day: 'DaytimeRow33', night: 'NighttimeRow33' },
  { date: 'DateRow34', day: 'DaytimeRow34', night: 'NighttimeRow34' },
  { date: 'DateRow35', day: 'DaytimeRow35', night: 'NighttimeRow35' },
  { date: 'DateRow36', day: 'DaytimeRow36', night: 'NighttimeRow36' },
  { date: 'DateRow37', day: 'DaytimeRow37', night: 'NighttimeRow37' },
  { date: 'DateRow38', day: 'DaytimeRow38', night: 'NighttimeRow38' },
  { date: 'DateRow39', day: 'DaytimeRow39', night: 'NighttimeRow39' },
  { date: 'DateRow40', day: 'DaytimeRow40', night: 'NighttimeRow40' },
  { date: 'DateRow41', day: 'DaytimeRow41', night: 'NighttimeRow41' },
  { date: 'DateRow42', day: 'DaytimeRow42', night: 'NighttimeRow42' },
  { date: 'DateRow43', day: 'DaytimeRow43', night: 'NighttimeRow43' },
];

// Kansas' DE-IB01 log rows, measured from the printed grid lines in a
// rendering of the page: 24 equal rows, ~13.6-14pt each.
const ksRowYs = [
  606.5, 592.8, 578.8, 565.2, 551.2, 537.5, 523.8, 509.8, 496.2, 482.2,
  468.5, 454.8, 440.8, 427.2, 413.2, 399.5, 385.8, 371.8, 358.2, 344.2,
  330.5, 316.8, 302.8, 289.2,
];

// North Carolina's DL-4A rows: date + a clock-time stamp in whichever of
// "Time of Day"/"Time of Night" applies + an always-filled hours column,
// rather than a duration split across two hour cells — a different shape
// from every other acroform-log here. 56 rows across 2 pages; page 2's
// field names carry literal tab/CR characters straight from the state's
// own PDF ("AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow1"), confirmed
// correct by resolving through pdf-lib itself rather than assuming.
// Extracted programmatically from the published PDF's field list and
// rects, grouped into rows by y-position, not transcribed by hand.
const ncRows = [
  { date: 'DATERow1', dayTime: 'TIME OF DAYRow1', nightTime: 'TIME OF NIGHTRow1', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow1' },
  { date: 'DATERow2', dayTime: 'TIME OF DAYRow2', nightTime: 'TIME OF NIGHTRow2', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow2' },
  { date: 'DATERow3', dayTime: 'TIME OF DAYRow3', nightTime: 'TIME OF NIGHTRow3', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow3' },
  { date: 'DATERow4', dayTime: 'TIME OF DAYRow4', nightTime: 'TIME OF NIGHTRow4', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow4' },
  { date: 'DATERow5', dayTime: 'TIME OF DAYRow5', nightTime: 'TIME OF NIGHTRow5', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow5' },
  { date: 'DATERow6', dayTime: 'TIME OF DAYRow6', nightTime: 'TIME OF NIGHTRow6', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow6' },
  { date: 'DATERow7', dayTime: 'TIME OF DAYRow7', nightTime: 'TIME OF NIGHTRow7', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow7' },
  { date: 'DATERow8', dayTime: 'TIME OF DAYRow8', nightTime: 'TIME OF NIGHTRow8', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow8' },
  { date: 'DATERow9', dayTime: 'TIME OF DAYRow9', nightTime: 'TIME OF NIGHTRow9', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow9' },
  { date: 'DATERow10', dayTime: 'TIME OF DAYRow10', nightTime: 'TIME OF NIGHTRow10', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow10' },
  { date: 'DATERow11', dayTime: 'TIME OF DAYRow11', nightTime: 'TIME OF NIGHTRow11', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow11' },
  { date: 'DATERow12', dayTime: 'TIME OF DAYRow12', nightTime: 'TIME OF NIGHTRow12', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow12' },
  { date: 'DATERow13', dayTime: 'TIME OF DAYRow13', nightTime: 'TIME OF NIGHTRow13', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow13' },
  { date: 'DATERow14', dayTime: 'TIME OF DAYRow14', nightTime: 'TIME OF NIGHTRow14', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow14' },
  { date: 'DATERow15', dayTime: 'TIME OF DAYRow15', nightTime: 'TIME OF NIGHTRow15', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow15' },
  { date: 'DATERow16', dayTime: 'TIME OF DAYRow16', nightTime: 'TIME OF NIGHTRow16', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow16' },
  { date: 'DATERow17', dayTime: 'TIME OF DAYRow17', nightTime: 'TIME OF NIGHTRow17', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow17' },
  { date: 'DATERow18', dayTime: 'TIME OF DAYRow18', nightTime: 'TIME OF NIGHTRow18', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow18' },
  { date: 'DATERow19', dayTime: 'TIME OF DAYRow19', nightTime: 'TIME OF NIGHTRow19', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow19' },
  { date: 'DATERow20.0', dayTime: 'TIME OF DAYRow20.0', nightTime: 'TIME OF NIGHTRow20.0', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.0' },
  { date: 'DATERow20.1.0', dayTime: 'TIME OF DAYRow20.1.0', nightTime: 'TIME OF NIGHTRow20.1.0', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.0' },
  { date: 'DATERow20.1.1', dayTime: 'TIME OF DAYRow20.1.1', nightTime: 'TIME OF NIGHTRow20.1.1', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.1' },
  { date: 'DATERow20.1.2', dayTime: 'TIME OF DAYRow20.1.2', nightTime: 'TIME OF NIGHTRow20.1.2', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.2' },
  { date: 'DATERow20.1.3', dayTime: 'TIME OF DAYRow20.1.3', nightTime: 'TIME OF NIGHTRow20.1.3', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.3' },
  { date: 'DATERow20.1.4', dayTime: 'TIME OF DAYRow20.1.4', nightTime: 'TIME OF NIGHTRow20.1.4', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.4' },
  { date: 'DATERow20.1.5', dayTime: 'TIME OF DAYRow20.1.5', nightTime: 'TIME OF NIGHTRow20.1.5', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.5' },
  { date: 'DATERow20.1.6', dayTime: 'TIME OF DAYRow20.1.6', nightTime: 'TIME OF NIGHTRow20.1.6', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.6' },
  { date: 'DATERow20.1.7', dayTime: 'TIME OF DAYRow20.1.7', nightTime: 'TIME OF NIGHTRow20.1.7', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.7' },
  { date: 'DATERow20.1.8', dayTime: 'TIME OF DAYRow20.1.8', nightTime: 'TIME OF NIGHTRow20.1.8', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.8' },
  { date: 'DATERow20.1.9', dayTime: 'TIME OF DAYRow20.1.9', nightTime: 'TIME OF NIGHTRow20.1.9', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.9' },
  { date: 'DATERow20.1.10', dayTime: 'TIME OF DAYRow20.1.10', nightTime: 'TIME OF NIGHTRow20.1.10', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.10' },
  { date: 'DATERow20.1.11', dayTime: 'TIME OF DAYRow20.1.11', nightTime: 'TIME OF NIGHTRow20.1.11', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.11' },
  { date: 'DATERow20.1.12', dayTime: 'TIME OF DAYRow20.1.12', nightTime: 'TIME OF NIGHTRow20.1.12', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.12' },
  { date: 'DATERow20.1.13', dayTime: 'TIME OF DAYRow20.1.13', nightTime: 'TIME OF NIGHTRow20.1.13', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.13' },
  { date: 'DATERow20.1.14', dayTime: 'TIME OF DAYRow20.1.14', nightTime: 'TIME OF NIGHTRow20.1.14', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.14' },
  { date: 'DATERow20.1.15', dayTime: 'TIME OF DAYRow20.1.15', nightTime: 'TIME OF NIGHTRow20.1.15', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.15' },
  { date: 'DATERow20.1.16', dayTime: 'TIME OF DAYRow20.1.16', nightTime: 'TIME OF NIGHTRow20.1.16', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.16' },
  { date: 'DATERow20.1.17', dayTime: 'TIME OF DAYRow20.1.17', nightTime: 'TIME OF NIGHTRow20.1.17', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.17' },
  { date: 'DATERow20.1.18', dayTime: 'TIME OF DAYRow20.1.18', nightTime: 'TIME OF NIGHTRow20.1.18', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.18' },
  { date: 'DATERow20.1.19', dayTime: 'TIME OF DAYRow20.1.19', nightTime: 'TIME OF NIGHTRow20.1.19', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.19' },
  { date: 'DATERow20.1.20', dayTime: 'TIME OF DAYRow20.1.20', nightTime: 'TIME OF NIGHTRow20.1.20', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.20' },
  { date: 'DATERow20.1.21', dayTime: 'TIME OF DAYRow20.1.21', nightTime: 'TIME OF NIGHTRow20.1.21', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.21' },
  { date: 'DATERow20.1.22', dayTime: 'TIME OF DAYRow20.1.22', nightTime: 'TIME OF NIGHTRow20.1.22', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.22' },
  { date: 'DATERow20.1.23', dayTime: 'TIME OF DAYRow20.1.23', nightTime: 'TIME OF NIGHTRow20.1.23', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.23' },
  { date: 'DATERow20.1.24', dayTime: 'TIME OF DAYRow20.1.24', nightTime: 'TIME OF NIGHTRow20.1.24', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.24' },
  { date: 'DATERow20.1.25', dayTime: 'TIME OF DAYRow20.1.25', nightTime: 'TIME OF NIGHTRow20.1.25', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.25' },
  { date: 'DATERow20.1.26', dayTime: 'TIME OF DAYRow20.1.26', nightTime: 'TIME OF NIGHTRow20.1.26', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.26' },
  { date: 'DATERow20.1.27', dayTime: 'TIME OF DAYRow20.1.27', nightTime: 'TIME OF NIGHTRow20.1.27', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.27' },
  { date: 'DATERow20.1.28', dayTime: 'TIME OF DAYRow20.1.28', nightTime: 'TIME OF NIGHTRow20.1.28', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.28' },
  { date: 'DATERow20.1.29', dayTime: 'TIME OF DAYRow20.1.29', nightTime: 'TIME OF NIGHTRow20.1.29', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.29' },
  { date: 'DATERow20.1.30', dayTime: 'TIME OF DAYRow20.1.30', nightTime: 'TIME OF NIGHTRow20.1.30', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.30' },
  { date: 'DATERow20.1.31', dayTime: 'TIME OF DAYRow20.1.31', nightTime: 'TIME OF NIGHTRow20.1.31', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.31' },
  { date: 'DATERow20.1.32', dayTime: 'TIME OF DAYRow20.1.32', nightTime: 'TIME OF NIGHTRow20.1.32', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.32' },
  { date: 'DATERow20.1.33', dayTime: 'TIME OF DAYRow20.1.33', nightTime: 'TIME OF NIGHTRow20.1.33', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.33' },
  { date: 'DATERow20.1.34', dayTime: 'TIME OF DAYRow20.1.34', nightTime: 'TIME OF NIGHTRow20.1.34', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.34' },
  { date: 'DATERow20.1.35', dayTime: 'TIME OF DAYRow20.1.35', nightTime: 'TIME OF NIGHTRow20.1.35', hours: 'AMOUNT OF DRIVING\t\r  TIME EG  HOURSRow20.1.35' },
];

// New Hampshire's DSMV 509 asks for a start and end time per row plus
// running CUMULATIVE day/night totals (not each row's own duration) — see
// the `cumulative` flag on the template below. 52 rows across 2 pages;
// the first 10 rows on page 2 collided in name with page 1's rows and got
// Acrobat's automatic "_2" suffix instead of continuing the RowN scheme
// the remaining 32 rows use. Extracted programmatically from the
// published PDF's field list and rects, grouped into rows by y-position,
// not transcribed by hand.
const nhRows = [
  { date: 'DateRow1', start: 'Time AMPM Start  EndRow1', end: 'Time AMPM Start  EndRow1_2', day: 'Cumulative Hours Daytime  NighttimeRow1', night: 'Cumulative Hours Daytime  NighttimeRow1_2' },
  { date: 'DateRow2', start: 'Time AMPM Start  EndRow2', end: 'Time AMPM Start  EndRow2_2', day: 'Cumulative Hours Daytime  NighttimeRow2', night: 'Cumulative Hours Daytime  NighttimeRow2_2' },
  { date: 'DateRow3', start: 'Time AMPM Start  EndRow3', end: 'Time AMPM Start  EndRow3_2', day: 'Cumulative Hours Daytime  NighttimeRow3', night: 'Cumulative Hours Daytime  NighttimeRow3_2' },
  { date: 'DateRow4', start: 'Time AMPM Start  EndRow4', end: 'Time AMPM Start  EndRow4_2', day: 'Cumulative Hours Daytime  NighttimeRow4', night: 'Cumulative Hours Daytime  NighttimeRow4_2' },
  { date: 'DateRow5', start: 'Time AMPM Start  EndRow5', end: 'Time AMPM Start  EndRow5_2', day: 'Cumulative Hours Daytime  NighttimeRow5', night: 'Cumulative Hours Daytime  NighttimeRow5_2' },
  { date: 'DateRow6', start: 'Time AMPM Start  EndRow6', end: 'Time AMPM Start  EndRow6_2', day: 'Cumulative Hours Daytime  NighttimeRow6', night: 'Cumulative Hours Daytime  NighttimeRow6_2' },
  { date: 'DateRow7', start: 'Time AMPM Start  EndRow7', end: 'Time AMPM Start  EndRow7_2', day: 'Cumulative Hours Daytime  NighttimeRow7', night: 'Cumulative Hours Daytime  NighttimeRow7_2' },
  { date: 'DateRow8', start: 'Time AMPM Start  EndRow8', end: 'Time AMPM Start  EndRow8_2', day: 'Cumulative Hours Daytime  NighttimeRow8', night: 'Cumulative Hours Daytime  NighttimeRow8_2' },
  { date: 'DateRow9', start: 'Time AMPM Start  EndRow9', end: 'Time AMPM Start  EndRow9_2', day: 'Cumulative Hours Daytime  NighttimeRow9', night: 'Cumulative Hours Daytime  NighttimeRow9_2' },
  { date: 'DateRow10', start: 'Time AMPM Start  EndRow10', end: 'Time AMPM Start  EndRow10_2', day: 'Cumulative Hours Daytime  NighttimeRow10', night: 'Cumulative Hours Daytime  NighttimeRow10_2' },
  { date: 'DateRow1_2', start: 'Time AMPM Start   EndRow1', end: 'Time AMPM Start   EndRow1_2', day: 'Cumulative Hours Daytime  NighttimeRow1_3', night: 'Cumulative Hours Daytime  NighttimeRow1_4' },
  { date: 'DateRow2_2', start: 'Time AMPM Start   EndRow2', end: 'Time AMPM Start   EndRow2_2', day: 'Cumulative Hours Daytime  NighttimeRow2_3', night: 'Cumulative Hours Daytime  NighttimeRow2_4' },
  { date: 'DateRow3_2', start: 'Time AMPM Start   EndRow3', end: 'Time AMPM Start   EndRow3_2', day: 'Cumulative Hours Daytime  NighttimeRow3_3', night: 'Cumulative Hours Daytime  NighttimeRow3_4' },
  { date: 'DateRow4_2', start: 'Time AMPM Start   EndRow4', end: 'Time AMPM Start   EndRow4_2', day: 'Cumulative Hours Daytime  NighttimeRow4_3', night: 'Cumulative Hours Daytime  NighttimeRow4_4' },
  { date: 'DateRow5_2', start: 'Time AMPM Start   EndRow5', end: 'Time AMPM Start   EndRow5_2', day: 'Cumulative Hours Daytime  NighttimeRow5_3', night: 'Cumulative Hours Daytime  NighttimeRow5_4' },
  { date: 'DateRow6_2', start: 'Time AMPM Start   EndRow6', end: 'Time AMPM Start   EndRow6_2', day: 'Cumulative Hours Daytime  NighttimeRow6_3', night: 'Cumulative Hours Daytime  NighttimeRow6_4' },
  { date: 'DateRow7_2', start: 'Time AMPM Start   EndRow7', end: 'Time AMPM Start   EndRow7_2', day: 'Cumulative Hours Daytime  NighttimeRow7_3', night: 'Cumulative Hours Daytime  NighttimeRow7_4' },
  { date: 'DateRow8_2', start: 'Time AMPM Start   EndRow8', end: 'Time AMPM Start   EndRow8_2', day: 'Cumulative Hours Daytime  NighttimeRow8_3', night: 'Cumulative Hours Daytime  NighttimeRow8_4' },
  { date: 'DateRow9_2', start: 'Time AMPM Start   EndRow9', end: 'Time AMPM Start   EndRow9_2', day: 'Cumulative Hours Daytime  NighttimeRow9_3', night: 'Cumulative Hours Daytime  NighttimeRow9_4' },
  { date: 'DateRow10_2', start: 'Time AMPM Start   EndRow10', end: 'Time AMPM Start   EndRow10_2', day: 'Cumulative Hours Daytime  NighttimeRow10_3', night: 'Cumulative Hours Daytime  NighttimeRow10_4' },
  { date: 'DateRow11', start: 'Time AMPM Start   EndRow11', end: 'Time AMPM Start   EndRow11_2', day: 'Cumulative Hours Daytime  NighttimeRow11', night: 'Cumulative Hours Daytime  NighttimeRow11_2' },
  { date: 'DateRow12', start: 'Time AMPM Start   EndRow12', end: 'Time AMPM Start   EndRow12_2', day: 'Cumulative Hours Daytime  NighttimeRow12', night: 'Cumulative Hours Daytime  NighttimeRow12_2' },
  { date: 'DateRow13', start: 'Time AMPM Start   EndRow13', end: 'Time AMPM Start   EndRow13_2', day: 'Cumulative Hours Daytime  NighttimeRow13', night: 'Cumulative Hours Daytime  NighttimeRow13_2' },
  { date: 'DateRow14', start: 'Time AMPM Start   EndRow14', end: 'Time AMPM Start   EndRow14_2', day: 'Cumulative Hours Daytime  NighttimeRow14', night: 'Cumulative Hours Daytime  NighttimeRow14_2' },
  { date: 'DateRow15', start: 'Time AMPM Start   EndRow15', end: 'Time AMPM Start   EndRow15_2', day: 'Cumulative Hours Daytime  NighttimeRow15', night: 'Cumulative Hours Daytime  NighttimeRow15_2' },
  { date: 'DateRow16', start: 'Time AMPM Start   EndRow16', end: 'Time AMPM Start   EndRow16_2', day: 'Cumulative Hours Daytime  NighttimeRow16', night: 'Cumulative Hours Daytime  NighttimeRow16_2' },
  { date: 'DateRow17', start: 'Time AMPM Start   EndRow17', end: 'Time AMPM Start   EndRow17_2', day: 'Cumulative Hours Daytime  NighttimeRow17', night: 'Cumulative Hours Daytime  NighttimeRow17_2' },
  { date: 'DateRow18', start: 'Time AMPM Start   EndRow18', end: 'Time AMPM Start   EndRow18_2', day: 'Cumulative Hours Daytime  NighttimeRow18', night: 'Cumulative Hours Daytime  NighttimeRow18_2' },
  { date: 'DateRow19', start: 'Time AMPM Start   EndRow19', end: 'Time AMPM Start   EndRow19_2', day: 'Cumulative Hours Daytime  NighttimeRow19', night: 'Cumulative Hours Daytime  NighttimeRow19_2' },
  { date: 'DateRow20', start: 'Time AMPM Start   EndRow20', end: 'Time AMPM Start   EndRow20_2', day: 'Cumulative Hours Daytime  NighttimeRow20', night: 'Cumulative Hours Daytime  NighttimeRow20_2' },
  { date: 'DateRow21', start: 'Time AMPM Start   EndRow21', end: 'Time AMPM Start   EndRow21_2', day: 'Cumulative Hours Daytime  NighttimeRow21', night: 'Cumulative Hours Daytime  NighttimeRow21_2' },
  { date: 'DateRow22', start: 'Time AMPM Start   EndRow22', end: 'Time AMPM Start   EndRow22_2', day: 'Cumulative Hours Daytime  NighttimeRow22', night: 'Cumulative Hours Daytime  NighttimeRow22_2' },
  { date: 'DateRow23', start: 'Time AMPM Start   EndRow23', end: 'Time AMPM Start   EndRow23_2', day: 'Cumulative Hours Daytime  NighttimeRow23', night: 'Cumulative Hours Daytime  NighttimeRow23_2' },
  { date: 'DateRow24', start: 'Time AMPM Start   EndRow24', end: 'Time AMPM Start   EndRow24_2', day: 'Cumulative Hours Daytime  NighttimeRow24', night: 'Cumulative Hours Daytime  NighttimeRow24_2' },
  { date: 'DateRow25', start: 'Time AMPM Start   EndRow25', end: 'Time AMPM Start   EndRow25_2', day: 'Cumulative Hours Daytime  NighttimeRow25', night: 'Cumulative Hours Daytime  NighttimeRow25_2' },
  { date: 'DateRow26', start: 'Time AMPM Start   EndRow26', end: 'Time AMPM Start   EndRow26_2', day: 'Cumulative Hours Daytime  NighttimeRow26', night: 'Cumulative Hours Daytime  NighttimeRow26_2' },
  { date: 'DateRow27', start: 'Time AMPM Start   EndRow27', end: 'Time AMPM Start   EndRow27_2', day: 'Cumulative Hours Daytime  NighttimeRow27', night: 'Cumulative Hours Daytime  NighttimeRow27_2' },
  { date: 'DateRow28', start: 'Time AMPM Start   EndRow28', end: 'Time AMPM Start   EndRow28_2', day: 'Cumulative Hours Daytime  NighttimeRow28', night: 'Cumulative Hours Daytime  NighttimeRow28_2' },
  { date: 'DateRow29', start: 'Time AMPM Start   EndRow29', end: 'Time AMPM Start   EndRow29_2', day: 'Cumulative Hours Daytime  NighttimeRow29', night: 'Cumulative Hours Daytime  NighttimeRow29_2' },
  { date: 'DateRow30', start: 'Time AMPM Start   EndRow30', end: 'Time AMPM Start   EndRow30_2', day: 'Cumulative Hours Daytime  NighttimeRow30', night: 'Cumulative Hours Daytime  NighttimeRow30_2' },
  { date: 'DateRow31', start: 'Time AMPM Start   EndRow31', end: 'Time AMPM Start   EndRow31_2', day: 'Cumulative Hours Daytime  NighttimeRow31', night: 'Cumulative Hours Daytime  NighttimeRow31_2' },
  { date: 'DateRow32', start: 'Time AMPM Start   EndRow32', end: 'Time AMPM Start   EndRow32_2', day: 'Cumulative Hours Daytime  NighttimeRow32', night: 'Cumulative Hours Daytime  NighttimeRow32_2' },
  { date: 'DateRow33', start: 'Time AMPM Start   EndRow33', end: 'Time AMPM Start   EndRow33_2', day: 'Cumulative Hours Daytime  NighttimeRow33', night: 'Cumulative Hours Daytime  NighttimeRow33_2' },
  { date: 'DateRow34', start: 'Time AMPM Start   EndRow34', end: 'Time AMPM Start   EndRow34_2', day: 'Cumulative Hours Daytime  NighttimeRow34', night: 'Cumulative Hours Daytime  NighttimeRow34_2' },
  { date: 'DateRow35', start: 'Time AMPM Start   EndRow35', end: 'Time AMPM Start   EndRow35_2', day: 'Cumulative Hours Daytime  NighttimeRow35', night: 'Cumulative Hours Daytime  NighttimeRow35_2' },
  { date: 'DateRow36', start: 'Time AMPM Start   EndRow36', end: 'Time AMPM Start   EndRow36_2', day: 'Cumulative Hours Daytime  NighttimeRow36', night: 'Cumulative Hours Daytime  NighttimeRow36_2' },
  { date: 'DateRow37', start: 'Time AMPM Start   EndRow37', end: 'Time AMPM Start   EndRow37_2', day: 'Cumulative Hours Daytime  NighttimeRow37', night: 'Cumulative Hours Daytime  NighttimeRow37_2' },
  { date: 'DateRow38', start: 'Time AMPM Start   EndRow38', end: 'Time AMPM Start   EndRow38_2', day: 'Cumulative Hours Daytime  NighttimeRow38', night: 'Cumulative Hours Daytime  NighttimeRow38_2' },
  { date: 'DateRow39', start: 'Time AMPM Start   EndRow39', end: 'Time AMPM Start   EndRow39_2', day: 'Cumulative Hours Daytime  NighttimeRow39', night: 'Cumulative Hours Daytime  NighttimeRow39_2' },
  { date: 'DateRow40', start: 'Time AMPM Start   EndRow40', end: 'Time AMPM Start   EndRow40_2', day: 'Cumulative Hours Daytime  NighttimeRow40', night: 'Cumulative Hours Daytime  NighttimeRow40_2' },
  { date: 'DateRow41', start: 'Time AMPM Start   EndRow41', end: 'Time AMPM Start   EndRow41_2', day: 'Cumulative Hours Daytime  NighttimeRow41', night: 'Cumulative Hours Daytime  NighttimeRow41_2' },
  { date: 'DateRow42', start: 'Time AMPM Start   EndRow42', end: 'Time AMPM Start   EndRow42_2', day: 'Cumulative Hours Daytime  NighttimeRow42', night: 'Cumulative Hours Daytime  NighttimeRow42_2' },
].map((row) => ({
  ...row,
  // The published field is named after its own row suffix the same way as
  // every other column here — "DateRow1" pairs with "Skill Practiced Ex
  // Highway Parking etcRow1", "DateRow1_2" with "...etcRow1_2", and so on.
  skill: `Skill Practiced Ex Highway Parking etc${row.date.replace('Date', '')}`,
}));

// Kentucky's Practice Driving Log rows, measured from the printed grid
// lines in a rendering of each page: 32 day rows on page 1, 33 night rows
// on page 2 — a separate page per side of the split, not just a separate
// column (see Nevada) or a separate hour cell in a shared row (see
// Colorado, Illinois, Kansas).
const kyDayRowYs = [
  576.2, 561.2, 546.5, 531.5, 516.8, 501.8, 487.2, 472.5, 457.5, 442.8,
  427.8, 413.2, 398.2, 383.5, 368.8, 353.8, 339.2, 324.5, 309.5, 294.8,
  279.8, 265.2, 250.5, 235.5, 220.8, 205.8, 191.2, 176.2, 161.5, 146.5,
  131.8, 117.2,
];
const kyNightRowYs = [
  672.8, 660.2, 647.8, 635.2, 622.8, 610.2, 597.8, 585.2, 572.8, 560.2,
  547.8, 535.2, 522.8, 510.2, 497.8, 485.2, 472.8, 460.2, 447.8, 435.2,
  422.8, 410.2, 397.8, 385.2, 372.8, 360.2, 347.8, 335.2, 322.8, 310.2,
  297.8, 285.2, 272.5,
];

// West Virginia's DMV-10-GDL rows: 10 blank rows on page 1 (after its 2
// pre-printed "EXAMPLE" rows, which are burned into the page and not
// fillable), then 12 more blank rows on page 2 — one continuous row pool
// split across two pages, not a day/night split (see Kentucky), so each
// entry is either a plain y (page 1, the `log.page` default) or a
// `{ page, y }` pair naming page 2.
const wvRowYs = [
  366, 330, 294, 258, 222, 185.5, 149.5, 113.5, 77.5, 41.5,
  { page: 1, y: 626 }, { page: 1, y: 590 }, { page: 1, y: 554.5 }, { page: 1, y: 518.5 },
  { page: 1, y: 483 }, { page: 1, y: 447 }, { page: 1, y: 411.5 }, { page: 1, y: 375.5 },
  { page: 1, y: 340 }, { page: 1, y: 304 }, { page: 1, y: 268.5 }, { page: 1, y: 232.5 },
];

// Texas's DES150N is organized around the ten skill categories from TDLR's
// Behind-the-Wheel Instruction Guide rather than a running date grid — each
// category has a fixed number of day rows and night rows, and the hours for
// every row are already pre-printed by the state (e.g. Backing always gets
// one 30-minute day row and one 30-minute night row; the total across every
// row is fixed at 20 day hours + 10 night hours regardless of what's
// filled in). Row baselines below were measured against each row's own
// pre-printed "1 hour"/"30 minutes" text in the Daytime/Nighttime Hours
// columns — reliable where the grid's own rule lines were not, since two of
// its categories (City Driving, Expressway/Freeway Driving) mix a taller
// header-like row into otherwise-uniform spacing. City Driving and
// Expressway/Freeway Driving each have one more row that asks for both a
// day amount and a night amount at once — there's no single drive that is
// both, so those two rows are simply never referenced here and stay blank
// for the parent.
// One entry per SKILL_CATEGORIES entry, in the same order — the TX form
// lists its ten categories in exactly that order top to bottom.
const TX_ROWS_BY_CATEGORY = [
  { day: [651.8], night: [635.7] },
  { day: [618.2, 604.2], night: [589.3] },
  { day: [571.8], night: [557.7] },
  { day: [540.2, 526.2, 511.3], night: [496.4] },
  { day: [478.8, 464.9], night: [449.9] },
  { day: [432.4], night: [418.4] },
  { day: [400.8], night: [386.9] },
  { day: [369.3, 355.3, 340.4], night: [325.5] },
  { day: [308.0, 293.9, 279.0], night: [249.2] },
  { day: [231.6, 217.6, 202.7], night: [172.8] },
];
const txCategoryRows = SKILL_CATEGORIES.map((cat, i) => ({
  key: cat.key,
  ...TX_ROWS_BY_CATEGORY[i],
}));

// Minnesota's Supervised Driving Log repeats the same row shape in two
// side-by-side blocks on one page instead of running further down it — the
// left block fills first, then the right. Row baselines are shared between
// both blocks; only the column x's differ.
const mnRowYs = [
  537.7, 521.0, 504.3, 488.0, 471.3, 454.7, 438.0, 421.3, 404.7, 388.0,
  371.3, 354.7, 338.0, 321.3, 304.7, 288.0, 271.3, 254.7, 238.0, 221.3,
  204.7, 188.0, 171.3, 155.0, 137.7,
];

// Maryland's RD-006 practice log runs across 4 pages of its 5-page booklet
// (the 5th is the age-branched certification page, handled separately) —
// 19 rows on the first page, which shares its page with an instructional
// paragraph, then 23 rows on each full page after. Row entries are a plain
// y (page 0, the `log.page` default) or a `{ page, y }` pair, same shape
// as West Virginia's two-page log.
const mdRowYs = [
  422.7, 401.0, 379.3, 357.7, 336.0, 314.7, 293.0, 271.3, 249.7, 228.0, 206.7, 185.0, 163.3, 141.7, 120.0, 98.7, 77.0, 55.3, 33.7,
  { page: 1, y: 527.0 }, { page: 1, y: 505.3 }, { page: 1, y: 484.0 }, { page: 1, y: 462.3 },
  { page: 1, y: 440.7 }, { page: 1, y: 419.0 }, { page: 1, y: 397.3 }, { page: 1, y: 376.0 },
  { page: 1, y: 354.3 }, { page: 1, y: 332.7 }, { page: 1, y: 311.0 }, { page: 1, y: 289.3 },
  { page: 1, y: 268.0 }, { page: 1, y: 246.3 }, { page: 1, y: 224.7 }, { page: 1, y: 203.0 },
  { page: 1, y: 181.3 }, { page: 1, y: 160.0 }, { page: 1, y: 138.3 }, { page: 1, y: 116.7 },
  { page: 1, y: 95.0 }, { page: 1, y: 73.3 }, { page: 1, y: 52.0 },
  { page: 2, y: 527.0 }, { page: 2, y: 505.3 }, { page: 2, y: 484.0 }, { page: 2, y: 462.3 },
  { page: 2, y: 440.7 }, { page: 2, y: 419.0 }, { page: 2, y: 397.3 }, { page: 2, y: 376.0 },
  { page: 2, y: 354.3 }, { page: 2, y: 332.7 }, { page: 2, y: 311.0 }, { page: 2, y: 289.3 },
  { page: 2, y: 268.0 }, { page: 2, y: 246.3 }, { page: 2, y: 224.7 }, { page: 2, y: 203.0 },
  { page: 2, y: 181.3 }, { page: 2, y: 160.0 }, { page: 2, y: 138.3 }, { page: 2, y: 116.7 },
  { page: 2, y: 95.0 }, { page: 2, y: 73.3 }, { page: 2, y: 52.0 },
  { page: 3, y: 527.0 }, { page: 3, y: 505.3 }, { page: 3, y: 484.0 }, { page: 3, y: 462.3 },
  { page: 3, y: 440.7 }, { page: 3, y: 419.0 }, { page: 3, y: 397.3 }, { page: 3, y: 376.0 },
  { page: 3, y: 354.3 }, { page: 3, y: 332.7 }, { page: 3, y: 311.0 }, { page: 3, y: 289.3 },
  { page: 3, y: 268.0 }, { page: 3, y: 246.3 }, { page: 3, y: 224.7 }, { page: 3, y: 203.0 },
  { page: 3, y: 181.3 }, { page: 3, y: 160.0 }, { page: 3, y: 138.3 }, { page: 3, y: 116.7 },
  { page: 3, y: 95.0 }, { page: 3, y: 73.3 }, { page: 3, y: 52.0 },
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
    leftBlank: ['Permit number'],
    note:
      'Every row’s Comments cell prints whichever skill categories the parent tagged that drive ' +
      'with, if any — otherwise it’s left blank.',
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

  IL: {
    kind: 'acroform-log',
    asset: 'forms/il-dsdx152.pdf',
    formLabel: 'DSD X152 Practice Driving Log',
    revision: '152.4, March 2026',
    // No name field exists anywhere on this form — it's a bare practice
    // chart attached to a covering letter, with nothing to identify the
    // student beyond the log itself.
    fields: [],
    log: { rows: ilRows },
    // The one other field on this document, a text field literally named
    // "Signature of Parent, Guardian or Other Responsible Adult", is left
    // blank on purpose — typing into it would be signing on the parent's
    // behalf, the one thing this app must never do, regardless of what
    // field type the state happened to publish it as.
    leftBlank: ['Signature of Parent, Guardian or Other Responsible Adult'],
    note: 'Location of Practice, Weather Conditions, and Initials are left blank on every row — the app records when a drive happened and how long, not where or in what weather.',
  },

  KS: {
    kind: 'overlay-log',
    asset: 'forms/ks-deib01.pdf',
    formLabel: 'DE-IB01 Teen Driving Experience Log',
    revision: '6/99',
    overlay: [{ page: 0, x: 95, y: 732, size: 11, value: fullName }],
    log: {
      page: 0,
      rowYs: ksRowYs,
      size: 9,
      fields: {
        date: { x: 83 },
        day: { x: 210 },
        night: { x: 330 },
        total: { x: 444 },
      },
    },
    note:
      'The certification, Parent/Guardian Signature, and Date at the bottom are left blank for ' +
      'the parent to sign by hand.',
  },

  NC: {
    kind: 'acroform-log',
    asset: 'forms/nc-dl4a.pdf',
    formLabel: 'DL-4A Driving Log to Advance to N.C. Level 2 Limited Provisional Driver License',
    revision: '09/2011',
    fields: [
      { name: 'Customer Name', value: fullName },
      // "I ____, do certify..." — the printed name of the supervising
      // driver on the certification line, same as every other state's
      // cover-page name field. The signature line right after it
      // ("in accordance with N.C. G.S. 20-11(d), ____") is left blank.
      { name: 'I', value: (ctx) => ctx.parentName },
    ],
    log: { rows: ncRows },
    totals: {
      day: 'To t a l Da y Ho u r s Driv en',
      night: 'To t a l Ni g h t Ho u r s Dr iv e n',
      total: 'Gr a n d To t a l',
    },
    leftBlank: ["Customers    DL Number", 'Supervising Driver’s DL'],
    note:
      'Every row’s Supervising Driver’s Printed Name and DL cell is left blank — the app doesn’t ' +
      'record which specific supervising driver rode along on a given drive.',
  },

  NH: {
    kind: 'acroform-log',
    asset: 'forms/nh-dsmv509.pdf',
    formLabel: 'DSMV 509 Certification of Additional Supervised Driving',
    revision: 'Rev. 6/23',
    fields: [{ name: 'Full Name of Driver', value: fullName }],
    log: { rows: nhRows, cumulative: true },
    totals: {
      // "Total Time Logged" is the grand total across both pages; the
      // per-page subtotals ("Total Time this/back page") are left blank —
      // computing them correctly means knowing exactly which drives
      // landed on which physical page, which the parent can total by hand
      // faster than this app can reconstruct it.
      total: 'Cumulative Hours Daytime  NighttimeTotal Time Logged',
      night: 'Cumulative Hours Daytime  NighttimeTotal Time Logged_2',
    },
    leftBlank: ['Telephone', 'Address'],
    note:
      'Every row’s Skill Practiced cell prints whichever categories the parent tagged that drive ' +
      'with, if any. Parent/Guardian Initials is left blank, and both pages’ per-page subtotals ' +
      'are left for the parent to total by hand — only the grand total is filled.',
  },

  KY: {
    kind: 'overlay-log',
    asset: 'forms/ky-practicelog.pdf',
    formLabel: 'Practice Driving Log',
    revision: 'as published; unnumbered',
    // No name field exists anywhere on this form.
    log: {
      tracks: {
        day: { page: 0, rowYs: kyDayRowYs, columns: { date: { x: 93 }, hours: { x: 230 } } },
        night: { page: 1, rowYs: kyNightRowYs, columns: { date: { x: 73 }, hours: { x: 227 } } },
      },
    },
    leftBlank: ['Parent/Guardian Initials'],
    note:
      'Both signature lines (Applicant, Parent/Guardian) and the KSP License Examiner block are ' +
      'left blank for signing in person, per the form’s own instructions.',
  },

  TN: {
    kind: 'overlay',
    asset: 'forms/tn-sf1256.pdf',
    formLabel: 'SF-1256 Certification of 50 Hours Behind the Wheel Driving Experience',
    revision: '02/13',
    // Measured from the two "NAME OF ___" boxes at the top of the form.
    overlay: [
      { x: 60, y: 650, size: 10, value: fullName },
      { x: 45, y: 584, size: 10, value: (ctx) => ctx.parentName },
    ],
    note:
      'Only the permit holder’s and parent/guardian/instructor’s names are filled. Permit number, ' +
      'Social Security numbers, addresses, and the signature/relationship line at the bottom are ' +
      'left for the parent to complete by hand.',
  },

  WY: {
    kind: 'acroform',
    asset: 'forms/wy-fsgdl01.pdf',
    formLabel: 'FSGDL-01 Behind-the-Wheel Driving Certification',
    revision: '20190620',
    fields: [
      { name: 'Drivers Name', value: fullName },
      { name: 'I', value: (ctx) => ctx.parentName },
      { name: 'Total Daytime Driving Hours', value: dayHours },
      { name: 'Total Nighttime Driving Hours', value: nightHours },
      { name: 'Total Driving Hours', value: totalHours },
    ],
    leftBlank: ['Date of Birth', 'Driver License No'],
    note:
      'Date of birth and driver license number: the app collects neither. The signature and date ' +
      'line at the bottom are left blank for the parent to sign.',
  },

  WV: {
    kind: 'overlay-log',
    asset: 'forms/wv-dmv10gdl.pdf',
    formLabel: 'DMV-10-GDL 50-Hour Certification Log for Driver’s License Applicants Under Age 18',
    revision: 'REV 09/14',
    // The applicant's name line repeats at the top of each page — the
    // form's own instructions say it may be photocopied for more rows.
    overlay: [
      { page: 0, x: 42, y: 579, size: 10, value: fullName },
      { page: 1, x: 42, y: 709, size: 10, value: fullName },
      // "I hereby certify that ___, who bears instruction permit number
      // ___, has completed..." — only the certifying parent's name is
      // filled; the permit number blank right after it is left empty.
      { page: 1, x: 130, y: 161, size: 9, value: (ctx) => ctx.parentName },
      { page: 1, x: 485, y: 189, size: 10, value: totalHours },
    ],
    log: {
      page: 0,
      rowYs: wvRowYs,
      size: 9,
      fields: {
        date: { x: 42 },
        day: { x: 334 },
        night: { x: 411 },
      },
    },
    note:
      'Only the date and the Daytime/Nighttime hours columns are filled — Location of Practice, ' +
      'Time Period, Weather Conditions, and the supervising adult’s initials are left for the ' +
      'parent to complete by hand, as is the permit number and the signature/driver’s-license ' +
      'line at the bottom.',
  },

  WA: {
    kind: 'acroform',
    asset: 'forms/wa-dle520003.pdf',
    formLabel: 'DLE-520-003 Parental Authorization Affidavit',
    revision: 'R4/25',
    fields: [
      { name: 'txtLastName', value: (ctx) => ctx.student.lastName },
      { name: 'txtFirstName', value: (ctx) => ctx.student.firstName },
    ],
    // Middle name, suffix, and date of birth: the app collects none of
    // these. The relationship checkbox, the permit-type checkboxes, the
    // hours-certification checkbox, the driver license/ID box, and
    // everything from "Licensing services representative" down (signature,
    // date, and the notarization block) are all left for the parent — this
    // affidavit exists specifically for signing in front of a notary when
    // the parent can't be present in person, so those are not the app's to
    // fill.
    leftBlank: [
      'txtMiddleName', 'txtSuffix', 'dob', 'dlIDnum', 'cert',
      'appInsPerm', 'appDL', 'appMCperm', 'appMCend', 'certify hours',
      'UserName', 'txtBadge', 'txtStationNum', 'txtCurrentDate', 'parentPic', 'parentLicenseState', 'printSign',
    ],
    note:
      'This affidavit must be signed in front of a notary (or witnessed by a DMV agent) — it is ' +
      'meant for when the authorized signer can’t be present in person, not a substitute for the ' +
      'standard hours certification.',
  },

  AK: {
    kind: 'acroform',
    asset: 'forms/ak-form433.pdf',
    formLabel: 'Form 433 Parent/Guardian Consent for a Minor',
    revision: 'Rev. 08/28/2018',
    // The PDF's own field names are each taken from the printed text right
    // after the blank they belong to, not the blank's own label — "I,
    // [Parent/Guardian's Name], hereby give my consent for" names the
    // parent's-name field "hereby give my consent for", and likewise the
    // applicant's-name field is named "whose date of birth is".
    fields: [
      { name: 'hereby give my consent for', value: (ctx) => ctx.parentName },
      { name: 'whose date of birth is', value: fullName },
    ],
    // Date of birth ("to obtain", the field after the DOB blank): the app
    // doesn't collect it. Which of the four license classes applies is a
    // fact about the family, not the logged hours, so all four are left
    // for the parent to mark themselves, as is everything below the
    // consent paragraph — driver's license number, address, contact info,
    // and the signature/notary block.
    leftBlank: [
      'to obtain',
      'Alaska Drivers Instruction Permit Class IP', 'Alaska Provisional Drivers License Class D',
      'Alaska Drivers License Class D', 'Alaska ATV  Snowmachine Drivers License Class R',
      'Parents Drivers License', 'Issuing State', 'Your Relationship to Applicant',
      'Your Mailing Address', 'Email', 'Phone',
    ],
    note:
      'This is a consent-to-apply form, not a driving log — it must be signed in front of a notary ' +
      'or DMV representative if the parent isn’t present in person, per the form’s own instructions.',
  },

  TX: {
    kind: 'overlay-category-log',
    asset: 'forms/tx-des150n.pdf',
    formLabel: 'TDLR DES150N Driver Education 30 Hour Behind the Wheel Log',
    revision: 'rev December 2024',
    // Measured from the blank line right after "Student's Name:". DL # is
    // left blank — the app doesn't collect a permit number.
    overlay: [{ x: 115, y: 692, size: 10, value: fullName }],
    log: {
      page: 0,
      dateX: 202,
      timeX: 260,
      categories: txCategoryRows,
    },
    note:
      'Only the Date and Time cells are filled — the Daytime/Nighttime Hours columns are already ' +
      'pre-printed by the state and never touched. Every drive must be tagged with at least one ' +
      'skill category for this state, since the log is organized by category rather than by date; ' +
      'a category with more tagged drives than it has rows keeps only the most recent ones. The ' +
      'Adult’s Signature and DL # column, and the certification signature/date at the bottom, ' +
      'are left for the parent. Texas counts at most 2 hours of driving per calendar day (1 hour ' +
      'day, 1 hour night) toward the 30-hour requirement regardless of how much was actually ' +
      'driven — the app applies that same cap wherever it shows this student’s progress, not ' +
      'just on this form.',
  },

  MN: {
    kind: 'overlay-log',
    asset: 'forms/mn-supervised-log.pdf',
    formLabel: 'Supervised Driving Log',
    revision: 'Rev. 06/2021',
    // Measured from the blank line right after "Student's Name". The
    // example row's own "8/15/14 / 90 / 30 / 120 / parking; turns" is
    // printed on the page itself, not a fillable field — the first usable
    // row is the blank one beneath it.
    overlay: [
      { page: 0, x: 180, y: 761, size: 10, value: fullName },
      // The single "TOTAL DRIVING HOURS" box. Each block's own DAY/NIGHT/
      // TOTAL MINUTES subtotals are left for the parent to add up by
      // hand — the same reasoning as New Hampshire's per-page subtotals.
      { page: 0, x: 525, y: 60, size: 11, value: totalHours },
    ],
    log: {
      page: 0,
      rowYs: mnRowYs,
      size: 9,
      blocks: [
        {
          date: { x: 26 }, day: { x: 69 }, night: { x: 111 }, total: { x: 153 },
          skills: { x: 194, width: 100 }, unit: 'minutes',
        },
        {
          date: { x: 306.7 }, day: { x: 350 }, night: { x: 391.7 }, total: { x: 433.3 },
          skills: { x: 475.3, width: 108 }, unit: 'minutes',
        },
      ],
    },
    note:
      'Day/Night/Total Minutes are whole minutes, matching the form’s own header. Skills ' +
      'Practiced prints whichever categories the parent tagged the drive with, same as the DPS ' +
      'example row — a drive tagged with more categories than the cell can fit shows as many as ' +
      'fit plus a "+N" count, never overflowing into the next column. Only the grand Total ' +
      'Driving Hours box is filled — each block’s own DAY/NIGHT/TOTAL MINUTES subtotals and the ' +
      'Signature of Primary Driving Supervisor line are left for the parent.',
  },

  AL: {
    kind: 'overlay',
    asset: 'forms/al-dl31.pdf',
    formLabel: 'DL-31 Graduated Driver License Form',
    revision: 'Rev 09/21',
    // "Name of Applicant" appears twice — once in the "Permission to Drive
    // Without Supervision" consent section, once in the "Behind the Wheel
    // Verification Form" section right below it. Both Signature of Parent
    // or Legal Guardian lines are left blank.
    overlay: [
      { x: 160, y: 495, size: 10, value: fullName },
      { x: 160, y: 291, size: 10, value: fullName },
    ],
    note:
      'Only the applicant’s name is filled in both sections. Both signature lines are left blank ' +
      'for the parent to sign, and the Certificate of Completion checkbox (driver education) is ' +
      'left unmarked — the app doesn’t know whether the student completed a state-approved course.',
  },

  MS: {
    kind: 'overlay',
    asset: 'forms/ms-roadtestwaiver.pdf',
    formLabel: 'Affidavit for Road Test Waiver',
    revision: '§63-1-33, Miss. Code Ann. 1972',
    // The APPLICANT line is one continuous underline spanning Last Name/
    // First/Middle, positioned under each printed label; the app only has
    // first and last. Measured from the blank right after "I," on the
    // certification paragraph for the parent's name.
    overlay: [
      { x: 155, y: 569, size: 10, value: (ctx) => ctx.student.lastName },
      { x: 295, y: 569, size: 10, value: (ctx) => ctx.student.firstName },
      { x: 85, y: 380, size: 10, value: (ctx) => ctx.parentName },
    ],
    note:
      'This affidavit is for the optional road-test waiver — it is not evidence that Mississippi ' +
      'requires logged hours generally (it doesn’t; the 50-hour figure printed on this form only ' +
      'applies to families choosing to waive the road test). Address, date of birth, age, and SSN ' +
      'are left blank, as is everything from the swear/affirm line down (signature, date, title) ' +
      'for the parent or instructor to complete.',
  },

  MD: {
    kind: 'overlay-log',
    asset: 'forms/md-rd006.pdf',
    formLabel: 'RD-006 New Driver & Coach Practice Guide — Practice Log',
    revision: 'New Driver & Coach Practice Guide',
    log: {
      page: 0,
      rowYs: mdRowYs,
      size: 8,
      fields: {
        date: { x: 31 },
        start: { x: 86 },
        end: { x: 235 },
        hours: { x: 291 },
        skills: { x: 141, width: 84 },
      },
    },
    // The certification page (5th page of the booklet) branches on the
    // driver's age — under 25 (60 hrs, 10 at night) or 25+ (14 hrs, 3 at
    // night) — which the app doesn't track, so both name blanks there are
    // left for the parent, who signs only the paragraph that applies.
    note:
      'The practice log (Date, Start/End Time, Skill or Activity Practiced, Total Hours) is ' +
      'filled across all four log pages. The certification page is left entirely blank — it has ' +
      'two alternate paragraphs depending on whether the driver is under 25 or 25 and older, and ' +
      'the app doesn’t know the driver’s age — the parent fills in whichever paragraph applies ' +
      'and signs it by hand.',
  },
};

export function stateFormTemplateFor(stateCode) {
  return STATE_FORM_TEMPLATES[stateCode] ?? null;
}
