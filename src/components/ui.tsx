import katex from 'katex';
import { useId, useMemo, type ReactNode } from 'react';
import { useReveal, useTweenedNumber } from '../lib/motion';

/** Sección editorial: número, título en serif, texto introductorio amplio y contenido. Sin cajas. */
export function Section({
  id,
  index,
  kicker,
  title,
  lead,
  children,
  aside,
}: {
  id: string;
  index: string;
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const ref = useReveal<HTMLElement>();
  return (
    <section id={id} ref={ref} className="reveal scroll-mt-8 py-20 sm:py-28" aria-labelledby={`${id}-titulo`}>
      <header className="mb-10 sm:mb-14">
        <p className="kicker flex items-center gap-3">
          <span className="text-ink">{index}</span>
          <span className="h-px w-8 bg-faint" aria-hidden />
          {kicker}
        </p>
        <h2
          id={`${id}-titulo`}
          className="mt-5 max-w-[22ch] text-balance font-serif text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] font-normal leading-[1.08] tracking-[-0.015em] text-ink"
        >
          {title}
        </h2>
        <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,64ch)_1fr]">
          {lead && <div className="prose-lead space-y-4">{lead}</div>}
          {aside && <div className="xl:pt-1">{aside}</div>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
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
            className={`relative whitespace-nowrap py-1 text-[13px] transition-colors disabled:opacity-40 ${
              active ? 'text-ink' : 'text-muted hover:text-ink-2'
            }`}
          >
            {o.label}
            <span
              aria-hidden
              className={`absolute inset-x-0 -bottom-px h-px origin-left bg-ink transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] ${
                active ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Interruptor de diseño: punto de color + nombre; apagado = atenuado. */
export function DesignChip({
  color,
  label,
  on,
  onClick,
  role = 'switch',
}: {
  color: string;
  label: string;
  on: boolean;
  onClick: () => void;
  role?: 'switch' | 'radio';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      className={`group inline-flex items-center gap-2 py-1 text-[13px] transition-all duration-300 ${
        on ? 'text-ink' : 'text-muted hover:text-ink-2'
      }`}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full transition-all duration-300"
        style={{
          background: on ? color : 'transparent',
          boxShadow: on ? `0 0 0 3px color-mix(in oklab, ${color} 22%, transparent)` : `inset 0 0 0 1.5px ${color}`,
        }}
      />
      <span className={on || role === 'radio' ? '' : 'line-through decoration-faint'}>{label}</span>
    </button>
  );
}

export function ExactBadge({ exact }: { exact: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted"
      title={exact ? 'Distribución exacta: se enumeraron todas las muestras posibles' : 'Distribución aproximada por simulación Monte Carlo'}
    >
      <span aria-hidden className={`h-1 w-1 rounded-full ${exact ? 'bg-ink-2' : 'bg-accent'}`} />
      {exact ? 'exacta' : 'monte carlo'}
    </span>
  );
}

export function Tex({ children, display = false, className = '' }: { children: string; display?: boolean; className?: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: (ctx) => ctx.command === '\\htmlStyle',
      }),
    [children, display],
  );
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format = String,
  className = '',
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
  className?: string;
}) {
  const id = useId();
  const fill = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
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
        className="range w-full"
        style={{ ['--fill' as string]: `${fill}%` }}
      />
      <output htmlFor={id} className="tabular w-14 shrink-0 text-right font-mono text-[13px] text-ink">
        {format(value)}
      </output>
    </div>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  disabled,
  pressed,
  primary,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30 ${
        primary
          ? 'bg-ink text-page hover:opacity-90'
          : 'text-ink-2 ring-1 ring-line hover:text-ink hover:ring-faint'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Número que se anima al cambiar. */
export function Num({ value, format }: { value: number; format: (v: number) => string }) {
  const v = useTweenedNumber(value);
  return <span className="tabular">{format(v)}</span>;
}

const ICONS: Record<string, ReactNode> = {
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <g fill="currentColor" stroke="none">
      <rect x="7" y="5.5" width="3.5" height="13" rx="1" />
      <rect x="13.5" y="5.5" width="3.5" height="13" rx="1" />
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
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </g>
  ),
  sun: (
    <g>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  github: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
    />
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  sliders: (
    <g>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </g>
  ),
  sort: <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
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
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

/** Tooltip flotante, translúcido. */
export function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 16, 4), Math.max(width - 236, 4));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[180px] max-w-[260px] rounded-xl bg-[var(--dock)] px-3.5 py-2.5 text-xs shadow-[0_8px_30px_rgba(0,0,0,0.18)] ring-1 ring-line backdrop-blur-xl"
      style={{ left, top: Math.max(y - 10, 0) }}
    >
      {children}
    </div>
  );
}

/** Pie de figura discreto. */
export function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-4 max-w-[72ch] text-[13px] leading-relaxed text-muted">{children}</p>;
}
