import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * Review progress lives under the student it belongs to:
 *   users/{ownerId}/students/{studentId}/flashcardProgress/{cardId}
 *
 * One record per student rather than per signed-in user, so a parent quizzing
 * their student and the student practising alone build the same schedule —
 * which is the point of tracking it at all. The trade-off is that a parent
 * running through the deck for their own curiosity moves the student's
 * schedule too.
 *
 * This is the one thing a student may write. Their dashboard is otherwise
 * read-only, but these are their own answers, and spaced repetition is
 * useless if the person doing the reviewing can't record them — see the
 * flashcardProgress rule in firestore.rules.
 */

export async function loadProgress(ownerId, studentId) {
  const snap = await getDocs(
    collection(db, 'users', ownerId, 'students', studentId, 'flashcardProgress')
  );
  const byId = {};
  snap.docs.forEach((d) => {
    byId[d.id] = { ...d.data(), cardId: d.id };
  });
  return byId;
}

export async function saveCardProgress(ownerId, studentId, progress) {
  await setDoc(
    doc(db, 'users', ownerId, 'students', studentId, 'flashcardProgress', progress.cardId),
    progress
  );
}

/**
 * Used when a student is deleted. Firestore does not cascade-delete
 * subcollections, so without this the review history would outlive the
 * student it describes — the same way drive logs would.
 */
export async function deleteAllProgress(ownerId, studentId) {
  const snap = await getDocs(
    collection(db, 'users', ownerId, 'students', studentId, 'flashcardProgress')
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
