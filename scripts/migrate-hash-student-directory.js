/**
 * One-time migration: re-keys studentDirectory from studentId to a hash of
 * the student's email, so the duplicate-email check can read one known
 * document instead of querying the collection. Querying forced the security
 * rules to permit listing, which let any signed-in user enumerate every
 * student's name and email — see src/utils/emailHash.js.
 *
 * What this touches:
 *   - READS  users/{uid}/students/**            (never written)
 *   - READS  studentDirectory/**
 *   - WRITES studentDirectory/{sha256(email)}   (the new entries)
 *   - DELETES studentDirectory/{studentId}      (only the old-style entries
 *                                                it has already replaced)
 *
 * Student records and drive logs are never modified. Directory entries are
 * derived data, rebuilt from the students themselves on every run.
 *
 * Safe to re-run. Pass --dry-run first to see the plan without writing.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
 *     node scripts/migrate-hash-student-directory.js [--dry-run]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { emailDocId } from '../src/utils/emailHash.js';

const DRY_RUN = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no writes or deletes will be performed.\n');

  const students = await db.collectionGroup('students').get();

  // One entry per email. Where two students share an address, keep the
  // earliest-created so the result doesn't depend on iteration order, and say
  // so — the loser stays a perfectly usable student, it just isn't the one the
  // directory points at.
  const byEmailKey = new Map();
  // Every student we successfully read, winners and duplicate-losers alike.
  // Old-style entries are keyed by studentId, so this is what decides which
  // of them are safe to clean up — a loser's old entry is just as stale as a
  // winner's once the hashed entries exist.
  const seenStudentIds = new Set();
  let skipped = 0;

  for (const studentDoc of students.docs) {
    const student = studentDoc.data();
    const email = (student.email || '').trim().toLowerCase();

    if (!student.ownerId) {
      console.warn(`Skipping ${student.firstName} ${student.lastName}: no ownerId (run migrate-add-sharing-fields.js first)`);
      skipped++;
      continue;
    }
    if (!email) {
      console.warn(`Skipping ${student.firstName} ${student.lastName}: no email`);
      skipped++;
      continue;
    }

    seenStudentIds.add(studentDoc.id);

    const key = await emailDocId(email);
    const entry = {
      studentId: studentDoc.id,
      ownerId: student.ownerId,
      ownerName: student.ownerName || '',
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email,
      createdAt: student.createdAt || '',
    };

    const existing = byEmailKey.get(key);
    if (!existing) {
      byEmailKey.set(key, entry);
      continue;
    }
    const winner = (existing.createdAt || '') <= (entry.createdAt || '') ? existing : entry;
    const loser = winner === existing ? entry : existing;
    console.warn(
      `Duplicate email ${email}: keeping ${winner.firstName} ${winner.lastName} (${winner.studentId}), ` +
        `not ${loser.firstName} ${loser.lastName} (${loser.studentId})`
    );
    byEmailKey.set(key, winner);
  }

  let written = 0;
  for (const [key, entry] of byEmailKey) {
    const { createdAt, ...record } = entry;
    if (DRY_RUN) {
      console.log(`Would write studentDirectory/${key} -> ${record.firstName} ${record.lastName}`);
    } else {
      await db.collection('studentDirectory').doc(key).set(record);
      console.log(`Wrote studentDirectory/${key} -> ${record.firstName} ${record.lastName}`);
    }
    written++;
  }

  // Remove the old studentId-keyed entries, now that hashed ones exist. A doc
  // whose ID matches a studentId we just migrated is definitionally old-style,
  // since the new IDs are 64-char hex hashes.
  const directory = await db.collection('studentDirectory').get();
  let removed = 0;

  for (const entryDoc of directory.docs) {
    const isHashKeyed = /^[0-9a-f]{64}$/.test(entryDoc.id);
    if (isHashKeyed) continue;
    if (!seenStudentIds.has(entryDoc.id)) {
      console.warn(`Leaving old entry studentDirectory/${entryDoc.id} in place: no migrated student matches it`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`Would delete old entry studentDirectory/${entryDoc.id}`);
    } else {
      await entryDoc.ref.delete();
      console.log(`Deleted old entry studentDirectory/${entryDoc.id}`);
    }
    removed++;
  }

  console.log(
    `\n${DRY_RUN ? 'Dry run complete' : 'Migration complete'}. ` +
      `${written} hashed entr${written === 1 ? 'y' : 'ies'}, ` +
      `${removed} old entr${removed === 1 ? 'y' : 'ies'} removed, ${skipped} student(s) skipped.`
  );
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
