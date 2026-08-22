import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startMileageTracking } from '../utils/geo';
import { keepScreenAwake } from '../utils/device';
import { savePendingDrive } from '../utils/pendingDrive';

// What to tell the driver about GPS before any mileage has accumulated.
// `warning: true` means mileage will not be recorded in this state, so it is
// worth interrupting for — the drive would otherwise save with no distance
// and no map, with nothing having looked wrong along the way.
function gpsNotice({ status, accuracy }) {
  switch (status) {
    case 'tracking':
      return { label: 'GPS ready — 0.0 mi so far' };
    case 'imprecise':
      return {
        label: accuracy ? `Location too imprecise (±${Math.round(accuracy)} m)` : 'Location too imprecise',
        warning: true,
        hint: "Mileage won't be recorded. Turn on precise location for this site in your browser or phone settings, then restart the drive.",
      };
    case 'denied':
      return {
        label: 'Location access blocked',
        warning: true,
        hint: "Mileage won't be recorded. Allow location for this site in your browser settings, then restart the drive. You can still log the distance by hand.",
      };
    case 'unavailable':
      return {
        label: 'GPS signal unavailable',
        warning: true,
        hint: "Mileage won't be recorded until a signal is found — this is common indoors or in a garage.",
      };
    case 'unsupported':
      return {
        label: 'GPS not supported on this device',
        warning: true,
        hint: 'You can still time the drive and enter the distance by hand.',
      };
    default:
      return { label: 'Waiting for GPS…' };
  }
}

export default function DriveTimer() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [startTime] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [miles, setMiles] = useState(0);
  const [gps, setGps] = useState({ status: 'waiting', accuracy: null });
  const interval = useRef(null);
  const trackingRef = useRef({ miles: 0, start: null, end: null, route: [] });
  const stopTracking = useRef(null);
  const releaseWakeLock = useRef(null);

  useEffect(() => {
    interval.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    stopTracking.current = startMileageTracking((update) => {
      trackingRef.current = update;
      setMiles(update.miles);
      setGps({ status: update.status, accuracy: update.accuracy });
    });
    releaseWakeLock.current = keepScreenAwake();
    return () => {
      clearInterval(interval.current);
      stopTracking.current?.();
      releaseWakeLock.current?.();
    };
  }, [startTime]);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const endDrive = () => {
    clearInterval(interval.current);
    stopTracking.current?.();
    const endTime = new Date();
    const { miles: trackedMiles, start, end, route } = trackingRef.current;
    const prefill = {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      distanceMiles: trackedMiles > 0 ? Number(trackedMiles.toFixed(1)) : null,
      startLocation: start,
      endLocation: end,
      route: route && route.length > 1 ? route : null,
    };

    // Navigation state alone is lost if the log form's tab reloads before the
    // drive is saved, which takes the GPS results with it — back it up, and
    // mark the URL so the form knows to look. See src/utils/pendingDrive.js.
    savePendingDrive(studentId, prefill);
    navigate(`/log-drive/${studentId}?pending=1`, { state: { prefill }, replace: true });
  };

  return (
    <div className="timer-screen">
      <div className="timer-label">Drive in progress</div>
      <div className="timer-readout mono">{hh}:{mm}:{ss}</div>
      <div className="timer-hint">
        Started at {startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </div>
      {/* Always say something about GPS. A drive that records nothing should
          look wrong while it's happening, not at save time. */}
      {miles > 0 ? (
        <div className="timer-miles mono">{miles.toFixed(1)} mi (GPS estimate)</div>
      ) : (
        <div className="timer-miles" style={gpsNotice(gps).warning ? { color: 'var(--danger)' } : undefined}>
          {gpsNotice(gps).label}
        </div>
      )}
      <button className="ignition-btn" onClick={endDrive}>End Drive</button>
      <p className="timer-gps-hint">
        {gpsNotice(gps).hint ??
          'Keep this screen open for accurate GPS mileage — tracking pauses if you switch apps or lock your phone.'}
      </p>
    </div>
  );
}
