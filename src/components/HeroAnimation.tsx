import { useEffect, useRef } from 'react';
import { fmtAxis } from '../lib/format';
import { usePrefersReducedMotion } from '../lib/hooks';
import { easeInQuad, easeOutCubic, useInView } from '../lib/motion';
import type { PreparedDesign } from '../stats/designs/types';
import { mulberry32 } from '../stats/rng';

interface Lane {
  design: PreparedDesign;
  colorVar: string;
  label: string;
}

interface Dot {
  x: number;
  col: number;
  row: number;
  t0: number;
}

/**
 * Animación de portada: dos carriles con el mismo número de muestras (n fija).
 * Cada punto es el Ŷ de una muestra; los puntos se apilan formando la distribución en el muestreo.
 */
export function HeroAnimation({ lanes, Y, domain }: { lanes: Lane[]; Y: number; domain: [number, number] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const inViewRef = useRef(inView);
  inViewRef.current = inView;
  const stateRef = useRef<{ dots: Dot[][]; heights: number[][]; next: number; fade: number; hold: number; count: number }>({
    dots: [],
    heights: [],
    next: 0,
    fade: 1,
    hold: 0,
    count: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rng = mulberry32(20240517);
    let raf = 0;
    let W = 0;
    let H = 0;
    const R = 2.3;
    const STEP = R * 2 + 1;
    const laneH = () => (H - 46) / lanes.length;
    let cols = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(1, Math.floor((W - 24) / STEP));
      reset();
    };
    const reset = () => {
      const s = stateRef.current;
      s.dots = lanes.map(() => []);
      s.heights = lanes.map(() => new Array(cols).fill(0));
      s.fade = 1;
      s.hold = 0;
      s.count = 0;
    };
    const xOf = (v: number) => 12 + ((v - domain[0]) / (domain[1] - domain[0])) * (W - 24);
    const colOf = (v: number) => Math.max(0, Math.min(cols - 1, Math.floor((xOf(v) - 12) / STEP)));
    const maxRows = () => Math.floor((laneH() - 30) / STEP);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const css = getComputedStyle(document.documentElement);
    const color = (v: string) => css.getPropertyValue(v.replace(/var\((--[^)]+)\)/, '$1')).trim() || '#888';

    let last = performance.now();
    const loop = (now: number) => {
      const s = stateRef.current;
      const dt = now - last;
      last = now;
      const ink = color('var(--ink)');
      const muted = color('var(--muted)');
      const base = color('var(--baseline)');
      const glow = parseFloat(css.getPropertyValue('--glow')) || 0;
      ctx.clearRect(0, 0, W, H);

      // Nueva muestra cada ~55 ms (en todos los carriles a la vez: misma n, mismo número de muestras)
      if (!reduced && inViewRef.current && s.fade >= 1 && s.hold <= 0) {
        s.next -= Math.min(dt, 200);
        while (s.next <= 0 && s.hold <= 0) {
          s.next += 55;
          lanes.forEach((ln, k) => {
            const d = ln.design.draw(rng);
            const col = colOf(d.est);
            const row = s.heights[k][col]++;
            s.dots[k].push({ x: d.est, col, row, t0: now });
          });
          s.count++;
          // Al llenarse un carril, se deja la imagen completa unos segundos antes de reiniciar.
          if (s.heights.some((h) => Math.max(...h) >= maxRows())) s.hold = 2600;
        }
      }
      if (s.hold > 0 && inViewRef.current) {
        s.hold -= dt;
        if (s.hold <= 0) s.fade = 0.999;
      }
      if (s.fade < 1) {
        s.fade -= dt / 1200;
        if (s.fade <= 0) reset();
      }
      const alpha = s.fade < 1 ? Math.max(0, s.fade) : 1;

      lanes.forEach((ln, k) => {
        const top = 8 + k * laneH();
        const baseY = top + laneH() - 18;
        const c = color(ln.colorVar);
        // línea base
        ctx.strokeStyle = base;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(12, baseY + 0.5);
        ctx.lineTo(W - 12, baseY + 0.5);
        ctx.stroke();
        // etiqueta
        ctx.fillStyle = muted;
        ctx.font = '500 12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ln.label, 12, top + 12);
        // puntos
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = c;
        if (glow) {
          ctx.shadowColor = c;
          ctx.shadowBlur = 8 * glow;
        }
        for (const d of s.dots[k]) {
          const target = baseY - R - 1 - d.row * STEP;
          const p = reduced ? 1 : Math.min(1, (now - d.t0) / 650);
          const y = top + 4 + (target - top - 4) * easeInQuad(p);
          const x = 12 + d.col * STEP + STEP / 2;
          ctx.globalAlpha = alpha * (0.35 + 0.65 * easeOutCubic(Math.min(1, p * 1.6)));
          ctx.beginPath();
          ctx.arc(x, y, R, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // Valor verdadero Y
      const xy = xOf(Y);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.9;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(xy, 4);
      ctx.lineTo(xy, H - 34);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.font = 'italic 14px Newsreader, Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText('Y', xy + 6, 16);

      // eje
      ctx.fillStyle = muted;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const span = domain[1] - domain[0];
      const step = span > 1.2e6 ? 400000 : 200000;
      for (let v = Math.ceil(domain[0] / step) * step; v <= domain[1]; v += step) {
        ctx.fillText(fmtAxis(v), xOf(v), H - 14);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, Y, domain[0], domain[1], reduced]);

  return (
    <div ref={wrapRef} className="relative">
      <canvas
        ref={canvasRef}
        className="h-[380px] w-full sm:h-[440px]"
        role="img"
        aria-label="Animación: muestras de MAS sin reemplazo y de PPT cayendo y apilándose alrededor del valor verdadero Y. Las de PPT se concentran mucho más."
      />
    </div>
  );
}
