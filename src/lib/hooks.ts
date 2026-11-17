import { useEffect, useLayoutEffect, useState } from 'react';

/** Ancho de un contenedor, actualizado con ResizeObserver. */
export function useWidth<T extends HTMLElement>(initial = 640): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}

export type ThemePref = 'claro' | 'oscuro' | 'sistema';

export function useTheme(): [ThemePref, (t: ThemePref) => void, boolean] {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      const t = localStorage.getItem('tema');
      if (t === 'claro' || t === 'oscuro' || t === 'sistema') return t;
    } catch {
      /* sin almacenamiento */
    }
    return 'oscuro';
  });
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setSystemDark(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const dark = pref === 'oscuro' || (pref === 'sistema' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('tema', pref);
    } catch {
      /* sin almacenamiento */
    }
  }, [dark, pref]);
  return [pref, setPref, dark];
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = () => setR(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return r;
}
