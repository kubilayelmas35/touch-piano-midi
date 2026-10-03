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
| **Kayıt hatası: Unable to handle the request** | Backend modülü yüklenemedi, CMS yok/yanlış ad, veya Velo **Publish** edilmedi |
| Yükleme hatası | Backend / Media izinleri |
| Boş liste | CMS adı `UserPianoData` |

### "Unable to handle the request" adımları

1. Wix → **Site Monitoring** → son hata satırına bakın (WDE kodu).
2. **Backend** → `pianoLibrary.web.js` dosyasını repodaki güncel sürümle değiştirin → **Publish**.
3. CMS’te koleksiyon ID: `UserPianoData`, alanlar: `memberId`, `librariesJson`.
4. Piyano sayfasında **Wix üyesi olarak giriş** yapın (sadece GitHub Pages’te açmak yetmez).
5. Editor’da **Run** ile `pianoPing` test edin (giriş yapmış üye gerekir).
