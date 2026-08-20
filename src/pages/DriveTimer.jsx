import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startMileageTracking } from '../utils/geo';

export default function DriveTimer() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [startTime] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [miles, setMiles] = useState(0);
  const interval = useRef(null);
  const milesRef = useRef(0);
  const stopTracking = useRef(null);

  useEffect(() => {
    interval.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    stopTracking.current = startMileageTracking((total) => {
      milesRef.current = total;
      setMiles(total);
    });
    return () => {
      clearInterval(interval.current);
      stopTracking.current?.();
    };
  }, [startTime]);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const endDrive = () => {
    clearInterval(interval.current);
    stopTracking.current?.();
    const endTime = new Date();
    navigate(`/log-drive/${studentId}`, {
      state: {
        prefill: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          distanceMiles: milesRef.current > 0 ? Number(milesRef.current.toFixed(1)) : null,
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
    </div>
  );
}
