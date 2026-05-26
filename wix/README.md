# Wix entegrasyonu

Touch Piano web sürümü (GitHub Pages) Wix **Members** ile giriş yapar; MIDI dosyaları **Wix Media**’da, liste **CMS**’te saklanır.

## Kurulum sırası

1. [CMS_SETUP.md](CMS_SETUP.md) — `UserPianoData` koleksiyonunu oluşturun (**üye Create/Update izni şart**).
2. Velo **Backend** — şu dosyaları ekleyin (repodan kopyalayın):
   - `backend/pianoLibraryCore.js`
   - `backend/pianoLibrary.web.js`
   - `backend/pianoMedia.web.js` (isteğe bağlı; sayfa kodu Media kullanmıyor)
3. `http-functions.js` (isteğe bağlı).
4. Sayfa **Piyano**:
   - Embed, **ID:** `pianoHtml`
   - URL: `https://kubilayelmas35.github.io/touch-piano-midi/`
   - Sayfa kodu: `public/player-page.js` (`GITHUB_PAGES_ORIGIN` doğru olsun).
5. **Publish** (her Velo değişikliğinden sonra).

## Akış

- Kullanıcı Wix’te giriş yapar → iframe GitHub Pages oynatıcıyı açar.
- Kütüphane listesi: `player-page.js` → **wix-data** (CMS) — webMethod değil.
- MIDI yükleme: `player-page.js` → `UserPianoMidi` koleksiyonu (~15 MB / parça).

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `backend/pianoLibraryCore.js` | Paylaşılan CMS mantığı |
| `backend/pianoLibrary.web.js` | HTTP / webMethod (isteğe bağlı) |
| `backend/pianoMedia.web.js` | MIDI Media yükleme |
| `public/player-page.js` | iframe köprüsü + CMS okuma/yazma |
| `http-functions.js` | `post_piano*` HTTP uçları |
