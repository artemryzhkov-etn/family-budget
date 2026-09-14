import { useEffect, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn, faCircleNotch, faEnvelopeOpenText, faGear, faHouse, faListCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { isConfigured } from './firebase-config';
import { useAuthUser, useHousehold } from './lib/cloud';
import { cn } from './ui';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Envelopes } from './screens/Envelopes';
import { BudgetScreen } from './screens/Budget';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';
import { QuickAddModal, readQuickAddParams, type QuickAddParams } from './screens/QuickAdd';

export type Tab = 'home' | 'envelopes' | 'budget' | 'reports' | 'settings';

const TABS: Array<{ key: Tab; label: string; icon: typeof faHouse }> = [
  { key: 'home', label: 'Огляд', icon: faHouse },
  { key: 'envelopes', label: 'Конверти', icon: faEnvelopeOpenText },
  { key: 'budget', label: 'Бюджет', icon: faListCheck },
  { key: 'reports', label: 'Звіти', icon: faChartColumn },
  { key: 'settings', label: 'Ще', icon: faGear },
];

const THEME_KEY = 'household-budget-theme';
const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

/** Responsive chrome: bottom tabs on mobile, left sidebar on lg+. */
export function AppShell({ tab, onTab, userLabel, children }: {
  tab: Tab;
  onTab: (t: Tab) => void;
  userLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-card">
        <div className="sticky top-0 flex h-dvh flex-col p-4">
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FontAwesomeIcon icon={faEnvelopeOpenText} />
            </div>
            <span className="font-semibold">Сімейний бюджет</span>
          </div>
          <nav className="flex flex-col gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => onTab(t.key)}
                aria-current={tab === t.key ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  tab === t.key ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <FontAwesomeIcon icon={t.icon} className="w-4" />
                {t.key === 'settings' ? 'Налаштування' : t.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto truncate px-3 text-sm text-muted-foreground">{userLabel}</div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Top header — mobile only */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-base font-semibold">Сімейний бюджет</h1>
            <span className="max-w-40 truncate text-sm text-muted-foreground">{userLabel}</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-24 lg:max-w-5xl lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom tabs — mobile only */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors',
                tab === t.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              <FontAwesomeIcon icon={t.icon} className="text-base" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  const configured = isConfigured() || useEmulator;
  const { user, ready } = useAuthUser();
  const household = useHousehold(configured && !!user);
  const [tab, setTab] = useState<Tab>('home');
  const [quickAdd, setQuickAdd] = useState<QuickAddParams | null>(() => readQuickAddParams());
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  if (!configured) return <SetupNotice />;

  if (!ready || (user && !household)) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <FontAwesomeIcon icon={faCircleNotch} spin className="text-2xl" />
      </div>
    );
  }

  if (!user || !household) return <Login />;

  const displayName = user.displayName
    ?? household.users.find(u => u.id === user.uid)?.name
    ?? user.email
    ?? '';

  return (
    <AppShell tab={tab} onTab={setTab} userLabel={displayName}>
      {tab === 'home' && <Dashboard household={household} userId={user.uid} />}
      {tab === 'envelopes' && <Envelopes household={household} userId={user.uid} />}
      {tab === 'budget' && <BudgetScreen household={household} />}
      {tab === 'reports' && <Reports household={household} />}
      {tab === 'settings' && (
        <Settings household={household} userId={user.uid} dark={dark} onToggleDark={() => setDark(d => !d)} />
      )}
      {quickAdd && household.envelopes.some(e => !e.archived) && (
        <QuickAddModal
          household={household}
          userId={user.uid}
          initial={quickAdd}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </AppShell>
  );
}

function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-6">
        <h1 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-muted-foreground" />
          Потрібне налаштування Firebase
        </h1>
        <p className="text-sm text-muted-foreground">
          Апка ще не підключена до Firebase. Відкрийте файл{' '}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">src/firebase-config.ts</code>{' '}
          і вставте конфігурацію вашого проєкту (покрокова інструкція — у README.md, розділ
          «Налаштування Firebase»). Після цього перезберіть і задеплойте апку.
        </p>
      </div>
    </div>
  );
}
