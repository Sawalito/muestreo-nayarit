import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './hooks';

/** Curva de aceleración tipo 3Blue1Brown ("smooth"): lenta al inicio y al final. */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInQuad = (t: number) => t * t;

/** Marca un elemento como visible cuando entra al viewport (una sola vez). */
export function useReveal<T extends HTMLElement>(threshold = 0.12): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('is-visible');
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

/** true mientras el elemento está (aunque sea parcialmente) en pantalla. */
export function useInView<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

/** Interpola suavemente un número hacia su nuevo valor. */
export function useTweenedNumber(value: number, duration = 700): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const shownRef = useRef(value);
  shownRef.current = shown;
  useEffect(() => {
    if (reduced || !Number.isFinite(value) || !Number.isFinite(shownRef.current)) {
      setShown(value);
      return;
    }
    fromRef.current = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(fromRef.current + (value - fromRef.current) * easeInOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return shown;
}

/**
 * Transición entre dos estados de una gráfica: devuelve un progreso t ∈ [0, 1]
 * que avanza con easing cada vez que cambia `key`, junto con el estado anterior y el nuevo.
 */
export function useMorph<S>(state: S, key: string, duration = 1100): { from: S; to: S; t: number } {
  const reduced = usePrefersReducedMotion();
  const [t, setT] = useState(1);
  const fromRef = useRef(state);
  const toRef = useRef(state);
  const lastKey = useRef(key);
  const tRef = useRef(1);

  if (lastKey.current !== key) {
    // El estado "desde" es lo que se veía en este instante (aunque la transición anterior no hubiera terminado).
    fromRef.current = tRef.current >= 1 ? toRef.current : fromRef.current;
    lastKey.current = key;
  }
  toRef.current = state;

  useEffect(() => {
    if (reduced) {
      tRef.current = 1;
      setT(1);
      return;
    }
    const start = performance.now();
    let raf = 0;
    tRef.current = 0;
    setT(0);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      tRef.current = p;
      setT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);

  return { from: fromRef.current, to: toRef.current, t: easeInOutCubic(t) };
}
