import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt } from '@fortawesome/free-solid-svg-icons';
import type { Household } from '../lib/types';
import { sortedEnvelopes, todayISO, uid } from '../lib/store';
import { api } from '../lib/cloud';
import { evalAmount } from '../lib/calc';
import { Button, Label, Modal, Select } from '../ui';
import { AmountDateFields } from './Dashboard';

const LAST_ENV_KEY = 'household-budget-quickadd-env';

/**
 * Guess the envelope from the merchant/note using expense history:
 * exact note match scores highest, then partial (one contains the other).
 * Only active envelopes win. Returns null when history says nothing.
 */
export function guessEnvelopeId(h: Household, note: string): string | null {
  const q = note.trim().toLowerCase();
  if (!q) return null;
  const active = new Set(h.envelopes.filter(e => !e.archived).map(e => e.id));
  const score = new Map<string, number>();
  for (const t of h.txs) {
    if (t.type !== 'expense' || !active.has(t.envelopeId)) continue;
    const n = t.note.trim().toLowerCase();
    if (!n) continue;
    let pts = 0;
    if (n === q) pts = 3;
    else if (n.includes(q) || q.includes(n)) pts = 1;
    if (pts) score.set(t.envelopeId, (score.get(t.envelopeId) ?? 0) + pts);
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [id, sc] of score) {
    if (sc > bestScore) { best = id; bestScore = sc; }
  }
  return best;
}

export type QuickAddParams = { amount: string; note: string };

/** Reads ?add=1&amount=..&note=.. once at startup and cleans the URL. */
export function readQuickAddParams(): QuickAddParams | null {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get('add') === null) return null;
    const params = { amount: p.get('amount') ?? '', note: p.get('note') ?? '' };
    window.history.replaceState({}, '', window.location.pathname);
    return params;
  } catch {
    return null;
  }
}

export function QuickAddModal({ household: h, userId, initial, onClose }: {
  household: Household;
  userId: string;
  initial: QuickAddParams;
  onClose: () => void;
}) {
  const envelopes = sortedEnvelopes(h);
  const [envelopeId, setEnvelopeId] = useState(() => {
    const guessed = guessEnvelopeId(h, initial.note);
    if (guessed) return guessed;
    try {
      const saved = localStorage.getItem(LAST_ENV_KEY);
      if (saved && envelopes.some(e => e.id === saved)) return saved;
    } catch { /* ignore */ }
    return envelopes[0]?.id ?? '';
  });
  // Apple Pay / Shortcuts can send "12,50" or "12.50 CZK" — keep only the number
  const [amount, setAmount] = useState(initial.amount.replace(/[^\d.,+\-*/()]/g, ''));
  const [note, setNote] = useState(initial.note);
  const [date, setDate] = useState(todayISO());

  const suggestions = (() => {
    const stats = new Map<string, { note: string; count: number; last: string }>();
    for (const t of h.txs) {
      if (t.type !== 'expense' || t.envelopeId !== envelopeId) continue;
      const n = t.note.trim();
      if (!n) continue;
      const key = n.toLowerCase();
      const cur = stats.get(key);
      if (cur) {
        cur.count += 1;
        if (t.date > cur.last) { cur.last = t.date; cur.note = n; }
      } else {
        stats.set(key, { note: n, count: 1, last: t.date });
      }
    }
    return [...stats.values()]
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .map(x => x.note)
      .slice(0, 12);
  })();

  return (
    <Modal title="Швидка витрата" onClose={onClose}>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        const a = evalAmount(amount);
        if (!a || !envelopeId) return;
        try { localStorage.setItem(LAST_ENV_KEY, envelopeId); } catch { /* ignore */ }
        api.addTx({
          id: uid(), type: 'expense', envelopeId, amount: a,
          note: note.trim(), userId, date, createdAt: new Date().toISOString(),
        });
        onClose();
      }}>
        <div>
          <Label>Конверт</Label>
          <Select value={envelopeId} onChange={e => setEnvelopeId(e.target.value)}>
            {envelopes.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
          </Select>
          {guessEnvelopeId(h, initial.note) === envelopeId && initial.note.trim() !== '' && (
            <p className="mt-1 text-xs text-muted-foreground">Конверт підібрано за «{initial.note.trim()}» — перевірте і за потреби змініть.</p>
          )}
        </div>
        <AmountDateFields
          amount={amount} setAmount={setAmount}
          note={note} setNote={setNote}
          date={date} setDate={setDate}
          noteLabel="На що витрачено"
          notePlaceholder="Напр., продукти в Albert"
          noteSuggestions={suggestions}
        />
        <Button type="submit" className="w-full" disabled={!envelopeId}>
          <FontAwesomeIcon icon={faBolt} /> Записати витрату
        </Button>
      </form>
    </Modal>
  );
}
