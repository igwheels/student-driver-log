# Firestore Security Rules for Student Sharing Feature

This document outlines the Firestore security rules needed to support the student sharing feature.

## Rules Overview

The sharing feature requires these security rules in the Firebase Console:

1. Users can read and write their own students
2. Users can read students shared with them
3. Users can add/delete drives for students they own or are shared with
4. Users cannot modify shared student info (name, state) - only owner can
5. Users can read invitations sent to their email

## Firestore Rules

Update your Firestore security rules in the Firebase Console to:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - each user's data is private
    match /users/{userId} {
      // Only the user can read/write their own data
      allow read, write: if request.auth.uid == userId;

      match /students/{studentId} {
        // Allow read if:
        // 1. User owns the student (ownerId == userId)
        // 2. Student is shared with user's email
        allow read: if
          request.auth.uid == resource.data.ownerId ||
          (resource.data.sharedWith != null &&
           resource.data.sharedWith.size() > 0 &&
           request.auth.token.email in resource.data.sharedWith[*].email);

        // Only owner can write to student (add/update fields)
        allow write: if request.auth.uid == resource.data.ownerId;

        // Create new students
        allow create: if request.auth.uid == request.resource.data.ownerId &&
                         request.resource.data.ownerId == resource.id;

        // Drives (logs) subcollection
        match /logs/{logId} {
          // Allow read if user owns the student or it's shared with them
          let studentData = get(/databases/$(database)/documents/users/$(userId)/students/$(studentId)).data;
          allow read: if
            request.auth.uid == studentData.ownerId ||
            (studentData.sharedWith != null &&
             request.auth.token.email in studentData.sharedWith[*].email);

          // Allow create/delete if user owns the student or it's shared with them
          allow create, delete: if
            request.auth.uid == studentData.ownerId ||
            (studentData.sharedWith != null &&
             request.auth.token.email in studentData.sharedWith[*].email);

          // Allow update only if user owns the student
          allow update: if request.auth.uid == studentData.ownerId;
        }
      }
    }

    // Invitations collection
    match /invitations/{invitationId} {
      // Users can read invitations sent to their email
      allow read: if request.auth.token.email == resource.data.email;

      // Only the system (backend) can create invitations
      // In practice, you might want to:
      // 1. Use a Cloud Function as the backend that sets custom claims
      // 2. Create a service role for backend operations
      allow create: if false; // Should only be created by backend/Cloud Function

      // Users can't directly modify invitations
      allow update, delete: if false; // Should only be updated by backend/Cloud Function
    }
  }
}
```

## Implementation Notes

### Critical Fields for Sharing to Work:

Each student document MUST have:
```javascript
{
  id: "student-id",
  firstName: "John",
  lastName: "Doe",
  state: "CA",
  ownerId: "firebase-uid-of-owner",  // REQUIRED
  sharedWith: [
    {
      email: "parent@example.com",
      addedAt: "2025-08-18T12:00:00Z"
    }
  ]
}
```

### Data Migration:

To add `ownerId` and `sharedWith` to existing students:

```javascript
// In a one-time migration script
const batch = db.batch();
const usersRef = collection(db, 'users');
const usersSnap = await getDocs(usersRef);

for (const userDoc of usersSnap.docs) {
  const studentsRef = collection(userDoc.ref, 'students');
  const studentsSnap = await getDocs(studentsRef);

  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data();
    // Only update if ownerId or sharedWith is missing
    if (!student.ownerId || !student.sharedWith) {
      batch.update(studentDoc.ref, {
        ownerId: student.ownerId || userDoc.id,
        sharedWith: student.sharedWith || [],
      });
    }
  }
}

await batch.commit();
console.log('Migration complete');
```

### Email-based Access:

The rules use `request.auth.token.email` to check if a user should have access. This email must be the same email they sign up with or the email associated with their Google account.

## Testing the Rules

To test if rules are working correctly:

1. Create two test users (A and B) with different emails
2. User A creates a student
3. User A shares the student with User B's email
4. User B signs in and verifies they can see the student
5. User B tries to modify the student name - should fail
6. User B adds a drive log - should succeed
7. User B tries to delete a drive - should succeed
8. User A unshares with User B
9. User B tries to access the student - should fail

## Backend Setup for Email Sending

See `src/utils/invitations.js` for examples of:
1. Cloud Function that listens to invitation creation and sends emails
2. Express endpoint that sends invitation emails
3. Email template generation

The backend should:
1. Listen to new invitations in Firestore
2. Generate a signup link with the invitation email
3. Send an email using SendGrid/Nodemailer
4. Mark the invitation as `emailSent: true`

## Troubleshooting

### "Permission denied" when accessing shared student
- Verify `sharedWith` array contains the user's email
- Check that `ownerId` is set correctly
- Ensure the user is signed in with the correct email

### Invitations not appearing after signup
- Verify invitations have `accepted: false` before signup
- Check that the signup email matches the invitation email (case-insensitive)
- Ensure the login code calls the invitation processing function

### Shared users can't add drives
- Verify the `allow create` rule includes the shared user check
- Check that the student's `sharedWith` array is properly populated
- Ensure `ownerId` is set on the student document

## Production Considerations

1. **Email Verification**: Consider requiring email verification for invitations
2. **Invitation Expiry**: Set a TTL on invitations (e.g., delete after 30 days if not accepted)
3. **Audit Logging**: Log who shares with whom for security/privacy reasons
4. **Rate Limiting**: Limit how many invitations a user can send to prevent spam
5. **Revocation**: Consider adding ability to revoke access immediately from shared user's access
