/**
 * Sends "a student was shared with you" emails — run by
 * .github/workflows/send-invitations.yml on a short schedule via GitHub
 * Actions (same Gmail/Nodemailer setup as the weekly progress emails, no
 * extra service required).
 *
 * Sharing itself already takes effect the moment the recipient signs in with
 * the shared email (see shareStudent in src/context/AppContext.jsx) — this
 * script just notifies them, whether they have an account yet or not.
 *
 * Requires repo secrets: FIREBASE_SERVICE_ACCOUNT (JSON), GMAIL_EMAIL, GMAIL_APP_PASSWORD
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { generateInvitationEmailContent } from '../src/utils/invitations.js';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const APP_URL = process.env.APP_URL || 'https://igwheels.github.io/student-driver-log/';

async function main() {
  const db = getFirestore();
  const pending = await db.collection('invitations').where('emailSent', '==', false).get();

  if (pending.empty) {
    console.log('No pending invitation emails.');
    return;
  }

  const results = await Promise.allSettled(
    pending.docs.map(async (docSnap) => {
      const invitation = docSnap.data();
      const { subject, text, html } = generateInvitationEmailContent(invitation, APP_URL);
      await transporter.sendMail({
        to: invitation.email,
        from: `"Student Driver Log" <${process.env.GMAIL_EMAIL}>`,
        replyTo: process.env.GMAIL_EMAIL,
        subject,
        text,
        html,
      });
      await docSnap.ref.update({ emailSent: true, emailSentAt: new Date().toISOString() });
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  console.log(`Sent ${results.length - failed.length}/${results.length} invitation emails.`);
  if (failed.length) {
    failed.forEach((f) => console.error(f.reason));
    process.exitCode = 1;
  }
}

main();
