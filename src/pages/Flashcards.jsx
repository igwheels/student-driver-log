import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getDeck } from '../data/flashcards';
import { applyAnswer, buildSession, deckStats, initialProgress } from '../utils/spacedRepetition';
import { loadProgress, saveCardProgress } from '../utils/flashcardProgress';

const SESSION_SIZE = 10;

export default function Flashcards() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { students } = useApp();
  const student = students.find((s) => s.id === studentId);

  const [progressById, setProgressById] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [session, setSession] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });

  const deck = student ? getDeck(student.state) : null;

  useEffect(() => {
    if (!student || !deck) return;
    let cancelled = false;
    loadProgress(student.ownerId, studentId)
      .then((p) => {
        if (cancelled) return;
        setProgressById(p);
        setSession(buildSession(deck.cards, p, { limit: SESSION_SIZE }));
      })
      .catch((e) => {
        console.error('Failed to load flashcard progress:', e);
        if (!cancelled) setLoadError('Could not load your review history. Check your connection and try again.');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, student?.ownerId, deck]);

  const stats = useMemo(
    () => (deck && progressById ? deckStats(deck.cards, progressById) : null),
    [deck, progressById]
  );

  if (!student) return <div className="page">Student not found.</div>;

  if (!deck) {
    return (
      <div className="page">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Permit practice</h2>
        <div className="quiz-card">
          <p style={{ margin: 0 }}>
            There's no question deck for {student.state} yet.
          </p>
          <p style={{ marginBottom: 0, marginTop: 12, fontSize: 14 }}>
            Decks are written from each state's official driver's manual, because the rules that get
            tested — speed limits, parking distances, alcohol limits — genuinely differ between
            states. Rather than show questions that might not match {student.state}'s manual, we'd
            rather show none.
          </p>
        </div>
        <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => navigate(`/dashboard/${studentId}`)}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const card = session[index];

  const handlePick = async (choiceIndex) => {
    if (picked !== null) return; // already answered this card
    setPicked(choiceIndex);

    const wasCorrect = choiceIndex === card.answer;
    setTally((t) => ({
      correct: t.correct + (wasCorrect ? 1 : 0),
      incorrect: t.incorrect + (wasCorrect ? 0 : 1),
    }));

    const updated = applyAnswer(progressById[card.id] ?? initialProgress(card.id), wasCorrect);
    updated.cardId = card.id;
    setProgressById((prev) => ({ ...prev, [card.id]: updated }));

    try {
      await saveCardProgress(student.ownerId, studentId, updated);
    } catch (e) {
      // The answer still counts for this session; only the schedule is lost.
      console.error('Failed to save flashcard progress:', e);
    }
  };

  const handleNext = () => {
    setPicked(null);
    if (index + 1 >= session.length) setSessionDone(true);
    else setIndex(index + 1);
  };

  const startAnother = () => {
    setSession(buildSession(deck.cards, progressById, { limit: SESSION_SIZE }));
    setIndex(0);
    setPicked(null);
    setTally({ correct: 0, incorrect: 0 });
    setSessionDone(false);
  };

  if (loadError) {
    return (
      <div className="page">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Permit practice</h2>
        <p style={{ color: 'var(--danger)' }}>{loadError}</p>
        <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => navigate(`/dashboard/${studentId}`)}>
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!progressById) return <div className="page">Loading…</div>;

  if (sessionDone || session.length === 0) {
    const nothingDue = session.length === 0;
    return (
      <div className="page">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>
          {nothingDue ? 'Nothing due right now' : 'Session complete'}
        </h2>

        {!nothingDue && (
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
            {tally.correct} of {tally.correct + tally.incorrect} correct this round.
          </p>
        )}
        {nothingDue && (
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
            Every card has been reviewed recently. Cards come back on a schedule — the ones answered
            wrong return soonest.
          </p>
        )}

        {stats && (
          <div className="dash-panel" style={{ flexDirection: 'column', gap: 6, padding: 20 }}>
            <div style={{ color: 'var(--white)' }}>
              {stats.seen} of {stats.total} cards seen
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              {stats.dueNow} due now
              {stats.accuracy != null ? ` · ${stats.accuracy}% correct all time` : ''}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {stats && stats.dueNow > 0 && (
            <button className="btn btn-primary" onClick={startAnother}>Review more</button>
          )}
          <button className="btn btn-outline" onClick={() => navigate(`/dashboard/${studentId}`)}>
            Back to dashboard
          </button>
        </div>

        <SourceNote deck={deck} />
      </div>
    );
  }

  const isCorrect = picked === card.answer;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Permit practice</h2>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {index + 1} of {session.length}
        </span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2, marginBottom: 20 }}>
        {card.category}
      </p>

      <div className="quiz-card" style={{ fontSize: 16 }}>{card.q}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        {card.choices.map((choice, i) => {
          const isAnswer = i === card.answer;
          const chosen = picked === i;
          let style = {};
          if (picked !== null && isAnswer) {
            style = { background: 'var(--success)', color: 'var(--white)', borderColor: 'var(--success)' };
          } else if (chosen && !isAnswer) {
            style = { background: 'var(--danger)', color: 'var(--white)', borderColor: 'var(--danger)' };
          }
          return (
            <button
              key={i}
              className="btn btn-ghost"
              style={{ textAlign: 'left', ...style }}
              disabled={picked !== null}
              onClick={() => handlePick(i)}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontWeight: 600, color: isCorrect ? 'var(--success)' : 'var(--danger)', marginBottom: 4 }}>
            {isCorrect ? 'Correct' : 'Not quite'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
            {deck.manualName}, {card.ref}
          </p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleNext}>
            {index + 1 >= session.length ? 'Finish' : 'Next'}
          </button>
        </div>
      )}

      <SourceNote deck={deck} />
    </div>
  );
}

function SourceNote({ deck }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 32 }}>
      Questions are written from the{' '}
      <a href={deck.manualUrl} target="_blank" rel="noopener noreferrer">{deck.manualName}</a>{' '}
      ({deck.edition}). This is practice material, not the official test — always study the manual
      itself, and check it for the current rules.
    </p>
  );
}
