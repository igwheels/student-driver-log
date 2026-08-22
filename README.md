# Student Driver Log — Web

A browser version of Student Driver Log, built with **React + Vite**, deployable for free on **GitHub Pages**. It mirrors the React Native app (same students, logs, gauges, PDF affidavit) with web-native equivalents for the platform-specific pieces (storage, PDF export).

## Design concept

Instead of generic cards and progress bars, the UI borrows two real objects from a learner driver's world:

- **The instrument cluster** — the dashboard's hour gauges are styled as speedometer dials (tick marks, needle, mono digital readout) inside a dark dash panel, not a plain percentage ring.
- **The permit card** — each student in the list renders like a small ID/permit card with a state-code badge, echoing the plate/permit theme of the DMV forms this app produces.

Type: **Space Grotesk** for headings, **Inter** for body text, **JetBrains Mono** for all numeric readouts (timer, gauge digits, log durations) — reinforcing the "trip computer" feel.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

**Add your logo:** drop a square PNG at `public/logo.png` — it's used as the favicon, the login screen mark, and the topbar icon.

## Deploying to GitHub Pages

1. Push this project to a new GitHub repo.
2. In the repo, go to **Settings → Pages → Source** and select **GitHub Actions**.
3. Edit `vite.config.js` and set `base: '/your-repo-name/'` to match your repo's name exactly (skip this step, leaving `base: '/'`, if deploying to a `yourname.github.io` user/org site instead).
4. Push to `main`. `.github/workflows/deploy.yml` builds the app with Vite and publishes `dist/` to Pages automatically on every push.
5. Your app will be live at `https://yourname.github.io/your-repo-name/`.

## Wiring up production auth (Firebase)

1. Create a Firebase project → enable **Authentication** (Email/Password, Google) and **Firestore**.
2. Add your Firebase config to a new `src/firebase.js` and replace the TODOs in `src/pages/Login.jsx`:
   - Email/password → `signInWithEmailAndPassword`
   - Google → `signInWithPopup(auth, new GoogleAuthProvider())`
   - Apple → `OAuthProvider('apple.com')` via Firebase, once domain verification is set up in your Apple Developer account
3. Add your GitHub Pages domain to Firebase Auth's **authorized domains** list, or sign-in redirects will fail.

## Weekly progress emails

GitHub Pages only serves static files — it can't run scheduled jobs. Instead, `.github/workflows/weekly-emails.yml` runs a scheduled **GitHub Actions workflow** every Monday that executes `scripts/send-weekly-emails.js`, which reads Firestore and sends emails via SendGrid. Add these as repo secrets under **Settings → Secrets and variables → Actions**:

- `FIREBASE_SERVICE_ACCOUNT` — JSON key for a Firebase service account with Firestore read access
- `SENDGRID_API_KEY` — from your SendGrid account (verify a sender domain first)

Since student drivers are typically minors, keep these emails strictly transactional (progress only, no marketing) and get parent consent at signup.

The email includes the drives logged since the previous email (with route maps) and the dashboard's progress gauges, rendered to PNG server-side via `scripts/lib/staticImages.js` (OpenStreetMap tiles, no API key) and attached inline. Each email also carries an unsubscribe link, and the Account page has a matching "Send me weekly progress emails" checkbox — both read/write the same `emailPreferences/{email}` Firestore document (`weeklyEmailOptOut: boolean`; no document means subscribed). That document must be readable and writable without a signed-in session, since the unsubscribe link works for anyone who received the email — see the `emailPreferences` block in [`firestore.rules`](firestore.rules), which keeps single-document reads open while blocking collection listing (the document IDs are email addresses) and pinning writes to the two expected fields.

## Firestore security rules

[`firestore.rules`](firestore.rules) is the source of truth for the database's access rules, with the reasoning for each block in comments. It is **not** deployed by any workflow — publish changes by pasting the file into the Firebase console (Firestore → Rules), which validates the syntax before you commit it. Edit the file and publish together so the two don't drift.

Note that rules cannot inspect a query's filters — they authorize the operation, not the `where` clause. Allowing a collection to be queried therefore allows it to be listed in full. That's why `studentDirectory` is keyed by a hash of the student's email: the duplicate-email check reads one known document rather than querying, so `list` can be denied outright.

## State requirements data

`src/data/stateRequirements.js` encodes the IIHS Graduated Licensing Laws table as of **July 2026**, including per-state night-hour rules and notes (e.g., "waived with driver's ed"). GDL laws change — add a "verify with your DMV" note in the UI/PDF and re-check the IIHS table periodically.

## Sharing a student with another parent

A student's owner can share their dashboard with another parent/guardian by email from the student's dashboard (**Share** button). Access is enforced by Firestore security rules matching the signed-in user's email against the student's `sharedWithEmails` list, so it takes effect the instant the recipient is signed in with that email — whether they already had an account or just created one. Shared users can view the dashboard, add/delete drives, and export the PDF log, but can't edit the student's name/state or delete the student. Unsharing removes future access but keeps any drives that user logged.

A GitHub Actions workflow (`send-invitations.yml`, same Gmail setup as the weekly emails) emails the recipient a link every ~15 minutes for any pending shares, so they know to sign in or create an account.

**One-time setup after adding this feature to an existing deployment:**

1. Update your Firestore security rules (see the rules block in project chat history, or ask to have them regenerated) to allow reading a student when `request.auth.token.email` is in its `sharedWithEmails` array, and to allow the `collectionGroup('students')` query the app uses to find students shared with you.
2. Migrate any existing students so they have the new fields:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   node scripts/migrate-add-sharing-fields.js
   ```

## Requesting access to an existing student

When someone tries to add a student whose email already has a dashboard (owned by someone else), `AddStudent.jsx` offers to send an access request instead of creating a duplicate. The owner sees it as a **pending** entry next to "Shared with" on that student's dashboard, with **Approve**/**Deny** buttons — approving is the same as using the Share button (`shareStudent()`), just triggered from the other side.

This relies on two collections that aren't covered by the existing rules:

- `studentDirectory/{sha256(email)}` — a small, separate record (just `studentId`, `ownerId`, `ownerName`, `firstName`, `lastName`, `email`) kept in sync with each student, so the "does this email already have a dashboard?" check doesn't require opening up read access to the full `students` collection (which also holds `sharedWithEmails`, log summaries via subcollections, etc.) to every signed-in user. Keying it by a hash of the email (see `src/utils/emailHash.js`) makes that check a direct document read, which is what allows the rules to deny listing — otherwise any signed-in user could enumerate every student's name and email. One entry per address: if a second student is registered under an address another account already used, the entry stays with the first, and the second student is created and usable but isn't what the directory points at.
- `accessRequests/{requestId}` — one doc per pending request, holding both the owner's and requester's ids/emails so each side can be scoped independently.

**One-time setup after adding this feature to an existing deployment:**

1. Backfill directory entries for students created before this feature existed. Preview first — the dry run writes nothing:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   node scripts/migrate-hash-student-directory.js --dry-run
   node scripts/migrate-hash-student-directory.js
   ```
   This only reads student records and rewrites `studentDirectory`; student data and drive logs are never modified. It supersedes `migrate-add-student-directory.js`, which wrote the old `studentId`-keyed entries and is kept only for reference.
2. Then publish the `studentDirectory` and `accessRequests` rules — see [`firestore.rules`](firestore.rules).

Run them in that order: the rules deny listing, which the old query-based lookup depended on, so publish them only once the hashed entries exist and the matching app version is deployed.

## Project structure

```
index.html                       entry HTML + font imports
src/main.jsx                     React root, HashRouter
src/App.jsx                      routes + topbar
src/styles/theme.css             design tokens, dash-panel, plate-card, gauge, timer styles
src/context/AppContext.jsx       students, logs, totals, localStorage + sharing functions
src/data/stateRequirements.js    per-state hour requirements (IIHS)
src/data/encouragements.js       random praise messages
src/components/Gauge.jsx         SVG speedometer-style dial gauge
src/components/ShareModal.jsx    sharing UI modal
src/pages/                       Login, Students, AddStudent, Dashboard, DriveTimer, LogDrive
src/utils/pdfExport.js           affidavit + log table PDF (jsPDF)
src/utils/invitations.js         invitation email utilities
src/utils/escapeHtml.js          HTML/header escaping for outbound emails
src/utils/emailHash.js           studentDirectory document key (SHA-256 of email)
scripts/send-weekly-emails.js    weekly email cron script (run by GitHub Actions)
scripts/migrate-add-sharing-fields.js  migrate existing students for sharing feature
.github/workflows/deploy.yml     builds + publishes to GitHub Pages on push
.github/workflows/weekly-emails.yml  Monday-morning progress email cron
```

## Why HashRouter

GitHub Pages has no server-side rewrites, so a path like `/dashboard/abc123` 404s on a hard refresh or direct link. `HashRouter` keeps routes after a `#` (`/#/dashboard/abc123`), which always resolves to `index.html` — the standard fix for SPA routing on static hosts.
