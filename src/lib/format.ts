const fmt = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
});

const fmtExact = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'CZK',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function czk(n: number): string {
  return Number.isInteger(n) ? fmt.format(n) : fmtExact.format(n);
}

export const MONTHS_UK = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_UK[m - 1]} ${y}`;
}

export function monthShort(month: string): string {
  const [, m] = month.split('-').map(Number);
  return MONTHS_UK[m - 1].slice(0, 3);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function lastMonths(n: number, endMonth: string): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(endMonth, -i));
  return out;
}

export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}
