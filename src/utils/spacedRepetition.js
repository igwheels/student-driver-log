/**
 * Spaced repetition scheduling (SM-2, simplified).
 *
 * A card's schedule is three numbers: `ease` (how easy it has proven),
 * `intervalDays` (how long until it is due again) and `reps` (consecutive
 * correct answers). Answer correctly and the interval grows by the ease
 * factor; answer wrong and the card resets to be seen again today.
 *
 * Deliberately pure and date-injectable so the schedule can be tested
 * without waiting days or stubbing the clock — see the checks run against
 * this module when it was added.
 */

export const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

/** Schedule for a card that has never been reviewed. */
export function initialProgress(cardId) {
  return {
    cardId,
    ease: DEFAULT_EASE,
    intervalDays: 0,
    reps: 0,
    correct: 0,
    incorrect: 0,
    dueAt: null, // never reviewed — treated as due immediately
    lastReviewedAt: null,
  };
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Apply an answer to a card's progress and return the updated progress.
 * `now` is injectable for testing.
 */
export function applyAnswer(progress, wasCorrect, now = new Date()) {
  const p = progress ?? initialProgress(null);

  if (!wasCorrect) {
    // Reset the ladder but keep the ease penalty modest, so one slip on a
    // card that is otherwise well known doesn't bury it in short intervals
    // for weeks.
    return {
      ...p,
      ease: Math.max(MIN_EASE, p.ease - 0.2),
      intervalDays: 0,
      reps: 0,
      incorrect: (p.incorrect ?? 0) + 1,
      dueAt: now.toISOString(), // due again this session
      lastReviewedAt: now.toISOString(),
    };
  }

  const reps = (p.reps ?? 0) + 1;
  // First two correct answers use fixed short steps; after that the interval
  // compounds by the ease factor. This is the standard SM-2 ramp.
  let intervalDays;
  if (reps === 1) intervalDays = 1;
  else if (reps === 2) intervalDays = 3;
  else intervalDays = Math.round((p.intervalDays || 1) * p.ease);

  return {
    ...p,
    ease: Math.min(3.0, p.ease + 0.1),
    intervalDays,
    reps,
    correct: (p.correct ?? 0) + 1,
    dueAt: addDays(now, intervalDays).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

/** A card with no progress, or whose dueAt has passed, is due. */
export function isDue(progress, now = new Date()) {
  if (!progress || !progress.dueAt) return true;
  return new Date(progress.dueAt).getTime() <= now.getTime();
}

/**
 * Choose the cards to review this session.
 *
 * Due cards first, oldest due date first so the most overdue comes back
 * soonest; never-seen cards after those, in deck order, so a new deck is
 * introduced steadily rather than all at once.
 */
export function buildSession(cards, progressById, { limit = 10, now = new Date() } = {}) {
  const due = [];
  const fresh = [];

  for (const card of cards) {
    const p = progressById[card.id];
    if (!p || !p.lastReviewedAt) fresh.push(card);
    else if (isDue(p, now)) due.push(card);
  }

  due.sort((a, b) => new Date(progressById[a.id].dueAt) - new Date(progressById[b.id].dueAt));

  return [...due, ...fresh].slice(0, limit);
}

/** Headline counts for the dashboard entry point. */
export function deckStats(cards, progressById, now = new Date()) {
  let seen = 0;
  let dueNow = 0;
  let correct = 0;
  let incorrect = 0;

  for (const card of cards) {
    const p = progressById[card.id];
    if (p && p.lastReviewedAt) {
      seen++;
      correct += p.correct ?? 0;
      incorrect += p.incorrect ?? 0;
      if (isDue(p, now)) dueNow++;
    } else {
      dueNow++; // never seen counts as available to study
    }
  }

  const answered = correct + incorrect;
  return {
    total: cards.length,
    seen,
    dueNow,
    correct,
    incorrect,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : null,
  };
}
