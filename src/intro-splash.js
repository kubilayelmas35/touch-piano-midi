/** Açılış videosu / aurora splash — her oturumda bir kez */
const IntroSplash = (() => {
  const MIN_SHOW_MS = 2200;
  const MAX_SHOW_MS = 12000;
  let playing = false;

  function $(id) {
    return document.getElementById(id);
  }

  function drawAuroraFrame(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#050510");
    g.addColorStop(0.45, "#0c0a1e");
    g.addColorStop(1, "#120820");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 90; i++) {
      const sx = ((i * 97) % 1000) / 1000;
      const sy = ((i * 53) % 1000) / 1000;
      const tw = 0.35 + 0.65 * Math.sin(t * 1.4 + i);
      ctx.fillStyle = `rgba(255,255,255,${0.12 + tw * 0.35})`;
      ctx.beginPath();
      ctx.arc(sx * w, sy * h * 0.72, 0.6 + (i % 3) * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let band = 0; band < 3; band++) {
      const y = h * (0.28 + band * 0.12) + Math.sin(t * 0.55 + band) * 18;
      const grad = ctx.createLinearGradient(0, y - 40, w, y + 80);
      grad.addColorStop(0, "rgba(88,28,135,0)");
      grad.addColorStop(0.35, `rgba(168,85,247,${0.14 + band * 0.04})`);
      grad.addColorStop(0.65, `rgba(56,189,248,${0.1 + band * 0.03})`);
      grad.addColorStop(1, "rgba(88,28,135,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 50, w, 140);
    }
  }

  function startCanvasLoop(canvas) {
    const ctx = canvas.getContext("2d");
    let raf = 0;
    const loop = (now) => {
      const t = now / 1000;
      const w = canvas.width;
      const h = canvas.height;
      drawAuroraFrame(ctx, w, h, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }

  function resizeCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    }, 520);
  }

  function play() {
    if (playing) return Promise.resolve();
    const overlay = $("introSplash");
    if (!overlay) return Promise.resolve();

    const video = $("introSplashVideo");
    const canvas = $("introSplashCanvas");
    const skipBtn = $("introSplashSkip");
    if (!canvas) return Promise.resolve();

    playing = true;
    overlay.classList.remove("hidden", "intro-done", "intro-fade-out");
    overlay.setAttribute("aria-hidden", "false");

    resizeCanvas(canvas);
    const onResize = () => resizeCanvas(canvas);
    window.addEventListener("resize", onResize);
    const stopLoop = startCanvasLoop(canvas);

    return new Promise((resolve) => {
      const started = performance.now();
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        window.removeEventListener("resize", onResize);
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
      overlay.addEventListener("click", tryClose, { once: true });

      if (video) {
        const sources = ["assets/intro.webm", "assets/intro.mp4"];
        let srcIdx = 0;
        video.muted = true;
        video.playsInline = true;
        video.classList.remove("hidden");
        const loadNext = () => {
          if (srcIdx >= sources.length) {
            video.classList.add("hidden");
            return;
          }
          const onReady = () => {
            video.removeEventListener("canplay", onReady);
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
