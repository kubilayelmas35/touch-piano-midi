# Sonatrio — Steam yayını

Masaüstü uygulaması Electron ile paketlenir (`desktop/`). Steam'den başlatıldığında
`steamworks.js` üzerinden başarımları açar ve Steam arayüzünü (Shift+Tab) etkinleştirir.
Steam yoksa ya da App ID verilmemişse uygulama normal şekilde çalışır.

## 1. Steamworks hesabı

1. <https://partner.steamgames.com> adresinden Steamworks'e kaydol (uygulama başına 100 $ ücret).
2. Yeni uygulama oluştur; sana bir **App ID** (ör. `3456780`) ve bir **Depot ID** (genelde App ID + 1) verilir.
3. *SteamPipe → Depots* altında depoyu Windows için ayarla.
4. *Installation → General* altında başlatma seçeneği ekle:
   - Executable: `Sonatrio.exe`
   - Operating system: Windows

## 2. Başarımlar

*Stats & Achievements* sayfasında aşağıdaki 20 başarımı **API adları birebir aynı** olacak şekilde
oluştur. İkonlar `steam/achievements/` klasöründe hazır (açık: `ACH_X.png`, kilitli: `ACH_X_locked.png`, 256×256).
Bitirdikten sonra *Publish* düğmesine basmayı unutma.

| API adı | Türkçe | English | Açıklama (EN) |
| --- | --- | --- | --- |
| ACH_FIRST_SONG | İlk şarkı | First song | Finish a song from start to end. |
| ACH_FIVE_STARS | Beş yıldız | Five stars | Get 5 stars on any song. |
| ACH_DAILY_GOAL | Hedef avcısı | Goal getter | Reach your daily practice goal. |
| ACH_STREAK_3 | Isınıyorsun | On a roll | Practise 3 days in a row. |
| ACH_COMBO_50 | 50 kombo | Combo 50 | Hit 50 notes in a row. |
| ACH_NOTES_1K | Bin nota | A thousand notes | Play 1,000 notes correctly. |
| ACH_HOUR_1 | İlk saat | First hour | Practise for one hour in total. |
| ACH_SONGS_10 | Repertuvar | Repertoire | Finish 10 different songs. |
| ACH_STREAK_7 | Haftanın yıldızı | Week warrior | Practise 7 days in a row. |
| ACH_COMBO_200 | Durdurulamaz | Unstoppable | Hit 200 notes in a row. |
| ACH_EXPLORER | Kâşif | Explorer | Finish a song from every category. |
| ACH_TRIO | Üçlü | Trio | Finish songs on piano, guitar and violin. |
| ACH_FLAWLESS | Kusursuz | Flawless | Finish a song without a single miss. |
| ACH_NO_SAFETY_NET | Filesiz | No safety net | Get 4+ stars without wait mode, at full speed. |
| ACH_CLASSICAL_5 | Maestro | Maestro | Get 3+ stars on 5 classical pieces. |
| ACH_NOTES_10K | On bin nota | Ten thousand notes | Play 10,000 notes correctly. |
| ACH_HOUR_10 | Azimli | Dedicated | Practise for 10 hours in total. |
| ACH_SONGS_25 | Şarkı defteri | Songbook | Finish 25 different songs. |
| ACH_STREAK_30 | Alışkanlık | Habit | Practise 30 days in a row. |
| ACH_STARS_100 | Yıldız koleksiyoncusu | Star collector | Collect 100 stars across your songs. |

Kullanıcı Steam'e bağlanmadan önce açtığı başarımlar da uygulama Steam ile ilk açıldığında Steam'e aktarılır.

## 3. Derleme

```powershell
npm run steam:dist -- 3456780   # kendi App ID'n
```

Bu komut web uygulamasını derler, `../sonatrio-release/win-unpacked/` klasörüne paketler ve
`Sonatrio.exe` yanına `steam_appid.txt` yazar.

Steam olmadan dağıtılacak kurulum dosyası için: `npm run desktop:dist`
(`../sonatrio-release/Sonatrio-Setup-<sürüm>.exe`).

## 4. Yükleme (SteamPipe)

1. [Steamworks SDK](https://partner.steamgames.com/downloads/steamworks_sdk.zip) içindeki `tools/ContentBuilder/builder/steamcmd.exe` dosyasını kullan.
2. `steam/scripts/app_build.vdf` içinde `APP_ID` ve `DEPOT_ID`, `steam/scripts/depot_build.vdf` içinde `DEPOT_ID` değerlerini kendi numaralarınla değiştir.
3. Yükle:

```powershell
steamcmd.exe +login <steam_kullanici_adi> +run_app_build "C:\...\touch-piano-midi\steam\scripts\app_build.vdf" +quit
```

4. Steamworks'te *SteamPipe → Builds* altında yüklenen derlemeyi `default` dalına al.

## 5. Mağaza görselleri

`steam/art/` klasöründe Steam'in istediği ölçülerde hazır:

| Dosya | Steamworks alanı |
| --- | --- |
| header_capsule_920x430.png | Header Capsule |
| small_capsule_462x174.png | Small Capsule |
| main_capsule_1232x706.png | Main Capsule |
| vertical_capsule_748x896.png | Vertical Capsule |
| library_capsule_600x900.png | Library Capsule |
| library_hero_3840x1240.png | Library Hero |
| library_logo_1280x720.png | Library Logo |

Mağaza sayfası için en az 5 ekran görüntüsü (1920×1080) gerekir; uygulamayı tam ekranda (F11) açıp alabilirsin.

## Notlar

- MIDI klavyeler masaüstünde doğrudan çalışır (izin otomatik verilir).
- Masaüstünde Google/Apple ile giriş gizlidir; e-posta ile giriş çalışır.
- Test için App ID `480` (Spacewar) kullanılabilir: `npm run steam:dist -- 480`; başarımlar bu durumda Steam'de görünmez ama overlay çalışır.
