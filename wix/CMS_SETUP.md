# Wix CMS — UserPianoData

Wix Editor → CMS → **Create Collection**:

| Alan | Tür | Not |
|------|-----|-----|
| `memberId` | Text | Üye kimliği (Wix Members `_id`) |
| `librariesJson` | Text (uzun) | `{ "libraries": [ ... ] }` JSON |

## İzinler (önerilen)

- **Read**: Site member author (veya Admin only — veri zaten `memberId` ile filtrelenir)
- **Create / Update / Delete**: Site member author

`pianoLibrary.web.js` her istekte `auth.getTokenInfo()` ile yalnızca oturum açmış üyenin verisini okur/yazar.

## Medya klasörü

İlk MIDI yüklemesinde Wix Media Manager’da `/touch-piano-midi` klasörü oluşur.
