# Roadmap: App Stores, Corporate Email Sender, Multi-Channel Share, Biometric Login

## Context

Student Driver Log is currently a React 18 + Vite SPA, deployed as a static
site to GitHub Pages, backed by Firebase (Auth: email/password + Google
Sign-In; Firestore for data). It is a PWA (manifest, service worker) but has
no native mobile packaging yet (no Capacitor/Cordova/React Native). The
owner (DevWorks LLC, solo indie developer) wants to:

1. Get the app onto the iOS App Store and Google Play Store — with the
   longer-term goal of the mobile app becoming the *only* way the product is
   distributed, retiring the GitHub Pages web deployment once stores are live.
2. Send the app's automated emails (invitation + weekly progress emails) from
   the new corporate address `ian@devworksllc.com` instead of the current
   ad-hoc Gmail account.
3. Let a user share a dashboard via email, SMS, or social media, not just a
   generic share button.
4. Add biometric login (Face ID / Touch ID / Android biometric).
5. Add Sign in with Apple as an authentication option.
6. Remove the student's ability to sign in and view their own dashboard,
   while continuing to send students their weekly progress emails.

No Apple Developer or Google Play Developer account exists yet for DevWorks
LLC. This document is a sequenced roadmap to work from — later work items
depend on the file paths and decisions recorded here, so implementation
sessions should re-read this rather than re-deriving the plan from scratch.

## Decisions already made (with the owner)

- **SMS = free device SMS composer** (`sms:` URI, opens the Messages app
  pre-filled), not Twilio-backed programmatic sending. Twilio would cost
  ~$0.008/message + ~$1.15/mo per number + A2P 10DLC registration
  (~$4–15 one-time + ~$1.50–10/mo) — real recurring cost and compliance
  paperwork the owner chose to skip for now.
- **Email transport = Resend**, not SendGrid (SendGrid dropped its free
  tier partway through this project) and not a paid Google Workspace
  mailbox. Resend's free tier (3,000 emails/month) comfortably covers this
  app's volume (invitation + weekly emails to a small user base), has a
  clean REST API, and supports inline CID attachments — needed for the
  weekly email's embedded gauge/route-map PNGs. Note the Resend Node SDK's
  attachment fields are camelCase (`contentId`, `contentType`), not the
  snake_case (`content_id`) most other providers' REST APIs use — this
  tripped up the first implementation (images shipped as regular
  attachments instead of embedding inline) since this is plain `.js` with
  no compile-time type checking to catch it.
- **Mobile packaging = Capacitor**, wrapping the existing Vite/React app —
  not a React Native rewrite. This is *reinforced*, not weakened, by the
  mobile-only end goal: Capacitor produces genuine native store binaries: the
  web build becomes internal tooling, not a user-facing website, once GitHub
  Pages is retired. One React codebase stays the single source of truth.
  React Native would only be worth the much larger rewrite cost if the app
  needed to avoid a WebView UI for performance/native-feel reasons — unlikely
  for a forms/data app like this one.
- **The app is adult-only** — the student driver can no longer sign in or
  view their own dashboard at all. Students continue to receive the weekly
  progress email (already sent to `student.email` by
  `scripts/send-weekly-emails.js`, independent of any login). This removes
  the earlier Kids Category/teen-privacy-law open question entirely — the
  account holder and every signed-in user is an adult, so the app can be
  scoped as an adult-supervisor tool for App Store category and
  privacy-label purposes, no state-level minor-specific research needed
  before submission.
- **Sign in with Apple** will be added as an auth option alongside the
  existing email/password and Google Sign-In. `src/firebase.js` already has
  `OAuthProvider('apple.com')` referenced in a comment as available-but-not-
  configured, needing Apple domain verification — this becomes concrete work
  once real domain/Capacitor infrastructure exists. It is also a near-
  mandatory addition, not just a nice-to-have: **App Store Review Guideline
  4.8** requires apps offering a third-party login (Google Sign-In already
  does) to offer Sign in with Apple as an equivalent option, so this is
  effectively required for iOS approval once Capacitor ships, not optional
  polish.

## Phase 1 — Zero-cost, zero-lead-time [DONE]

**Goal:** Ship the cheap wins first; they don't block or depend on anything else.

All of the following shipped:

1. **Switch email sender to Resend / ian@devworksllc.com** (PRs #51, #52, #53)
   — `scripts/send-invitation-emails.js` and `scripts/send-weekly-emails.js`
   use `resend.emails.send(...)` with `from`/`replyTo` set to
   `ian@devworksllc.com`. Workflow secret is `RESEND_API_KEY` (repo secret
   under Settings → Secrets and variables → Actions), set in
   `.github/workflows/send-invitations.yml` and `weekly-emails.yml`. The
   weekly email's inline gauge/route-map PNGs use Resend's `Attachment`
   type — `content` (base64), `contentId` (matches the `cid:` reference in
   the HTML), `contentType` — all camelCase per
   `node_modules/resend/dist/index.d.mts`.
2. **Extend sharing to explicit email / SMS / social options** (PR #54) —
   `src/utils/share.js` gained `buildShareLinks()` (mailto:/sms:/wa.me URLs)
   and `hasNativeShare()`. A new `src/components/ShareLinksMenu.jsx` dropdown
   (reuses the app's `.menu-dropdown` styling) shows Email/Text
   message/WhatsApp/Copy link wherever `navigator.share()` isn't available —
   wired into both `ShareButton.jsx` (topbar) and `LogDrive.jsx`'s "Brag on
   your student" button. Native share sheet still triggers directly when
   available.
3. **PWA foundation** (PR #54) — `vite-plugin-pwa` configured in
   `vite.config.js` with a manifest, three icons generated from
   `public/logo.png` (`public/pwa-192.png`, `pwa-512.png`,
   `pwa-maskable-512.png`), and a generated service worker
   (`registerType: 'autoUpdate'`, `skipWaiting`/`clientsClaim`) that
   precaches the build's own static assets only — deliberately no runtime
   caching of Firestore/API calls, since stale offline drive-log data would
   be worse than showing nothing. `index.html` also carries an
   `apple-touch-icon` link and `apple-mobile-web-app-*` meta tags, since iOS
   Safari ignores the web manifest for "Add to Home Screen".
4. **Move the live app to sdl.devworksllc.com** (PR #48) —
   `public/CNAME` + a DNS `CNAME` record (Cloudflare, DNS-only) pointing
   `sdl` at `igwheels.github.io`. `vite.config.js`'s `base` is `/` (a
   custom domain serves from root, not the old
   `/student-driver-log/` project-site subpath). GitHub's Settings → Pages
   custom-domain field had to be set manually — pushing the `CNAME` file
   alone did not populate it, since this repo's Pages deployment uses the
   Actions-based source (`actions/deploy-pages`), not the older
   deploy-from-branch method that auto-detects it.
5. **Remove student self-login, keep weekly emails** (PR #49) — removed
   `setStudentLoginAccess`/`isStudentSelf`/`isStudentOnlyAccount` from
   `src/context/AppContext.jsx`, the "Let this student sign in" toggle from
   `ManageStudents.jsx`, and the `studentLoginEmail` access path from
   `firestore.rules` (published manually to the Firebase console — this
   repo does not auto-deploy rules). Also added a per-student weekly-email
   opt-out checkbox to `ManageStudents.jsx` (PR #50), reusing the existing
   `emailPreferences/{email}` mechanism so a parent can still silence a
   student's weekly email without the student needing to sign in.

## Phase 2 — Kick off immediately because of lead time (IN PROGRESS)

**Goal:** Start the slow, external, non-technical clocks as early as possible.

This phase is 100% account setup and identity verification — there is no
code involved, and it can't be automated: enrollment requires DevWorks LLC's
legal/business details, a payment method, and identity documents only the
owner can provide. This is an action checklist for the owner to work through
directly on Apple's and Google's sites, not an implementation task.

6. **Apple Developer Program enrollment** — start today, this is the
   longest pole in the whole roadmap.
   - Check whether DevWorks LLC already has a **D-U-N-S number** at
     https://developer.apple.com/support/D-U-N-S/ (Apple's own lookup tool,
     via Dun & Bradstreet). If one doesn't exist, request it there —
     Apple's free expedited request usually resolves in about 5 business
     days, but can occasionally take longer; this is the step most likely
     to become the bottleneck, so kick it off first, before anything else
     in Phase 2.
   - Once the D-U-N-S number resolves, enroll at
     https://developer.apple.com/programs/enroll/ as an **Organization**
     (not Individual), using DevWorks LLC's legal name exactly as it
     appears in D-U-N-S records — mismatches are the most common cause of
     enrollment rejection.
   - Have ready: DevWorks LLC's legal entity name, D-U-N-S number, a
     company website or web presence (worth having `sdl.devworksllc.com`
     live before applying — it already is, per Phase 1), a company email
     at the DevWorks LLC domain (`ian@devworksllc.com` already exists),
     and legal signing authority for the LLC (as owner, this should already
     be true).
   - $99/year, charged after enrollment is approved.
   - Apple verifies the enrollment by phone — watch for a call and be
     ready to confirm company details.

7. **Google Play Console enrollment** — **also gated on the same D-U-N-S
   number as Apple**, confirmed directly on Google's current signup page
   (https://play.google.com/console/signup): Play Console's Organization
   account type requires a D-U-N-S number too, the same one requested for
   Apple in step 6 above. This corrects the roadmap's earlier assumption
   that Google didn't need one — there is now only **one** shared
   external dependency blocking both enrollments, not two independent ones.
   - Once the D-U-N-S number DevWorks LLC applied for (step 6) resolves,
     enroll at https://play.google.com/console/signup as an
     **Organization** account (not individual), using DevWorks LLC as the
     developer entity — this determines what shows as the publisher on the
     Play Store listing, so get this right at signup rather than changing
     it later.
   - $25 one-time registration fee.
   - Have ready: the D-U-N-S number, DevWorks LLC's legal name and business
     address, a government-issued ID for the account owner, and a payment
     method for the $25 fee.
   - Since this no longer has an independent lead time, there's nothing to
     start in parallel right now beyond what step 6 already kicked off —
     revisit this once the D-U-N-S number comes back.

**When both are approved:** Phase 3 (Capacitor wrapper) doesn't block on
this, but Phase 5 (store submission) can't start until both accounts are
active. No code changes happen in this repo as part of Phase 2; the next
actionable *code* work is Phase 3.

## Phase 3 — Capacitor wrapper (not started)

**Goal:** Get the existing Vite/React app running inside iOS/Android native shells.

8. Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`,
   `@capacitor/android` on top of the existing `vite build` output;
   `capacitor.config.json` points `webDir` at `dist`. **App ID decided:
   `com.devworksllc.sdl`** (reverse-domain, matches the `sdl` used in
   `sdl.devworksllc.com`). **Owner decision:** hold off starting this step
   until working from a Mac with Xcode, so both iOS and Android platforms
   can be scaffolded and opened in one pass rather than doing Android now
   and iOS later.
9. Verify Firebase Auth — especially Google Sign-In — and Firestore work
   inside the Capacitor WebView. Google Sign-In's web popup/redirect flow
   often needs `@capacitor-firebase/authentication` or a custom URL scheme
   handler instead; this is the most likely native-specific integration snag
   and should be validated early in this phase, not discovered at submission.
10. **Add Sign in with Apple** alongside the existing email/password and
    Google Sign-In in `src/pages/Login.jsx` and `src/firebase.js`, using
    `OAuthProvider('apple.com')` (already referenced in a comment there as
    available-but-unconfigured). Requires: enabling the Sign in with Apple
    capability in the Apple Developer account from Phase 2, configuring it as
    an auth provider in the Firebase console, and — same as Google Sign-In in
    the step above — verifying the native flow works inside the Capacitor
    WebView (`@capacitor-firebase/authentication` covers this provider too).
    Do this in the same pass as the Google Sign-In verification above since
    both hit the same native-auth integration surface. Required for iOS
    submission per Guideline 4.8 (see the Decisions section) — treat it as a
    Phase 3 blocker for the iOS side of Phase 5, not optional follow-up work.
11. Address Apple's **"no bare wrapped website" rejection risk** (App Store
    Review Guideline 4.2, Minimum Functionality). Mitigations: native
    navigation chrome (status bar styling, safe-area handling, no visible
    browser furniture), native share sheet (already true via
    `navigator.share`), relevant Capacitor plugins (haptics, etc.), offline
    support from the Phase 1 service worker, and the Phase 4 biometric unlock
    — together these make the review case that it's a real app, not a
    bookmarked site.
12. Prepare **App Store Privacy Nutrition Label** and **Play Console Data
    Safety form** answers (driving logs, location/GPS, email addresses used
    for sharing — how each is used, whether shared with third parties,
    retention). With the app now adult-only, this is a standard
    privacy-label exercise — no minor-specific state-law research needed,
    since every account holder and signed-in user is an adult; the data
    collected is *about* a minor (entered by their supervisor), which is the
    ordinary case store privacy labels already handle.
13. Once Capacitor is stable and store presence is live, swap what's served
    at `sdl.devworksllc.com` (already the live app's domain since Phase 1)
    from the live app to a marketing/redirect page per the owner's
    mobile-only end goal: build a simple static page (App Store and Google
    Play badge links, brief product description) and repoint
    `.github/workflows/deploy.yml` to build/deploy that instead. The
    domain/DNS mapping stays as-is — only the deployed content changes.

## Phase 4 — Biometric login (depends on Phase 3 existing, not started)

**Goal:** Face ID / Touch ID / Android biometric as a local unlock
convenience layer on top of the existing Firebase Auth session — not a new
identity system.

14. Add a maintained Capacitor biometric plugin (e.g.
    `capacitor-native-biometric` — verify current maintenance status at
    implementation time before committing to it).
15. Flow: after first successful Firebase Auth sign-in inside the native app,
    offer "enable Face ID / Touch ID unlock." On success, store a
    locally-encrypted flag/token via the plugin's secure storage. On
    subsequent app opens, prompt biometric — success re-displays the
    already-signed-in Firebase session (or unlocks a locally cached refresh
    token); failure/cancel falls back to normal email/password, Google
    Sign-In, or Sign in with Apple. `AppContext`'s auth state and Firestore
    security rules are unaffected by this — it's purely a local unlock gate
    in front of an already-authenticated session.
16. No web/PWA equivalent in scope initially (WebAuthn passkeys would be a
    separate, larger project). Gate all biometric code behind
    `Capacitor.isNativePlatform()` so the web build is unaffected — relevant
    if the web build is kept around during the transition period before
    Phase 3's step 13 swaps it for the marketing page.

## Phase 5 — Store submission (tail end, depends on Phases 2 + 3, not started)

**Goal:** Get a signed build into both stores once accounts, wrapper, and
privacy labels all exist.

17. Requires Phase 2 (developer accounts approved) and Phase 3 (working
    Capacitor build, Sign in with Apple live, privacy labels ready) both
    complete. Build signed archives (Xcode for iOS, Android Studio/Gradle for
    Play), complete store listings, submit for review.
18. Budget for Apple review iteration risk (4.2 minimum-functionality
    rejections, 4.8 third-party-login parity checks) — plan at least one
    resubmission cycle into the timeline. Play Store review is typically
    faster and less subjective.

## Sequencing summary

- **Done:** Phase 1 in full — Resend email switch, share fallback links, PWA
  foundation, custom domain, student self-login removal.
- **In progress:** D-U-N-S number applied for (blocks both Apple Developer
  Program enrollment (6) and Google Play Console enrollment (7) — both
  require the same D-U-N-S number, so they're no longer independent
  tracks). Once it resolves, enroll in both.
- **Middle, blocking:** Capacitor wrapper, native-auth verification
  (including Sign in with Apple), review-risk mitigation, privacy labels
  (Phase 3).
- **Last, dependent on Phase 3 existing:** native biometric unlock (Phase 4),
  store submission (Phase 5), swapping `sdl.devworksllc.com`'s content from
  live app to marketing page (Phase 3, step 13, once stores are confirmed
  live).

## Critical files for implementation

- `src/utils/share.js`, `src/components/ShareLinksMenu.jsx`,
  `src/components/ShareButton.jsx` — sharing (done, Phase 1).
- `scripts/send-invitation-emails.js`, `scripts/send-weekly-emails.js` —
  email sending via Resend (done, Phase 1).
- `vite.config.js`, `index.html`, `public/pwa-*.png` — PWA manifest/service
  worker (done, Phase 1).
- `public/CNAME`, `.github/workflows/deploy.yml` — custom domain (done,
  Phase 1); `deploy.yml` gets repointed to a marketing page in Phase 3
  step 13.
- `src/context/AppContext.jsx`, `firestore.rules`,
  `src/pages/ManageStudents.jsx` — student self-login removal and weekly
  email opt-out (done, Phase 1).
- `src/firebase.js`, `src/pages/Login.jsx` — auth flow; Google Sign-In and
  Sign in with Apple will likely need `@capacitor-firebase/authentication`
  inside the native shell (Phase 3, not started).
- New `capacitor.config.json` (Phase 3, not started).

## Verification approach for each phase

- **Phase 1 (done):** verified via `npm run build`, Playwright screenshots
  for UI changes, and live `workflow_dispatch` test sends for both email
  workflows — see PR descriptions for #48–#54 for the specifics of each.
- **Phase 3 (Capacitor):** run `npx cap run ios` / `npx cap run android`
  against a simulator/emulator and a real device; manually exercise sign-in
  (email/password, Google, and Sign in with Apple), drive logging, and
  sharing end-to-end inside the native shell before moving to Phase 4.
- **Phase 4 (biometric):** on a real device with Face ID/Touch ID/fingerprint
  enrolled, verify enable → lock → biometric prompt → unlock, and verify the
  fallback path (cancel biometric → normal sign-in still works).
- **Phase 5 (submission):** use each store's internal testing track
  (TestFlight, Play Internal Testing) before public submission to catch
  review-blocking issues early.
