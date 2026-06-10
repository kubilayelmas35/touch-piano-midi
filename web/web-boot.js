/** Web: oturum banner, köprü durumu, iframe yükseklik senkronu */
(function () {
  const t = (key, vars) => window.I18n?.t?.(key, vars) ?? key;

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

  if (window.I18n) {
    window.I18n.init();
    setBanner(t("auth.connecting"), "warn");
  }

  window.addEventListener("touch-piano:session", (e) => {
    const { memberId, email } = e.detail || {};
    if (memberId) {
      setBanner(
        window.I18n
          ? window.I18n.formatMemberBanner(email)
          : `Signed in${email ? `: ${email}` : ""}.`,
        "ok"
      );
    } else {
      setBanner(t("auth.guest"), "warn");
    }
    syncEmbedHeight();
  });

  window.addEventListener("staveflow:locale", () => {
    if (!window.pianoApi?.getSession?.()?.memberId) {
      setBanner(t("auth.guest"), "warn");
    }
  });

  setTimeout(() => {
    if (window.pianoApi.isBridgeReady?.()) return;
    try {
      if (window.self === window.top) {
        setBanner(t("auth.embedOnly"), "warn");
      } else {
        setBanner(t("auth.guestShort"), "warn");
      }
    } catch {
      setBanner(t("auth.bridgeFail"), "warn");
    }
  }, 3500);
})();
