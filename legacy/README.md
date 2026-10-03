# Touch Piano MIDI

Windows için dokunmatik piyano uygulaması: MIDI kütüphaneleri, parça (iz) seçimi, düşen notalar ve doğru tuşa basınca puan.

## Özellikler

- **Kütüphaneler**: İsim vererek birden fazla MIDI koleksiyonu oluşturun
- **Şarkı seçimi**: Kütüphaneden istediğiniz `.mid` dosyasını seçin
- **İz seçimi**: MIDI içindeki farklı parçaları (track) ayrı ayrı çalın
- **Oktav**: Başlangıç oktavı ve oktav sayısı (1–3)
- **Puanlama**: Doğru zamanda doğru tuşa basınca puan + combo
- **Dokunmatik**: Çoklu dokunma destekli piyano tuşları

## Kurulum

```bash
cd touch-piano-midi
npm install
npm start
```

## Windows paketi (taşınabilir)

```bash
npm run pack
```

Çıktı: `dist/` klasöründe portable `.exe`

## Kullanım

1. Sol panelden **+** ile yeni kütüphane oluşturun
2. Kütüphaneyi seçip **+ MIDI** ile dosya ekleyin
3. Şarkıyı seçin, **MIDI izi** ile parçayı belirleyin
4. Oktav ayarlarını yapın, **Oynat** ile başlayın
5. Notalar sarı çizgiye gelince ilgili tuşa basın

MIDI dosyaları `%APPDATA%/touch-piano-midi/libraries/` altında saklanır.

## Web + Wix (isteğe bağlı)

Üyelik ve bulutta kütüphane için:

```bash
npm run build:pages
```

- GitHub Pages: `docs/` klasörünü yayınlayın.
- Wix kurulumu: [wix/README.md](wix/README.md)
- Test listesi: [wix/VERIFICATION.md](wix/VERIFICATION.md) (build sonrası `docs/VERIFICATION.md`)

Masaüstü (`npm start`) ve web sürümü aynı arayüzü paylaşır; web’de MP3→MIDI yoktur.
