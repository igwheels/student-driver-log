# Student Sharing Feature - Quick Start Guide

## What Was Implemented

A complete student sharing feature that allows users to share their students' driving logs with other users (e.g., co-parents, guardians). Existing data is fully preserved.

### Key Capabilities

✅ **Owner Functions:**
- Share students with other users by email
- View who a student is shared with
- Remove shared user access at any time
- See "Shared" badge for students they don't own

✅ **Shared User Functions:**
- View dashboard and driving statistics for shared students
- Add new drives
- Delete drives
- Export logs as PDF
- See shared students in their student list

✅ **Automatic Access:**
- If recipient has an account → instant access
- If recipient doesn't have account → send invitation email
- When new user signs up with invited email → automatic access granted

✅ **Data Safety:**
- All existing data preserved
- Backward compatible
- Drives persist when unsharing
- Owner info never visible to shared users

## Quick Setup (3 Steps)

### Step 1: Migrate Existing Data (Important!)

This adds required `ownerId` and `sharedWith` fields to your existing students:

```bash
# Set your Firebase service account JSON as environment variable
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"student-driver-log-b1924","...}'

# Run the migration
node scripts/migrate-add-sharing-fields.js
```

Check the output to verify all students were migrated successfully. If you see "Migration complete!" you're good to go.

**Note:** Back up your data first! Go to Firebase Console → Firestore → Backup & Restore.

### Step 2: Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `student-driver-log-b1924`
3. Go to: Firestore Database → Rules
4. Replace all content with the rules from: `FIRESTORE_SECURITY_RULES.md`
5. Click "Publish"

**These rules are required for the sharing feature to work properly.**

### Step 3: Set Up Email Sending (Optional but Recommended)

Invitation emails are not sent by the web app itself (security best practice). You need a backend function to send them.

**Choose one option:**

#### Option A: Firebase Cloud Functions (Easiest)

Create a new file: `functions/index.js`

```javascript
const functions = require('firebase-functions');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendInvitationEmail = functions.firestore
  .document('invitations/{docId}')
  .onCreate(async (snap) => {
    const invitation = snap.data();
    const signupUrl = `https://yourapp.com/signup?email=${encodeURIComponent(invitation.email)}`;

    const msg = {
      to: invitation.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `${invitation.ownerName} wants to share ${invitation.studentName}'s driving log with you`,
      html: `
        <h2>You're invited!</h2>
        <p>${invitation.ownerName} wants to share <strong>${invitation.studentName}</strong>'s driving log with you.</p>
        <p><a href="${signupUrl}">View Driving Log</a></p>
        <p>If you already have an account, just sign in and access will be granted automatically.</p>
      `,
    };

    return sgMail.send(msg);
  });
```

Then deploy:
```bash
firebase deploy --only functions
```

#### Option B: Express Backend

If you have an Express server, create an endpoint:

```javascript
app.post('/api/send-invitation', async (req, res) => {
  const { invitationId } = req.body;
  const invitation = await db.collection('invitations').doc(invitationId).get();
  // ... send email using SendGrid ...
  await db.collection('invitations').doc(invitationId).update({ emailSent: true });
  res.json({ success: true });
});
```

#### No Backend?

Without email sending, users still get access when they sign up with the invited email - they just won't receive notification emails. The feature still works!

## How to Use

### As an Owner (Sharing a Student)

1. Go to your student's Dashboard
2. Click the "Share" button
3. Enter the recipient's email
4. Click "Share"
5. See them appear in "Shared with" section

To unshare:
- Click "Remove" next to their email in the "Shared with" section

### As a Shared User (Receiving Access)

**If you already have an account:**
1. Owner shares your email
2. Your student appears in your list (may need to refresh)
3. Access works immediately - no special action needed

**If you're new:**
1. Owner shares your email
2. You receive an invitation email (if backend is set up)
3. Click the link to sign up
4. Log in with your email
5. Student automatically appears in your list

## Testing the Feature

### Test Owned Student Access
```
✓ Owner can see "Share" button
✓ Owner can add drives
✓ Owner can delete student
✓ Owner can see "Shared with" section
```

### Test Sharing
```
✓ Owner can enter email and click Share
✓ Success message appears
✓ Email appears in "Shared with" section
✓ Owner can click "Remove" to unshare
```

### Test Shared User Access
```
✓ Shared user sees student in list with "Shared" label
✓ Shared user can view dashboard
✓ Shared user can add drives
✓ Shared user can delete drives
✓ Shared user can download PDF
✓ Shared user cannot see "Share" button
✓ Shared user cannot edit student name/state
✓ Shared user cannot delete the student
```

### Test After Unshare
```
✓ Shared user no longer sees the student
✓ Original owner still sees all data
✓ Drive entries still exist for owner
```

## File Changes Summary

### Modified Files (3)
- `src/context/AppContext.jsx` - Sharing functions + multi-user loading
- `src/pages/Dashboard.jsx` - Share button + shared users UI
- `src/pages/Login.jsx` - Invitation processing on signup
- `src/pages/Students.jsx` - Shared student display

### New Files (5)
- `src/components/ShareModal.jsx` - Email input modal
- `src/utils/invitations.js` - Email utilities
- `scripts/migrate-add-sharing-fields.js` - Data migration
- `FIRESTORE_SECURITY_RULES.md` - Security rules
- `STUDENT_SHARING_IMPLEMENTATION.md` - Full documentation

## Troubleshooting

### "Permission denied" when accessing shared student
- Verify Firestore rules are published
- Check `sharedWith` array contains the user's email
- Ensure user is signed in with correct email

### Share button not visible
- Check you're logged in as the owner
- Refresh the page
- Check browser console for errors

### Email not received
- Confirm Cloud Function is deployed (or backend running)
- Check SendGrid API key is set
- Verify `SENDGRID_FROM_EMAIL` is a verified sender

### Shared student not appearing after signup
- Check invitation email matches signup email (case-insensitive)
- Refresh browser
- Sign out and back in
- Check Firestore rules are correct

## Next Steps

1. ✅ Run migration script
2. ✅ Update Firestore rules
3. ✅ Set up email sending (optional but recommended)
4. ✅ Test the feature with test accounts
5. ✅ Deploy to production

## Important Notes

**Data Safety:**
- All existing students preserved
- No data loss during migration
- Can always unshare to revoke access

**Security:**
- Only owner can share/unshare
- Shared users can't modify student info
- Drives persist across share/unshare
- Email-based access control

**Performance:**
- Loading shared students queries all users (may be slow with many users)
- Future: Consider optimizing with user directory

## Getting Help

1. **Read the docs:** See `STUDENT_SHARING_IMPLEMENTATION.md` for detailed info
2. **Check browser console:** F12 → Console tab shows debug logs
3. **Review Firestore:** Firebase Console shows actual data structure
4. **Test rules:** Firebase Console → Firestore → Rules → Test

## Rollback Plan

If something goes wrong:

1. **Revert code:** `git revert <commit-hash>`
2. **Restore data:** Use Firestore backup from Firebase Console
3. **Restore rules:** Use previous rules version

The migration is safe - it only adds new fields, never deletes data.

---

**That's it!** Your students can now be shared. Questions? See `STUDENT_SHARING_IMPLEMENTATION.md` for comprehensive documentation.
