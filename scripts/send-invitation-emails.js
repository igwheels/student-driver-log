/**
 * Sends "a student was shared with you" emails — run by
 * .github/workflows/send-invitations.yml on a short schedule via GitHub
 * Actions (same SendGrid setup as the weekly progress emails, no separately
 * running server required).
 *
 * Sharing itself already takes effect the moment the recipient signs in with
 * the shared email (see shareStudent in src/context/AppContext.jsx) — this
 * script just notifies them, whether they have an account yet or not.
 *
 * Requires repo secrets: FIREBASE_SERVICE_ACCOUNT (JSON), SENDGRID_API_KEY
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sgMail from '@sendgrid/mail';
import { generateInvitationEmailContent } from '../src/utils/invitations.js';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// SendGrid requires the sender to be a domain-authenticated (or single
// sender verified) address — see the SendGrid dashboard's Sender
// Authentication section for devworksllc.com's setup.
const FROM_EMAIL = 'ian@devworksllc.com';

const APP_URL = process.env.APP_URL || 'https://sdl.devworksllc.com/';

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
      await sgMail.send({
        to: invitation.email,
        from: { email: FROM_EMAIL, name: 'Student Driver Log' },
        replyTo: FROM_EMAIL,
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
