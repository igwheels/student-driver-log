import React, { useState } from 'react';
import { getSharePlatform } from '../utils/device';
import { shareContent } from '../utils/share';

function IOSShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function AndroidShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function GenericShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9" />
    </svg>
  );
}

export default function ShareButton({ title, text, url }) {
  const platform = getSharePlatform();
  const [copied, setCopied] = useState(false);

  const handleShare = () =>
    shareContent(
      { title, text, url },
      {
        onCopied: () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
      }
    );

  const Icon = platform === 'ios' ? IOSShareIcon : platform === 'android' ? AndroidShareIcon : GenericShareIcon;

  return (
    <div className="share-btn-wrapper">
      <button className="share-btn" onClick={handleShare} title="Share" aria-label="Share">
        <Icon />
      </button>
      {copied && <div className="share-toast">Link copied</div>}
    </div>
  );
}
