/** Mor/neon düşen notalar, vuruş parıltısı, aurora */
const NoteRenderer = (() => {
  function baseHue() {
    const v = window.__effectHue;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    const css = getComputedStyle(document.documentElement).getPropertyValue("--effect-hue");
    return Number(css) || 275;
  }

  function hue(midi) {
    return (baseHue() + (midi % 12) * 4) % 360;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, rad);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  function drawLane(ctx, x, w, h, hitY, midi, t, laneColor = null) {
    const hu = hue(midi);
    const pulse = 0.04 + Math.sin(t * 2.5 + midi * 0.08) * 0.02;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    if (laneColor) {
      g.addColorStop(0.45, `color-mix(in srgb, ${laneColor} 75%, transparent)`);
      g.addColorStop(0.55, `color-mix(in srgb, ${laneColor} 95%, white 5%)`);
    } else {
      g.addColorStop(0.45, `hsla(${hu}, 80%, 55%, ${pulse})`);
      g.addColorStop(0.55, `hsla(${hu}, 90%, 65%, ${pulse * 1.2})`);
    }
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 0.6, 0, w * 1.2, hitY + 8);
  }

  function drawNote(ctx, opts) {
    const { x, y, w, h, midi, vel, state, styleId, intensity, time, laneColor } = opts;
    if (h < 2) return;

    const style = window.FlameStyles?.styles?.[styleId];
    if (style?.drawNote && styleId && styleId !== "aurora") {
      style.drawNote(ctx, x, y, w, h, state, midi, vel, intensity);
      return;
    }

    const hu = hue(midi);
    const v = vel ?? 0.75;
    const cx = x + w / 2;
    const r = Math.min(w * 0.48, 12);

    if (state === "hit") {
      ctx.save();
      ctx.shadowColor = `hsla(${hu}, 100%, 75%, 1)`;
      ctx.shadowBlur = 22;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, `hsla(${hu}, 90%, 85%, 1)`);
      g.addColorStop(1, `hsla(${hu}, 100%, 55%, 1)`);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (state === "miss") {
      ctx.fillStyle = "rgba(248, 113, 113, 0.4)";
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.shadowColor = `hsla(${hu}, 100%, 65%, 0.9)`;
    ctx.shadowBlur = (14 + v * 8) * intensity;
    const body = ctx.createLinearGradient(x, y, x, y + h);
    if (laneColor) {
      body.addColorStop(0, `color-mix(in srgb, ${laneColor} 40%, white 60%)`);
      body.addColorStop(0.35, `color-mix(in srgb, ${laneColor} 85%, white 15%)`);
      body.addColorStop(0.75, laneColor);
      body.addColorStop(1, `color-mix(in srgb, ${laneColor} 72%, black 28%)`);
    } else {
      body.addColorStop(0, `hsla(${hu}, 70%, 78%, 0.95)`);
      body.addColorStop(0.35, `hsla(${hu}, 95%, 62%, 1)`);
      body.addColorStop(0.75, `hsla(${hu}, 100%, 52%, 1)`);
      body.addColorStop(1, `hsla(${hu}, 100%, 42%, 1)`);
    }
    ctx.fillStyle = body;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    const shine = ctx.createLinearGradient(x, y, x + w * 0.4, y + h * 0.3);
    shine.addColorStop(0, "rgba(255,255,255,0.4)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    roundRect(ctx, x + w * 0.08, y + 1, w * 0.3, Math.min(h * 0.3, 20), r * 0.4);
    ctx.fill();

    const bottomY = y + h;
    const cap = ctx.createRadialGradient(cx, bottomY, 0, cx, bottomY, w * 0.7);
    cap.addColorStop(0, `rgba(255,255,255,${0.5 + v * 0.3})`);
    cap.addColorStop(0.4, `hsla(${hu}, 100%, 75%, 0.85)`);
    cap.addColorStop(1, `hsla(${hu}, 100%, 50%, 0)`);
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(cx, bottomY, w * 0.5, Math.min(8, h * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function spawnImpactParticles(particles, x, y, w, midi, count = 16) {
    const hu = hue(midi);
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const sp = 2 + Math.random() * 5;
      particles.push({
        x: x + (Math.random() - 0.5) * w * 0.5,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 2 + Math.random() * 4,
        hot: true,
        midi,
        rgb: `${180 + (hu % 60)},${100 + Math.random() * 80},255`,
        star: Math.random() > 0.5,
      });
    }
  }

  function drawKeyAuroras(ctx, auras, hitY, w, t) {
    for (const [midi, aura] of auras) {
      const power = aura.power * Math.max(0, aura.life);
      if (power < 0.02) continue;
      const hu = hue(midi);
      const x = aura.x;
      const kw = aura.w || 40;

      const pillar = ctx.createLinearGradient(x, hitY, x, hitY - 120);
      pillar.addColorStop(0, `hsla(${hu}, 90%, 65%, ${0.45 * power})`);
      pillar.addColorStop(0.5, `hsla(${hu}, 80%, 50%, ${0.2 * power})`);
      pillar.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pillar;
      ctx.fillRect(x - kw * 0.55, hitY - 130, kw * 1.1, 130);

      for (let i = 0; i < 8; i++) {
        const sx = x + Math.sin(t * 3 + midi + i) * kw * 0.35;
        const sy = hitY - 15 - i * 12 - Math.sin(t * 2 + i) * 6;
        const a = 0.35 * power * (0.5 + Math.sin(t * 5 + i) * 0.5);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return {
    drawNote,
    drawLane,
    drawKeyAuroras,
    spawnImpactParticles,
    hue,
  };
})();

window.NoteRenderer = NoteRenderer;
