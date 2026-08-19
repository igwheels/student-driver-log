/**
 * One-time migration: adds ownerId, ownerName, ownerEmail, sharedWith, and
 * sharedWithEmails to existing student documents so the sharing feature
 * (and weekly emails to everyone with dashboard access) works on data that
 * predates it. Safe to re-run — already-migrated students are skipped.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node scripts/migrate-add-sharing-fields.js
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const authAdmin = getAuth();

async function main() {
  // Build a uid -> display name/email lookup from real Firebase Auth accounts,
  // so existing students get an accurate ownerName/ownerEmail.
  const userNames = {};
  const userEmails = {};
  const listUsersResult = await authAdmin.listUsers();
  for (const u of listUsersResult.users) {
    userNames[u.uid] = u.displayName || (u.email ? u.email.split('@')[0] : 'Owner');
    userEmails[u.uid] = u.email || '';
  }

  let migrated = 0;

  // Iterate real Firebase Auth accounts directly, not db.collection('users')
  // — this app never writes a document at users/{uid} itself, only nested
  // paths like users/{uid}/students/{id}, so users/{uid} was never a real
  // document and that collection is always empty.
  for (const u of listUsersResult.users) {
    const userId = u.uid;
    const studentsSnap = await db.collection('users').doc(userId).collection('students').get();

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const needsMigration =
        !student.ownerId ||
        !('sharedWith' in student) ||
        !('sharedWithEmails' in student) ||
        !student.ownerName ||
        !student.ownerEmail;

      if (!needsMigration) {
        console.log(`Already migrated: ${student.firstName} ${student.lastName}`);
        continue;
      }

      const sharedWith = student.sharedWith || [];
      console.log(`Migrating: ${student.firstName} ${student.lastName} (owner ${userId})`);
      await studentDoc.ref.update({
        ownerId: student.ownerId || userId,
        ownerName: student.ownerName || userNames[userId] || 'Owner',
        ownerEmail: student.ownerEmail || userEmails[userId] || '',
        sharedWith,
        sharedWithEmails: student.sharedWithEmails || sharedWith.map((s) => s.email),
      });
      migrated++;
    }
  }

  console.log(`\nMigration complete. ${migrated} student(s) updated.`);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
