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
        <strong>Location data.</strong> If you use the drive timer and grant location permission,
        the Service records GPS coordinates during the drive: the starting location, the ending
        location, and the route travelled in between. This is used to calculate mileage
        automatically and to draw a map of the drive. Location is collected only while a drive is
        actively being timed, and only if you grant permission — you can decline and enter mileage
        manually instead, and you can revoke the permission at any time in your browser or device
        settings. Because these are precise coordinates of trips taken by a student driver, they may
        reveal frequently visited places such as a home, school, or workplace.
      </p>
      <p>
        <strong>Sharing information.</strong> If you share a dashboard, we store the email address
        you shared it with so we can grant that person access and send them an invitation. If
        someone requests access to a student's dashboard you own, we store their request until you
        approve or decline it.
      </p>
      <p>
        <strong>Student directory.</strong> To detect when a dashboard already exists for a given
        student, we store a directory entry keyed by an irreversible hash of the student's email
        address, containing the student's first name, the dashboard's identifier, and the owner's
        name. This lets the Service answer "does a dashboard for this address exist?" without making
        student records searchable or allowing the list of students to be enumerated.
      </p>
      <p>
        <strong>Email preferences.</strong> If you opt out of weekly progress emails, we store that
        preference against your email address so we stop sending them.
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
          To send weekly progress emails summarizing recorded hours — including a breakdown of
          recent drives and map images of GPS-tracked routes — to the student's email address, the
          account owner, and anyone the dashboard has been shared with, unless they have opted out
        </li>
        <li>To send an invitation email when a dashboard is shared with a new address</li>
        <li>To verify your email address when you create an account</li>
        <li>To calculate drive mileage and draw route maps from location data</li>
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

      <h3>8. Snapshot links you share</h3>
      <p>
        The Service can generate a "snapshot" link — a read-only view of a student's progress, or of
        a single drive, that you can send to family or friends. Please understand how these work
        before sharing one:
      </p>
      <ul>
        <li>
          The information is encoded <em>directly into the link itself</em>, not stored on our
          servers. Anyone who has the link can open it. There is no sign-in, and we cannot revoke a
          link once you have sent it.
        </li>
        <li>
          A progress snapshot contains the student's first name, their state's requirement, and
          their recorded hours.
        </li>
        <li>
          A snapshot of an individual drive contains the student's first name, the date, duration,
          road type, whether it was day or night, and the distance.
        </li>
        <li>
          <strong>Snapshot links contain no location data.</strong> Coordinates and routes are
          deliberately excluded, because a link cannot be revoked once sent and could otherwise
          reveal where a student drove — potentially including a home address. Maps are visible only
          inside the app, to you and to people you have shared the dashboard with.
        </li>
      </ul>

      <h3>9. Data retention and deletion</h3>
      <p>
        We retain your information for as long as your account is active. You may delete an
        individual student driver — along with all of that student's recorded drives — from the
        Manage Students page, or delete your entire account from the Account page. Deletion is
        permanent and cannot be undone. Some information may persist briefly in routine backups
        before being overwritten.
      </p>

      <h3>10. Security</h3>
      <p>
        We use industry-standard measures including encrypted connections and database access rules
        that restrict each account to its own data. No online service can be guaranteed completely
        secure, and we cannot promise that unauthorized access will never occur.
      </p>

      <h3>11. Your choices</h3>
      <ul>
        <li>View and edit student information from the Manage Students page</li>
        <li>Delete individual drives, individual students, or your entire account at any time</li>
        <li>Revoke a shared user's access from the student's dashboard</li>
        <li>Change the email address that receives weekly progress updates</li>
        <li>
          Decline or revoke location permission in your browser or device settings and enter mileage
          manually — the Account page shows the current permission status
        </li>
        <li>Opt out of weekly progress emails from the Account page or any email's unsubscribe link</li>
        <li>Reset your password from the Account page</li>
      </ul>

      <h3>12. Changes to this Policy</h3>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected in
        the "Last updated" date above.
      </p>

      <h3>13. Contact</h3>
      <p>
        Questions about this Privacy Policy, or requests regarding a student driver's information,
        may be directed to DevWorks LLC at <a href="mailto:ian@devworksllc.com">ian@devworksllc.com</a>.
      </p>
    </div>
  );
}
