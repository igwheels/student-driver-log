export const ENCOURAGEMENTS = [
  'Another drive in the books — great work behind the wheel! 🚗',
  'Every mile makes you a safer driver. Keep it up!',
  "Nice driving! You're one step closer to that license. 🏁",
  'Practice makes progress — and you just made some!',
  'Way to go! Consistency behind the wheel pays off.',
  "Logged and locked in. You're building real driving skills!",
  'Smooth moves! Your hours are adding up fast.',
  "Great job today! Future you (with a license) says thanks. 🎉",
  "You're crushing this. Another drive closer to the goal!",
  'Steady progress — that license is getting closer every day.',
  'Buckle up for success — another drive complete! ⭐',
  'Awesome session! Your hard work is really adding up.',
  'One more drive down. Your dedication shows!',
  "Fantastic! Every hour of practice makes you road-ready.",
  'Keep rolling! Your progress gauge just got happier. 📈',
];

export function randomEncouragement() {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
}
