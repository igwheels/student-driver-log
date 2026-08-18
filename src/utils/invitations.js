/**
 * Invitation utilities for student sharing
 *
 * NOTE: Email sending must be done on the backend (Cloud Function or server endpoint)
 * since we can't expose SendGrid API key in client-side code.
 *
 * When a student is shared:
 * 1. An invitation record is created in Firestore at: db.collection('invitations')
 * 2. A backend function/endpoint should listen to these invitations
 * 3. The backend sends an email with an invitation link
 * 4. When the user clicks the link and signs up, they automatically get access
 *
 * Cloud Function Example (functions/sendInvitationEmail.js):
 * ```
 * const functions = require('firebase-functions');
 * const sgMail = require('@sendgrid/mail');
 * sgMail.setApiKey(process.env.SENDGRID_API_KEY);
 *
 * exports.sendInvitationEmail = functions.firestore
 *   .document('invitations/{docId}')
 *   .onCreate(async (snap) => {
 *     const invitation = snap.data();
 *
 *     const signupUrl = `https://yourapp.com/signup?invitationId=${snap.id}&email=${encodeURIComponent(invitation.email)}`;
 *
 *     const msg = {
 *       to: invitation.email,
 *       from: process.env.SENDGRID_FROM_EMAIL,
 *       subject: `${invitation.ownerName} wants to share ${invitation.studentName}'s driving log with you`,
 *       html: `
 *         <h2>You're invited!</h2>
 *         <p>${invitation.ownerName} wants to share <strong>${invitation.studentName}</strong>'s Student Driver Log with you.</p>
 *         <p>Click the link below to create an account and view the driving log:</p>
 *         <p><a href="${signupUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2F6FDE; color: white; text-decoration: none; border-radius: 6px;">View Driving Log</a></p>
 *         <p>If you already have an account, just sign in and the access will be granted automatically.</p>
 *       `,
 *     };
 *
 *     return sgMail.send(msg);
 *   });
 * ```
 *
 * Backend Endpoint Example (for Node.js/Express):
 * ```
 * app.post('/api/send-invitation-email', async (req, res) => {
 *   const { invitationId } = req.body;
 *
 *   const invSnap = await db.collection('invitations').doc(invitationId).get();
 *   const invitation = invSnap.data();
 *
 *   if (!invitation) {
 *     return res.status(404).json({ error: 'Invitation not found' });
 *   }
 *
 *   const signupUrl = `https://yourapp.com/signup?invitationId=${invitationId}&email=${encodeURIComponent(invitation.email)}`;
 *
 *   const msg = {
 *     to: invitation.email,
 *     from: process.env.SENDGRID_FROM_EMAIL,
 *     subject: `${invitation.ownerName} wants to share ${invitation.studentName}'s driving log with you`,
 *     html: `
 *       <h2>You're invited!</h2>
 *       <p>${invitation.ownerName} wants to share <strong>${invitation.studentName}</strong>'s Student Driver Log with you.</p>
 *       <p>Click the link below to create an account and view the driving log:</p>
 *       <p><a href="${signupUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2F6FDE; color: white; text-decoration: none; border-radius: 6px;">View Driving Log</a></p>
 *       <p>If you already have an account, just sign in and the access will be granted automatically.</p>
 *     `,
 *   };
 *
 *   try {
 *     await sgMail.send(msg);
 *     await db.collection('invitations').doc(invitationId).update({ emailSent: true, sentAt: new Date() });
 *     res.json({ success: true });
 *   } catch (error) {
 *     console.error('Failed to send invitation email:', error);
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 * ```
 */

export const generateInvitationEmailContent = (invitation) => {
  const signupUrl = `${window.location.origin}/signup?email=${encodeURIComponent(invitation.email)}`;

  return {
    subject: `${invitation.ownerName} wants to share ${invitation.studentName}'s driving log with you`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1F2937; margin-bottom: 16px;">You're invited to view a Student Driver Log!</h2>

        <p style="color: #4B5563; line-height: 1.6; margin-bottom: 16px;">
          <strong>${invitation.ownerName}</strong> (${invitation.ownerEmail}) wants to share
          <strong> ${invitation.studentName}</strong>'s Student Driver Log with you.
        </p>

        <p style="color: #4B5563; line-height: 1.6; margin-bottom: 24px;">
          You'll be able to view their driving hours, statistics, and track their progress toward their state requirements.
        </p>

        <p style="text-align: center; margin-bottom: 24px;">
          <a href="${signupUrl}" style="
            display: inline-block;
            padding: 12px 32px;
            background-color: #2F6FDE;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
          ">View Driving Log</a>
        </p>

        <p style="color: #6B7280; line-height: 1.6; margin-bottom: 12px; font-size: 14px;">
          If you already have a Student Driver Log account, simply sign in with your existing email and password, and this student will automatically be shared with you.
        </p>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          This is an automatic message from Student Driver Log. If you didn't expect this invitation, you can safely ignore it.
        </p>
      </div>
    `,
  };
};

export const generateInvitationEmailText = (invitation) => {
  const signupUrl = `${window.location.origin}/signup?email=${encodeURIComponent(invitation.email)}`;

  return `
${invitation.ownerName} wants to share ${invitation.studentName}'s Student Driver Log with you.

View the driving log: ${signupUrl}

If you already have a Student Driver Log account, simply sign in and the access will be granted automatically.
  `.trim();
};

/**
 * Generates a signup link for an invited user
 * The link includes the email to pre-fill the signup form
 */
export const generateSignupLink = (email) => {
  return `${window.location.origin}/signup?email=${encodeURIComponent(email)}`;
};
