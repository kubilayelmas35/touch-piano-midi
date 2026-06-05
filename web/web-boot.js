/** Web: oturum banner, köprü durumu, iframe yükseklik senkronu */
(function () {
  function syncEmbedHeight() {
    const h = window.innerHeight;
    if (h > 0) {
      document.documentElement.style.height = `${h}px`;
      document.body.style.height = `${h}px`;
      document.body.style.maxHeight = `${h}px`;
    }
    try {
      window.Guitar?.applyLayout?.();
      window.Violin?.applyLayout?.();
      window.Piano?.applyLayout?.();
      window.Game?.resize?.();
    } catch {
      /* henüz yüklenmedi */
    }
  }

  window.addEventListener("resize", syncEmbedHeight);
  window.addEventListener("orientationchange", () => setTimeout(syncEmbedHeight, 100));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncEmbedHeight);
  } else {
    syncEmbedHeight();
  }
  setTimeout(syncEmbedHeight, 250);

  const banner = document.getElementById("authBanner");
  if (!banner || !window.pianoApi?.isWeb) return;

  function setBanner(text, kind) {
    banner.textContent = text;
    banner.className = kind || "";
  }

  window.addEventListener("touch-piano:session", (e) => {
    const { memberId, email } = e.detail || {};
    if (memberId) {
      setBanner(
        `Giriş yapıldı${email ? `: ${email}` : ""}. Kütüphaneleriniz bulutta saklanır.`,
        "ok"
      );
    } else {
      setBanner(
        "Misafir modu — serbest çalın. MIDI bu tarayıcıda saklanır; buluta kayıt için üye olun (tek seferlik 1 USD).",
        "warn"
      );
    }
    syncEmbedHeight();
  });

  setTimeout(() => {
    if (window.pianoApi.isBridgeReady?.()) return;
    try {
      if (window.self === window.top) {
        setBanner(
          "Bu sayfa Wix sitesinde gömülü açılmalıdır. Doğrudan GitHub Pages'te misafir modu çalışır; bulut senkronu için Wix gerekir.",
          "warn"
        );
      } else {
        setBanner(
          "Misafir modu — serbest çalın. MIDI kaydetmek için Wix'te üye olun (tek seferlik 1 USD).",
          "warn"
        );
      }
    } catch {
      setBanner("Wix köprüsü bağlanamadı.", "warn");
    }
  }, 3500);
})();
