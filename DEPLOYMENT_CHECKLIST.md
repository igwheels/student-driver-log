# Student Sharing Feature - Deployment Checklist

Use this checklist to deploy the student sharing feature safely.

## Pre-Deployment

### 1. Code Review
- [ ] Review all changes in git: `git log --oneline -10`
- [ ] Verify build succeeds: `npm run build`
- [ ] Check for console errors: `npm run dev` and open browser console
- [ ] Test locally with multiple test accounts

### 2. Data Backup
- [ ] Backup Firestore data in Firebase Console (Firestore → Backups & Restore → Create on-demand backup)
- [ ] Backup Firebase Auth users list
- [ ] Document current user count and student count

### 3. Environment Verification
- [ ] Verify Firebase project ID is correct
- [ ] Confirm SendGrid API key is available (if using email)
- [ ] Verify all environment variables are set

## Deployment Steps

### Step 1: Run Data Migration
```bash
# Set environment variable
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Run migration script
node scripts/migrate-add-sharing-fields.js

# Verify output:
# - "Migration complete!"
# - Reports number of students migrated
# - No errors in output
```

- [ ] Migration script executed successfully
- [ ] All students show ownerId and sharedWith fields
- [ ] Spot-check a few students in Firebase Console

### Step 2: Update Firestore Security Rules

1. [ ] Go to Firebase Console → Firestore Database → Rules
2. [ ] Back up current rules (copy to text file)
3. [ ] Replace with rules from `FIRESTORE_SECURITY_RULES.md`
4. [ ] Review rules carefully
5. [ ] Click "Publish"

- [ ] Rules published successfully
- [ ] No permission denied errors in console

### Step 3: Deploy to Staging (if available)

- [ ] Deploy code to staging environment
- [ ] Test complete sharing workflow
- [ ] Verify all permissions work correctly
- [ ] Test with multiple users

### Step 4: Set Up Email (Optional)

#### If Using Firebase Cloud Functions:
```bash
# Create functions directory
mkdir -p functions

# Create index.js with email sending function
# (See SHARING_SETUP_QUICKSTART.md for code)

# Deploy
firebase deploy --only functions
```

- [ ] Cloud Function deployed successfully
- [ ] SetEnv vars in Cloud Functions settings
- [ ] Test invitation email sending

#### If Using Express Backend:
- [ ] Create endpoint for sending invitations
- [ ] Set environment variables
- [ ] Deploy backend
- [ ] Test endpoint

#### If Not Using Email:
- [ ] Confirm users can still access via direct signup
- [ ] Document this limitation for users

### Step 5: Deploy Code to Production

```bash
# Build for production
npm run build

# Deploy to your hosting
# (Firebase Hosting, Netlify, Vercel, etc.)
```

- [ ] Build completes without errors
- [ ] Deploy completes successfully
- [ ] No downtime observed

### Step 6: Verification

- [ ] App loads without errors
- [ ] Dashboard shows all students (owned and shared)
- [ ] Owner can see "Share" button
- [ ] Owner can click "Share" and enter email
- [ ] Shared student appears immediately for new owner

## Post-Deployment Testing

### Test Account Setup
Create test accounts:
- Account A (Owner): owner@example.com
- Account B (Shared User): shared@example.com
- Account C (New User): newuser@example.com

### Functional Testing Checklist

#### Owner Functions (Account A)
- [ ] Can see "Share" button on own students
- [ ] Can enter email and share student
- [ ] Success message appears
- [ ] Shared email appears in "Shared with" section
- [ ] Can remove shared user
- [ ] Can add/delete drives
- [ ] Can delete entire student

#### Existing Shared User (Account B)
- [ ] Log in with existing account
- [ ] Shared student appears in list immediately
- [ ] Can view dashboard
- [ ] Can add drives
- [ ] Can delete drives
- [ ] Can download PDF
- [ ] Cannot see "Share" button
- [ ] Cannot edit student name/state
- [ ] Cannot delete student

#### New User Flow (Account C)
- [ ] Owner shares student with newuser@example.com
- [ ] If email setup: Receive invitation email
- [ ] Click invitation link
- [ ] Email pre-filled in signup form
- [ ] Create account
- [ ] Auto-redirect to login
- [ ] Sign in
- [ ] Shared student appears
- [ ] Can access immediately

### Edge Case Testing
- [ ] Share with same email twice → Error message
- [ ] Unshare then reshare → Works correctly
- [ ] Multiple owners share to same user → All appear
- [ ] Share by owner with uppercase email → Lowercase works
- [ ] Browser refresh maintains access
- [ ] Clear localStorage → Still loads from Firestore

### Performance Testing
- [ ] Student list loads within 2 seconds
- [ ] Dashboard loads within 1 second
- [ ] Share action completes within 2 seconds
- [ ] Add drive for shared student works

## Rollback Plan

If critical issues occur:

### Immediate Rollback
```bash
# Revert code
git revert <commit-hash-of-sharing-feature>
npm run build
# Redeploy to production

# Restore Firestore rules
# Go to Firebase Console → Rules → Use previous version
```

- [ ] Code reverted
- [ ] Rules reverted
- [ ] App redeployed
- [ ] Verify functionality restored

### Data Recovery
If data was corrupted:
```bash
# Use Firestore backup
# Firebase Console → Firestore → Backups → Restore
```

## Communication Plan

### Internal Communication
- [ ] Notify team of deployment
- [ ] Provide testing credentials
- [ ] Share this checklist
- [ ] Set up support channel

### User Communication
- [ ] Create user documentation (optional)
- [ ] Prepare FAQ
- [ ] Plan announcement if major feature
- [ ] Set up feedback channel

### Post-Launch Monitoring
- [ ] Monitor error logs for 24 hours
- [ ] Check Firestore quota usage
- [ ] Monitor user feedback
- [ ] Track adoption rate

## Documentation

- [ ] README updated with sharing feature
- [ ] User guide created (if needed)
- [ ] Administrator guide created (if needed)
- [ ] Known issues documented
- [ ] Limitations documented

## Success Criteria

- [ ] All test accounts can share students
- [ ] Shared users can access and modify drives
- [ ] No permission errors in console
- [ ] Email sending works (if implemented)
- [ ] Data persists across browser sessions
- [ ] No data loss from migration
- [ ] All existing functionality preserved
- [ ] Performance acceptable

## Sign-Off

- [ ] Developer: _________________ Date: _______
- [ ] QA/Tester: ________________ Date: _______
- [ ] Product Owner: _____________ Date: _______
- [ ] Operations: ________________ Date: _______

## Known Limitations

- [ ] Shared students query is slow with many users (optimize later)
- [ ] Email sending requires separate backend setup
- [ ] No invitation expiry (can implement later)
- [ ] No bulk sharing (can implement later)

## Future Improvements

- [ ] Add user directory for faster lookups
- [ ] Add invitation expiry
- [ ] Add role-based access (viewer vs editor)
- [ ] Add sharing history/audit log
- [ ] Add auto-revoke after X days
- [ ] Add email notifications
- [ ] Optimize shared student loading

---

**Keep this checklist for reference. Complete all items before considering the feature fully deployed.**

For detailed technical documentation, see `STUDENT_SHARING_IMPLEMENTATION.md`.
For quick setup, see `SHARING_SETUP_QUICKSTART.md`.
