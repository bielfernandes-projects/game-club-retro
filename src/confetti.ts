const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Confete/fogos saindo de três pontos. Respeita prefers-reduced-motion. */
export function fireConfetti(canvas: HTMLCanvasElement) {
  if (reduceMotion()) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.hidden = false;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ["#ffc53d", "#ff2e88", "#35e0f0", "#46d17b", "#ffffff"];
  const parts: {
    x: number; y: number; vx: number; vy: number; g: number;
    s: number; rot: number; vr: number; c: string;
  }[] = [];

  for (const ox of [0.5, 0.12, 0.88]) {
    for (let i = 0; i < 55; i++) {
      parts.push({
        x: W * ox,
        y: H * (ox === 0.5 ? 0.42 : 0.72),
        vx: (Math.random() - 0.5) * (ox === 0.5 ? 13 : 9) + (ox === 0.12 ? 5 : ox === 0.88 ? -5 : 0),
        vy: Math.random() * -15 - (ox === 0.5 ? 6 : 3),
        g: 0.32 + Math.random() * 0.16,
        s: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        c: colors[(Math.random() * colors.length) | 0]!,
      });
    }
  }

  const start = performance.now();
  const frame = (t: number) => {
    const e = t - start;
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    const alpha = Math.max(0, 1 - e / 2800);
    for (const p of parts) {
      p.vy += p.g;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y < H + 40) alive = true;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (alive && e < 3200) requestAnimationFrame(frame);
    else {
      ctx.clearRect(0, 0, W, H);
      canvas.hidden = true;
    }
  };
  requestAnimationFrame(frame);
}
