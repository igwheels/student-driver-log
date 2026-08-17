import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates a PDF containing:
 *  Page 1 — an affidavit addressed to the student's state DMV in which the
 *           parent attests the log is true and accurate, with a signature
 *           block dated with the export date.
 *  Page 2  — the full driving log table with totals.
 * Then triggers a browser download.
 */
export function exportLogPdf({ student, req, logs, totals, parentName }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 56;
  let y = margin;

  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const fmtDur = (mins) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- Page 1: Affidavit ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Student Driver Log', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Supervised Driving Record — exported ${exportDate}`, margin, y);
  doc.setTextColor(20);
  y += 34;

  doc.setFontSize(11);
  doc.text('To: Department of Motor Vehicles', margin, y);
  y += 14;
  doc.text(`State of ${req.name}`, margin, y);
  y += 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('AFFIDAVIT OF SUPERVISED DRIVING — CERTIFICATION', margin, y, { align: 'left' });
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const requirementSentence =
    req.totalHours > 0
      ? `has completed the supervised behind-the-wheel motor vehicle operation recorded in the attached log, toward the minimum of ${req.totalHours} hours${
          req.nightHours > 0 ? `, including at least ${req.nightHours} hours between sunset and sunrise,` : ''
        } required by the State of ${req.name}, under conditions consistent with safe motor vehicle operation, and that the student is sufficiently prepared and able to operate a motor vehicle safely.`
      : `has completed the supervised behind-the-wheel motor vehicle operation recorded in the attached log, under conditions consistent with safe motor vehicle operation, and that the student is sufficiently prepared and able to operate a motor vehicle safely.`;

  const paragraphs = [
    `I certify that ${student.firstName} ${student.lastName} ${requirementSentence}`,
    `I also certify that the supervised driving hours recorded in the attached log were spent with a parent, guardian, or licensed adult driver as required by the State of ${req.name}.`,
    `I certify that the attached driving log is a true and accurate statement of the supervised driving completed by the above-named student, and that all information submitted by me regarding this record is true and correct.`,
  ];

  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p, 500);
    doc.text(lines, margin, y);
    y += lines.length * 15 + 14;
  }

  y += 60;
  doc.line(margin, y, margin + 300, y);
  doc.line(margin + 340, y, margin + 480, y);
  y += 12;
  doc.setFontSize(9);
  doc.text(
    `Signature of Parent, Guardian or Licensed Supervising Driver${parentName ? ` (${parentName})` : ''}`,
    margin, y
  );
  doc.text(`Date: ${exportDate}`, margin + 340, y);

  // ---- Page 2: Log table ----
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Driving Log — ${student.firstName} ${student.lastName}`, margin, margin);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Total driving time: ${fmtDur(totals.totalMinutes)}     Total night driving time: ${fmtDur(totals.nightMinutes)}`,
    margin, margin + 20
  );

  const rows = [...logs]
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .map((e) => [
      e.date,
      fmtTime(e.startTime),
      fmtTime(e.endTime),
      fmtDur(e.durationMinutes),
      cap(e.timeOfDay),
      cap(e.type),
      e.distanceMiles != null ? `${e.distanceMiles} mi` : '—',
    ]);

  autoTable(doc, {
    startY: margin + 36,
    margin: { left: margin, right: margin },
    head: [['Date', 'Start', 'End', 'Duration', 'Time of Day', 'Type', 'Distance']],
    body: rows,
    headStyles: { fillColor: [20, 28, 46], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [242, 244, 248] },
    styles: { fontSize: 9, cellPadding: 6 },
  });

  doc.save(`${student.firstName}-${student.lastName}-driving-log.pdf`);
}
