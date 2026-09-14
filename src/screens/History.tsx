import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faChevronRight, faClockRotateLeft, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import type { Household, Tx } from '../lib/types';
import { sortedEnvelopes } from '../lib/store';
import { api } from '../lib/cloud';
import { czk, dateLabel, monthLabel } from '../lib/format';
import { Button, Card, EmptyState, Input, Select } from '../ui';
import { EditTxModal, txLabelFor } from './Dashboard';

const PAGE = 50;

type Props = { household: Household; userId: string; onClose: () => void; initialEnvelopeId?: string };

export function History({ household: h, userId, onClose, initialEnvelopeId }: Props) {
  const [type, setType] = useState('all');
  const [envelopeId, setEnvelopeId] = useState(initialEnvelopeId ?? 'all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editTx, setEditTx] = useState<Tx | null>(null);

  const userName = (id: string) => h.users.find(u => u.id === id)?.name ?? '—';
  const envelopes = sortedEnvelopes(h);
  const archivedEnvelopes = h.envelopes.filter(e => e.archived);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...h.txs]
      .filter((t) => {
        if (type === 'income' && t.type !== 'income') return false;
        if (type === 'expense' && t.type !== 'expense') return false;
        if (type === 'allocate' && t.type !== 'allocate' && t.type !== 'return') return false;
        if (type === 'transfer' && t.type !== 'transfer') return false;
        if (envelopeId !== 'all') {
          const touches =
            (t.type === 'allocate' || t.type === 'return' || t.type === 'expense')
              ? t.envelopeId === envelopeId
              : t.type === 'transfer'
                ? t.fromEnvelopeId === envelopeId || t.toEnvelopeId === envelopeId
                : false;
          if (!touches) return false;
        }
        if (q && !t.note.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [h, type, envelopeId, query]);

  const visible = filtered.slice(0, limit);
  const expensesSum = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // group by month for headers
  const groups: Array<{ month: string; txs: Tx[] }> = [];
  for (const t of visible) {
    const m = t.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === m) last.txs.push(t);
    else groups.push({ month: m, txs: [t] });
  }

  const txSign = (t: Tx): string => (t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onClose} aria-label="Назад" className="flex size-9 items-center justify-center rounded-lg hover:bg-accent">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 className="text-lg font-semibold">Всі операції</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={type} onChange={e => { setType(e.target.value); setLimit(PAGE); }}>
          <option value="all">Всі типи</option>
          <option value="expense">Витрати</option>
          <option value="income">Поповнення каси</option>
          <option value="allocate">Каса ⇄ конверти</option>
          <option value="transfer">Перекази</option>
        </Select>
        <Select value={envelopeId} onChange={e => { setEnvelopeId(e.target.value); setLimit(PAGE); }}>
          <option value="all">Всі конверти</option>
          {envelopes.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
          {archivedEnvelopes.map(en => <option key={en.id} value={en.id}>{en.name} (архів)</option>)}
        </Select>
        <div className="relative">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" />
          <Input className="pl-8" placeholder="Пошук у нотатках" value={query} onChange={e => { setQuery(e.target.value); setLimit(PAGE); }} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Знайдено: {filtered.length}
        {expensesSum > 0 && <> · витрат на {czk(expensesSum)}</>}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<FontAwesomeIcon icon={faClockRotateLeft} />} text="Нічого не знайдено за цими фільтрами." />
        </Card>
      ) : (
        <Card className="p-4">
          {groups.map(g => (
            <div key={g.month}>
              <h3 className="sticky top-14 bg-card py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:top-0">
                {monthLabel(g.month)}
              </h3>
              <ul className="divide-y divide-border">
                {g.txs.map((t) => {
                  const own = t.userId === userId;
                  const inner = (
                    <>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate">{txLabelFor(h, t)}{t.note ? ` · ${t.note}` : ''}</p>
                        <p className="text-xs text-muted-foreground">{dateLabel(t.date)} · {userName(t.userId)}</p>
                      </div>
                      <span className={t.type === 'expense' ? 'font-medium text-destructive' : t.type === 'income' ? 'font-medium' : 'text-muted-foreground'}>
                        {txSign(t)}{czk(t.amount)}
                      </span>
                      {own && <FontAwesomeIcon icon={faChevronRight} className="text-xs text-muted-foreground/50" />}
                    </>
                  );
                  return (
                    <li key={t.id}>
                      {own ? (
                        <button className="flex w-full items-center gap-3 py-2.5 text-sm hover:bg-accent/50" onClick={() => setEditTx(t)}>
                          {inner}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 py-2.5 text-sm">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {filtered.length > limit && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit(l => l + PAGE)}>
              Показати ще {Math.min(PAGE, filtered.length - limit)}
            </Button>
          )}
        </Card>
      )}

      {editTx && (
        <EditTxModal
          tx={editTx}
          label={txLabelFor(h, editTx)}
          onClose={() => setEditTx(null)}
          onSave={(amount, date) => {
            api.updateTx(editTx.id, { amount, date });
            setEditTx(null);
          }}
          onDelete={() => {
            api.deleteTx(editTx);
            setEditTx(null);
          }}
        />
      )}
    </div>
  );
}
