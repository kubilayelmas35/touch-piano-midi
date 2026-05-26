/** Web: oturum banner ve köprü durumu */
(function () {
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
