# Doğrulama — Wix + GitHub Pages

## Ön koşullar

- [ ] `npm run build:pages` çalıştırıldı, `docs/` güncel
- [ ] GitHub Pages yayında (Settings → Pages → `docs/`)
- [ ] Wix’te CMS `UserPianoData` ve Velo backend yüklü
- [ ] Piyano sayfasında iframe + `player-page.js`, `GITHUB_PAGES_ORIGIN` doğru

## Test planı

1. **Üye kaydı / giriş** — Wix Members; Piyano sayfasında yeşil oturum bandı.
2. **Kütüphane** — Ekle, yenile, listede kalsın.
3. **MIDI yükle** — + MIDI, çal ve seç.
4. **Tekrar giriş** — Çıkış/giriş sonrası aynı şarkılar.
5. **Silme** — × ile sil, kalıcı olsun.
6. **Electron** — `npm start` yerel kütüphane hâlâ çalışsın.

## Sorun giderme

| Belirti | Olası neden |
|---------|-------------|
| Oturum bekleniyor | Giriş yok veya iframe dışı açılış |
| Yükleme hatası | Backend / Media izinleri |
| Boş liste | CMS adı `UserPianoData` |
