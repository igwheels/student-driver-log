/**
 * Derives the studentDirectory document ID for an email address.
 *
 * The directory exists so "does a dashboard for this email already exist?"
 * can be answered without opening up the student records themselves. It used
 * to be keyed by studentId and found with a where('email','==') query — but
 * Firestore security rules can't inspect a query's filters, so allowing that
 * query meant allowing the whole collection to be listed, and any signed-in
 * user could enumerate every student's name and email.
 *
 * Keying each entry by a hash of the email instead means the lookup is a
 * direct read of one known document, so the rules can permit `get` and deny
 * `list` outright. Finding an entry then requires already knowing the address.
 *
 * The hash is not a secret and isn't meant to be one — email addresses are
 * low-entropy and a determined attacker with a candidate list could confirm
 * guesses. What it removes is bulk enumeration: you can no longer walk the
 * collection and read out addresses you didn't already have.
 *
 * Uses Web Crypto, which is present in browsers on a secure context (HTTPS,
 * or localhost in dev) and in Node 18+ for the migration script.
 */

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

export async function emailDocId(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('Cannot derive a directory key from an empty email');

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    // Better to fail loudly than to silently write entries under a fallback
    // key that no lookup would ever find again.
    throw new Error('Web Crypto unavailable — cannot derive the directory key');
  }

  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
