/** Açılış — responsive aurora splash + isteğe bağlı video */
const IntroSplash = (() => {
  const MIN_SHOW_MS = 2600;
  const MAX_SHOW_MS = 9000;
  const APP_NAME = window.__appName || window.I18n?.APP_NAME || "StaveFlow";
  let playing = false;

  function $(id) {
    return document.getElementById(id);
  }

  function viewSize() {
    return {
      w: document.documentElement.clientWidth || window.innerWidth,
      h: document.documentElement.clientHeight || window.innerHeight,
    };
  }

  function drawAuroraFrame(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#03030a");
    g.addColorStop(0.42, "#0a0818");
    g.addColorStop(1, "#140a1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const starCount = Math.min(140, Math.floor((w * h) / 9000));
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 97) % 1000) / 1000;
      const sy = ((i * 53) % 1000) / 1000;
      const tw = 0.35 + 0.65 * Math.sin(t * 1.2 + i * 0.7);
      ctx.fillStyle = `rgba(255,255,255,${0.1 + tw * 0.32})`;
      ctx.beginPath();
      ctx.arc(sx * w, sy * h * 0.78, 0.45 + (i % 4) * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let band = 0; band < 3; band++) {
      const y = h * (0.22 + band * 0.14) + Math.sin(t * 0.48 + band * 1.1) * h * 0.018;
      const grad = ctx.createLinearGradient(0, y - h * 0.08, w, y + h * 0.12);
      grad.addColorStop(0, "rgba(88,28,135,0)");
      grad.addColorStop(0.4, `rgba(168,85,247,${0.1 + band * 0.03})`);
      grad.addColorStop(0.62, `rgba(56,189,248,${0.08 + band * 0.025})`);
      grad.addColorStop(1, "rgba(88,28,135,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - h * 0.09, w, h * 0.18);
    }

    const vign = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.15, w * 0.5, h * 0.5, w * 0.75);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, w, h);
  }

  function resizeCanvas(canvas) {
    const { w, h } = viewSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function startCanvasLoop(canvas) {
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let size = resizeCanvas(canvas);
    const loop = (now) => {
      const t = now / 1000;
      drawAuroraFrame(ctx, size.w, size.h, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }

  function finish(overlay, stopLoop, resolve) {
    if (!overlay || overlay.classList.contains("intro-done")) return;
    overlay.classList.add("intro-fade-out");
    setTimeout(() => {
      overlay.classList.add("hidden", "intro-done");
      overlay.setAttribute("aria-hidden", "true");
      stopLoop?.();
      playing = false;
      resolve();
    }, 480);
  }

  function play() {
    if (playing) return Promise.resolve();
    const overlay = $("introSplash");
    if (!overlay) return Promise.resolve();

    const video = $("introSplashVideo");
    const canvas = $("introSplashCanvas");
    const skipBtn = $("introSplashSkip");
    const logoEl = overlay.querySelector(".intro-splash-logo");
    const tagEl = overlay.querySelector(".intro-splash-tag");
    const hintEl = overlay.querySelector(".intro-splash-hint");
    if (logoEl) logoEl.textContent = APP_NAME;
    if (tagEl && window.I18n) tagEl.textContent = window.I18n.t("intro.tag");
    if (hintEl && window.I18n) hintEl.textContent = window.I18n.t("intro.hint");
    if (skipBtn && window.I18n) skipBtn.textContent = window.I18n.t("intro.skip");
    if (!canvas) return Promise.resolve();

    playing = true;
    overlay.classList.remove("hidden", "intro-done", "intro-fade-out");
    overlay.setAttribute("aria-hidden", "false");

    resizeCanvas(canvas);
    const onResize = () => resizeCanvas(canvas);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const stopLoop = startCanvasLoop(canvas);

    return new Promise((resolve) => {
      const started = performance.now();
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
        finish(overlay, stopLoop, resolve);
      };

      const tryClose = () => {
        const elapsed = performance.now() - started;
        if (elapsed < MIN_SHOW_MS) {
          setTimeout(tryClose, MIN_SHOW_MS - elapsed);
          return;
        }
        done();
      };

      skipBtn?.addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          tryClose();
        },
        { once: true }
      );
      overlay.addEventListener("click", (e) => {
        if (e.target === skipBtn) return;
        tryClose();
      });

      if (video) {
        const sources = ["assets/intro.webm", "assets/intro.mp4"];
        let srcIdx = 0;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        const loadNext = () => {
          if (srcIdx >= sources.length) {
            video.classList.add("hidden");
            return;
          }
          const onReady = () => {
            video.removeEventListener("canplay", onReady);
            video.classList.remove("hidden");
            video.play().catch(() => video.classList.add("hidden"));
          };
          video.addEventListener("canplay", onReady);
          video.src = sources[srcIdx++];
        };
        video.addEventListener("error", loadNext);
        video.addEventListener("ended", tryClose, { once: true });
        loadNext();
      }

      setTimeout(tryClose, MAX_SHOW_MS);
    });
  }

  return { play };
})();

window.IntroSplash = IntroSplash;
