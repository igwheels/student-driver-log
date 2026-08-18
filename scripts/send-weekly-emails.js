/**
 * Weekly progress emails — run by .github/workflows/weekly-emails.yml
 * on a Monday-morning schedule via GitHub Actions (no separate server needed).
 *
 * Sent to everyone with access to the student's dashboard: the student
 * themselves (student.email, if set), the owner (ownerEmail), and anyone
 * the student has been shared with (sharedWithEmails) — see shareStudent
 * in src/context/AppContext.jsx.
 *
 * Requires:
 *   - Firestore mirroring the app's students + logs
 *   - Repo secrets: FIREBASE_SERVICE_ACCOUNT (JSON), GMAIL_EMAIL, GMAIL_APP_PASSWORD
 *
 * Firestore structure expected:
 *   users/{uid}/students/{studentId}         -> { firstName, lastName, email, state,
 *                                                 ownerEmail, sharedWithEmails }
 *   users/{uid}/students/{studentId}/logs/*  -> { durationMinutes, timeOfDay }
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { STATE_REQUIREMENTS } from '../src/data/stateRequirements.js';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const fmt = (mins) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;

async function main() {
  const db = getFirestore();
  const students = await db.collectionGroup('students').get();

  const sends = [];
  for (const doc of students.docs) {
    const student = doc.data();

    const recipients = new Set();
    for (const email of [student.email, student.ownerEmail, ...(student.sharedWithEmails ?? [])]) {
      if (email) recipients.add(email.trim().toLowerCase());
    }
    if (recipients.size === 0) continue;

    const logsSnap = await doc.ref.collection('logs').get();
    let total = 0;
    let night = 0;
    logsSnap.forEach((l) => {
      const d = l.data();
      total += d.durationMinutes ?? 0;
      if (d.timeOfDay === 'night') night += d.durationMinutes ?? 0;
    });

    const req = STATE_REQUIREMENTS[student.state] ?? { totalHours: 0, nightHours: 0 };
    const pct = req.totalHours > 0 ? Math.min(100, Math.round((total / (req.totalHours * 60)) * 100)) : null;
    const progressLine =
      pct != null
        ? `${student.firstName} is ${pct}% of the way to the ${req.totalHours}-hour goal.` +
          (req.nightHours > 0 ? ` Night driving: ${fmt(night)} of ${req.nightHours}h.` : '')
        : `${req.name ?? 'Your state'} has no minimum hour requirement — every hour logged is above and beyond!`;

    for (const to of recipients) {
      sends.push(
        transporter.sendMail({
          to,
          from: `"Student Driver Log" <${process.env.GMAIL_EMAIL}>`,
          replyTo: process.env.GMAIL_EMAIL,
          subject: `🚗 Weekly driving progress for ${student.firstName}`,
          text: `Weekly driving progress for ${student.firstName}

Total supervised hours: ${fmt(total)}
Night hours: ${fmt(night)}
${progressLine}

Keep up the great work!`,
          html: `
            <h2>Weekly driving progress for ${student.firstName}</h2>
            <p><strong>Total supervised hours:</strong> ${fmt(total)}</p>
            <p><strong>Night hours:</strong> ${fmt(night)}</p>
            <p>${progressLine}</p>
            <p>Keep up the great work! 🏁</p>`,
        })
      );
    }
  }

  const results = await Promise.allSettled(sends);
  const failed = results.filter((r) => r.status === 'rejected');
  console.log(`Sent ${results.length - failed.length}/${results.length} emails.`);
  if (failed.length) {
    failed.forEach((f) => console.error(f.reason));
    process.exitCode = 1;
  }
}

main();
