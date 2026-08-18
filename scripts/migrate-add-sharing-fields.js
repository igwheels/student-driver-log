/**
 * One-time migration: adds ownerId, ownerName, sharedWith, and sharedWithEmails
 * to existing student documents so the sharing feature works on data that
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
  // so existing students get an accurate ownerName for the "Shared by" label.
  const userNames = {};
  const listUsersResult = await authAdmin.listUsers();
  for (const u of listUsersResult.users) {
    userNames[u.uid] = u.displayName || (u.email ? u.email.split('@')[0] : 'Owner');
  }

  const usersSnap = await db.collection('users').get();
  let migrated = 0;

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const studentsSnap = await userDoc.ref.collection('students').get();

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const needsMigration =
        !student.ownerId || !('sharedWith' in student) || !('sharedWithEmails' in student) || !student.ownerName;

      if (!needsMigration) {
        console.log(`Already migrated: ${student.firstName} ${student.lastName}`);
        continue;
      }

      const sharedWith = student.sharedWith || [];
      console.log(`Migrating: ${student.firstName} ${student.lastName} (owner ${userId})`);
      await studentDoc.ref.update({
        ownerId: student.ownerId || userId,
        ownerName: student.ownerName || userNames[userId] || 'Owner',
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
