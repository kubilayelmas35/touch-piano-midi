# Web (Wix + GitHub Pages) vs Masaüstü (Electron)

Aynı oynatıcı kodu (`src/main.js`) her iki sürümde de kullanılır.

## MIDI boyutu (web)

- Eski: tüm kütüphane tek JSON’da → ~400 KB güvenli limit
- Yeni: her parça **`UserPianoMidi`** koleksiyonunda ayrı satır → **~15 MB / parça**

## Karşılaştırma

| Özellik | Masaüstü | Web (Wix) |
|--------|----------|-----------|
| MIDI | Sınırsız (disk) | ~15 MB / parça (CMS) |
| MP3→MIDI | Var | Yok |
| Bulut kütüphane | Yerel | Wix üye hesabı |

Masaüstü: `npm install` → `npm start`
