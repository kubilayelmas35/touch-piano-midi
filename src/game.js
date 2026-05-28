/** Düşen notalar — stiller, renkler, süre */
const Game = (() => {
  const NOTE_HEIGHT_PX = 14;
  const LOOKAHEAD_SEC = 3;
  const HIT_LINE_FALLBACK = 0.88;

  let canvas, ctx;
  let notes = [];
  let pendingHits = [];
  let particles = [];
  let playing = false;
  let startTime = 0;
  let pausedAt = 0;
  let speed = 1;
  let animId = null;
  let timingWindowMs = 200;
  let score = 0;
  let combo = 0;
  let songDuration = 0;
  let flameIntensity = 1;
  let flameStyleId = "aurora";
  let trimStartSec = 0;
  let trimEndSec = 0;
  const keyAuras = new Map();
  const impactCooldown = new Map();
  let onScoreChange = null;
  let onFeedback = null;
  let onTimeUpdate = null;
  let keyPositions = new Map();
  let lastFrameT = 0;
  let autoPlayMode = false;

  function init(canvasEl, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
    onScoreChange = callbacks.onScoreChange;
    onFeedback = callbacks.onFeedback;
    onTimeUpdate = callbacks.onTimeUpdate;
    resize();
    window.addEventListener("resize", resize);
    const observeTargets = [
      document.getElementById("instrumentFooter"),
      document.getElementById("pianoWrap"),
      document.getElementById("guitarWrap"),
      document.getElementById("violinWrap"),
    ].filter(Boolean);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        resize();
        updateKeyPositions();
      });
      for (const el of observeTargets) ro.observe(el);
    }
  }

  function setFlameIntensity(level) {
    flameIntensity = Math.max(0.3, Math.min(2, level));
  }

  function setFlameStyle(styleId) {
    flameStyleId = styleId || "aurora";
    window.FlameStyles?.setStyle(flameStyleId);
  }

  function setTrim(startSec, endSec) {
    trimStartSec = Math.max(0, Number(startSec) || 0);
    trimEndSec = Math.max(0, Number(endSec) || 0);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function emitTime(t) {
    const total = songDuration || 0;
    const remaining = Math.max(0, total - t);
    onTimeUpdate?.({
      current: t,
      total,
      remaining,
      currentText: formatTime(t),
      totalText: formatTime(total),
      remainingText: formatTime(remaining),
      percent: total > 0 ? Math.min(100, (t / total) * 100) : 0,
    });
  }

  function isReady() {
    return !!(canvas && canvas.parentElement);
  }

  function resize() {
    if (!canvas?.parentElement) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth * devicePixelRatio;
    canvas.height = parent.clientHeight * devicePixelRatio;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    positionHitLine();
  }

  function getHitY() {
    const area = canvas?.parentElement;
    const instWrap =
      window.PlaySurface?.getWrapEl?.() || document.getElementById("pianoWrap");
    if (!area || !instWrap || instWrap.classList.contains("hidden")) {
      return area?.clientHeight * HIT_LINE_FALLBACK || 400;
    }
    const ar = area.getBoundingClientRect();
    const pr = instWrap.getBoundingClientRect();
    return Math.max(48, Math.round(pr.top - ar.top));
  }

  function positionHitLine() {
    const line = document.getElementById("hitLine");
    if (!line) return;
    const y = getHitY();
    line.style.top = `${y - 2}px`;
  }

  function updateKeyPositions() {
    keyPositions.clear();
    if (!canvas?.parentElement) return;
    const surface = window.PlaySurface;
    if (!surface) return;
    const range = surface.getRange();
    if (!range) return;
    const mode = surface.getMode();
    let selector = ".piano-keys .key";
    if (mode === "guitar") selector = ".guitar-string-stripe.string-touch-target";
    if (mode === "violin") selector = ".violin-string-stripe.string-touch-target";

    const area = canvas.parentElement;
    const areaRect = area.getBoundingClientRect();

    document.querySelectorAll(selector).forEach((key) => {
      const midi = Number(key.dataset.midi);
      if (!midi || midi < range.startMidi || midi > range.endMidi) return;
      const r = key.getBoundingClientRect();
      const centerX = r.left + r.width / 2 - areaRect.left;
      keyPositions.set(midi, { x: centerX, w: r.width });
    });
  }

  function clearAutoFlags() {
    for (const n of notes) {
      n._autoStarted = false;
      n._autoEnded = false;
    }
  }

  function setAutoPlayMode(on) {
    autoPlayMode = !!on;
    clearAutoFlags();
  }

  function isAutoPlayMode() {
    return autoPlayMode;
  }

  function releaseAllSound() {
    window.AudioEngine?.stopAll?.();
    window.PlaySurface?.releaseAll?.();
    window.KeyboardInput?.releaseAll?.();
  }

  function loadNotes(trackNotes, range) {
    stop();
    particles = [];
    keyAuras.clear();
    let list = trackNotes;
    if (window.NoteUtils?.cleanupNotes) {
      list = window.NoteUtils.cleanupNotes(trackNotes);
    }
    if (list.length && (trimStartSec > 0 || trimEndSec > 0)) {
      const rawEnd =
        list.length > 0 ? Math.max(...list.map((n) => n.time + n.duration)) : 0;
      const endLimit = Math.max(0, rawEnd - trimEndSec);
      list = list
        .filter((n) => n.time >= trimStartSec && n.time + n.duration <= endLimit + 0.001)
        .map((n) => ({
          ...n,
          time: Math.max(0, n.time - trimStartSec),
        }));
    }
    notes = list
      .filter((n) => n.midi >= range.startMidi && n.midi <= range.endMidi)
      .map((n) => ({
        midi: n.midi,
        time: n.time,
        duration: Math.max(0.08, n.duration),
        velocity: n.velocity,
        hit: false,
        missed: false,
        _autoStarted: false,
        _autoEnded: false,
      }))
      .sort((a, b) => a.time - b.time);

    pendingHits = notes.map((n) => ({ ...n, id: `${n.midi}-${n.time}` }));
    songDuration =
      notes.length > 0
        ? Math.max(...notes.map((n) => n.time + n.duration)) + 1.5
        : 0;
    score = 0;
    combo = 0;
    emitScore();
    emitTime(0);
  }

  function spawnFlame(x, y, w, count, hot, midi) {
    const style = window.FlameStyles?.getStyle();
    const n = Math.floor(count * flameIntensity);
    for (let i = 0; i < n; i++) {
      const p = {
        x: x + (Math.random() - 0.5) * w,
        y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.5 - Math.random() * 2.5,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: 2 + Math.random() * 4,
        hot: hot !== false,
        midi: midi || 0,
      };
      style?.particle?.(p, p.hot);
      particles.push(p);
    }
  }

  function spawnHitBurst(x, y, midi) {
    const style = window.FlameStyles?.getStyle();
    for (let i = 0; i < 18 * flameIntensity; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      const p = {
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3 + Math.random() * 5,
        hot: true,
        midi: midi || 0,
      };
      style?.particle?.(p, true);
      particles.push(p);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.08;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = (p.life / p.maxLife) * 0.9;
      const rgb = p.rgb || "200,120,255";
      if (p.star) {
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        ctx.fillRect(p.x, p.y - 2, 1, 4);
        ctx.fillRect(p.x - 2, p.y, 4, 1);
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBackground(w, h, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#05060c");
    bg.addColorStop(0.45, "#0c1020");
    bg.addColorStop(1, "#12182a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const hitY = getHitY();
    const vig = ctx.createRadialGradient(w * 0.5, hitY, w * 0.2, w * 0.5, hitY, w * 0.85);
    vig.addColorStop(0, "rgba(80, 120, 255, 0.06)");
    vig.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createLinearGradient(0, hitY - 50, 0, hitY + 30);
    glow.addColorStop(0, "rgba(168, 85, 247, 0)");
    glow.addColorStop(0.45, `rgba(192, 132, 252, ${0.14 + Math.sin(t * 3) * 0.05})`);
    glow.addColorStop(1, "rgba(124, 58, 237, 0.25)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, hitY - 55, w, 90);

    ctx.strokeStyle = "rgba(216, 180, 254, 0.9)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(168, 85, 247, 0.85)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function play() {
    if (!notes.length) return;
    window.AudioEngine.ensure();
    clearAutoFlags();
    keyAuras.clear();
    updateKeyPositions();
    playing = true;
    startTime = performance.now() / 1000 - pausedAt;
    lastFrameT = currentTime();
    tick();
  }

  function stop() {
    playing = false;
    pausedAt = 0;
    autoPlayMode = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    releaseAllSound();
    clearAutoFlags();
    keyAuras.clear();
    draw(0);
    emitTime(0);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    pausedAt = currentTime();
    if (animId) cancelAnimationFrame(animId);
    releaseAllSound();
    emitTime(pausedAt);
  }

  function currentTime() {
    if (!playing && pausedAt) return pausedAt;
    return (performance.now() / 1000 - startTime) * speed;
  }

  function setSpeed(s) {
    const t = currentTime();
    speed = s;
    if (playing) {
      startTime = performance.now() / 1000 - t / speed;
    } else {
      pausedAt = t;
    }
  }

  function setTimingWindow(ms) {
    timingWindowMs = ms;
  }

  function playInstrumentApi() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  function processAutoPlay(t) {
    if (!autoPlayMode || !playing) return;
    const inst = playInstrumentApi();
    const sound = window.PlaySurface?.getModes?.()?.[window.PlaySurface.getMode()]?.sound;
    if (sound) window.AudioEngine?.setInstrument?.(sound);
    for (const n of notes) {
      if (!n._autoStarted && t >= n.time) {
        n._autoStarted = true;
        const vel = Math.max(0.2, Math.min(1, n.velocity ?? 0.75));
        inst?.pressKey?.(n.midi, vel);
        boostKeyAura(n.midi, 1);
        n.hit = true;
      }
      if (n._autoStarted && !n._autoEnded && t >= n.time + n.duration) {
        n._autoEnded = true;
        inst?.releaseKey?.(n.midi);
      }
    }
  }

  /** Çubuk vuruş çizgisindeyken sürekli aurora */
  function syncHeldLineEffects(t) {
    for (const n of notes) {
      if (t < n.time || t >= n.time + n.duration) continue;
      boostKeyAura(n.midi, 0.2);
      const pos = keyPositions.get(n.midi);
      if (!pos) continue;
      const aura = keyAuras.get(n.midi);
      if (aura) {
        aura.life = 1;
        aura.power = Math.min(1, aura.power + 0.05);
      }
    }
  }

  function boostKeyAura(midi, amount = 0.8) {
    const pos = keyPositions.get(midi);
    if (!pos) return;
    const prev = keyAuras.get(midi);
    keyAuras.set(midi, {
      x: pos.x,
      w: pos.w,
      power: Math.min(1, (prev?.power || 0) + amount),
      life: 1,
    });
  }

  function updateKeyAuras(dt) {
    for (const [midi, a] of keyAuras) {
      a.life -= dt * 1.8;
      a.power *= 0.92;
      if (a.life <= 0 || a.power < 0.03) keyAuras.delete(midi);
    }
    document.querySelectorAll(".piano-keys .key.active").forEach((el) => {
      const midi = Number(el.dataset.midi);
      const pos = keyPositions.get(midi);
      if (!pos) return;
      keyAuras.set(midi, {
        x: pos.x,
        w: pos.w,
        power: 1,
        life: 1,
      });
    });
  }

  function checkNoteImpacts(t, hitY, pxPerSec) {
    const NR = window.NoteRenderer;
    if (!NR?.spawnImpactParticles) return;
    for (const n of notes) {
      if (n.hit || n.missed || n._impactDone) continue;
      const dist = (n.time - t) * pxPerSec;
      if (dist > 0 && dist < 6) {
        n._impactDone = true;
        const pos = keyPositions.get(n.midi);
        if (!pos) continue;
        const key = `${n.midi}-${Math.floor(n.time * 20)}`;
        if (impactCooldown.has(key)) continue;
        impactCooldown.set(key, t);
        NR.spawnImpactParticles(particles, pos.x, hitY, pos.w, n.midi, 14);
        boostKeyAura(n.midi, 0.7);
        window.Piano?.flash?.(n.midi, "good");
      }
    }
    for (const [k, when] of impactCooldown) {
      if (t - when > 0.5) impactCooldown.delete(k);
    }
  }

  function tick() {
    if (!playing) return;
    const t = currentTime();
    const dt = Math.min(0.05, t - lastFrameT || 0.016);
    lastFrameT = t;
    processAutoPlay(t);
    syncHeldLineEffects(t);
    if (!autoPlayMode) checkMisses(t);
    draw(t, dt);
    emitTime(t);
    if (songDuration > 0 && t >= songDuration) {
      playing = false;
      window.AudioEngine?.stopAll?.();
      onFeedback?.("complete");
      emitTime(songDuration);
      return;
    }
    animId = requestAnimationFrame(tick);
  }

  function checkMisses(t) {
    const windowSec = timingWindowMs / 1000;
    for (const n of pendingHits) {
      if (n.hit || n.missed) continue;
      if (t > n.time + windowSec) {
        n.missed = true;
        combo = 0;
        onFeedback?.("miss");
        window.PlaySurface?.flash?.(n.midi, "miss");
        emitScore();
      }
    }
  }

  function handleKeyPress(midi) {
    if (autoPlayMode) return false;
    if (!playing && !pausedAt) return false;
    const t = currentTime();
    const windowSec = timingWindowMs / 1000;

    let best = null;
    let bestDelta = Infinity;
    for (const n of pendingHits) {
      if (n.hit || n.missed || n.midi !== midi) continue;
      const delta = Math.abs(t - n.time);
      if (delta <= windowSec && delta < bestDelta) {
        best = n;
        bestDelta = delta;
      }
    }

    if (!best) return false;

    best.hit = true;
    const points = Math.round(100 + Math.max(0, 50 - bestDelta * 200));
    combo += 1;
    score += points + combo * 5;
    onFeedback?.("good", points);

    const pos = keyPositions.get(midi);
    const hitY = getHitY();
    if (pos) {
      window.NoteRenderer?.spawnImpactParticles?.(particles, pos.x, hitY, pos.w, midi, 18);
      spawnHitBurst(pos.x, hitY - 4, midi);
      boostKeyAura(midi, 1);
    }

    window.PlaySurface?.flash?.(midi, "good");
    emitScore();
    return true;
  }

  function emitScore() {
    onScoreChange?.({ score, combo });
  }

  function draw(t, dt = 0.016) {
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    updateParticles(dt);
    drawBackground(w, h, t);

    const hitY = getHitY();
    const pxPerSec = hitY / LOOKAHEAD_SEC;
    positionHitLine();
    const NR = window.NoteRenderer;

    updateKeyAuras(dt);
    checkNoteImpacts(t, hitY, pxPerSec);
    NR?.drawKeyAuroras?.(ctx, keyAuras, hitY, w, t);

    const seenLanes = new Set();
    for (const n of notes) {
      if (n.time > t + LOOKAHEAD_SEC || n.time + n.duration < t - 0.2) continue;
      const pos = keyPositions.get(n.midi);
      if (!pos || seenLanes.has(n.midi)) continue;
      seenLanes.add(n.midi);
      NR?.drawLane(ctx, pos.x, pos.w, h, hitY, n.midi, t);
    }

    for (const n of notes) {
      if (n.time > t + LOOKAHEAD_SEC || n.time + n.duration < t - 0.2) continue;
      const pos = keyPositions.get(n.midi);
      if (!pos) continue;

      const noteBottom = hitY - (n.time - t) * pxPerSec;
      const noteH = Math.max(NOTE_HEIGHT_PX, n.duration * pxPerSec);
      const width = pos.w * 0.92;
      const x = pos.x - width / 2;
      const y = noteBottom - noteH;
      const state = n.hit ? "hit" : n.missed ? "miss" : "pending";

      if (NR) {
        NR.drawNote(ctx, {
          x,
          y,
          w: width,
          h: noteH,
          midi: n.midi,
          vel: n.velocity,
          state,
          styleId: flameStyleId,
          intensity: flameIntensity,
          time: t,
        });
      }

    }

    drawParticles();
  }

  function resetScore() {
    score = 0;
    combo = 0;
    emitScore();
  }

  function resetRound() {
    autoPlayMode = false;
    stop();
    particles = [];
    impactCooldown.clear();
    for (const n of notes) {
      n.hit = false;
      n.missed = false;
      n._autoStarted = false;
      n._autoEnded = false;
      n._impactDone = false;
    }
    pendingHits = notes.map((n) => ({ ...n, id: `${n.midi}-${n.time}` }));
    resetScore();
    draw(0);
  }

  return {
    init,
    loadNotes,
    play,
    stop,
    pause,
    setSpeed,
    setTimingWindow,
    setFlameIntensity,
    setFlameStyle,
    setTrim,
    setAutoPlayMode,
    isAutoPlayMode,
    handleKeyPress,
    resetScore,
    resetRound,
    getSongDuration: () => songDuration,
    isPlaying: () => playing,
    hasNotes: () => notes.length > 0,
    isReady,
    resize: () => {
      resize();
      updateKeyPositions();
    },
  };
})();

window.Game = Game;
