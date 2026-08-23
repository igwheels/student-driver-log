import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="page legal-page">
      <button className="back" style={{ marginBottom: 16, color: 'var(--blue)' }} onClick={() => navigate(-1)}>
        ‹ Back
      </button>

      <h2>Privacy Policy</h2>
      <p className="legal-updated">Last updated: February 2026</p>

      <p>
        This Privacy Policy explains how DevWorks LLC ("we," "us," or "our") collects, uses, and
        protects information in Student Driver Log (the "Service"). Because this Service is used to
        record information about student drivers — who are often minors — we have tried to keep what
        we collect to the minimum needed to make it work.
      </p>

      <h3>1. Information you provide</h3>
      <p>
        <strong>Account information.</strong> When you create an account we collect your email
        address. If you sign in with Google, we also receive your name and profile email from Google.
        We do not receive or store your password: authentication is handled by Google Firebase
        Authentication.
      </p>
      <p>
        <strong>Student driver information.</strong> For each student driver you add, we collect the
        student's first and last name, an email address you supply for them, and their state of
        residence.
      </p>
      <p>
        <strong>Driving records.</strong> For each drive you log, we collect the date, start and end
        times, duration, whether it occurred during the day or at night, the type of road, and
        optionally the distance driven.
      </p>
      <p>
        <strong>Sharing information.</strong> If you share a dashboard, we store the email address
        you shared it with so we can grant that person access and send them an invitation.
      </p>

      <h3>2. Information collected automatically</h3>
      <p>
        The Service uses Google Analytics, which collects standard usage information such as pages
        visited, approximate location derived from IP address, device and browser type, and general
        usage patterns. This is used to understand how the Service is used. It is not linked to the
        driving records of any individual student.
      </p>

      <h3>3. How we use information</h3>
      <ul>
        <li>To provide the Service — storing your logs and syncing them across your devices</li>
        <li>To authenticate you and keep your account secure</li>
        <li>
          To send weekly progress emails summarizing recorded hours to the student's email address,
          the account owner, and anyone the dashboard has been shared with
        </li>
        <li>To send an invitation email when a dashboard is shared with a new address</li>
        <li>To generate the driving log and affidavit PDF you export</li>
        <li>To understand overall usage and improve the Service</li>
      </ul>
      <p>
        We do not sell your information. We do not use it for advertising, and we do not share it
        with third parties for their own marketing purposes.
      </p>

      <h3>4. Information about minors</h3>
      <p>
        Student drivers are frequently minors. Accounts may only be created and student drivers may
        only be added by an adult parent, guardian, or authorized supervising driver — students do
        not create their own accounts. We collect only what is needed to produce a supervised driving
        log: name, an email address for progress updates, state, and drive records.
      </p>
      <p>
        The Service is not directed to children under 13 and we do not knowingly permit anyone under
        13 to create an account. If you believe a student driver's information has been added without
        proper authority, contact us and we will remove it.
      </p>
      <p>
        You can review, correct, or delete a student's information at any time from the Manage
        Students page, including changing the email address used for progress updates.
      </p>

      <h3>5. Where your information is stored</h3>
      <p>
        Information is stored using Google Firebase (Firestore and Firebase Authentication) on Google
        Cloud infrastructure in the United States. Access is restricted by security rules so that
        only your account — and accounts you have explicitly shared a dashboard with — can read your
        data. The Service also keeps a copy in your browser's local storage so it remains usable
        offline; clearing your browser data removes that local copy.
      </p>

      <h3>6. Service providers</h3>
      <p>We rely on the following third parties to operate the Service:</p>
      <ul>
        <li>
          <strong>Google Firebase</strong> — authentication and database storage
        </li>
        <li>
          <strong>Google Analytics</strong> — usage analytics
        </li>
        <li>
          <strong>Gmail</strong> — delivery of weekly progress emails and sharing invitations
        </li>
        <li>
          <strong>GitHub Pages</strong> — website hosting
        </li>
      </ul>
      <p>
        Each of these providers processes information under its own privacy policy and security
        practices.
      </p>

      <h3>7. Sharing with other users</h3>
      <p>
        When you share a student's dashboard, the person you share it with can see the student's
        name, state, all recorded drives, and progress totals, and can add or delete drives and
        export the log. You control who has access and may revoke it at any time from the student's
        dashboard. Revoking access stops future access but does not delete drives that person
        already recorded.
      </p>

      <h3>8. Data retention and deletion</h3>
      <p>
        We retain your information for as long as your account is active. You may delete an
        individual student driver — along with all of that student's recorded drives — from the
        Manage Students page, or delete your entire account from the Account page. Deletion is
        permanent and cannot be undone. Some information may persist briefly in routine backups
        before being overwritten.
      </p>

      <h3>9. Security</h3>
      <p>
        We use industry-standard measures including encrypted connections and database access rules
        that restrict each account to its own data. No online service can be guaranteed completely
        secure, and we cannot promise that unauthorized access will never occur.
      </p>

      <h3>10. Your choices</h3>
      <ul>
        <li>View and edit student information from the Manage Students page</li>
        <li>Delete individual drives, individual students, or your entire account at any time</li>
        <li>Revoke a shared user's access from the student's dashboard</li>
        <li>Change the email address that receives weekly progress updates</li>
        <li>Reset your password from the Account page</li>
      </ul>

      <h3>11. Changes to this Policy</h3>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected in
        the "Last updated" date above.
      </p>

      <h3>12. Contact</h3>
      <p>
        Questions about this Privacy Policy, or requests regarding a student driver's information,
        may be directed to DevWorks LLC at the contact address published with the Service.
      </p>
    </div>
  );
}
