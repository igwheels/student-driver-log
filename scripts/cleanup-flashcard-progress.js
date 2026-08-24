/**
 * One-off cleanup: deletes the flashcardProgress subcollections left behind
 * by the removed permit-practice feature.
 *
 * Those documents live at
 *   users/{ownerId}/students/{studentId}/flashcardProgress/{cardId}
 * and are now unreachable from the app — the rule that permitted them was
 * removed with the feature, so the client cannot read or delete them. The
 * admin SDK bypasses security rules, which is why this has to run here
 * rather than in the app.
 *
 * Dry run by default: it lists what it would delete and changes nothing.
 * Pass --confirm to actually delete.
 *
 *   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
 *   node scripts/cleanup-flashcard-progress.js              # dry run
 *   node scripts/cleanup-flashcard-progress.js --confirm    # delete
 *
 * Safe to re-run; a second pass finds nothing. Delete this script once the
 * cleanup is done — it has no other purpose.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

const confirmed = process.argv.includes('--confirm');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Firestore caps a batched write at 500 operations.
const BATCH_LIMIT = 500;

async function main() {
  // A collection-group query finds every flashcardProgress document wherever
  // it lives, without having to walk users -> students by hand.
  const snap = await db.collectionGroup('flashcardProgress').get();

  if (snap.empty) {
    console.log('No flashcardProgress documents found. Nothing to clean up.');
    return;
  }

  // Group by owning student so the report is readable rather than a wall of
  // card ids.
  const byStudent = new Map();
  for (const doc of snap.docs) {
    // users/{ownerId}/students/{studentId}/flashcardProgress/{cardId}
    const parts = doc.ref.path.split('/');
    const key = `${parts[1]}/${parts[3]}`;
    byStudent.set(key, (byStudent.get(key) ?? 0) + 1);
  }

  console.log(`Found ${snap.size} document(s) across ${byStudent.size} student(s):\n`);
  for (const [key, count] of byStudent) {
    const [ownerId, studentId] = key.split('/');
    console.log(`  owner ${ownerId}  student ${studentId}  ${count} card(s)`);
  }

  if (!confirmed) {
    console.log('\nDry run — nothing deleted.');
    console.log('Re-run with --confirm to delete these documents.');
    return;
  }

  console.log('\nDeleting…');
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += Math.min(BATCH_LIMIT, snap.docs.length - i);
    console.log(`  ${deleted}/${snap.size}`);
  }

  console.log(`\nDeleted ${deleted} document(s).`);
  console.log('Re-run without --confirm to verify nothing remains.');
}

main().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
