/**
 * Recovery script: finds drive logs left orphaned under a stale student
 * document id after the id-consistency fix in commit a1462c4.
 *
 * Background: before that fix, addStudent() used addDoc(), which lets
 * Firestore assign its own document id — separate from the "id" field the
 * app also stored inside the document. addLog() used that in-memory id (not
 * Firestore's real one) to build its storage path, so historical drive logs
 * ended up at users/{ownerId}/students/{STALE_ID}/logs/* — a path with no
 * matching student document. After the fix, the app correctly reads/writes
 * using the real Firestore document id, so those older logs became
 * invisible to the app (but were never deleted — they're still in
 * Firestore).
 *
 * This script finds those orphaned "logs" subcollections under a given
 * owner (by email) and copies their contents into the named student's real
 * logs subcollection. It never deletes or overwrites anything at the
 * original location, and skips any log id already present at the
 * destination — safe to run more than once.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
 *   node scripts/recover-orphaned-logs.js --email=igwheels@gmail.com --first=Wren --last=Wheeler
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const ownerEmail = args.email;
const firstName = args.first;
const lastName = args.last;

if (!ownerEmail || !firstName || !lastName) {
  console.error(
    'Usage: node scripts/recover-orphaned-logs.js --email=owner@example.com --first=Wren --last=Wheeler'
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const authAdmin = getAuth();

async function main() {
  const ownerUser = await authAdmin.getUserByEmail(ownerEmail);
  const ownerId = ownerUser.uid;
  console.log(`Owner ${ownerEmail} -> uid ${ownerId}`);

  const studentsSnap = await db.collection('users').doc(ownerId).collection('students').get();
  const realStudent = studentsSnap.docs.find(
    (d) => d.data().firstName === firstName && d.data().lastName === lastName
  );

  if (!realStudent) {
    console.error(`No student named ${firstName} ${lastName} found under this owner.`);
    process.exit(1);
  }

  const realStudentId = realStudent.id;
  console.log(`Found ${firstName} ${lastName} at real student id: ${realStudentId}`);

  const existingLogsSnap = await realStudent.ref.collection('logs').get();
  console.log(`Currently visible logs for this student: ${existingLogsSnap.size}`);

  // Search every "logs" document in the whole project (collection group),
  // then keep only the ones under this owner's path.
  const allLogs = await db.collectionGroup('logs').get();
  const prefix = `users/${ownerId}/students/`;

  const byStudentId = new Map();
  for (const logDoc of allLogs.docs) {
    const path = logDoc.ref.path; // users/UID/students/STUDENT_ID/logs/LOG_ID
    if (!path.startsWith(prefix)) continue;
    const studentId = path.slice(prefix.length).split('/')[0];
    if (!byStudentId.has(studentId)) byStudentId.set(studentId, []);
    byStudentId.get(studentId).push(logDoc);
  }

  console.log('\nLog groups found under this owner:');
  for (const [studentId, logs] of byStudentId) {
    const tag = studentId === realStudentId ? '(current, correct location)' : '(orphaned - different id)';
    console.log(`  ${studentId}: ${logs.length} log(s) ${tag}`);
  }

  const orphanedGroups = [...byStudentId.entries()].filter(([studentId]) => studentId !== realStudentId);

  if (orphanedGroups.length === 0) {
    console.log('\nNo orphaned log groups found under this owner. Nothing to restore.');
    return;
  }

  let restored = 0;
  let skipped = 0;
  for (const [studentId, logs] of orphanedGroups) {
    console.log(`\nRestoring ${logs.length} log(s) from orphaned id ${studentId} into ${realStudentId}...`);
    for (const logDoc of logs) {
      const destRef = realStudent.ref.collection('logs').doc(logDoc.id);
      const destSnap = await destRef.get();
      if (destSnap.exists) {
        skipped++;
        continue;
      }
      await destRef.set(logDoc.data());
      restored++;
    }
  }

  console.log(`\nDone. Restored ${restored} log(s), skipped ${skipped} already present at the destination.`);
  console.log('Nothing was deleted from the orphaned location - verify in the app, then it is safe to leave as-is.');
}

main().catch((error) => {
  console.error('Recovery failed:', error);
  process.exit(1);
});
