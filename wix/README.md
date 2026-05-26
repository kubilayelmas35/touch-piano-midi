# Wix entegrasyonu

Touch Piano web sürümü (GitHub Pages) Wix **Members** ile giriş yapar; MIDI dosyaları **Wix Media**’da, liste **CMS**’te saklanır.

## Kurulum sırası

1. [CMS_SETUP.md](CMS_SETUP.md) — `UserPianoData` koleksiyonunu oluşturun.
2. Velo’da `backend/pianoLibrary.web.js` dosyasını ekleyin (bu repodaki içeriği kopyalayın).
3. `http-functions.js` dosyasını site backend’ine ekleyin (isteğe bağlı, doğrudan HTTP için).
4. Yeni sayfa **Piyano** oluşturun:
   - Embed / Custom Element, **ID:** `pianoHtml`
   - **Kaynak URL:** GitHub Pages adresiniz (`npm run build:pages` sonrası)
   - Sayfa kodu: [public/player-page.js](public/player-page.js) — `GITHUB_PAGES_ORIGIN` değerini düzenleyin.
5. Üyelik: Site → **Members** → kayıt/giriş açık.
6. Menüde “Piyano” sayfasına yalnızca üyeler gitsin (isteğe bağlı).

## Akış

- Kullanıcı Wix’te giriş yapar → Piyano sayfası iframe’de GitHub Pages’i açar.
- `player-page.js` üye bilgisini `postMessage` ile iframe’e gönderir.
- MIDI yükleme / liste: iframe → köprü → `pianoLibrary.web.js` → Media + CMS.
- Tekrar girişte aynı `memberId` ile `librariesJson` okunur.

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `backend/pianoLibrary.web.js` | Kütüphane CRUD + MIDI yükleme |
| `http-functions.js` | `post_piano*` HTTP uçları |
| `public/player-page.js` | iframe köprüsü |

Masaüstü uygulama (`npm start`) bu dosyalardan bağımsız çalışır; veriler `%APPDATA%` altındadır.
