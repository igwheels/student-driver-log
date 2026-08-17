/**
 * Weekly progress emails — run by .github/workflows/weekly-emails.yml
 * on a Monday-morning schedule via GitHub Actions (no separate server needed).
 *
 * Requires:
 *   - Firestore mirroring the app's students + logs (see README "Syncing data")
 *   - Repo secrets: FIREBASE_SERVICE_ACCOUNT (JSON), SENDGRID_API_KEY
 *
 * Firestore structure expected:
 *   users/{uid}/students/{studentId}         -> { firstName, lastName, email, state }
 *   users/{uid}/students/{studentId}/logs/*  -> { durationMinutes, timeOfDay }
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sgMail from '@sendgrid/mail';
import { STATE_REQUIREMENTS } from '../src/data/stateRequirements.js';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const fmt = (mins) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;

async function main() {
  const db = getFirestore();
  const students = await db.collectionGroup('students').get();

  const sends = [];
  for (const doc of students.docs) {
    const student = doc.data();
    if (!student.email) continue;

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
        ? `You're ${pct}% of the way to your ${req.totalHours}-hour goal.` +
          (req.nightHours > 0 ? ` Night driving: ${fmt(night)} of ${req.nightHours}h.` : '')
        : 'Your state has no minimum hour requirement — every hour you log is above and beyond!';

    sends.push(
      sgMail.send({
        to: student.email,
        from: 'progress@yourdomain.com', // must be a verified SendGrid sender
        subject: `🚗 Your weekly driving progress, ${student.firstName}!`,
        html: `
          <h2>Keep up the great driving, ${student.firstName}!</h2>
          <p><strong>Total supervised hours:</strong> ${fmt(total)}</p>
          <p><strong>Night hours:</strong> ${fmt(night)}</p>
          <p>${progressLine}</p>
          <p>See you on the road! 🏁</p>`,
      })
    );
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
