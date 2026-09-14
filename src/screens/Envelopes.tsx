import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft, faBoxArchive, faCartShopping, faCirclePlus, faClockRotateLeft,
  faEnvelopeOpenText, faGripVertical, faPen, faPlus, faRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import {
  DndContext, PointerSensor, TouchSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Envelope, Household } from '../lib/types';
import { cashBalance, envelopeBalance, sortedEnvelopes, todayISO, uid } from '../lib/store';
import { api } from '../lib/cloud';
import { czk } from '../lib/format';
import { Button, Card, EmptyState, Input, Label, Modal, Select, cn, seriesColor } from '../ui';
import { ENVELOPE_ICONS, envelopeIcon } from '../icons';
import { AmountDateFields } from './Dashboard';
import { History } from './History';
import { evalAmount } from '../lib/calc';

type Props = { household: Household; userId: string };

type ModalState =
  | { kind: 'create' }
  | { kind: 'edit'; envelope: Envelope }
  | { kind: 'expense'; envelope: Envelope }
  | { kind: 'add'; envelope: Envelope }
  | { kind: 'transfer'; envelope: Envelope }
  | null;

export function Envelopes({ household: h, userId }: Props) {
  const [modal, setModal] = useState<ModalState>(null);
  const [historyEnv, setHistoryEnv] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // local order for instant feedback while the write is in flight
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const sorted = sortedEnvelopes(h);
  const active = pendingOrder
    ? pendingOrder
        .map(id => sorted.find(e => e.id === id))
        .filter((e): e is Envelope => !!e)
        .concat(sorted.filter(e => !pendingOrder.includes(e.id)))
    : sorted;
  const archived = h.envelopes.filter(e => e.archived);
  const cash = cashBalance(h);

  const now = () => new Date().toISOString();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  /** Most-used past notes for this envelope's expenses (frequency, then recency). */
  const noteSuggestions = (envelopeId: string): string[] => {
    const stats = new Map<string, { note: string; count: number; last: string }>();
    for (const t of h.txs) {
      if (t.type !== 'expense' || t.envelopeId !== envelopeId) continue;
      const note = t.note.trim();
      if (!note) continue;
      const key = note.toLowerCase();
      const cur = stats.get(key);
      if (cur) {
        cur.count += 1;
        if (t.date > cur.last) { cur.last = t.date; cur.note = note; }
      } else {
        stats.set(key, { note, count: 1, last: t.date });
      }
    }
    return [...stats.values()]
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .map(x => x.note)
      .slice(0, 12);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const ids = active.map(x => x.id);
    const next = arrayMove(ids, ids.indexOf(String(a.id)), ids.indexOf(String(over.id)));
    setPendingOrder(next);
    api.reorderEnvelopes(next).finally(() => setPendingOrder(null));
  };

  if (historyEnv) {
    return <History household={h} userId={userId} initialEnvelopeId={historyEnv} onClose={() => setHistoryEnv(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Конверти</h2>
        <Button onClick={() => setModal({ kind: 'create' })} className="px-3 py-2 text-sm">
          <FontAwesomeIcon icon={faPlus} /> Новий
        </Button>
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState icon={<FontAwesomeIcon icon={faEnvelopeOpenText} />} text="Створіть перший конверт — категорію витрат, куди відкладатимете гроші." />
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={active.map(e => e.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map(env => (
                <SortableEnvelopeCard
                  key={env.id}
                  env={env}
                  balance={envelopeBalance(h, env.id)}
                  canTransfer={active.length > 1}
                  onEdit={() => setModal({ kind: 'edit', envelope: env })}
                  onHistory={() => setHistoryEnv(env.id)}
                  onExpense={() => setModal({ kind: 'expense', envelope: env })}
                  onAdd={() => setModal({ kind: 'add', envelope: env })}
                  onTransfer={() => setModal({ kind: 'transfer', envelope: env })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {archived.length > 0 && (
        <div>
          <button className="text-sm text-muted-foreground underline" onClick={() => setShowArchived(v => !v)}>
            {showArchived ? 'Сховати архів' : `Архів (${archived.length})`}
          </button>
          {showArchived && (
            <div className="mt-2 space-y-2">
              {archived.map(env => (
                <Card key={env.id} className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">{env.name} · {czk(envelopeBalance(h, env.id))}</span>
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => api.updateEnvelope({ ...env, archived: false })}>
                    <FontAwesomeIcon icon={faRotateLeft} /> Відновити
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {modal?.kind === 'create' && (
        <EnvelopeForm
          title="Новий конверт"
          usedSlots={h.envelopes.map(e => e.colorSlot)}
          onClose={() => setModal(null)}
          onSave={(name, icon, colorSlot) => {
            const maxOrder = Math.max(-1, ...h.envelopes.map(e => e.order ?? -1));
            api.addEnvelope({ id: uid(), name, icon, colorSlot, archived: false, createdAt: now(), order: maxOrder + 1 });
            setModal(null);
          }}
        />
      )}

      {modal?.kind === 'edit' && (
        <EnvelopeForm
          title="Редагувати конверт"
          initial={modal.envelope}
          usedSlots={h.envelopes.filter(e => e.id !== modal.envelope.id).map(e => e.colorSlot)}
          onClose={() => setModal(null)}
          onSave={(name, icon, colorSlot) => {
            api.updateEnvelope({ ...modal.envelope, name, icon, colorSlot });
            setModal(null);
          }}
          onArchive={() => {
            api.updateEnvelope({ ...modal.envelope, archived: true });
            setModal(null);
          }}
        />
      )}

      {modal?.kind === 'expense' && (
        <TxModal
          title={`Витрата · ${modal.envelope.name}`}
          submitLabel="Записати витрату"
          max={undefined}
          hint={`У конверті: ${czk(envelopeBalance(h, modal.envelope.id))}`}
          noteLabel="На що витрачено"
          notePlaceholder="Напр., продукти в Albert"
          noteSuggestions={noteSuggestions(modal.envelope.id)}
          onClose={() => setModal(null)}
          onSave={(amount, note, date) => {
            api.addTx({ id: uid(), type: 'expense', envelopeId: modal.envelope.id, amount, note, userId, date, createdAt: now() });
            setModal(null);
          }}
        />
      )}

      {modal?.kind === 'add' && (
        <TxModal
          title={`Поповнити · ${modal.envelope.name}`}
          submitLabel="Поповнити"
          max={cash}
          maxError={c => `У касі лише ${czk(c)}`}
          hint={`Доступно в касі: ${czk(cash)}`}
          notePlaceholder="Напр., на продукти до кінця місяця"
          onClose={() => setModal(null)}
          onSave={(amount, note, date) => {
            api.addTx({ id: uid(), type: 'allocate', envelopeId: modal.envelope.id, amount, note, userId, date, createdAt: now() });
            setModal(null);
          }}
        />
      )}

      {modal?.kind === 'transfer' && (
        <TransferModal
          household={h}
          from={modal.envelope}
          onClose={() => setModal(null)}
          onSave={(toEnvelopeId, amount, temporary, note, date) => {
            api.addTx({
              id: uid(), type: 'transfer', fromEnvelopeId: modal.envelope.id, toEnvelopeId,
              amount, temporary, note, userId, date, createdAt: now(),
            });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function SortableEnvelopeCard({ env, balance, canTransfer, onEdit, onHistory, onExpense, onAdd, onTransfer }: {
  env: Envelope;
  balance: number;
  canTransfer: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onExpense: () => void;
  onAdd: () => void;
  onTransfer: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: env.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'z-10 opacity-90')}
    >
      <Card className={cn('p-4', isDragging && 'shadow-lg ring-2 ring-ring')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              aria-label="Перетягнути, щоб змінити порядок"
              className="-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-accent active:cursor-grabbing"
            >
              <FontAwesomeIcon icon={faGripVertical} />
            </button>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: seriesColor(env.colorSlot) }}>
              <FontAwesomeIcon icon={envelopeIcon(env.icon)} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{env.name}</p>
              <p className={cn('text-sm', balance < 0 ? 'text-destructive' : 'text-muted-foreground')}>{czk(balance)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <button className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent" onClick={onHistory} aria-label="Історія конверта">
              <FontAwesomeIcon icon={faClockRotateLeft} className="text-xs" />
            </button>
            <button className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent" onClick={onEdit} aria-label="Редагувати">
              <FontAwesomeIcon icon={faPen} className="text-xs" />
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={onExpense}>
            <FontAwesomeIcon icon={faCartShopping} /> Витрата
          </Button>
          <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={onAdd}>
            <FontAwesomeIcon icon={faCirclePlus} /> Поповнити
          </Button>
          <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={onTransfer} disabled={!canTransfer}>
            <FontAwesomeIcon icon={faArrowRightArrowLeft} /> Переказ
          </Button>
        </div>
      </Card>
    </div>
  );
}

function EnvelopeForm({ title, initial, usedSlots, onClose, onSave, onArchive }: {
  title: string;
  initial?: Envelope;
  usedSlots: number[];
  onClose: () => void;
  onSave: (name: string, icon: string, colorSlot: number) => void;
  onArchive?: () => void;
}) {
  const freeSlot = [1, 2, 3, 4, 5, 6, 7, 8].find(s => !usedSlots.includes(s)) ?? ((usedSlots.length % 8) + 1);
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'basket');
  const [slot, setSlot] = useState(initial?.colorSlot ?? freeSlot);
  return (
    <Modal title={title} onClose={onClose}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim(), icon, slot); }}>
        <div>
          <Label>Назва</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Напр., Продукти" autoFocus required />
        </div>
        <div>
          <Label>Іконка</Label>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(ENVELOPE_ICONS).map(([key, def]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-label={key}
                className={cn(
                  'flex h-10 items-center justify-center rounded-lg border text-lg',
                  icon === key ? 'border-ring bg-accent' : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                <FontAwesomeIcon icon={def} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Колір</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                aria-label={`Колір ${s}`}
                className={cn('size-8 rounded-full border-2', slot === s ? 'border-ring' : 'border-transparent')}
                style={{ background: seriesColor(s) }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {onArchive && (
            <Button variant="secondary" onClick={onArchive} className="flex-1">
              <FontAwesomeIcon icon={faBoxArchive} /> В архів
            </Button>
          )}
          <Button type="submit" className="flex-1">Зберегти</Button>
        </div>
      </form>
    </Modal>
  );
}

function TxModal({ title, submitLabel, hint, noteLabel, notePlaceholder, noteSuggestions, max, maxError, onClose, onSave }: {
  title: string;
  submitLabel: string;
  hint?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  noteSuggestions?: string[];
  max?: number;
  maxError?: (max: number) => string;
  onClose: () => void;
  onSave: (amount: number, note: string, date: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        const a = evalAmount(amount);
        if (!a) return;
        if (max !== undefined && a > max) { setError(maxError?.(max) ?? 'Недостатньо коштів'); return; }
        onSave(a, note, date);
      }}>
        <AmountDateFields amount={amount} setAmount={setAmount} note={note} setNote={setNote} date={date} setDate={setDate} noteLabel={noteLabel} notePlaceholder={notePlaceholder} noteSuggestions={noteSuggestions} />
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">{submitLabel}</Button>
      </form>
    </Modal>
  );
}

function TransferModal({ household: h, from, onClose, onSave }: {
  household: Household;
  from: Envelope;
  onClose: () => void;
  onSave: (toEnvelopeId: string, amount: number, temporary: boolean, note: string, date: string) => void;
}) {
  const targets = sortedEnvelopes(h).filter(e => e.id !== from.id);
  const [toId, setToId] = useState(targets[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [temporary, setTemporary] = useState(true);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const bal = envelopeBalance(h, from.id);
  return (
    <Modal title={`Переказ із «${from.name}»`} onClose={onClose}>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        const a = evalAmount(amount);
        if (!a || !toId) return;
        if (a > bal) { setError(`У конверті лише ${czk(bal)}`); return; }
        onSave(toId, a, temporary, note, date);
      }}>
        <div>
          <Label>Куди</Label>
          <Select value={toId} onChange={e => setToId(e.target.value)}>
            {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <AmountDateFields amount={amount} setAmount={setAmount} note={note} setNote={setNote} date={date} setDate={setDate} notePlaceholder="Напр., тимчасово на ремонт" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={temporary} onChange={e => setTemporary(e.target.checked)} className="size-4 accent-current" />
          Тимчасово (позика — нагадаємо повернути)
        </label>
        <p className="text-sm text-muted-foreground">У конверті: {czk(bal)}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">Переказати</Button>
      </form>
    </Modal>
  );
}
