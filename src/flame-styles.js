/** Alev / nota çizim stilleri */
const FlameStyles = (() => {
  const PITCH_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  let current = "aurora";

  function hueToRgb(h, a = 1) {
    const s = h / 360;
    const c = 0.9;
    const x = c * (1 - Math.abs(((s * 6) % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (s < 1 / 6) [r, g, b] = [c, x, 0];
    else if (s < 2 / 6) [r, g, b] = [x, c, 0];
    else if (s < 3 / 6) [r, g, b] = [0, c, x];
    else if (s < 4 / 6) [r, g, b] = [0, x, c];
    else if (s < 5 / 6) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return `${Math.round((r + 0.1) * 255)},${Math.round((g + 0.1) * 255)},${Math.round((b + 0.1) * 255)}`;
  }

  function pitchColor(midi, noteH, velocity, alpha = 1) {
    const hue = PITCH_HUES[midi % 12];
    const isSmall = noteH < 22;
    const sat = isSmall ? 95 : 75;
    const light = isSmall ? 72 : 52 + (velocity || 0.7) * 15;
    return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
  }

  const styles = {
    aurora: {
      name: "Aurora (mor)",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        const hu = (275 + (midi % 12) * 4) % 360;
        const r = Math.min(w * 0.48, 12);
        ctx.save();
        ctx.shadowColor = `hsla(${hu}, 100%, 65%, 0.85)`;
        ctx.shadowBlur = 14 * intensity;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, `hsla(${hu}, 75%, 75%, 0.95)`);
        g.addColorStop(1, `hsla(${hu}, 100%, 48%, 1)`);
        ctx.fillStyle = g;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
      },
      particle(p) {
        p.rgb = "200,120,255";
        p.star = true;
      },
    },

    fire: {
      name: "Alev",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, "rgba(180,255,200,0.4)");
          g.addColorStop(1, "rgba(34,160,80,1)");
          ctx.fillStyle = g;
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(180,50,50,0.55)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          const top = pitchColor(midi, h, vel, 0.85);
          g.addColorStop(0, top);
          g.addColorStop(0.4, `hsla(${(PITCH_HUES[midi % 12] + 40) % 360}, 90%, 65%, 0.9)`);
          g.addColorStop(0.75, "rgba(255,100,30,0.95)");
          g.addColorStop(1, "rgba(255,40,0,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(255,100,40,0.8)";
          ctx.shadowBlur = 14 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p, hot) {
        p.rgb = hot
          ? ["255,245,160", "255,120,32", "255,34,0"][Math.floor(Math.random() * 3)]
          : hueToRgb(PITCH_HUES[(p.midi || 0) % 12], 0.85);
      },
    },

    ice: {
      name: "Buz",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "rgba(120,255,200,0.9)";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(100,80,120,0.5)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, pitchColor(midi, h, vel, 0.9));
          g.addColorStop(0.5, "rgba(150,230,255,0.95)");
          g.addColorStop(1, "rgba(40,120,255,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(100,200,255,0.7)";
          ctx.shadowBlur = 12 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = p.hot ? "170,240,255" : hueToRgb(200);
      },
    },

    neon: {
      name: "Neon",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        const hue = PITCH_HUES[midi % 12];
        if (state === "hit") {
          ctx.fillStyle = `hsla(${hue},100%,60%,1)`;
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(80,80,80,0.4)";
        } else {
          ctx.fillStyle = pitchColor(midi, h, vel, 1);
          ctx.shadowColor = `hsl(${hue},100%,55%)`;
          ctx.shadowBlur = 20 * intensity;
          ctx.strokeStyle = `hsla(${hue},100%,80%,0.9)`;
          ctx.lineWidth = 2;
        }
        roundFill(ctx, x, y, w, h);
        if (state === "pending") roundStroke(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = hueToRgb(PITCH_HUES[(p.midi || 0) % 12]);
      },
    },

    rainbow: {
      name: "Gökkuşağı",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "#4ade80";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(120,80,80,0.45)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          const n = 5;
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const hue = (PITCH_HUES[midi % 12] + t * 120) % 360;
            g.addColorStop(t, `hsla(${hue}, 90%, ${h < 22 ? 70 : 55}%, 0.95)`);
          }
          ctx.fillStyle = g;
          ctx.shadowColor = pitchColor(midi, h, vel, 0.6);
          ctx.shadowBlur = 10 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = hueToRgb((PITCH_HUES[(p.midi || 0) % 12] + Math.random() * 80) % 360);
      },
    },

    minimal: {
      name: "Sade",
      drawNote(ctx, x, y, w, h, state, midi, vel) {
        if (state === "hit") ctx.fillStyle = "rgba(74,222,128,0.85)";
        else if (state === "miss") ctx.fillStyle = "rgba(248,113,113,0.45)";
        else ctx.fillStyle = pitchColor(midi, h, vel, 0.88);
        roundFill(ctx, x, y, w, h);
      },
      particle(p) {
        p.rgb = hueToRgb(PITCH_HUES[(p.midi || 0) % 12]);
      },
    },

    plasma: {
      name: "Plazma",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "#a78bfa";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(80,40,80,0.5)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, pitchColor(midi, h, vel, 0.7));
          g.addColorStop(0.5, "rgba(200,100,255,0.95)");
          g.addColorStop(1, "rgba(120,0,200,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(180,80,255,0.9)";
          ctx.shadowBlur = 16 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = p.hot ? "233,213,255" : hueToRgb(280 + ((p.midi || 0) % 12) * 5);
      },
    },
  };

  function roundFill(ctx, x, y, w, h) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(6, w * 0.2));
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  function roundStroke(ctx, x, y, w, h) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(6, w * 0.2));
      ctx.stroke();
    }
  }

  function setStyle(id) {
    if (styles[id]) current = id;
  }

  function getStyle() {
    return styles[current] || styles.fire;
  }

  function getStyleIds() {
    return Object.keys(styles);
  }

  function getStyleName(id) {
    return styles[id]?.name || id;
  }

  return {
    setStyle,
    getStyle,
    getStyleIds,
    getStyleName,
    pitchColor,
    styles,
  };
})();

window.FlameStyles = FlameStyles;
