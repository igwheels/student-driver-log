/**
 * DEV-62: backfills sharedWithUids (and the emailToUid directory it's
 * resolved from) so existing shares don't have to wait for every recipient
 * to sign in again before access is keyed off their stable uid instead of
 * whichever email address Firebase currently reports for them.
 *
 * Two passes, both idempotent — safe to re-run at any time as new accounts
 * and shares appear:
 *
 *   1. emailToUid/{email} -> { uid } for every real Firebase Auth account,
 *      mirroring what src/context/AppContext.jsx now writes on every
 *      sign-in. Without this pass, shareStudent()'s at-share-time uid
 *      lookup only finds accounts that have signed in since this feature
 *      shipped; this backfills everyone who existed before it.
 *   2. For every student document, resolve a uid for each sharedWith entry
 *      that doesn't have one yet (via the map built in pass 1) and rewrite
 *      sharedWith/sharedWithUids. An entry whose recipient has no account
 *      yet is left with uid: null — untouched here, it self-resolves the
 *      normal way the first time they sign in (see firestore.rules'
 *      self-resolve rule and loadFromFirestore in AppContext.jsx).
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
 *     node scripts/migrate-backfill-shared-uids.js [--dry-run]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!serviceAccount.project_id) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const authAdmin = getAuth();

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no writes will be performed.\n');

  const listUsersResult = await authAdmin.listUsers();
  const uidByEmail = new Map();
  for (const u of listUsersResult.users) {
    if (u.email) uidByEmail.set(normalizeEmail(u.email), u.uid);
  }

  // Pass 1: emailToUid directory.
  let directoryWrites = 0;
  for (const [email, uid] of uidByEmail) {
    if (DRY_RUN) {
      console.log(`Would write emailToUid/${email} -> ${uid}`);
    } else {
      await db.collection('emailToUid').doc(email).set({ uid });
    }
    directoryWrites++;
  }

  // Pass 2: resolve uids on existing shares.
  const studentsSnap = await db.collectionGroup('students').get();
  let studentsUpdated = 0;
  let uidsResolved = 0;

  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data();
    const sharedWith = student.sharedWith || [];
    if (sharedWith.length === 0) continue;

    let changed = false;
    const resolvedSharedWith = sharedWith.map((entry) => {
      if (entry.uid) return entry;
      const uid = uidByEmail.get(normalizeEmail(entry.email));
      if (!uid) return entry;
      changed = true;
      uidsResolved++;
      return { ...entry, uid };
    });

    if (!changed) continue;

    const sharedWithUids = resolvedSharedWith.map((e) => e.uid).filter(Boolean);
    console.log(
      `${DRY_RUN ? 'Would update' : 'Updating'}: ${student.firstName} ${student.lastName} ` +
        `(${studentDoc.id}) — ${sharedWithUids.length} resolved uid(s)`
    );
    if (!DRY_RUN) {
      await studentDoc.ref.update({ sharedWith: resolvedSharedWith, sharedWithUids });
    }
    studentsUpdated++;
  }

  console.log(
    `\n${DRY_RUN ? 'Dry run complete' : 'Migration complete'}. ` +
      `${directoryWrites} emailToUid entr${directoryWrites === 1 ? 'y' : 'ies'} written, ` +
      `${uidsResolved} share(s) resolved across ${studentsUpdated} student(s).`
  );
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
