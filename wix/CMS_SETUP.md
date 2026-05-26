# Wix CMS — UserPianoData

Wix Editor → CMS → **Create Collection**:

| Alan | Tür | Not |
|------|-----|-----|
| `memberId` | Text | Üye kimliği (Wix Members `_id`) |
| `librariesJson` | Text (uzun) | `{ "libraries": [ ... ] }` JSON |

## İzinler (önerilen)

Koleksiyon → **Settings** → **Permissions**:

| İşlem | Öneri |
|--------|--------|
| Read | Anyone (veya Site member author) |
| Create | **Anyone** veya Site member author |
| Update | **Anyone** veya Site member author |
| Delete | Site member author |

**Önemli:** Koleksiyon **ID** tam olarak `UserPianoData` olmalı (boşluk veya Türkçe karakter yok).

Alan **Field key** (ID) tam olarak: `memberId`, `librariesJson` (büyük/küçük harf aynı).

`player-page.js` yalnızca giriş yapmış üyenin `memberId` satırını okur/yazar. Backend (`pianoLibraryCore.js`) aynı filtreyi kullanır.

**Kritik:** Create ve Update en az **Site member author** veya **Anyone** olmalı; yoksa sayfa kodu `WDE0027` verir.

## Medya klasörü

İlk MIDI yüklemesinde Wix Media Manager’da `/touch-piano-midi` klasörü oluşur.
