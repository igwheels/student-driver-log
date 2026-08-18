# Student Sharing Feature Implementation Guide

This document describes the complete implementation of the student sharing feature for the Student Driver Log web app.

## Overview

The sharing feature allows users to share their students' driving logs with other users (e.g., co-parents, guardians). 

### Features Implemented

1. **Share by Email**: Users can share students by entering another user's email address
2. **Automatic Access**: If the recipient has an account, they get access immediately
3. **Invitation Emails**: If the recipient doesn't have an account, they receive an invitation email with a signup link
4. **Shared Student Access**: Shared users can:
   - View the student's dashboard and driving statistics
   - Add new drives
   - Delete drives
   - Export driving logs as PDF
5. **Limited Permissions**: Shared users cannot:
   - Edit student name or state
   - Delete the student
   - Modify sharing settings
6. **Data Preservation**: When unsharing a student, all drive entries remain and are preserved in the owner's data

## Files Modified

### 1. `src/context/AppContext.jsx`
**Changes**: Added sharing functionality and multi-user student loading

- **New state management**:
  - Students now load both owned students and students shared with the current user
  - Each student includes `ownerId` and `sharedWith` fields

- **New functions**:
  - `isOwner(studentId)`: Check if current user owns a student
  - `shareStudent(studentId, recipientEmail)`: Share a student with another user's email
  - `unshareStudent(studentId, recipientEmail)`: Remove access for a shared user
  - `checkIfUserExists(email)`: Check if a user has a Firebase account (returns false if unknown)

- **Enhanced functions**:
  - `addStudent()`: Now includes `ownerId` and `sharedWith` fields
  - `addLog()`: Uses student's `ownerId` to save to correct Firestore location
  - `deleteStudent()`: Uses student's `ownerId`
  - `deleteDrive()`: Uses student's `ownerId`

- **Enhanced loading**:
  - Loads students the user owns (from `users/{uid}/students`)
  - Loads students shared with the user's email (by querying all users and checking `sharedWith` arrays)

### 2. `src/components/ShareModal.jsx` (New File)
Modal component for sharing students

- Email input field with validation
- Loading state while sharing
- Error and success messages
- Cancel and Share buttons

### 3. `src/pages/Dashboard.jsx`
**Changes**: Added sharing UI and shared user management

- **New imports**: Added `ShareModal` component
- **New state**:
  - `showShareModal`: Controls visibility of share modal
  - `sharedUsers`: Lists users the student is shared with

- **New handler**:
  - `handleUnshare()`: Remove access for a shared user

- **New UI elements**:
  - "Shared" badge for students shared with current user
  - "Share" button for student owners (only visible to owner)
  - "Shared with" section showing all users with access
  - Remove link for each shared user

### 4. `src/pages/Login.jsx`
**Changes**: Added invitation processing after signup

- **Enhanced imports**: Added Firestore functions
- **Updated `completeLogin()`**: Now async to handle invitation processing
  - Queries for invitations sent to the new user's email
  - Marks invitations as `accepted: true`
  - Automatically adds new user to student's `sharedWith` array

### 5. `src/pages/Students.jsx`
**Changes**: Enhanced student list display

- **New section**: "Shared with you" section for shared students
- **Visual organization**: Separates owned students from shared students
- **Shared indicator**: Shows "Shared" label on shared student cards

## New Files Created

### 1. `src/utils/invitations.js`
Utility functions for invitation email handling

- `generateInvitationEmailContent()`: HTML email template for invitations
- `generateInvitationEmailText()`: Plain text email template
- `generateSignupLink()`: Creates signup URL with email pre-filled
- Includes code examples for Cloud Functions and Express backends

### 2. `scripts/migrate-add-sharing-fields.js`
Data migration script

- Adds `ownerId` and `sharedWith` fields to existing students
- Uses Firebase Admin SDK
- Safely handles batch operations
- Reports on migration progress

### 3. `FIRESTORE_SECURITY_RULES.md`
Documentation for Firestore security rules

- Detailed rule explanations
- Access control logic for owned and shared students
- Drive (logs) subcollection rules
- Data migration examples
- Production considerations

### 4. `STUDENT_SHARING_IMPLEMENTATION.md` (this file)
Complete implementation documentation

## Data Structure

### Student Document
```javascript
{
  id: "student-id",
  firstName: "John",
  lastName: "Doe",
  state: "CA",
  email: "student@example.com",
  
  // Added fields for sharing
  ownerId: "firebase-uid",           // Required: ID of the student owner
  sharedWith: [                       // Required: Array of users with access
    {
      email: "parent2@example.com",
      addedAt: "2025-08-18T12:00:00Z"
    }
  ]
}
```

### Invitation Document
```javascript
{
  id: "invitation-id",
  email: "parent@example.com",        // Email the invitation was sent to
  studentId: "student-id",            // Student being shared
  studentName: "John Doe",            // Student's full name
  ownerId: "firebase-uid",            // Owner's Firebase UID
  ownerName: "Parent Name",           // Owner's name
  ownerEmail: "owner@example.com",    // Owner's email
  createdAt: "2025-08-18T12:00:00Z",  // When the invitation was created
  accepted: false,                    // Whether the user has signed up
  acceptedAt: null,                   // When they signed up (if accepted)
  emailSent: false,                   // Whether email was sent (set by backend)
  sentAt: null                        // When email was sent (set by backend)
}
```

## Setup Instructions

### Step 1: Backup Existing Data
Before running the migration, backup your Firestore data through the Firebase Console.

### Step 2: Run Data Migration
```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
node scripts/migrate-add-sharing-fields.js
```

This adds `ownerId` and `sharedWith` fields to all existing students.

### Step 3: Update Firestore Security Rules
1. Go to Firebase Console → Firestore Database → Rules
2. Replace the rules with the content from `FIRESTORE_SECURITY_RULES.md`
3. Publish the rules

### Step 4: Set Up Email Sending (Backend)
Choose one of the following:

#### Option A: Cloud Functions (Firebase)
Create `functions/index.js`:
```javascript
const functions = require('firebase-functions');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendInvitationEmail = functions.firestore
  .document('invitations/{docId}')
  .onCreate(async (snap) => {
    // See src/utils/invitations.js for full implementation
  });
```

Deploy with:
```bash
firebase deploy --only functions
```

#### Option B: Express Backend
Create an endpoint that processes invitations. See `src/utils/invitations.js` for example code.

### Step 5: Configure Environment Variables
Set these in your deployment environment:
- `SENDGRID_API_KEY`: Your SendGrid API key
- `SENDGRID_FROM_EMAIL`: The email address to send invitations from
- `APP_URL`: Your app's URL (for generating signup links)

## User Flow

### Sharing a Student
1. Owner opens Dashboard for their student
2. Owner clicks "Share" button
3. Owner enters recipient's email in modal
4. System checks if recipient exists
5. If recipient exists: They immediately get access
6. If recipient doesn't exist: Invitation is created and email is sent
7. Success message shown to owner

### Receiving Access (Existing User)
1. User A (owner) shares student with User B's email
2. User B is already signed up
3. User B signs in
4. Access is checked via Firestore security rules
5. User B sees the shared student in their student list
6. User B can view and add drives

### Receiving Access (New User)
1. User A (owner) shares student with User B's email
2. User B receives invitation email
3. User B clicks link in email
4. User B signs up with their email
5. System processes pending invitations
6. User B automatically gets access to shared student
7. User B sees the shared student in their student list

## Firestore Security Rules Summary

The security rules ensure:
- **Read Access**: User can read students they own OR students shared with their email
- **Write Access**: Only the owner can modify student information
- **Drive Access**: Both owner and shared users can add/delete drives
- **Invitation Access**: Users can only see invitations sent to their email

See `FIRESTORE_SECURITY_RULES.md` for complete rule definitions.

## Backward Compatibility

The implementation is fully backward compatible:
- Existing students without `ownerId` are assigned to the logged-in user
- Existing students without `sharedWith` get an empty array
- The migration script safely adds these fields without losing data
- Old code continues to work without modification

## Testing Checklist

### Data Migration
- [ ] Run migration script and verify all students get `ownerId` and `sharedWith`
- [ ] Verify existing drive entries are not affected
- [ ] Check that all students are still visible to their owners

### Sharing UI
- [ ] Owner can see "Share" button on their students
- [ ] Non-owners don't see "Share" button
- [ ] Clicking "Share" opens modal
- [ ] Can enter valid email and share
- [ ] "Shared with" section appears after sharing
- [ ] Can click "Remove" to unshare

### Access Control
- [ ] Shared user can see the student in their list
- [ ] Shared user can view dashboard and statistics
- [ ] Shared user can add drives
- [ ] Shared user can delete drives
- [ ] Shared user can download PDF
- [ ] Shared user CANNOT see "Share" button
- [ ] Shared user CANNOT edit student name/state
- [ ] Shared user CANNOT delete the student

### Invitations
- [ ] Invitation email is received by recipient (requires backend setup)
- [ ] Clicking invitation link pre-fills email
- [ ] After signup with invited email, student appears in list
- [ ] Student shows as "Shared" indicator

### Unsharing
- [ ] Owner can remove shared user
- [ ] Removed user no longer sees the student
- [ ] Drive entries persist after unsharing
- [ ] Original owner still sees all data

## Troubleshooting

### Students not appearing for shared user
- Verify `sharedWith` array contains the user's email (case-insensitive)
- Check that `ownerId` is set correctly
- Ensure user is signed in with correct email
- Check Firestore rules are updated and published

### Share button not working
- Check Firestore rules allow writing to student document
- Verify `ownerId` matches current user's ID
- Check browser console for error messages

### Invitations not being sent
- Verify backend function/endpoint is deployed
- Check SendGrid API key is set
- Review backend logs for errors
- Verify `SENDGRID_FROM_EMAIL` is a verified sender in SendGrid

### User can't sign up with invited email
- Check that signup page/component exists
- Verify invitation email is passed through URL
- Ensure login processes invitations after signup
- Check Firestore rules allow reading invitations by email

## Performance Considerations

### Firestore Queries
- Loading shared students requires querying all users (expensive)
- Consider implementing a User Profiles collection for faster lookups
- In production, cache or pre-compute shared student lists

### Future Optimization
```javascript
// Instead of querying all users, maintain a user directory:
// users/{email}/metadata with uid
// Then query sharedWith users by email directly
```

## Security Considerations

1. **Email Verification**: Consider requiring email verification for invitations
2. **Invitation Expiry**: Set TTL on invitations (30 days default)
3. **Rate Limiting**: Limit sharing to prevent spam
4. **Audit Logging**: Log all share/unshare actions
5. **Access Revocation**: Can revoke access immediately from shared user

## Future Enhancements

1. **Roles**: Add editor/viewer roles for different permission levels
2. **Bulk Sharing**: Share with multiple users at once
3. **Sharing History**: Track who shared when
4. **Sharing Requests**: Allow users to request access instead of owner inviting
5. **Email Notifications**: Notify owner when shared user adds drives
6. **Sharing Expiry**: Automatic access revocation after X days
7. **SSO Integration**: Support OAuth for easy access grants

## Support & Debugging

Enable debug logging to troubleshoot issues:

```javascript
// In AppContext.jsx or components
console.log('Loading students for user:', user.id);
console.log('Owned students:', ownedStudents);
console.log('Shared students:', sharedStudents);
console.log('Sharing attempt:', { studentId, recipientEmail });
```

Check Firebase Console:
- Firestore Database → Check document structure
- Firebase Rules Playground → Test rule logic
- Cloud Functions → Review logs

## Contact & Questions

For implementation questions or issues:
1. Review this documentation
2. Check FIRESTORE_SECURITY_RULES.md
3. Review code comments in src/context/AppContext.jsx
4. Check browser console for error messages
5. Review Firebase Admin panel for data issues
