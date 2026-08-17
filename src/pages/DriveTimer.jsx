import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function DriveTimer() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [startTime] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const interval = useRef(null);

  useEffect(() => {
    interval.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval.current);
  }, [startTime]);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const endDrive = () => {
    clearInterval(interval.current);
    const endTime = new Date();
    navigate(`/log-drive/${studentId}`, {
      state: { prefill: { startTime: startTime.toISOString(), endTime: endTime.toISOString() } },
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
      <button className="ignition-btn" onClick={endDrive}>End Drive</button>
    </div>
  );
}
