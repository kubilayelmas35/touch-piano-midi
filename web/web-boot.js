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
      window.Game?.resize?.();
    } catch {
      /* oyun henüz yüklenmedi */
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
    }
    syncEmbedHeight();
  });

  setTimeout(() => {
    if (window.pianoApi.isBridgeReady?.()) return;
    try {
      if (window.self === window.top) {
        setBanner(
          "Bu sayfa Wix sitesinde gömülü açılmalıdır. Doğrudan GitHub Pages’te kütüphane senkronu çalışmaz.",
          "warn"
        );
      } else {
        setBanner(
          "Wix oturumu bekleniyor… Lütfen sitede üye girişi yapın ve bu sayfayı yenileyin.",
          "warn"
        );
      }
    } catch {
      setBanner("Wix köprüsü bağlanamadı.", "warn");
    }
  }, 3500);
})();
