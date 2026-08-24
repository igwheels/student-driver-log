/**
 * Validates every flashcard deck. Run with plain node, no dependencies:
 *
 *   node scripts/validate-decks.mjs
 *
 * This is the safety net for adding states. A malformed card fails loudly
 * here rather than silently marking a correct answer wrong in front of
 * someone studying for a real permit test — an out-of-range `answer` index
 * is the dangerous one, because nothing else in the app would notice.
 *
 * Exits non-zero on any error so it can gate a commit or CI step.
 */
import { DECKS } from '../src/data/flashcards/index.js';

const MIN_CARDS = 20; // a deck thinner than this isn't worth shipping as "covering" a manual

let errors = 0;
let warnings = 0;

const err = (msg) => { console.error(`  ERROR  ${msg}`); errors++; };
const warn = (msg) => { console.warn(`  warn   ${msg}`); warnings++; };

const states = Object.keys(DECKS).sort();
if (states.length === 0) {
  console.error('No decks registered.');
  process.exit(1);
}

for (const state of states) {
  const deck = DECKS[state];
  console.log(`\n${state} — ${deck.cards.length} cards`);

  for (const field of ['manualName', 'manualUrl', 'edition']) {
    if (!deck[field]) err(`${state}: deck is missing "${field}"`);
  }
  if (deck.manualUrl && !/^https:\/\//.test(deck.manualUrl)) {
    err(`${state}: manualUrl should be https`);
  }
  if (deck.cards.length < MIN_CARDS) {
    warn(`${state}: only ${deck.cards.length} cards (expected at least ${MIN_CARDS})`);
  }

  const ids = new Set();
  const questions = new Set();
  const categories = new Map();

  for (const c of deck.cards) {
    const where = `${state}/${c.id ?? '(no id)'}`;

    if (!c.id) err(`${where}: missing id`);
    else if (ids.has(c.id)) err(`${where}: duplicate id`);
    ids.add(c.id);

    if (!c.q || !c.q.trim()) err(`${where}: empty question`);
    else {
      const key = c.q.trim().toLowerCase();
      if (questions.has(key)) err(`${where}: duplicate question text`);
      questions.add(key);
    }

    if (!Array.isArray(c.choices) || c.choices.length < 2) {
      err(`${where}: needs at least 2 choices`);
    } else {
      if (new Set(c.choices.map((x) => String(x).trim().toLowerCase())).size !== c.choices.length) {
        err(`${where}: duplicate choices`);
      }
      if (c.choices.some((x) => !String(x).trim())) err(`${where}: has an empty choice`);
    }

    // The one that matters most: an index outside the choices array means the
    // card can never be answered correctly, and nothing at runtime detects it.
    if (!Number.isInteger(c.answer)) {
      err(`${where}: answer must be an integer index`);
    } else if (!Array.isArray(c.choices) || c.answer < 0 || c.answer >= c.choices.length) {
      err(`${where}: answer index ${c.answer} is out of range`);
    }

    if (!c.ref) err(`${where}: missing manual reference — every card must be traceable`);
    if (!c.category) err(`${where}: missing category`);
    else categories.set(c.category, (categories.get(c.category) ?? 0) + 1);
  }

  const cats = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`  ${cats.length} categories: ${cats.map(([k, v]) => `${k} (${v})`).join(', ')}`);
}

console.log(
  `\n${states.length} deck(s), ${states.reduce((n, s) => n + DECKS[s].cards.length, 0)} cards — ` +
  `${errors} error(s), ${warnings} warning(s)`
);
process.exit(errors > 0 ? 1 : 0);
