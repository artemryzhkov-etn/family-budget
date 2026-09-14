import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faCopy } from '@fortawesome/free-solid-svg-icons';
import type { Household } from '../lib/types';
import { allocatedInMonth, currentMonth, getBudget, sortedEnvelopes, spentInMonth } from '../lib/store';
import { api } from '../lib/cloud';
import { czk, monthLabel, shiftMonth } from '../lib/format';
import { Button, Card, EmptyState, Input, cn, seriesColor } from '../ui';
import { envelopeIcon } from '../icons';

type Props = { household: Household };

export function BudgetScreen({ household: h }: Props) {
  const [month, setMonth] = useState(currentMonth());
  const budget = getBudget(h, month);
  const envelopes = sortedEnvelopes(h);
  const planned = (envelopeId: string) => budget.items.find(i => i.envelopeId === envelopeId)?.planned ?? 0;

  const totalPlanned = budget.items.reduce((s, i) => s + i.planned, 0);
  const totalAllocated = envelopes.reduce((s, e) => s + allocatedInMonth(h, e.id, month), 0);
  const totalSpent = envelopes.reduce((s, e) => s + spentInMonth(h, e.id, month), 0);
  const prev = shiftMonth(month, -1);
  const prevHasBudget = getBudget(h, prev).items.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Бюджет</h2>
        <div className="flex items-center gap-1">
          <button className="flex size-8 items-center justify-center rounded-lg hover:bg-accent" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Попередній місяць">
            <FontAwesomeIcon icon={faChevronLeft} className="text-sm" />
          </button>
          <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
          <button className="flex size-8 items-center justify-center rounded-lg hover:bg-accent" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Наступний місяць">
            <FontAwesomeIcon icon={faChevronRight} className="text-sm" />
          </button>
        </div>
      </div>

      <Card className="grid grid-cols-3 divide-x divide-border p-0 text-center">
        {[
          ['План', totalPlanned],
          ['Покладено', totalAllocated],
          ['Витрачено', totalSpent],
        ].map(([label, val]) => (
          <div key={label as string} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm font-semibold">{czk(val as number)}</p>
          </div>
        ))}
      </Card>

      {budget.items.length === 0 && prevHasBudget && (
        <Button variant="secondary" className="w-full" onClick={() => api.copyBudget(getBudget(h, prev), month)}>
          <FontAwesomeIcon icon={faCopy} /> Скопіювати план з {monthLabel(prev)}
        </Button>
      )}

      {envelopes.length === 0 ? (
        <Card>
          <EmptyState icon={<FontAwesomeIcon icon={faCopy} />} text="Спочатку створіть конверти на вкладці «Конверти»." />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {envelopes.map(env => {
            const plan = planned(env.id);
            const alloc = allocatedInMonth(h, env.id, month);
            const spent = spentInMonth(h, env.id, month);
            const allocPct = plan > 0 ? Math.min(100, (alloc / plan) * 100) : 0;
            return (
              <Card key={env.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm text-white" style={{ background: seriesColor(env.colorSlot) }}>
                      <FontAwesomeIcon icon={envelopeIcon(env.icon)} />
                    </div>
                    <p className="truncate font-medium">{env.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      className="w-24 py-1.5 text-right"
                      value={plan === 0 ? '' : String(plan)}
                      placeholder="0"
                      onChange={e => api.setBudgetItem(month, env.id, Number(e.target.value) || 0)}
                    />
                    <span className="text-xs text-muted-foreground">CZK</span>
                  </div>
                </div>
                {plan > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${allocPct}%`, background: seriesColor(env.colorSlot) }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>Покладено {czk(alloc)} із {czk(plan)}</span>
                      <span className={cn(spent > plan && 'font-medium text-destructive')}>Витрачено {czk(spent)}</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
