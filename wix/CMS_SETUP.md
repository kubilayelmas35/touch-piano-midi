# Wix CMS koleksiyonları

## 1. UserPianoData — kütüphane listesi

Wix Editor → CMS → **Create Collection**:

| Alan | Tür | Not |
|------|-----|-----|
| `memberId` | Text | Üye kimliği (Wix Members `_id`) |
| `librariesJson` | Text (uzun) | `{ "libraries": [ ... ] }` — yalnızca metadata (MIDI içeriği yok) |

**Koleksiyon ID:** `UserPianoData`

## 2. UserPianoMidi — MIDI dosyaları (parça başına)

| Alan | Tür | Not |
|------|-----|-----|
| `memberId` | Text | Üye kimliği |
| `songId` | Text | Şarkı kimliği (benzersiz) |
| `libraryId` | Text | Hangi kütüphaneye ait |
| `fileName` | Text | Orijinal dosya adı |
| `midiData` | Text (uzun) | Base64 MIDI (~15 MB’a kadar / parça) |

**Koleksiyon ID:** `UserPianoMidi`

Parça başına ayrı satır olduğu için limit **kütüphane toplamına değil tek dosyaya** uygulanır.

## İzinler (her iki koleksiyon)

Koleksiyon → **Settings** → **Permissions**:

| İşlem | Öneri |
|--------|--------|
| Read | Anyone (veya Site member author) |
| Create | **Anyone** veya Site member author |
| Update | **Anyone** veya Site member author |
| Delete | Site member author |

**Önemli:** Koleksiyon **ID** tam olarak `UserPianoData` ve `UserPianoMidi` olmalı.

`player-page.js` yalnızca giriş yapmış üyenin `memberId` satırlarını okur/yazar.

**Kritik:** Create ve Update en az **Site member author** veya **Anyone** olmalı; yoksa sayfa kodu `WDE0027` verir.

## Medya klasörü (isteğe bağlı)

Web sürümü artık CMS’te `UserPianoMidi` kullanır; Wix Media zorunlu değil.
