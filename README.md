# Student Driver Log — Web

A browser version of Student Driver Log, built with **React + Vite**, deployable for free on **GitHub Pages**. It mirrors the React Native app (same students, logs, gauges, PDF affidavit) with web-native equivalents for the platform-specific pieces (biometrics, storage, PDF export).

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

## Biometric login (WebAuthn)

`src/utils/webauthn.js` uses the browser's native platform authenticator (Face ID / Touch ID / Windows Hello) via the WebAuthn API. This scaffold is a **working client-only demo** — it proves the UX, but real WebAuthn security comes from a relying-party server that issues challenges and verifies attestations server-side. Before shipping, either stand up a small verification endpoint or use a library like [SimpleWebAuthn](https://simplewebauthn.dev/) with Firebase Cloud Functions as the backend.

## Weekly progress emails

GitHub Pages only serves static files — it can't run scheduled jobs. Instead, `.github/workflows/weekly-emails.yml` runs a scheduled **GitHub Actions workflow** every Monday that executes `scripts/send-weekly-emails.js`, which reads Firestore and sends emails via SendGrid. Add these as repo secrets under **Settings → Secrets and variables → Actions**:

- `FIREBASE_SERVICE_ACCOUNT` — JSON key for a Firebase service account with Firestore read access
- `SENDGRID_API_KEY` — from your SendGrid account (verify a sender domain first)

Since student drivers are typically minors, keep these emails strictly transactional (progress only, no marketing) and get parent consent at signup.

## State requirements data

`src/data/stateRequirements.js` encodes the IIHS Graduated Licensing Laws table as of **July 2026**, including per-state night-hour rules and notes (e.g., "waived with driver's ed"). GDL laws change — add a "verify with your DMV" note in the UI/PDF and re-check the IIHS table periodically.

## Student Sharing Feature

**New in this version:** Users can now share student driving logs with co-parents, guardians, and other authorized users.

### Key Features

- **Share by email**: Owner can share a student with any email address
- **Instant or invitation-based access**: If recipient has an account, they get access immediately; otherwise they receive an invitation email
- **Limited permissions**: Shared users can view, add, and delete drives, but cannot edit student info or delete the student
- **Data safety**: Drives persist when unsharing; shared data is never lost
- **Automatic access grant**: When new users sign up with an invited email, they automatically get access

### Quick Setup

1. Run the data migration to add sharing fields to existing students:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   node scripts/migrate-add-sharing-fields.js
   ```

2. Update Firestore security rules (see `FIRESTORE_SECURITY_RULES.md`)

3. (Optional) Set up email notifications via Cloud Functions or backend (see `SHARING_SETUP_QUICKSTART.md`)

For detailed setup instructions, see:
- **Quick start:** `SHARING_SETUP_QUICKSTART.md`
- **Full documentation:** `STUDENT_SHARING_IMPLEMENTATION.md`
- **Security rules:** `FIRESTORE_SECURITY_RULES.md`
- **Deployment checklist:** `DEPLOYMENT_CHECKLIST.md`

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
src/utils/webauthn.js            biometric login (WebAuthn)
src/utils/invitations.js         invitation email utilities
scripts/send-weekly-emails.js    weekly email cron script (run by GitHub Actions)
scripts/migrate-add-sharing-fields.js  migrate existing students for sharing feature
.github/workflows/deploy.yml     builds + publishes to GitHub Pages on push
.github/workflows/weekly-emails.yml  Monday-morning progress email cron
```

## Why HashRouter

GitHub Pages has no server-side rewrites, so a path like `/dashboard/abc123` 404s on a hard refresh or direct link. `HashRouter` keeps routes after a `#` (`/#/dashboard/abc123`), which always resolves to `index.html` — the standard fix for SPA routing on static hosts.
