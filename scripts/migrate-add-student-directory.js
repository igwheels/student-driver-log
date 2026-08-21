/**
 * One-time migration: creates a studentDirectory/{studentId} entry for every
 * existing student, so the "does a dashboard for this email already exist?"
 * check in AddStudent.jsx (see findExistingStudentByEmail in AppContext.jsx)
 * also covers students created before that feature existed. New students get
 * this entry automatically going forward. Safe to re-run — existing entries
 * are overwritten with the same data.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node scripts/migrate-add-student-directory.js
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const students = await db.collectionGroup('students').get();
  let written = 0;

  for (const studentDoc of students.docs) {
    const student = studentDoc.data();
    const ownerId = student.ownerId;
    if (!ownerId) {
      console.warn(`Skipping ${student.firstName} ${student.lastName}: no ownerId (run migrate-add-sharing-fields.js first)`);
      continue;
    }

    await db.collection('studentDirectory').doc(studentDoc.id).set({
      studentId: studentDoc.id,
      ownerId,
      ownerName: student.ownerName || '',
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email: (student.email || '').trim().toLowerCase(),
    });
    console.log(`Directory entry written: ${student.firstName} ${student.lastName}`);
    written++;
  }

  console.log(`\nMigration complete. ${written} directory entr${written === 1 ? 'y' : 'ies'} written.`);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
