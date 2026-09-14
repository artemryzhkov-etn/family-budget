import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

export function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)}>
      {children}
    </div>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
};

export function Button({ children, onClick, variant = 'primary', type = 'button', className, disabled }: BtnProps) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-accent border border-border',
    ghost: 'hover:bg-accent text-foreground',
    destructive: 'bg-destructive text-white hover:opacity-90',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm',
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm',
        props.className,
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium">{children}</label>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Закрити" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
      <div className="text-3xl">{icon}</div>
      <p className="max-w-60 text-sm">{text}</p>
    </div>
  );
}

/** Fixed categorical series slots (dataviz palette, via CSS vars). */
export function seriesColor(slot: number): string {
  return `var(--series-${((slot - 1) % 8) + 1})`;
}
