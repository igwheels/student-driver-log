export const ENCOURAGEMENTS = [
  "You're really shifting into gear! 🚗",
  'Steering your way to success, one drive at a time.',
  "Great drive! You're clearly going places.",
  "You put the 'drive' in driven — nice work today!",
  'Wheel done! Another great practice session. 🎡',
  "You're cruising toward that license faster than you think.",
  'Brake for a second and celebrate — that was a solid drive!',
  "You've got real wheel skills — and the drive to match! 🚗",
  'That was a smooth ride — no detours needed!',
  "You're really accelerating your progress today. 🏎️",
  "License to thrill: you're getting closer every drive!",
  'You handled that drive like a pro — gear job!',
  'Full steam ahead — your driving skills are really taking shape!',
  "Nice work — you're in the driver's seat of your own success.",
  'That drive was fuel for your confidence! ⛽',
  "You're not just driving — you're motor-vating toward your goal!",
  'Clutch performance out there today!',
  'You signaled great judgment behind the wheel.',
  'Another mile-stone reached — pun intended! 📍',
  "You're really turning heads with that driving progress.",
  'Park it right there — that was a great drive!',
  "You're cruising through these hours like a champ. 🛣️",
  'Not much vroom for improvement — that was excellent driving!',
  "You're driving your way to greatness, one lesson at a time.",
  "Highway to skilled: you're almost there! 🎉",
];

export function randomEncouragement() {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
}
