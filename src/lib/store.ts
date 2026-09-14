import type { Budget, Household, TransferTx, Tx } from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function exportJSON(h: Household): string {
  return JSON.stringify(h, null, 2);
}

export function importJSON(raw: string): Household | null {
  try {
    const data = JSON.parse(raw) as Household;
    if (!data || data.version !== 1 || !Array.isArray(data.txs)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Active envelopes in manual order (fallback: creation date). */
export function sortedEnvelopes(h: Household): Household['envelopes'] {
  return h.envelopes
    .filter(e => !e.archived)
    .sort((a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      || a.createdAt.localeCompare(b.createdAt),
    );
}

// ---- derived balances ----
export function cashBalance(h: Household): number {
  let sum = 0;
  for (const t of h.txs) {
    if (t.type === 'income') sum += t.amount;
    else if (t.type === 'allocate') sum -= t.amount;
    else if (t.type === 'return') sum += t.amount;
  }
  return sum;
}

export function envelopeBalance(h: Household, envelopeId: string): number {
  let sum = 0;
  for (const t of h.txs) {
    if (t.type === 'allocate' && t.envelopeId === envelopeId) sum += t.amount;
    else if (t.type === 'return' && t.envelopeId === envelopeId) sum -= t.amount;
    else if (t.type === 'expense' && t.envelopeId === envelopeId) sum -= t.amount;
    else if (t.type === 'transfer') {
      if (t.fromEnvelopeId === envelopeId) sum -= t.amount;
      if (t.toEnvelopeId === envelopeId) sum += t.amount;
    }
  }
  return sum;
}

/** Open temporary loans: transfers marked temporary and not yet settled. */
export function openLoans(h: Household): TransferTx[] {
  return h.txs.filter(
    (t): t is TransferTx => t.type === 'transfer' && t.temporary && !t.settledBy,
  );
}

export function txsInMonth(h: Household, month: string): Tx[] {
  return h.txs.filter(t => t.date.slice(0, 7) === month);
}

export function spentInMonth(h: Household, envelopeId: string, month: string): number {
  return h.txs
    .filter(t => t.type === 'expense' && t.envelopeId === envelopeId && t.date.slice(0, 7) === month)
    .reduce((s, t) => s + t.amount, 0);
}

export function allocatedInMonth(h: Household, envelopeId: string, month: string): number {
  return h.txs
    .filter(t => (t.type === 'allocate' || t.type === 'return') && t.envelopeId === envelopeId && t.date.slice(0, 7) === month)
    .reduce((s, t) => s + (t.type === 'allocate' ? t.amount : -t.amount), 0);
}

export function getBudget(h: Household, month: string): Budget {
  return h.budgets.find(b => b.month === month) ?? { month, items: [] };
}
