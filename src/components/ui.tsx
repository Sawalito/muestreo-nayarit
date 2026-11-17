import katex from 'katex';
import { useId, useMemo, type ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(options[(i + 1) % options.length].value);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(options[(i - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={active ? 0 : -1}
            className={`flex-1 whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-40 ${
              size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-[13px]'
            } ${active ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'exact' | 'mc' | 'warn'; title?: string }) {
  const cls = {
    neutral: 'bg-surface-2 text-ink-2',
    exact: 'bg-[color-mix(in_oklab,var(--d-estrat)_14%,transparent)] text-ink',
    mc: 'bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-ink',
    warn: 'bg-[color-mix(in_oklab,var(--critical)_14%,transparent)] text-ink',
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function ExactBadge({ exact }: { exact: boolean }) {
  return exact ? (
    <Badge tone="exact" title="Distribución exacta: se enumeraron todas las muestras posibles">
      <Icon name="check" size={12} /> Exacta
    </Badge>
  ) : (
    <Badge tone="mc" title="Distribución aproximada por simulación Monte Carlo">
      <Icon name="dice" size={12} /> Monte Carlo
    </Badge>
  );
}

export function Swatch({ color, className = '' }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] ${className}`} style={{ background: color }} />;
}

export function Tex({ children, display = false, className = '' }: { children: string; display?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: display, throwOnError: false, strict: false }),
    [children, display],
  );
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-snug text-muted">{hint}</p>}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format = String,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer"
      />
      <output htmlFor={id} className="tabular w-16 shrink-0 text-right text-sm font-semibold text-ink">
        {format(value)}
      </output>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  label,
  disabled,
  pressed,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  label?: string;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
}) {
  const cls = {
    primary: 'bg-accent text-white hover:brightness-110 shadow-sm',
    secondary: 'bg-surface border border-line text-ink hover:bg-surface-2',
    ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  }[variant];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

const ICONS: Record<string, ReactNode> = {
  play: <path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <g fill="currentColor" stroke="none">
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </g>
  ),
  step: (
    <g>
      <path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none" />
      <line x1="18" y1="5.5" x2="18" y2="18.5" />
    </g>
  ),
  reset: (
    <g>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </g>
  ),
  dice: (
    <g>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </g>
  ),
  sun: (
    <g>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  monitor: (
    <g>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </g>
  ),
  github: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
    />
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  info: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </g>
  ),
  warn: (
    <g>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </g>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  sliders: (
    <g>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </g>
  ),
  sort: <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />,
};

export function Icon({ name, size = 16, className = '' }: { name: keyof typeof ICONS | string; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

/** Tooltip flotante posicionado en coordenadas del contenedor. */
export function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 14, 4), Math.max(width - 230, 4));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[180px] max-w-[260px] rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
      style={{ left, top: Math.max(y - 10, 0) }}
    >
      {children}
    </div>
  );
}
