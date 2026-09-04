# Cloud Functions — Family Pack entitlement

This is the first Cloud Functions codebase in this repo. Everything else
server-side today is GitHub Actions cron scripts (`scripts/`) using
firebase-admin directly — that works for periodic batch jobs, but nothing
in this repo could previously be *called synchronously by the client*
with a trusted, verified identity. That's what these functions are for:
`validatePurchase` is invoked right after a native IAP purchase completes,
needs to know for certain who's calling, and needs to answer before the
purchase flow can tell the user it worked.

## What's here

- `validatePurchase` — `onCall` callable. The only trusted write path to
  `users/{uid}/entitlements/*`. See its file for the replay-protection
  and store-verification design.
- `onEntitlementWritten` / `onStudentCreated` — Firestore triggers that
  denormalize `familyPackActive` onto student documents so a shared
  co-parent's UI can gate correctly without a new cross-account read rule.
- `src/receiptVerification/` — Apple/Google verification, currently
  stubbed (blocked on developer-account access; see DEV-36).

## Prerequisite: Blaze plan

Cloud Functions — including simple Firestore triggers, regardless of
1st/2nd gen — require the project to be on the **Blaze (pay-as-you-go)**
plan. This isn't a scope choice, it's a hard Firebase requirement (Spark
can't deploy any function at all, since Cloud Functions run on Cloud
Run/Cloud Functions infra that needs a billing account attached to the
GCP project). Check Firebase console → Settings → Usage and billing.
Blaze includes the same free-tier quota Spark has — at this app's volume
cost should be near zero — but it does require a card on file, so it's a
real decision, not just a checkbox.

## Local development (emulators)

From the repo root:

```
npx firebase-tools emulators:start --only functions,firestore,auth
```

This runs `validatePurchase` and the two triggers against emulated
Firestore/Auth — no billing, no real project touched. The web app would
need to point at the emulator too (`connectFunctionsEmulator` /
`connectFirestoreEmulator` in src/firebase.js) to exercise it end-to-end;
that wiring isn't added yet since there's no client purchase UI to drive
it (that's DEV-37 + the IAP plugin, both blocked on the Apple/Google
developer accounts).

`firebase emulators:start` needs a `firebase-tools` install — either
global (`npm install -g firebase-tools`) or via `npx firebase-tools`
(no install required, slower first run). It also needs `functions/`
dependencies installed once: `cd functions && npm install`.

## Deploying

Unlike `firestore.rules` (pasted into the console by convention — see the
comment at the top of that file), Cloud Functions can't be deployed by
pasting code into a console text box. Deployment is always through the
CLI:

```
firebase deploy --only functions
```

(equivalently `npm run deploy` from inside `functions/`). This requires
`firebase login` once, the Blaze plan enabled, and `functions/`'s own
`npm install` run first — the functions codebase has its own
`package.json`, independent of the web app's.

Nothing has been deployed as part of this change. Deploying is a
deliberate follow-up, not something to do implicitly alongside a code
review.
