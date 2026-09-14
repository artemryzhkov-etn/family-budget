import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn, faChartPie, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import type { Household } from '../lib/types';
import { currentMonth, todayISO } from '../lib/store';
import { czk, dateLabel, lastMonths, monthLabel, monthShort, shiftMonth } from '../lib/format';
import { Button, Card, EmptyState, Input, cn, seriesColor } from '../ui';
import { envelopeIcon } from '../icons';

type Props = { household: Household };

type Mode = 'month' | 'quarter' | 'year' | 'custom';

const MODES: Array<{ mode: Mode; label: string }> = [
  { mode: 'month', label: 'Місяць' },
  { mode: 'quarter', label: 'Квартал' },
  { mode: 'year', label: 'Рік' },
  { mode: 'custom', label: 'Період' },
];

function monthsBetween(from: string, to: string): string[] {
  if (from > to) [from, to] = [to, from];
  const out: string[] = [];
  let m = from;
  while (m <= to && out.length < 60) {
    out.push(m);
    m = shiftMonth(m, 1);
  }
  return out;
}

function quarterStart(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const qm = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(qm).padStart(2, '0')}`;
}

export function Reports({ household: h }: Props) {
  const cur = currentMonth();
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(cur); // for month/quarter/year
  // custom range: exact dates, defaults to the current month so far
  const [from, setFrom] = useState(`${cur}-01`);
  const [to, setTo] = useState(todayISO());
  const [lo, hi] = from <= to ? [from, to] : [to, from];

  const months: string[] =
    mode === 'month' ? [anchor]
    : mode === 'quarter' ? monthsBetween(quarterStart(anchor), shiftMonth(quarterStart(anchor), 2))
    : mode === 'year' ? monthsBetween(`${anchor.slice(0, 4)}-01`, `${anchor.slice(0, 4)}-12`)
    : monthsBetween(lo.slice(0, 7), hi.slice(0, 7));

  // exact date bounds for filtering (string compare works for ISO dates)
  const dateFrom = mode === 'custom' ? lo : `${months[0]}-01`;
  const dateTo = mode === 'custom' ? hi : `${months[months.length - 1]}-31`;
  const inRange = (d: string) => d >= dateFrom && d <= dateTo;

  const step = mode === 'quarter' ? 3 : mode === 'year' ? 12 : 1;
  const rangeLabel =
    mode === 'month' ? monthLabel(anchor)
    : mode === 'quarter' ? `${Math.floor((Number(anchor.slice(5)) - 1) / 3) + 1}-й квартал ${anchor.slice(0, 4)}`
    : mode === 'year' ? `${anchor.slice(0, 4)} рік`
    : `${dateLabel(lo)} — ${dateLabel(hi)}`;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of h.txs) {
      if (t.type !== 'expense' || !inRange(t.date)) continue;
      map.set(t.envelopeId, (map.get(t.envelopeId) ?? 0) + t.amount);
    }
    return h.envelopes
      .map(env => ({ env, value: map.get(env.id) ?? 0 }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [h, mode, anchor, from, to]);

  const trend = useMemo(() => {
    // single-month view keeps a 6-month context; custom range clips to exact dates
    const contextual = mode === 'month';
    const trendMonths = contextual ? lastMonths(6, anchor) : months;
    return trendMonths.map(m => {
      let income = 0;
      let expense = 0;
      for (const t of h.txs) {
        if (t.date.slice(0, 7) !== m) continue;
        if (!contextual && !inRange(t.date)) continue;
        if (t.type === 'income') income += t.amount;
        else if (t.type === 'expense') expense += t.amount;
      }
      return { month: m, income, expense };
    });
  }, [h, mode, anchor, from, to]);

  const total = byCategory.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Звіти</h2>
        {mode !== 'custom' && (
          <div className="flex items-center gap-1">
            <button className="flex size-8 items-center justify-center rounded-lg hover:bg-accent" onClick={() => setAnchor(a => shiftMonth(a, -step))} aria-label="Назад">
              <FontAwesomeIcon icon={faChevronLeft} className="text-sm" />
            </button>
            <span className="min-w-32 text-center text-sm font-medium">{rangeLabel}</span>
            <button
              className="flex size-8 items-center justify-center rounded-lg hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              onClick={() => setAnchor(a => shiftMonth(a, step))}
              disabled={months[months.length - 1] >= cur}
              aria-label="Вперед"
            >
              <FontAwesomeIcon icon={faChevronRight} className="text-sm" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {MODES.map(m => (
          <Button
            key={m.mode}
            variant={m.mode === mode ? 'primary' : 'secondary'}
            className="px-3 py-1.5 text-xs"
            onClick={() => setMode(m.mode)}
          >
            {m.label}
          </Button>
        ))}
        {mode !== 'custom' && anchor !== cur && (
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setAnchor(cur)}>
            Сьогодні
          </Button>
        )}
      </div>

      {mode === 'custom' && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">З дати</label>
            <Input type="date" value={from} max={todayISO()} onChange={e => e.target.value && setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">По дату</label>
            <Input type="date" value={to} max={todayISO()} onChange={e => e.target.value && setTo(e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">Обрано: {rangeLabel}</p>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <FontAwesomeIcon icon={faChartPie} className="text-muted-foreground" /> Витрати за категоріями
        </h3>
        {byCategory.length === 0 ? (
          <EmptyState icon={<FontAwesomeIcon icon={faChartPie} />} text="Немає витрат за обраний період." />
        ) : (
          <>
            <p className="mb-3 text-2xl font-semibold tracking-tight">{czk(total)}</p>
            <CategoryBars data={byCategory.map(x => ({
              id: x.env.id, label: x.env.name, icon: x.env.icon, slot: x.env.colorSlot, value: x.value, share: total > 0 ? x.value / total : 0,
            }))} />
          </>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FontAwesomeIcon icon={faChartColumn} className="text-muted-foreground" /> Доходи та витрати по місяцях
        </h3>
        <TrendChart data={trend} />
      </Card>
      </div>
    </div>
  );
}

type CatRow = { id: string; label: string; icon: string; slot: number; value: number; share: number };

/** Horizontal bar list: color follows the envelope (entity), direct labels, thin marks. */
function CategoryBars({ data }: { data: CatRow[] }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <ul className="space-y-3">
      {data.map(d => (
        <li key={d.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] text-white" style={{ background: seriesColor(d.slot) }}>
                <FontAwesomeIcon icon={envelopeIcon(d.icon)} />
              </span>
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {czk(d.value)} <span className="text-xs text-muted-foreground">{Math.round(d.share * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary" title={`${d.label}: ${czk(d.value)}`}>
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: seriesColor(d.slot) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type TrendPoint = { month: string; income: number; expense: number };

/** Grouped monthly bars, two series (income/expense), SVG with hover tooltip. */
function TrendChart({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 220;
  const PAD = { top: 12, right: 8, bottom: 24, left: 8 };
  const max = Math.max(1, ...data.flatMap(d => [d.income, d.expense]));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const groupW = innerW / data.length;
  const barW = Math.min(18, groupW / 3);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const gridLines = 4;
  const incomeColor = 'var(--series-3)'; // aqua
  const expenseColor = 'var(--series-2)'; // orange

  const hasData = data.some(d => d.income > 0 || d.expense > 0);
  if (!hasData) {
    return <EmptyState icon={<FontAwesomeIcon icon={faChartColumn} />} text="Ще немає даних для графіка." />;
  }

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: incomeColor }} /> Доходи</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: expenseColor }} /> Витрати</span>
      </div>
      <div className="relative">
        {hovered && (
          <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-md">
            <span className="font-medium">{monthShort(hovered.month)}</span>
            {' · '}Доходи {czk(hovered.income)} · Витрати {czk(hovered.expense)}
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Доходи та витрати по місяцях">
          {Array.from({ length: gridLines + 1 }, (_, i) => {
            const gy = PAD.top + (innerH / gridLines) * i;
            return <line key={i} x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} stroke="var(--viz-grid)" strokeWidth="1" />;
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="var(--viz-axis)" strokeWidth="1" />
          {data.map((d, i) => {
            const cx = PAD.left + groupW * i + groupW / 2;
            return (
              <g key={d.month}>
                <rect
                  x={PAD.left + groupW * i} y={PAD.top} width={groupW} height={innerH}
                  fill={hover === i ? 'var(--viz-grid)' : 'transparent'} opacity={hover === i ? 0.4 : 0}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onTouchStart={() => setHover(i)}
                />
                <rect x={cx - barW - 1} y={y(d.income)} width={barW} height={Math.max(0, PAD.top + innerH - y(d.income))} rx="3" fill={incomeColor} pointerEvents="none" />
                <rect x={cx + 1} y={y(d.expense)} width={barW} height={Math.max(0, PAD.top + innerH - y(d.expense))} rx="3" fill={expenseColor} pointerEvents="none" />
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--viz-muted)">{monthShort(d.month)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Таблиця даних</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Місяць</th>
              <th className={cn('py-1 text-right font-medium')}>Доходи</th>
              <th className="py-1 text-right font-medium">Витрати</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.month} className="border-t border-border">
                <td className="py-1">{monthShort(d.month)}</td>
                <td className="py-1 text-right tabular-nums">{czk(d.income)}</td>
                <td className="py-1 text-right tabular-nums">{czk(d.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
