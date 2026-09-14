import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft, faChevronRight, faCircleMinus, faCirclePlus, faClockRotateLeft, faSackDollar, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import type { Household, Tx } from '../lib/types';
import { cashBalance, envelopeBalance, openLoans, sortedEnvelopes, todayISO, uid } from '../lib/store';
import { api } from '../lib/cloud';
import { czk, dateLabel } from '../lib/format';
import { evalAmount, isExpression } from '../lib/calc';
import { Button, Card, EmptyState, Input, Label, Modal, Select, seriesColor } from '../ui';
import { envelopeIcon } from '../icons';
import { History } from './History';

type Props = { household: Household; userId: string };

export function Dashboard({ household: h, userId }: Props) {
  const [modal, setModal] = useState<'income' | 'allocate' | null>(null);
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const cash = cashBalance(h);
  const envelopes = sortedEnvelopes(h);
  const totalInEnvelopes = envelopes.reduce((s, e) => s + envelopeBalance(h, e.id), 0);
  const loans = openLoans(h);
  const recent = [...h.txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  const userName = (id: string) => h.users.find(u => u.id === id)?.name ?? '—';
  const envName = (id: string) => h.envelopes.find(e => e.id === id)?.name ?? '—';
  const txLabel = (t: Tx): string => txLabelFor(h, t);
  const txSign = (t: Tx): string =>
    t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';

  if (showHistory) {
    return <History household={h} userId={userId} onClose={() => setShowHistory(false)} />;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Спільна каса</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{czk(cash)}</p>
        <p className="mt-1 text-sm text-muted-foreground">У конвертах: {czk(totalInEnvelopes)}</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => setModal('income')} className="flex-1">
            <FontAwesomeIcon icon={faCirclePlus} /> Додати гроші
          </Button>
          <Button variant="secondary" onClick={() => setModal('allocate')} className="flex-1" disabled={envelopes.length === 0}>
            <FontAwesomeIcon icon={faSackDollar} /> У конверт
          </Button>
        </div>
      </Card>

      {loans.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-muted-foreground" />
            Тимчасові позики
          </h3>
          <ul className="space-y-2">
            {loans.map(loan => (
              <li key={loan.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {envName(loan.toEnvelopeId)} винен {envName(loan.fromEnvelopeId)}{' '}
                  <strong>{czk(loan.amount)}</strong>
                </span>
                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => api.settleLoan(loan, userId)}>
                  Повернути
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      </div>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Останні операції</h3>
          {h.txs.length > 0 && (
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowHistory(true)}>
              <FontAwesomeIcon icon={faClockRotateLeft} className="text-xs" /> Всі операції
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={<FontAwesomeIcon icon={faCircleMinus} />} text="Поки що немає операцій. Почніть з поповнення каси." />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map(t => {
              const own = t.userId === userId;
              const inner = (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate">{txLabel(t)}{t.note ? ` · ${t.note}` : ''}</p>
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
        )}
      </Card>

      {modal === 'income' && (
        <IncomeModal onClose={() => setModal(null)} onSave={(amount, note, date) => {
          api.addTx({ id: uid(), type: 'income', amount, note, userId, date, createdAt: new Date().toISOString() });
          setModal(null);
        }} />
      )}
      {editTx && (
        <EditTxModal
          tx={editTx}
          label={txLabel(editTx)}
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
      {modal === 'allocate' && (
        <AllocateModal household={h} cash={cash} onClose={() => setModal(null)} onSave={(envelopeId, amount, note, date) => {
          api.addTx({ id: uid(), type: 'allocate', envelopeId, amount, note, userId, date, createdAt: new Date().toISOString() });
          setModal(null);
        }} />
      )}
    </div>
  );
}


export function txLabelFor(h: Household, t: Tx): string {
  const envName = (id: string) => h.envelopes.find(e => e.id === id)?.name ?? '—';
  switch (t.type) {
    case 'income': return `Поповнення каси`;
    case 'allocate': return `Каса → ${envName(t.envelopeId)}`;
    case 'return': return `${envName(t.envelopeId)} → Каса`;
    case 'expense': return `Витрата · ${envName(t.envelopeId)}`;
    case 'transfer': return `${envName(t.fromEnvelopeId)} → ${envName(t.toEnvelopeId)}`;
  }
}

export function AmountDateFields(props: {
  amount: string; setAmount: (v: string) => void;
  note: string; setNote: (v: string) => void;
  date: string; setDate: (v: string) => void;
  noteLabel?: string;
  notePlaceholder?: string;
  noteSuggestions?: string[];
}) {
  const value = evalAmount(props.amount);
  const expr = props.amount.trim() !== '' && isExpression(props.amount);
  const chips = (props.noteSuggestions ?? [])
    .filter(sg => sg.toLowerCase() !== props.note.trim().toLowerCase())
    .filter(sg => !props.note.trim() || sg.toLowerCase().includes(props.note.trim().toLowerCase()))
    .slice(0, 6);
  return (
    <>
      <div>
        <Label>Сума, CZK</Label>
        <Input
          type="text"
          inputMode="decimal"
          value={props.amount}
          onChange={e => props.setAmount(e.target.value)}
          placeholder="Напр., 120+85*2"
          autoFocus
          required
        />
        {expr && (
          <p className={value !== null ? 'mt-1 text-sm font-medium' : 'mt-1 text-sm text-muted-foreground'}>
            {value !== null ? `= ${czk(value)}` : '…'}
          </p>
        )}
        {!expr && props.amount.trim() !== '' && value === null && (
          <p className="mt-1 text-sm text-destructive">Некоректна сума</p>
        )}
      </div>
      <div>
        <Label>{props.noteLabel ?? 'Нотатка (необовʼязково)'}</Label>
        <Input value={props.note} onChange={e => props.setNote(e.target.value)} placeholder={props.notePlaceholder ?? 'Напр., зарплата'} />
        {chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map(sg => (
              <button
                key={sg}
                type="button"
                onClick={() => props.setNote(sg)}
                className="max-w-full truncate rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-accent"
              >
                {sg}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label>Дата</Label>
        <Input type="date" value={props.date} onChange={e => props.setDate(e.target.value)} required />
      </div>
    </>
  );
}

function IncomeModal({ onClose, onSave }: { onClose: () => void; onSave: (amount: number, note: string, date: string) => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  return (
    <Modal title="Додати гроші в касу" onClose={onClose}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const a = evalAmount(amount); if (a) onSave(a, note, date); }}>
        <AmountDateFields amount={amount} setAmount={setAmount} note={note} setNote={setNote} date={date} setDate={setDate} notePlaceholder="Напр., зарплата за серпень" />
        <Button type="submit" className="w-full">Додати</Button>
      </form>
    </Modal>
  );
}

function AllocateModal({ household: h, cash, onClose, onSave }: {
  household: Household; cash: number; onClose: () => void;
  onSave: (envelopeId: string, amount: number, note: string, date: string) => void;
}) {
  const envelopes = sortedEnvelopes(h);
  const [envelopeId, setEnvelopeId] = useState(envelopes[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  return (
    <Modal title="Покласти гроші в конверт" onClose={onClose}>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        const a = evalAmount(amount);
        if (!a) return;
        if (a > cash) { setError(`У касі лише ${czk(cash)}`); return; }
        onSave(envelopeId, a, note, date);
      }}>
        <div>
          <Label>Конверт</Label>
          <Select value={envelopeId} onChange={e => setEnvelopeId(e.target.value)}>
            {envelopes.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
          </Select>
        </div>
        <AmountDateFields amount={amount} setAmount={setAmount} note={note} setNote={setNote} date={date} setDate={setDate} notePlaceholder="Напр., на продукти до кінця місяця" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">Доступно в касі: {czk(cash)}</p>
        <Button type="submit" className="w-full" disabled={!envelopeId}>Покласти</Button>
      </form>
    </Modal>
  );
}

export function EnvelopeChip({ household: h, envelopeId }: { household: Household; envelopeId: string }) {
  const env = h.envelopes.find(e => e.id === envelopeId);
  if (!env) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="flex size-5 items-center justify-center rounded text-[10px] text-white" style={{ background: seriesColor(env.colorSlot) }}>
        <FontAwesomeIcon icon={envelopeIcon(env.icon)} />
      </span>
      {env.name}
    </span>
  );
}

export function EditTxModal({ tx, label, onClose, onSave, onDelete }: {
  tx: Tx;
  label: string;
  onClose: () => void;
  onSave: (amount: number, date: string) => void;
  onDelete: () => void;
}) {
  const [amount, setAmount] = useState(String(tx.amount));
  const [date, setDate] = useState(tx.date);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSettledLoan = tx.type === 'transfer' && tx.temporary && !!tx.settledBy;
  return (
    <Modal title="Операція" onClose={onClose}>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        const a = evalAmount(amount);
        if (a && date) onSave(a, date);
      }}>
        <div className="rounded-lg bg-secondary/60 p-3 text-sm">
          <p>{label}{tx.note ? ` · ${tx.note}` : ''}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel(tx.date)}</p>
        </div>
        <div>
          <Label>Сума, CZK</Label>
          <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoFocus required />
          {isExpression(amount) && evalAmount(amount) !== null && (
            <p className="mt-1 text-sm font-medium">= {czk(evalAmount(amount)!)}</p>
          )}
        </div>
        <div>
          <Label>Дата</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        {isSettledLoan && (
          <p className="text-xs text-muted-foreground">
            Ця позика вже повернута — після зміни суми відкоригуйте і операцію повернення.
          </p>
        )}
        <div className="flex gap-2">
          {confirmDelete ? (
            <Button variant="destructive" className="flex-1" onClick={onDelete}>
              <FontAwesomeIcon icon={faTrashCan} /> Точно видалити?
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(true)}>
              <FontAwesomeIcon icon={faTrashCan} /> Видалити
            </Button>
          )}
          <Button type="submit" className="flex-1">Зберегти</Button>
        </div>
      </form>
    </Modal>
  );
}
