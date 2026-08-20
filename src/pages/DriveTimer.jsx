import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startMileageTracking } from '../utils/geo';
import { keepScreenAwake } from '../utils/device';

export default function DriveTimer() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [startTime] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [miles, setMiles] = useState(0);
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
    navigate(`/log-drive/${studentId}`, {
      state: {
        prefill: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          distanceMiles: trackedMiles > 0 ? Number(trackedMiles.toFixed(1)) : null,
          startLocation: start,
          endLocation: end,
          route: route && route.length > 1 ? route : null,
        },
      },
      replace: true,
    });
  };

  return (
    <div className="timer-screen">
      <div className="timer-label">Drive in progress</div>
      <div className="timer-readout mono">{hh}:{mm}:{ss}</div>
      <div className="timer-hint">
        Started at {startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </div>
      {miles > 0 && (
        <div className="timer-miles mono">{miles.toFixed(1)} mi (GPS estimate)</div>
      )}
      <button className="ignition-btn" onClick={endDrive}>End Drive</button>
      <p className="timer-gps-hint">
        Keep this screen open for accurate GPS mileage — tracking pauses if you switch apps or lock your phone.
      </p>
    </div>
  );
}
