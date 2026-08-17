import React from 'react';

/**
 * Speedometer-style dial gauge — the dashboard's signature element.
 * Sweeps 270° (from -135° to +135°) with tick marks that light up
 * as progress accrues, plus a needle and a digital (mono) readout.
 */
export default function Gauge({ label, value, goal, color = '#2F6FDE', size = 150 }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const center = size / 2;
  const outerR = size / 2 - 10;
  const tickCount = 28;
  const sweep = 270; // degrees
  const startAngle = -225; // so 0% points to lower-left, sweeping clockwise

  const toXY = (angleDeg, r) => {
    const rad = (angleDeg * Math.PI) / 180;
    return [center + r * Math.cos(rad), center + r * Math.sin(rad)];
  };

  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const t = i / tickCount;
    const angle = startAngle + t * sweep;
    const isMajor = i % 7 === 0;
    const r1 = outerR;
    const r2 = outerR - (isMajor ? 12 : 7);
    const [x1, y1] = toXY(angle, r1);
    const [x2, y2] = toXY(angle, r2);
    const lit = t <= pct + 0.001;
    return (
      <line
        key={i}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={lit ? color : 'rgba(255,255,255,0.18)'}
        strokeWidth={isMajor ? 2.5 : 1.5}
        strokeLinecap="round"
      />
    );
  });

  const needleAngle = startAngle + pct * sweep;
  const [nx, ny] = toXY(needleAngle, outerR - 26);

  const fmt = (mins) => `${Math.floor(mins / 60)}h${String(Math.round(mins % 60)).padStart(2, '0')}m`;

  return (
    <div className="gauge-wrap">
      <svg width={size} height={size}>
        {ticks}
        <line x1={center} y1={center} x2={nx} y2={ny} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <circle cx={center} cy={center} r={5} fill={color} />
        <text x={center} y={center + 26} textAnchor="middle" className="gauge-readout" fontSize="17">
          {fmt(value)}
        </text>
        <text x={center} y={center + 42} textAnchor="middle" className="gauge-goal" fontSize="10">
          of {Math.round(goal / 60)}h goal
        </text>
      </svg>
      <div className="gauge-label">{label}</div>
    </div>
  );
}
