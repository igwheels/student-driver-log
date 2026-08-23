import { NE_DECK } from './ne';

/**
 * Per-state flashcard decks.
 *
 * A state appears here only once a deck has been built from that state's
 * official driver's manual and each card carries the manual page it came
 * from. States absent from this map are absent on purpose: the app says so
 * and links to the official manual, rather than serving generic questions
 * that would read as state material.
 *
 * That distinction matters more than coverage. Speed limits, parking
 * distances, BAC thresholds and GDL restrictions genuinely differ between
 * states, so a card that is merely plausible could have someone studying the
 * wrong number for a real permit test.
 *
 * To add a state: build the deck from its manual, add it here with the
 * manual's URL and the edition the deck was written against.
 */
export const DECKS = {
  NE: {
    cards: NE_DECK,
    manualName: 'Nebraska Driver’s Manual (Class O)',
    manualUrl: 'https://dmv.nebraska.gov/manuals',
    edition: 'January 2025 edition',
  },
};

// Where to send someone whose state has no deck yet, so the page is still
// useful rather than a dead end.
export const STATE_MANUAL_SEARCH = 'https://www.google.com/search?q=';

export function getDeck(stateCode) {
  return DECKS[stateCode] ?? null;
}

export function hasDeck(stateCode) {
  return Boolean(DECKS[stateCode]);
}
