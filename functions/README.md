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
GCP project). Blaze is confirmed active on `student-driver-log-b1924`
(billing account `010605-BBEB52-5D3BA5`, linked directly to this
project) — all three functions are deployed and live. Blaze includes the
same free-tier quota Spark has, so cost should stay near zero at this
app's volume; an Artifact Registry cleanup policy (1 day, `us-central1`)
is also set so old function container images don't quietly accumulate
into a storage bill.

**A tooling gotcha worth knowing about:** the Firebase MCP server's
`firebase_get_environment` tool and its `firebase_deploy` tool both
reported this exact project as *not* on Blaze — "Extensions require the
Blaze plan" — for three consecutive attempts, even after billing was
confirmed live in the console (screenshotted, project ID matched
exactly). The **raw CLI** (`npx firebase-tools deploy ...`), run
immediately after, sailed straight past that same check with no error at
all and successfully created a function. Whatever billing signal the MCP
tools read, it was stale relative to the real, current GCP state that
the CLI checks fresh on every invocation. **If a deploy through the MCP
`firebase_deploy` tool fails on a billing/Extensions message, don't
trust it — retry with the raw CLI before concluding billing is actually
the problem.** This cost real back-and-forth the first time; it
shouldn't again.

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

Cloud Functions can't be deployed by pasting code into a console text
box the way `firestore.rules` historically was — deployment is always
through the CLI. **Use the raw CLI, not the Firebase MCP `firebase_deploy`
tool** — see the "tooling gotcha" above; the MCP path returned a stale
billing verdict that the raw CLI didn't reproduce.

```
npx firebase-tools deploy --only functions --project student-driver-log-b1924
```

(equivalently `npm run deploy` from inside `functions/`, once its own
`.firebaserc`/project context is set up — the raw invocation above is
what's actually been used and verified). Requires `firebase login` once
and `functions/`'s own `npm install` run first — the functions codebase
has its own `package.json`, independent of the web app's.

One real first-deploy wrinkle to expect: the two Firestore triggers
(`onEntitlementWritten`, `onStudentCreated`) can fail on their first
attempt with *"Permission denied while using the Eventarc Service
Agent"* — that's the Eventarc/Pub/Sub service agent IAM roles still
propagating after they're first provisioned, not a real problem. Wait a
couple of minutes and redeploy; `validatePurchase` (a plain callable, no
Eventarc trigger) deployed clean on the very first attempt and doesn't
hit this.

**Current status: all three functions are deployed and live** in
`us-central1` — `validatePurchase` (callable), `onEntitlementWritten` and
`onStudentCreated` (Firestore triggers). `firestore.rules` is deployed
too (see the root README's Firestore section). Verified end to end: a
call to `validatePurchase` with a valid auth token and no real receipt
returns `functions/unimplemented` from the App Store verification stub,
and never reaches the Firestore write path — checked by exercising the
same committed source against the local emulator (a throwaway
emulator-only Auth user, never touching production Auth or Firestore),
and separately confirmed the live project's `receipts` collection and
every `entitlements` subcollection are still empty.
