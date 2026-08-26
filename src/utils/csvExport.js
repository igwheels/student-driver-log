/**
 * Exports a student's drives as CSV, for the parent's own records or for a
 * DMV that wants the itemized log as a file.
 *
 * Times are rendered in the zone each drive was recorded in rather than the
 * exporting device's, matching what the app shows — see utils/driveTime.js.
 *
 * GPS coordinates are deliberately not included. They aren't useful to a DMV,
 * and a spreadsheet of a minor's start and end points is an awkward thing to
 * have travelling around by email; the same reasoning keeps them out of
 * shareable snapshot links.
 */
import { localOffsetMinutes, toZonedTimeInput } from './driveTime';
import { downloadFileName } from './fileName';
import { formatSkills } from '../data/skillCategories';

const DRIVE_TYPE_LABELS = { local: 'Local', rural: 'Rural', highway: 'Highway' };

/**
 * Neutralises a value that a spreadsheet would treat as a formula. A student
 * name beginning with '=' or '+' is otherwise executed on open — the standard
 * CSV injection problem — and these fields are free text typed by a user.
 */
function neutralizeFormula(value) {
  const s = String(value ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function escapeCsv(value) {
  const s = neutralizeFormula(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toRow = (cells) => cells.map(escapeCsv).join(',');

export function buildDrivesCsv({ student, logs }) {
  const header = [
    'Date',
    'Start Time',
    'End Time',
    'Duration (minutes)',
    'Duration',
    'Time of Day',
    'Drive Type',
    'Distance (miles)',
    'Skills Practiced',
  ];

  const rows = [...logs]
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .map((log) => {
      const offset = log.startOffsetMinutes ?? localOffsetMinutes();
      const minutes = log.durationMinutes ?? 0;
      return toRow([
        log.date ?? '',
        log.startTime ? toZonedTimeInput(new Date(log.startTime), offset) : '',
        log.endTime ? toZonedTimeInput(new Date(log.endTime), offset) : '',
        minutes,
        `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`,
        log.timeOfDay === 'night' ? 'Night' : 'Day',
        DRIVE_TYPE_LABELS[log.type] ?? log.type ?? '',
        log.distanceMiles ?? '',
        formatSkills(log.skills),
      ]);
    });

  // CRLF per RFC 4180, and a BOM so Excel reads it as UTF-8 rather than
  // mangling non-ASCII names.
  return `﻿${[toRow(header), ...rows].join('\r\n')}\r\n`;
}

export function exportDrivesCsv({ student, logs }) {
  const csv = buildDrivesCsv({ student, logs });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName([student.firstName, student.lastName, 'driving-logs'], 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
