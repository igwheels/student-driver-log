/**
 * Migration script to add ownerId and sharedWith fields to existing students
 *
 * This ensures backward compatibility with existing data before the sharing feature.
 * Run this script once to migrate all students.
 *
 * Usage:
 *   node scripts/migrate-add-sharing-fields.js
 *
 * Prerequisites:
 *   - Set FIREBASE_SERVICE_ACCOUNT env variable with your Firebase service account JSON
 *   - Install firebase-admin if not already installed
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, writeBatch, collection, getDocs } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  console.error('Set it with: export FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrateStudents() {
  try {
    console.log('Starting migration to add sharing fields...');

    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);

    let totalStudentsMigrated = 0;
    let batchCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const studentsRef = collection(userDoc.ref, 'students');
      const studentsSnap = await getDocs(studentsRef);

      let batch = writeBatch(db);
      let batchSize = 0;

      for (const studentDoc of studentsSnap.docs) {
        const student = studentDoc.data();

        // Check if migration is needed
        if (!student.ownerId || !student.hasOwnProperty('sharedWith')) {
          console.log(`Migrating student: ${student.firstName} ${student.lastName} (${userId})`);

          batch.update(studentDoc.ref, {
            ownerId: student.ownerId || userId,
            sharedWith: student.sharedWith || [],
          });

          batchSize++;
          totalStudentsMigrated++;

          // Firestore has a limit of 500 writes per batch
          if (batchSize >= 500) {
            await batch.commit();
            console.log(`  Committed batch ${++batchCount} (${batchSize} updates)`);
            batch = writeBatch(db);
            batchSize = 0;
          }
        } else {
          console.log(`Already migrated: ${student.firstName} ${student.lastName}`);
        }
      }

      // Commit remaining batch
      if (batchSize > 0) {
        await batch.commit();
        console.log(`  Committed batch ${++batchCount} (${batchSize} updates)`);
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`Total students migrated: ${totalStudentsMigrated}`);
    console.log(`Total batches committed: ${batchCount}`);

    if (totalStudentsMigrated === 0) {
      console.log('All students already have the required fields.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateStudents();
