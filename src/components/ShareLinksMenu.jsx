import React from 'react';
import { buildShareLinks } from '../utils/share';

/**
 * The email/SMS/WhatsApp/copy-link dropdown shown in place of the native
 * share sheet on devices that don't offer one (see hasNativeShare in
 * src/utils/share.js). Reuses the app's existing .menu-dropdown look (same
 * component the topbar's hamburger menu uses) and its click-outside-to-close
 * pattern, so this reads as the same kind of menu rather than a one-off.
 */
export default function ShareLinksMenu({ title, text, url, onClose, onCopyLink }) {
  const links = buildShareLinks({ title, text, url });

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={onClose} />
      <div className="menu-dropdown">
        <a href={links.email} onClick={onClose}>Email</a>
        <a href={links.sms} onClick={onClose}>Text message</a>
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" onClick={onClose}>
          WhatsApp
        </a>
        <button type="button" onClick={onCopyLink}>Copy link</button>
      </div>
    </>
  );
}
