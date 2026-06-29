/* Otomatik birleştirilmiş — npm start öncesi üretilir */

/* === i18n.js === */
/** StaveFlow — çok dilli arayüz (otomatik algılama + ayarlar) */
const I18n = (() => {
  const APP_NAME = "StaveFlow";
  const SETTINGS_KEY = "touch-piano-settings";
  const FALLBACK = "en";

  const LOCALES = [
    { id: "auto", label: "🌐 Auto / Otomatik" },
    { id: "en", label: "English" },
    { id: "tr", label: "Türkçe" },
    { id: "de", label: "Deutsch" },
    { id: "fr", label: "Français" },
    { id: "it", label: "Italiano" },
    { id: "es", label: "Español" },
    { id: "pt", label: "Português" },
    { id: "nl", label: "Nederlands" },
    { id: "pl", label: "Polski" },
    { id: "ru", label: "Русский" },
    { id: "ja", label: "日本語" },
    { id: "ko", label: "한국어" },
    { id: "zh", label: "中文" },
  ];

  const en = {
    "app.tagline": "Piano · Guitar · Violin — play with MIDI",
    "intro.tag": "Piano · Guitar · Violin — play with MIDI",
    "intro.hint": "Tap anywhere or Skip",
    "intro.skip": "Skip",
    "auth.connecting": "Connecting to Wix account… Please sign in on the site.",
    "auth.member": "Signed in{email}. Your libraries are saved in the cloud.",
    "auth.guest": "Guest mode — play freely. MIDI is stored in this browser; sign up for cloud sync (one-time $1 USD).",
    "auth.embedOnly": "Open this player from your Wix Piano page. GitHub Pages works in guest mode; Wix is required for cloud sync.",
    "auth.guestShort": "Guest mode — sign up on Wix to save MIDI (one-time $1 USD).",
    "auth.bridgeFail": "Could not connect to Wix bridge.",
    "apiError.web": "Player failed to load. Open from your Wix <strong>Piano</strong> page or check configuration.",
    "apiError.desktop": "Main app failed to load. Run: <code>npm start</code>",
    "header.score": "Score",
    "header.remaining": "Left:",
    "header.play": "▶ Play (you play)",
    "header.pause": "⏸ Pause",
    "header.autoplay": "🎹 Auto play",
    "header.autoplayPause": "⏸ Pause auto",
    "header.stop": "■ Stop",
    "header.speed": "Speed",
    "header.menu": "☰ Menu",
    "header.menuOpen": "☰ Open menu",
    "header.fullscreen": "⛶ Full screen",
    "header.window": "⛶ Window",
    "header.instrument": "Instrument",
    "header.trackPosition": "Track position",
    "sidebar.tab.library": "Library",
    "sidebar.tab.songs": "Songs",
    "sidebar.tab.settings": "Settings",
    "libs.title": "Libraries",
    "libs.new": "New library name",
    "libs.add": "Add",
    "libs.hint": "Select or add a library above. Files are saved to your Wix account.",
    "libs.hintGuest": "Guest mode: MIDI stays in this browser. Wix membership for cloud (one-time $1 USD).",
    "libs.hintDesktop": "Select or add a library above.",
    "libs.hintSelected": "Selected: {name} — use + MIDI to add files",
    "libs.empty": "No libraries yet.",
    "libs.renameTitle": "Double-click: rename",
    "songs.title": "Songs",
    "songs.midi": "+ MIDI",
    "songs.audio": "♫ MP3→MIDI",
    "songs.hintWeb": "Web: ~15 MB per MIDI. Desktop for MP3→MIDI (<code>npm start</code>). Select a song then <strong>▶ Play</strong>.",
    "songs.hintAudio": "MP3→MIDI: best with a single instrument or vocal track.",
    "songs.hintSelectLib": "Select a library first.",
    "songs.hintPick": "Pick a song from the list to play.",
    "songs.hintAddMidi": "Add files with + MIDI to this library.",
    "songs.hintPlay": "▶ Play — notes fall from the top. Touch or keyboard to play.",
    "songs.empty": "No songs yet.",
    "songs.select": "Select a song",
    "songs.delete": "Delete",
    "songs.trackOption": "{name} ({count} notes){inst}",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.move": "↔ Move panels",
    "settings.moveSave": "✓ Save position",
    "settings.themeHint": "Colors are saved per instrument (piano / guitar / violin).",
    "settings.tab.song": "Track",
    "settings.tab.keys": "Keyboard",
    "settings.tab.look": "Look",
    "settings.tab.play": "Play",
    "settings.track": "MIDI track",
    "settings.trackEmpty": "Select a song first",
    "settings.trimStart": "Trim start (sec)",
    "settings.trimEnd": "Trim end (sec)",
    "settings.trimHint": "Track reloads after trimming.",
    "settings.octaveStart": "Start octave",
    "settings.octaveCount": "Octave count",
    "settings.octaveHint": "Auto-fits full width when a song is selected.",
    "settings.keyWidth.piano": "Key width",
    "settings.keyWidth.fretted": "Fret cell width",
    "settings.keyHeight.piano": "Keyboard height",
    "settings.keyHeight.fretted": "Panel height",
    "settings.neckHeight": "Neck row height",
    "settings.stringHeight": "String row height",
    "settings.neckWidth": "Neck / fret width",
    "settings.pluckWidth": "Strings panel width",
    "settings.gripGuitar": "Grip all strings (guitar — one fret → 6 strings)",
    "settings.gripViolin": "Grip all strings (violin — one position → 4 strings)",
    "settings.neckNearby": "Frets: detect nearby touch",
    "settings.stringsNearby": "Strings: detect nearby touch",
    "settings.gripHint": "Off = separate fret per string. On = one fret applies to all strings.",
    "settings.vibrato": "String vibrato sensitivity",
    "settings.vibratoHint": "On strings panel, hold and slide slightly to add vibrato.",
    "settings.dock.piano": "Keyboard position (vertical)",
    "settings.dock.other": "Instrument position (vertical)",
    "settings.align.piano": "Keyboard alignment (horizontal)",
    "settings.align.other": "Instrument alignment (horizontal)",
    "settings.dock.bottom": "Bottom (default)",
    "settings.dock.middle": "Middle (below notes)",
    "settings.dock.top": "Top",
    "settings.align.stretch": "Full width",
    "settings.align.left": "Left",
    "settings.align.center": "Center",
    "settings.align.right": "Right",
    "settings.dockHintPiano": "With few octaves, try center/right align or middle position.",
    "settings.dockHintStrings": "Drag panels with ↔ Move in the sidebar.",
    "settings.instrumentSound": "Instrument sound",
    "settings.labelMode": "Label mode",
    "settings.label.note": "Note name",
    "settings.label.letters": "Letter layout",
    "settings.label.custom": "Custom list",
    "settings.labelPreset": "Letter preset",
    "settings.label.game": "Game (ZXCV…)",
    "settings.label.piano": "Keyboard (AWSE…)",
    "settings.customLetters": "Custom letters",
    "settings.apply": "Apply",
    "settings.labelHint": "Right-click a key to assign a letter. On touch, edit in Settings.",
    "settings.effectHue": "Effect hue",
    "settings.keyTop": "Pressed key (top)",
    "settings.keyMid": "Pressed key (mid)",
    "settings.keyBottom": "Pressed key (bottom)",
    "settings.hitLine": "Hit line",
    "settings.noteStyle": "Note style",
    "settings.flame.aurora": "Aurora",
    "settings.flame.fire": "Fire",
    "settings.flame.ice": "Ice",
    "settings.flame.neon": "Neon",
    "settings.flame.rainbow": "Rainbow",
    "settings.flame.plasma": "Plasma",
    "settings.flame.minimal": "Minimal",
    "settings.flameIntensity": "Effect intensity",
    "settings.pcKeyboard": "Computer keyboard",
    "settings.kbLayout": "Keyboard layout",
    "settings.kb.auto": "Auto-detect",
    "settings.kb.qwerty": "QWERTY (US/English)",
    "settings.kb.tr-f": "Turkish F",
    "settings.kb.tr-q": "Turkish Q",
    "settings.kb.qwertz": "QWERTZ (German)",
    "settings.kb.azerty": "AZERTY (French)",
    "settings.kb.detected": "Detected: {name}",
    "settings.kb.selected": "Selected: {name}",
    "settings.dynamic": "Dynamic pressure",
    "settings.sustain": "Sustain release",
    "settings.sustainHint": "0–10,000 ms. 0 = instant cut. Affects sound and string vibration fade on guitar/violin.",
    "settings.timing": "Timing window",
    "settings.touchHint": "Touch: multi-finger gestures disabled. Long-press and double-tap on keys are ignored.",
    "inst.piano": "Piano",
    "inst.guitar": "Guitar",
    "inst.violin": "Violin",
    "inst.flute": "Flute",
    "inst.brass": "Brass",
    "inst.synth": "Synth",
    "inst.guitarNeck": "Guitar neck",
    "inst.guitarNeckSub": "Press a fret — pluck the string on the right",
    "inst.strings": "Strings (pluck)",
    "inst.stringsSub": "Same color = same string",
    "inst.openString": "open",
    "inst.violinNeck": "Violin fingerboard",
    "picker.title": "Which instrument do you want to play?",
    "picker.hint": "Falling notes stay the same; the play surface below changes. Switch anytime from the top menu.",
    "modal.newLib": "New library",
    "modal.renameLib": "Rename library",
    "modal.libName": "Library name",
    "modal.cancel": "Cancel",
    "modal.save": "Save",
    "modal.assignKey": "Assign key letter",
    "modal.assignHint": "{name} — one letter or empty",
    "modal.oneLetter": "One letter",
    "modal.clear": "Clear",
    "modal.assignClear": "Letter removed",
    "modal.assignSet": "Key → \"{ch}\"",
    "intensity.light": "Light",
    "intensity.normal": "Normal",
    "intensity.strong": "Strong",
    "intensity.max": "Maximum",
    "intensity.flame": "Blazing!",
    "toast.libEmpty": "Library name cannot be empty.",
    "toast.libRenamed": "Library renamed.",
    "toast.libAdded": "\"{name}\" library added.",
    "toast.saveError": "Save error: {msg}",
    "toast.octavePianoOnly": "Octave settings apply in piano mode only.",
    "toast.octaveSet": "Keyboard: octave {start}, {count} octaves",
    "toast.fitSong": "Keyboard fit to song: {count} octaves (full width)",
    "toast.instrument": "Instrument: {name}",
    "toast.fullscreenOn": "Full screen (F11 / Esc)",
    "toast.windowMode": "Window mode",
    "toast.songLoaded": "\"{name}\" loaded.",
    "toast.songLoadFail": "Could not load song: {msg}",
    "toast.noNotes": "No notes in this MIDI file.",
    "toast.songDeleted": "Song deleted.",
    "toast.deleteFail": "Could not delete: {msg}",
    "toast.trackDone": "Track finished! Press ■ to restart.",
    "toast.midiCloud": "{n} MIDI saved to cloud.",
    "toast.midiLocal": "{n} MIDI saved in this browser (guest).",
    "toast.midiFail": "Could not add MIDI: {msg}",
    "toast.pickLib": "Select or create a library first.",
    "toast.trim": "Trim: start {start}s, end {end}s",
    "toast.importCancel": "Cancelled or no file selected.",
    "toast.audioConverted": "{n} tracks converted ({notes} notes). Select and play.",
    "toast.bootGuest": "Guest mode: you can play. Sign up for cloud library.",
    "toast.cloudLibError":
      "Cloud library unavailable: {msg}. You can still play the sample track.",
    "toast.bootLibError": "Library error: {msg}",
    "toast.pianoWarn": "Piano warning: {msg}",
    "toast.demoError": "Demo song: {msg}",
    "toast.autoPlayOn": "Auto play — notes are hit automatically.",
    "toast.kbOn": "Keyboard playing enabled.",
    "toast.kbOff": "Keyboard playing disabled.",
    "toast.kbLayoutAuto": "Keyboard layout will auto-detect.",
    "toast.kbLayoutPick": "Keyboard layout: {name}",
    "toast.labelsUpdated": "Key letters updated.",
    "toast.flameStyle": "Note style: {name}",
    "toast.dynamicOn": "Dynamic pressure on.",
    "toast.dynamicOff": "Fixed volume.",
    "toast.sustainMs": "Sustain: {ms} ms",
    "toast.moveHintPiano": "Piano position: Settings → Keyboard → position / alignment.",
    "toast.sound": "Sound: {name}",
    "toast.instrumentRefreshFail": "Instrument changed; some settings could not refresh: {msg}",
    "toast.audioNoImport": "Audio import is not available in this build.",
    "toast.convertFail": "Could not convert audio: {msg}",
    "feedback.miss": "Miss!",
    "feedback.good": "+{points}",
    "starter.lib": "Sample tracks (royalty-free)",
    "starter.song": "Bach — Prelude BWV 846",
    "import.memberTitle": "Sign up to save MIDI (one-time $1 USD). You can still play without an account.",
    "audioImport.title": "Converting audio to MIDI",
    "audioImport.preparing": "Preparing…",
  };

  const tr = {
    ...en,
    "app.tagline": "Piyano · Gitar · Keman — MIDI ile çal",
    "intro.tag": "Piyano · Gitar · Keman — MIDI ile çal",
    "intro.hint": "Dokunun veya Atla",
    "intro.skip": "Atla",
    "auth.connecting": "Wix hesabına bağlanılıyor… Siteye giriş yaptığınızdan emin olun.",
    "auth.member": "Giriş yapıldı{email}. Kütüphaneleriniz bulutta saklanır.",
    "auth.guest":
      "Misafir modu — serbest çalın. MIDI bu tarayıcıda saklanır; buluta kayıt için üye olun (tek seferlik 1 USD).",
    "auth.embedOnly":
      "Oynatıcıyı Wix Piyano sayfanızdan açın. GitHub Pages misafir modunda çalışır; bulut için Wix gerekir.",
    "auth.guestShort": "Misafir modu — MIDI kaydetmek için Wix üyeliği (tek seferlik 1 USD).",
    "auth.bridgeFail": "Wix köprüsüne bağlanılamadı.",
    "apiError.web":
      "Oynatıcı yüklenemedi. Wix sitenizdeki <strong>Piyano</strong> sayfasından açın veya yapılandırmayı kontrol edin.",
    "header.score": "Puan",
    "header.remaining": "Kalan:",
    "header.play": "▶ Oynat (sen çal)",
    "header.pause": "⏸ Duraklat",
    "header.autoplay": "🎹 Sen çal",
    "header.autoplayPause": "⏸ Bilgisayar duraklat",
    "header.stop": "■ Durdur",
    "header.speed": "Hız",
    "header.menu": "☰ Menü",
    "header.menuOpen": "☰ Menüyü aç",
    "header.fullscreen": "⛶ Tam ekran",
    "header.window": "⛶ Pencere",
    "header.instrument": "Enstrüman",
    "header.trackPosition": "Parça konumu",
    "sidebar.tab.library": "Kütüphane",
    "sidebar.tab.songs": "Şarkılar",
    "sidebar.tab.settings": "Ayarlar",
    "libs.title": "Kütüphaneler",
    "libs.new": "Yeni kütüphane adı",
    "libs.add": "Ekle",
    "libs.hint": "Kütüphane seçin veya yukarıdan ekleyin. Dosyalar Wix hesabınıza kaydedilir.",
    "libs.hintGuest":
      "Misafir modu: MIDI bu tarayıcıda saklanır. Buluta kayıt için Wix üyeliği (tek seferlik 1 USD).",
    "libs.hintDesktop": "Kütüphane seçin veya yukarıdan ekleyin.",
    "libs.hintSelected": "Seçili: {name} — + MIDI ile dosya ekleyin",
    "libs.empty": "Henüz kütüphane yok.",
    "libs.renameTitle": "Çift tık: yeniden adlandır",
    "songs.title": "Şarkılar",
    "songs.midi": "+ MIDI",
    "songs.audio": "♫ MP3→MIDI",
    "songs.hintWeb":
      "Web: MIDI parça başına ~15 MB. MP3→MIDI için masaüstü (<code>npm start</code>). Şarkı seçince <strong>▶ Oynat</strong>.",
    "songs.hintAudio": "MP3→MIDI: tek enstrüman veya vokal en iyi sonucu verir.",
    "songs.hintSelectLib": "Önce bir kütüphane seçin.",
    "songs.hintPick": "Listeden bir şarkı seçin.",
    "songs.hintAddMidi": "Bu kütüphaneye + MIDI ile dosya ekleyin.",
    "songs.hintPlay": "▶ Oynat — notalar yukarıdan düşer. Dokunun veya klavye ile çalın.",
    "songs.empty": "Henüz şarkı yok.",
    "songs.select": "Şarkı seçin",
    "songs.delete": "Sil",
    "songs.trackOption": "{name} ({count} nota){inst}",
    "settings.title": "Ayarlar",
    "settings.language": "Dil",
    "settings.move": "↔ Hareket ettir",
    "settings.moveSave": "✓ Konumu kaydet",
    "settings.themeHint": "Renkler seçili enstrümana özel kaydedilir (piyano / gitar / keman).",
    "settings.tab.song": "Parça",
    "settings.tab.keys": "Klavye",
    "settings.tab.look": "Görünüm",
    "settings.tab.play": "Oyun",
    "settings.track": "MIDI izi",
    "settings.trackEmpty": "Önce şarkı seçin",
    "settings.trimStart": "Baştan kes (sn)",
    "settings.trimEnd": "Sondan kes (sn)",
    "settings.trimHint": "Kırpma sonrası parça yeniden yüklenir.",
    "settings.octaveStart": "Başlangıç oktavı",
    "settings.octaveCount": "Oktav sayısı",
    "settings.octaveHint": "Şarkı seçilince otomatik (tam genişlik).",
    "settings.keyWidth.piano": "Tuş genişliği",
    "settings.keyWidth.fretted": "Perde hücre genişliği",
    "settings.keyHeight.piano": "Klavye yüksekliği",
    "settings.keyHeight.fretted": "Panel yüksekliği",
    "settings.neckHeight": "Kol tel yüksekliği",
    "settings.stringHeight": "Sağ tel yüksekliği",
    "settings.neckWidth": "Kol / perde genişliği",
    "settings.pluckWidth": "Teller paneli genişliği",
    "settings.gripGuitar": "Tüm telleri sık (gitar — bir perde → 6 tel)",
    "settings.gripViolin": "Tüm telleri sık (keman — bir pozisyon → 4 tel)",
    "settings.neckNearby": "Perde: yakın temasları da algıla",
    "settings.stringsNearby": "Sağ teller: yakın temasları da algıla",
    "settings.gripHint": "Kapalıyken her tele ayrı perde. Açıkken bir perde tüm tellere uygulanır.",
    "settings.vibrato": "Tel titreşim hassasiyeti",
    "settings.vibratoHint":
      "Teller panelinde parmağınızı basılı tutup hafifçe sürükleyin — titreşim artar.",
    "settings.dock.piano": "Klavye konumu (dikey)",
    "settings.dock.other": "Enstrüman konumu (dikey)",
    "settings.align.piano": "Klavye hizası (yatay)",
    "settings.align.other": "Enstrüman hizası (yatay)",
    "settings.dock.bottom": "Alt (varsayılan)",
    "settings.dock.middle": "Orta (notaların altı)",
    "settings.dock.top": "Üst",
    "settings.align.stretch": "Tam genişlik",
    "settings.align.left": "Sola",
    "settings.align.center": "Ortaya",
    "settings.align.right": "Sağa",
    "settings.dockHintPiano": "Az oktav kullanıyorsanız ortaya/sağa hizalayın veya orta konuma alın.",
    "settings.dockHintStrings": "Panelleri sol menüden ↔ Hareket ettir ile sürükleyebilirsiniz.",
    "settings.instrumentSound": "Enstrüman sesi",
    "settings.labelMode": "Etiket modu",
    "settings.label.note": "Nota adı",
    "settings.label.letters": "Harf düzeni",
    "settings.label.custom": "Özel liste",
    "settings.labelPreset": "Harf düzeni",
    "settings.label.game": "Oyun (ZXCV…)",
    "settings.label.piano": "Klavye (AWSE…)",
    "settings.customLetters": "Özel harfler",
    "settings.apply": "Uygula",
    "settings.labelHint":
      "Tuşa <strong>sağ tık</strong> (fare) → harf ata. Dokunmatikte Ayarlar’dan düzenleyin.",
    "settings.effectHue": "Efekt rengi (ton)",
    "settings.keyTop": "Basılı tuş (üst)",
    "settings.keyMid": "Basılı tuş (orta)",
    "settings.keyBottom": "Basılı tuş (alt)",
    "settings.hitLine": "Vuruş çizgisi",
    "settings.noteStyle": "Nota stili",
    "settings.flame.aurora": "Aurora",
    "settings.flame.fire": "Alev",
    "settings.flame.ice": "Buz",
    "settings.flame.neon": "Neon",
    "settings.flame.rainbow": "Gökkuşağı",
    "settings.flame.plasma": "Plazma",
    "settings.flame.minimal": "Sade",
    "settings.flameIntensity": "Efekt yoğunluğu",
    "settings.pcKeyboard": "Bilgisayar klavyesi",
    "settings.kbLayout": "Klavye düzeni",
    "settings.kb.auto": "Otomatik algıla",
    "settings.kb.qwerty": "QWERTY (ABD/İngilizce)",
    "settings.kb.tr-f": "Türkçe F",
    "settings.kb.tr-q": "Türkçe Q",
    "settings.kb.qwertz": "QWERTZ (Almanca)",
    "settings.kb.azerty": "AZERTY (Fransızca)",
    "settings.dynamic": "Dinamik basınç",
    "settings.sustain": "Sustain (bırakış süresi)",
    "settings.sustainHint": "0–10.000 ms. 0 = anında kesilir. Ses ve sağ tellerdeki titreşimin yavaşlamasını ayarlar.",
    "settings.timing": "Zaman toleransı",
    "settings.touchHint": "Dokunmatik: çok parmaklı jestler kapalı. Tuşlarda uzun basış ve çift dokunuş yok sayılır.",
    "inst.piano": "Piyano",
    "inst.guitar": "Gitar",
    "inst.violin": "Keman",
    "inst.flute": "Flüt",
    "inst.brass": "Bakır üflemeli",
    "inst.synth": "Synth",
    "inst.guitarNeck": "Gitar kolu",
    "inst.guitarNeckSub": "Perdeye basın — teli sağdan çekin",
    "inst.strings": "Teller (titreştir)",
    "inst.stringsSub": "Aynı renk = aynı tel",
    "inst.openString": "açık",
    "inst.violinNeck": "Keman klavyesi",
    "picker.title": "Hangi enstrümanla çalmak istersiniz?",
    "picker.hint":
      "Düşen notalar aynı kalır; alttaki çalma yüzeyi değişir. Üst menüden istediğiniz zaman değiştirin.",
    "modal.newLib": "Yeni kütüphane",
    "modal.renameLib": "Kütüphaneyi yeniden adlandır",
    "modal.libName": "Kütüphane adı",
    "modal.cancel": "İptal",
    "modal.save": "Kaydet",
    "modal.assignKey": "Tuş harfi ata",
    "modal.assignHint": "{name} — tek harf veya boş",
    "modal.oneLetter": "Tek harf",
    "modal.clear": "Temizle",
    "toast.libEmpty": "Kütüphane adı boş olamaz.",
    "toast.libRenamed": "Kütüphane adı güncellendi.",
    "toast.libAdded": "\"{name}\" kütüphanesi eklendi.",
    "toast.saveError": "Kayıt hatası: {msg}",
    "toast.instrument": "Enstrüman: {name}",
    "toast.cloudLibError":
      "Bulut kütüphanesi açılamadı: {msg}. Örnek parça yine de yüklendi.",
    "toast.bootGuest": "Misafir modu: çalabilirsiniz. Bulut kütüphanesi için üye olun.",
    "toast.kbOn": "Klavye ile çalma açık.",
    "toast.kbOff": "Klavye ile çalma kapalı.",
    "toast.kbLayoutAuto": "Klavye düzeni otomatik algılanacak.",
    "toast.kbLayoutPick": "Klavye düzeni: {name}",
    "toast.labelsUpdated": "Tuş harfleri güncellendi.",
    "toast.flameStyle": "Nota stili: {name}",
    "toast.dynamicOn": "Dinamik basınç açık.",
    "toast.dynamicOff": "Sabit ses şiddeti.",
    "toast.sustainMs": "Sustain: {ms} ms",
    "toast.moveHintPiano": "Piyano konumu: Ayarlar → Klavye → konum / hiza.",
    "toast.sound": "Ses: {name}",
    "toast.instrumentRefreshFail": "Enstrüman değişti; bazı ayarlar yenilenemedi: {msg}",
    "toast.audioNoImport": "Ses içe aktarma bu sürümde yok.",
    "toast.convertFail": "Ses dönüştürülemedi: {msg}",
    "toast.octavePianoOnly": "Oktav ayarları yalnızca piyano modunda geçerlidir.",
    "toast.octaveSet": "Klavye: oktav {start}, {count} oktav",
    "toast.fitSong": "Klavye şarkıya göre: {count} oktav (tam genişlik)",
    "toast.songLoaded": "\"{name}\" yüklendi.",
    "toast.songLoadFail": "Şarkı yüklenemedi: {msg}",
    "toast.noNotes": "Bu MIDI dosyasında nota bulunamadı.",
    "toast.songDeleted": "Şarkı silindi.",
    "toast.deleteFail": "Silinemedi: {msg}",
    "toast.trackDone": "Parça bitti! ■ ile yeniden başlayın.",
    "toast.midiCloud": "{n} MIDI buluta kaydedildi.",
    "toast.midiLocal": "{n} MIDI bu tarayıcıya kaydedildi (misafir).",
    "toast.midiFail": "MIDI eklenemedi: {msg}",
    "toast.pickLib": "Önce bir kütüphane seçin veya oluşturun.",
    "toast.trim": "Kırpma: baş {start} sn, son {end} sn",
    "toast.importCancel": "İşlem iptal edildi veya dosya seçilmedi.",
    "toast.audioConverted": "{n} parça MIDI'ye çevrildi ({notes} nota). Şarkıyı seçip oynatın.",
    "toast.autoPlayOn": "Bilgisayar çalıyor — notalar otomatik vuruluyor.",
    "modal.assignClear": "Harf kaldırıldı",
    "modal.assignSet": "Tuş → \"{ch}\"",
    "starter.lib": "Örnek Parçalar (telifsiz)",
    "starter.song": "Bach — Prelude BWV 846",
    "import.memberTitle": "MIDI kaydetmek için üye olun (tek seferlik 1 USD). Hesapsız da çalabilirsiniz.",
    "audioImport.title": "Ses → MIDI dönüştürülüyor",
    "audioImport.preparing": "Hazırlanıyor…",
  };

  const de = {
    ...en,
    "app.tagline": "Klavier · Gitarre · Violine — mit MIDI spielen",
    "intro.tag": "Klavier · Gitarre · Violine — mit MIDI spielen",
    "intro.hint": "Tippen oder Überspringen",
    "intro.skip": "Überspringen",
    "header.score": "Punkte",
    "header.remaining": "Rest:",
    "header.play": "▶ Abspielen (du spielst)",
    "header.autoplay": "🎹 Auto-Spiel",
    "header.stop": "■ Stopp",
    "header.speed": "Tempo",
    "header.menu": "☰ Menü",
    "header.fullscreen": "⛶ Vollbild",
    "sidebar.tab.library": "Bibliothek",
    "sidebar.tab.songs": "Stücke",
    "sidebar.tab.settings": "Einstellungen",
    "libs.title": "Bibliotheken",
    "libs.add": "Hinzufügen",
    "libs.new": "Neuer Bibliotheksname",
    "libs.hint": "Bibliothek wählen oder oben hinzufügen. Dateien werden in Ihrem Wix-Konto gespeichert.",
    "libs.hintGuest": "Gastmodus: MIDI bleibt in diesem Browser. Wix-Mitgliedschaft für Cloud (einmalig 1 USD).",
    "songs.title": "Stücke",
    "songs.hintSelectLib": "Zuerst eine Bibliothek wählen.",
    "songs.hintPlay": "▶ Abspielen — Noten fallen von oben. Tippen oder Tastatur.",
    "settings.title": "Einstellungen",
    "settings.language": "Sprache",
    "settings.move": "↔ Panels verschieben",
    "settings.moveSave": "✓ Position speichern",
    "settings.tab.song": "Spur",
    "settings.tab.keys": "Tastatur",
    "settings.tab.look": "Aussehen",
    "settings.tab.play": "Spiel",
    "settings.track": "MIDI-Spur",
    "settings.trackEmpty": "Zuerst ein Stück wählen",
    "inst.piano": "Klavier",
    "inst.guitar": "Gitarre",
    "inst.violin": "Violine",
    "settings.sustain": "Sustain (Ausklingen)",
    "settings.sustainHint": "0–10.000 ms. 0 = sofortiger Stopp. Steuert Klang und Saiten-Tremolo bei Gitarre/Geige.",
    "inst.guitarNeck": "Gitarrenhals",
    "inst.guitarNeckSub": "Bund drücken — Saite rechts zupfen",
    "inst.strings": "Saiten (zupfen)",
    "inst.stringsSub": "Gleiche Farbe = gleiche Saite",
    "inst.violinNeck": "Geigengriffbrett",
    "inst.openString": "leer",
    "picker.title": "Welches Instrument möchten Sie spielen?",
    "starter.lib": "Beispielstücke (lizenzfrei)",
    "starter.song": "Bach — Präludium BWV 846",
  };

  const fr = {
    ...en,
    "app.tagline": "Piano · Guitare · Violon — jouer avec MIDI",
    "intro.hint": "Appuyez ou Ignorer",
    "intro.skip": "Ignorer",
    "header.score": "Score",
    "header.remaining": "Reste :",
    "header.play": "▶ Jouer (vous jouez)",
    "header.autoplay": "🎹 Lecture auto",
    "header.stop": "■ Stop",
    "header.speed": "Vitesse",
    "header.menu": "☰ Menu",
    "sidebar.tab.library": "Bibliothèque",
    "sidebar.tab.songs": "Morceaux",
    "sidebar.tab.settings": "Réglages",
    "libs.title": "Bibliothèques",
    "libs.add": "Ajouter",
    "libs.new": "Nom de bibliothèque",
    "libs.hint": "Choisissez ou ajoutez une bibliothèque. Fichiers enregistrés sur votre compte Wix.",
    "songs.title": "Morceaux",
    "songs.hintSelectLib": "Choisissez d'abord une bibliothèque.",
    "songs.hintPlay": "▶ Jouer — les notes tombent du haut. Touchez ou clavier.",
    "settings.title": "Paramètres",
    "settings.language": "Langue",
    "settings.move": "↔ Déplacer les panneaux",
    "settings.moveSave": "✓ Enregistrer la position",
    "settings.tab.song": "Piste",
    "settings.tab.keys": "Clavier",
    "settings.tab.look": "Apparence",
    "settings.tab.play": "Jeu",
    "settings.track": "Piste MIDI",
    "settings.trackEmpty": "Choisissez d'abord un morceau",
    "inst.piano": "Piano",
    "inst.guitar": "Guitare",
    "inst.violin": "Violon",
    "settings.sustain": "Sustain (relâchement)",
    "settings.sustainHint": "0–10 000 ms. 0 = coupure instantanée. Contrôle le son et la vibration des cordes (guitare/violon).",
    "inst.guitarNeck": "Manche de guitare",
    "inst.guitarNeckSub": "Appuyez sur une case — pincez la corde à droite",
    "inst.strings": "Cordes (pincer)",
    "inst.stringsSub": "Même couleur = même corde",
    "inst.violinNeck": "Touche de violon",
    "inst.openString": "à vide",
    "picker.title": "Quel instrument voulez-vous jouer ?",
    "starter.lib": "Exemples (libres de droits)",
    "starter.song": "Bach — Prélude BWV 846",
  };

  const it = {
    ...en,
    "app.tagline": "Piano · Chitarra · Violino — suona con MIDI",
    "intro.hint": "Tocca o Salta",
    "intro.skip": "Salta",
    "header.score": "Punteggio",
    "header.remaining": "Rimasto:",
    "header.play": "▶ Riproduci (suoni tu)",
    "header.autoplay": "🎹 Auto play",
    "header.stop": "■ Stop",
    "header.speed": "Velocità",
    "sidebar.tab.library": "Libreria",
    "sidebar.tab.songs": "Brani",
    "sidebar.tab.settings": "Impostazioni",
    "libs.title": "Librerie",
    "libs.add": "Aggiungi",
    "songs.title": "Brani",
    "songs.hintSelectLib": "Seleziona prima una libreria.",
    "settings.title": "Impostazioni",
    "settings.language": "Lingua",
    "settings.move": "↔ Sposta pannelli",
    "settings.tab.song": "Traccia",
    "settings.tab.keys": "Tastiera",
    "settings.tab.look": "Aspetto",
    "settings.tab.play": "Gioco",
    "inst.piano": "Piano",
    "inst.guitar": "Chitarra",
    "inst.violin": "Violino",
    "settings.sustain": "Sustain (rilascio)",
    "settings.sustainHint": "0–10.000 ms. 0 = taglio immediato. Controlla suono e vibrazione corde (chitarra/violino).",
    "inst.guitarNeck": "Manico chitarra",
    "inst.guitarNeckSub": "Premi un tasto — pizzica la corda a destra",
    "inst.strings": "Corde (pizzica)",
    "inst.stringsSub": "Stesso colore = stessa corda",
    "inst.violinNeck": "Tastiera violino",
    "inst.openString": "aperto",
    "picker.title": "Quale strumento vuoi suonare?",
    "starter.lib": "Brani di esempio (royalty-free)",
  };

  const es = {
    ...en,
    "app.tagline": "Piano · Guitarra · Violín — toca con MIDI",
    "intro.hint": "Toca o Omitir",
    "intro.skip": "Omitir",
    "header.score": "Puntuación",
    "header.remaining": "Queda:",
    "header.play": "▶ Tocar (tú tocas)",
    "header.autoplay": "🎹 Auto",
    "sidebar.tab.library": "Biblioteca",
    "sidebar.tab.songs": "Canciones",
    "sidebar.tab.settings": "Ajustes",
    "libs.title": "Bibliotecas",
    "libs.add": "Añadir",
    "songs.title": "Canciones",
    "songs.hintSelectLib": "Primero elige una biblioteca.",
    "settings.title": "Ajustes",
    "settings.language": "Idioma",
    "settings.move": "↔ Mover paneles",
    "settings.tab.song": "Pista",
    "settings.tab.keys": "Teclado",
    "settings.tab.look": "Aspecto",
    "settings.tab.play": "Juego",
    "inst.piano": "Piano",
    "inst.guitar": "Guitarra",
    "inst.violin": "Violín",
    "settings.sustain": "Sustain (soltar)",
    "settings.sustainHint": "0–10.000 ms. 0 = corte instantáneo. Controla el sonido y la vibración de cuerdas (guitarra/violín).",
    "inst.guitarNeck": "Mástil de guitarra",
    "inst.guitarNeckSub": "Pulsa un traste — pellizca la cuerda a la derecha",
    "inst.strings": "Cuerdas (pellizcar)",
    "inst.stringsSub": "Mismo color = misma cuerda",
    "inst.violinNeck": "Diapasón de violín",
    "inst.openString": "al aire",
    "picker.title": "¿Qué instrumento quieres tocar?",
    "starter.lib": "Ejemplos (libres de derechos)",
  };

  const pt = {
    ...en,
    "app.tagline": "Piano · Guitarra · Violino — toque com MIDI",
    "intro.skip": "Pular",
    "sidebar.tab.library": "Biblioteca",
    "sidebar.tab.songs": "Músicas",
    "sidebar.tab.settings": "Ajustes",
    "libs.title": "Bibliotecas",
    "songs.title": "Músicas",
    "settings.language": "Idioma",
    "inst.piano": "Piano",
    "inst.guitar": "Guitarra",
    "inst.violin": "Violino",
    "settings.sustain": "Sustain (soltura)",
    "settings.sustainHint": "0–10.000 ms. 0 = corte imediato. Controla som e vibração das cordas (guitarra/violino).",
    "inst.guitarNeck": "Braço da guitarra",
    "inst.guitarNeckSub": "Pressione uma casa — dedilhe a corda à direita",
    "inst.strings": "Cordas (dedilhar)",
    "inst.stringsSub": "Mesma cor = mesma corda",
    "inst.violinNeck": "Escala do violino",
    "inst.openString": "solta",
    "starter.lib": "Exemplos (livres de royalties)",
  };

  const nl = {
    ...en,
    "app.tagline": "Piano · Gitaar · Viool — speel met MIDI",
    "intro.skip": "Overslaan",
    "sidebar.tab.library": "Bibliotheek",
    "sidebar.tab.songs": "Nummers",
    "sidebar.tab.settings": "Instellingen",
    "libs.title": "Bibliotheken",
    "settings.language": "Taal",
    "inst.piano": "Piano",
    "inst.guitar": "Gitaar",
    "inst.violin": "Viool",
    "settings.sustain": "Sustain (loslaten)",
    "settings.sustainHint": "0–10.000 ms. 0 = direct stop. Regelt geluid en snaartrilling (gitaar/viool).",
    "inst.guitarNeck": "Gitaarhals",
    "inst.guitarNeckSub": "Druk een fret — tokkel de snaar rechts",
    "inst.strings": "Snaren (tokkelen)",
    "inst.stringsSub": "Zelfde kleur = zelfde snaar",
    "inst.violinNeck": "Vioolvingerboard",
    "inst.openString": "open",
    "starter.lib": "Voorbeelden (royalty-vrij)",
  };

  const pl = {
    ...en,
    "app.tagline": "Fortepian · Gitara · Skrzypce — graj z MIDI",
    "intro.skip": "Pomiń",
    "sidebar.tab.library": "Biblioteka",
    "sidebar.tab.songs": "Utwory",
    "sidebar.tab.settings": "Ustawienia",
    "libs.title": "Biblioteki",
    "settings.language": "Język",
    "inst.piano": "Fortepian",
    "inst.guitar": "Gitara",
    "inst.violin": "Skrzypce",
    "settings.sustain": "Sustain (wybrzmienie)",
    "settings.sustainHint": "0–10 000 ms. 0 = natychmiastowe wyciszenie. Steruje dźwiękiem i wibracją strun (gitara/skrzypce).",
    "inst.guitarNeck": "Gryf gitary",
    "inst.guitarNeckSub": "Naciśnij próg — szarpnij strunę po prawej",
    "inst.strings": "Struny (szarpnięcie)",
    "inst.stringsSub": "Ten sam kolor = ta sama struna",
    "inst.violinNeck": "Podstrunnica skrzypiec",
    "inst.openString": "pusta",
    "starter.lib": "Przykłady (bez tantiem)",
  };

  const ru = {
    ...en,
    "app.tagline": "Пианино · Гитара · Скрипка — играйте с MIDI",
    "intro.skip": "Пропустить",
    "sidebar.tab.library": "Библиотека",
    "sidebar.tab.songs": "Треки",
    "sidebar.tab.settings": "Настройки",
    "libs.title": "Библиотеки",
    "settings.language": "Язык",
    "inst.piano": "Пианино",
    "inst.guitar": "Гитара",
    "inst.violin": "Скрипка",
    "settings.sustain": "Сустейн (затухание)",
    "settings.sustainHint": "0–10 000 мс. 0 = мгновенная остановка. Управляет звуком и вибрацией струн (гитара/скрипка).",
    "inst.guitarNeck": "Гриф гитары",
    "inst.guitarNeckSub": "Нажмите лад — щипните струну справа",
    "inst.strings": "Струны (щипок)",
    "inst.stringsSub": "Один цвет = одна струна",
    "inst.violinNeck": "Гриф скрипки",
    "inst.openString": "открытая",
    "starter.lib": "Примеры (без лицензии)",
  };

  const ja = {
    ...en,
    "app.tagline": "ピアノ · ギター · バイオリン — MIDIで演奏",
    "intro.skip": "スキップ",
    "sidebar.tab.library": "ライブラリ",
    "sidebar.tab.songs": "曲",
    "sidebar.tab.settings": "設定",
    "libs.title": "ライブラリ",
    "settings.language": "言語",
    "inst.piano": "ピアノ",
    "inst.guitar": "ギター",
    "inst.violin": "バイオリン",
    "settings.sustain": "サステイン（余韻）",
    "settings.sustainHint": "0〜10,000 ms。0で即停止。ギター/バイオリンの音と弦の振動の減衰を調整。",
    "inst.guitarNeck": "ギターネック",
    "inst.guitarNeckSub": "フレットを押す — 右の弦を弾く",
    "inst.strings": "弦（弾く）",
    "inst.stringsSub": "同じ色 = 同じ弦",
    "inst.violinNeck": "バイオリン指板",
    "inst.openString": "開放",
    "starter.lib": "サンプル（ロイヤリティフリー）",
  };

  const ko = {
    ...en,
    "app.tagline": "피아노 · 기타 · 바이올린 — MIDI로 연주",
    "intro.skip": "건너뛰기",
    "sidebar.tab.library": "라이브러리",
    "sidebar.tab.songs": "곡",
    "sidebar.tab.settings": "설정",
    "libs.title": "라이브러리",
    "settings.language": "언어",
    "inst.piano": "피아노",
    "inst.guitar": "기타",
    "inst.violin": "바이올린",
    "settings.sustain": "서스테인 (잔향)",
    "settings.sustainHint": "0–10,000 ms. 0 = 즉시 정지. 기타/바이올린 소리와 줄 진동 감쇠를 조절합니다.",
    "inst.guitarNeck": "기타 넥",
    "inst.guitarNeckSub": "프렛을 누르고 — 오른쪽 줄을 뜯으세요",
    "inst.strings": "줄 (뜯기)",
    "inst.stringsSub": "같은 색 = 같은 줄",
    "inst.violinNeck": "바이올린 지판",
    "inst.openString": "개방",
    "starter.lib": "샘플 (로열티 프리)",
  };

  const zh = {
    ...en,
    "app.tagline": "钢琴 · 吉他 · 小提琴 — MIDI 演奏",
    "intro.skip": "跳过",
    "sidebar.tab.library": "曲库",
    "sidebar.tab.songs": "曲目",
    "sidebar.tab.settings": "设置",
    "libs.title": "曲库",
    "settings.language": "语言",
    "inst.piano": "钢琴",
    "inst.guitar": "吉他",
    "inst.violin": "小提琴",
    "settings.sustain": "延音（释放）",
    "settings.sustainHint": "0–10,000 毫秒。0 = 立即停止。控制吉他/小提琴的声音与弦振动衰减。",
    "inst.guitarNeck": "吉他琴颈",
    "inst.guitarNeckSub": "按品位 — 在右侧拨弦",
    "inst.strings": "弦（拨弦）",
    "inst.stringsSub": "同色 = 同弦",
    "inst.violinNeck": "小提琴指板",
    "inst.openString": "空弦",
    "starter.lib": "示例曲目（免版税）",
  };

  const PACKS = { en, tr, de, fr, it, es, pt, nl, pl, ru, ja, ko, zh };
  let locale = FALLBACK;
  let preference = "auto";

  function readPref() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return "auto";
      const s = JSON.parse(raw);
      return s.locale || "auto";
    } catch {
      return "auto";
    }
  }

  function detectLocale() {
    const list = navigator.languages?.length
      ? [...navigator.languages]
      : [navigator.language || FALLBACK];
    for (const raw of list) {
      const tag = String(raw).toLowerCase().replace("_", "-");
      const base = tag.split("-")[0];
      if (PACKS[tag]) return tag;
      if (PACKS[base]) return base;
    }
    return FALLBACK;
  }

  function resolveLocale(pref) {
    if (!pref || pref === "auto") return detectLocale();
    return PACKS[pref] ? pref : FALLBACK;
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""
    );
  }

  function t(key, vars) {
    const pack = PACKS[locale] || PACKS[FALLBACK];
    const base = PACKS[FALLBACK];
    const raw = pack[key] ?? base[key] ?? key;
    return interpolate(raw, vars);
  }

  function applyDOM(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.placeholder = t(key);
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.title = t(key);
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key) el.setAttribute("aria-label", t(key));
    });
    root.querySelectorAll("option[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (key) el.innerHTML = t(key);
    });
    document.documentElement.lang = locale;
  }

  function init() {
    preference = readPref();
    locale = resolveLocale(preference);
    window.__appName = APP_NAME;
    return locale;
  }

  function setPreference(pref) {
    preference = pref || "auto";
    locale = resolveLocale(preference);
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const s = raw ? JSON.parse(raw) : {};
      s.locale = preference;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* */
    }
    applyDOM();
    window.dispatchEvent(
      new CustomEvent("staveflow:locale", { detail: { locale, preference } })
    );
    return locale;
  }

  function getLocale() {
    return locale;
  }

  function getPreference() {
    return preference;
  }

  function getLocales() {
    return LOCALES.map((item) => ({
      ...item,
      label: item.id === "auto" ? item.label : item.label,
    }));
  }

  function formatMemberBanner(email) {
    const emailPart = email ? `: ${email}` : "";
    return t("auth.member", { email: emailPart });
  }

  return {
    APP_NAME,
    init,
    t,
    applyDOM,
    setPreference,
    getLocale,
    getPreference,
    getLocales,
    formatMemberBanner,
    detectLocale,
  };
})();

window.I18n = I18n;


/* === settings.js === */
const AppSettings = (() => {
  const KEY = "touch-piano-settings";
  const defaults = {
    octaveStart: 3,
    octaveCount: 2,
    keyWidth: 48,
    keyHeight: 160,
    dynamicPressure: true,
    sustainMs: 550,
    timingWindow: 200,
    speed: 100,
    labelMode: "note",
    labelPreset: "game",
    customLabels: "Z,X,C,V,B,N,M,A,S,D,F,G,H,J",
    flameIntensity: 1,
    flameStyle: "aurora",
    trimStart: 0,
    trimEnd: 0,
    midiLabels: {},
    keyboardEnabled: true,
    keyboardLayout: "auto",
    keyboardLayoutDetected: "",
    keyboardLearned: {},
    sidebarVisible: true,
    autoKeyboardFromSong: true,
    octaveLockManual: false,
    effectHue: 275,
    keyColorTop: "#e8d4ff",
    keyColorMid: "#a855f7",
    keyColorBottom: "#6b21a8",
    hitLineColor: "#d8b4fe",
    pianoDock: "bottom",
    pianoAlign: "stretch",
    instrumentId: "piano",
    playMode: "piano",
    themesByMode: {},
    instrumentPromptDone: false,
    panelLayout: {},
    stringVibratoSens: 1,
    /** Gitar: sol kolde bir perde → tüm teller sıkılır */
    guitarGripAllStrings: false,
    violinGripAllStrings: false,
    guitarNeckNearbyTouch: true,
    violinNeckNearbyTouch: true,
    guitarStringsNearbyTouch: false,
    violinStringsNearbyTouch: false,
    guitarNeckHeight: 30,
    guitarStringHeight: 30,
    guitarNeckWidth: 42,
    guitarPluckWidth: 220,
    /** "auto" veya en, tr, de, fr, it, … */
    locale: "auto",
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      const data = { ...defaults, ...JSON.parse(raw) };
      if (data.sustainMs == null || !Number.isFinite(data.sustainMs)) {
        data.sustainMs = data.sustainEnabled === false ? 0 : 550;
      }
      data.sustainMs = Math.max(0, Math.min(10000, Math.round(data.sustainMs)));
      return data;
    } catch {
      return { ...defaults };
    }
  }

  function save(partial) {
    const next = { ...load(), ...partial };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  return { load, save, defaults };
})();

window.AppSettings = AppSettings;


/* === theme.js === */
/** Tema — enstrümana göre ayrı renk paletleri */
const AppTheme = (() => {
  const PRESETS = {
    piano: {
      effectHue: 275,
      keyColorTop: "#e8d4ff",
      keyColorMid: "#a855f7",
      keyColorBottom: "#6b21a8",
      hitLineColor: "#d8b4fe",
      surfaceAccent: "#6c9eff",
    },
    guitar: {
      effectHue: 38,
      keyColorTop: "#f5e6c8",
      keyColorMid: "#c9a227",
      keyColorBottom: "#5c4a1e",
      hitLineColor: "#e8c468",
      surfaceAccent: "#d4a017",
    },
    violin: {
      effectHue: 350,
      keyColorTop: "#ffe4ec",
      keyColorMid: "#e11d48",
      keyColorBottom: "#881337",
      hitLineColor: "#fda4af",
      surfaceAccent: "#fb7185",
    },
  };

  function apply(partial) {
    const s = { ...PRESETS.piano, ...partial };
    const r = document.documentElement;
    r.style.setProperty("--effect-hue", String(s.effectHue));
    r.style.setProperty("--key-active-top", s.keyColorTop);
    r.style.setProperty("--key-active-mid", s.keyColorMid);
    r.style.setProperty("--key-active-bottom", s.keyColorBottom);
    r.style.setProperty("--hit-line-color", s.hitLineColor);
    if (s.surfaceAccent) r.style.setProperty("--accent", s.surfaceAccent);
    window.__effectHue = s.effectHue;
    return s;
  }

  function getPreset(mode) {
    return { ...(PRESETS[mode] || PRESETS.piano) };
  }

  function fromSettings(s, playMode) {
    const mode = playMode || s.playMode || "piano";
    const saved = s.themesByMode?.[mode];
    return apply({ ...getPreset(mode), ...saved });
  }

  function readFromInputs(inputs, mode) {
    const base = getPreset(mode);
    return {
      ...base,
      effectHue: Number(inputs.effectHue?.value) || base.effectHue,
      keyColorTop: inputs.keyColorTop?.value || base.keyColorTop,
      keyColorMid: inputs.keyColorMid?.value || base.keyColorMid,
      keyColorBottom: inputs.keyColorBottom?.value || base.keyColorBottom,
      hitLineColor: inputs.hitLineColor?.value || base.hitLineColor,
    };
  }

  function fillInputs(inputs, theme) {
    if (inputs.effectHue) inputs.effectHue.value = String(theme.effectHue);
    if (inputs.keyColorTop) inputs.keyColorTop.value = theme.keyColorTop;
    if (inputs.keyColorMid) inputs.keyColorMid.value = theme.keyColorMid;
    if (inputs.keyColorBottom) inputs.keyColorBottom.value = theme.keyColorBottom;
    if (inputs.hitLineColor) inputs.hitLineColor.value = theme.hitLineColor;
  }

  function saveForMode(mode, theme, settings) {
    const themesByMode = { ...(settings.themesByMode || {}) };
    themesByMode[mode] = { ...themesByMode[mode], ...theme };
    return themesByMode;
  }

  return {
    apply,
    fromSettings,
    getPreset,
    readFromInputs,
    fillInputs,
    saveForMode,
    PRESETS,
  };
})();

window.AppTheme = AppTheme;


/* === audio.js === */
/** Sentez enstrüman sesleri — Web Audio (çoklu ses / tel) */
const AudioEngine = (() => {
  let ctx = null;
  /** id → { midi, voice } */
  const voices = new Map();
  let nextVoiceId = 1;

  let dynamicPressure = true;
  const SUSTAIN_MS_MAX = 10000;
  let sustainMs = 550;
  let instrumentId = "piano";

  const INSTRUMENTS = {
    piano: { label: "Piyano", sustainScale: 1 },
    violin: { label: "Keman", sustainScale: 1.15 },
    guitar: { label: "Gitar", sustainScale: 1 },
    flute: { label: "Flüt", sustainScale: 0.85 },
    brass: { label: "Bakır üflemeli", sustainScale: 0.9 },
    synth: { label: "Synth", sustainScale: 0.75 },
  };

  function ensure() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function setDynamicPressure(on) {
    dynamicPressure = !!on;
  }

  function setSustainMs(ms) {
    sustainMs = Math.max(0, Math.min(SUSTAIN_MS_MAX, Math.round(Number(ms) || 0)));
  }

  function getSustainMs() {
    return sustainMs;
  }

  function setInstrument(id) {
    if (INSTRUMENTS[id]) instrumentId = id;
  }

  function getInstruments() {
    return Object.entries(INSTRUMENTS).map(([id, meta]) => ({
      id,
      label: meta.label,
    }));
  }

  function velocityFromPointer(e, fallback = 0.75) {
    if (!dynamicPressure) return fallback;
    let v = fallback;
    if (e.pressure > 0) {
      v = 0.25 + Math.min(1, e.pressure) * 0.75;
    } else if (e.width && e.height) {
      const area = Math.min(1, (e.width * e.height) / 1200);
      v = 0.3 + area * 0.7;
    }
    return Math.max(0.15, Math.min(1, v));
  }

  /**
   * İnsan kulağı düşük frekansları daha zayıf algılar;
   * özellikle kalın teller/sol tuşlar için hafif telafi uygular.
   */
  function loudnessCompensation(freq) {
    if (!Number.isFinite(freq) || freq <= 0) return 1;
    if (freq >= 440) return 1;
    if (freq <= 80) return 1.65;
    if (freq <= 160) return 1.48;
    if (freq <= 240) return 1.32;
    if (freq <= 320) return 1.18;
    return 1.08;
  }

  function voiceConfig(id) {
    switch (id) {
      case "violin":
        return {
          oscs: [{ type: "sawtooth", gain: 0.42 }, { type: "sine", ratio: 2, gain: 0.12 }],
          peak: 0.42,
          attack: 0.07,
          sustain: 0.34,
          decay1: 0.45,
          decay2: 2.6,
          tail: 0.06,
          filterType: "lowpass",
          filterStart: 2400,
          filterEnd: 900,
          filterVel: 1400,
          filterQ: 1.8,
          vibratoHz: 5.5,
          vibratoDepth: 0.007,
        };
      case "guitar":
        return {
          oscs: [{ type: "triangle", gain: 0.55 }, { type: "sine", ratio: 2, gain: 0.08 }],
          peak: 0.48,
          attack: 0.004,
          sustain: 0.2,
          decay1: 0.18,
          decay2: 1.35,
          tail: 0.08,
          filterType: "bandpass",
          filterStart: 1800,
          filterEnd: 600,
          filterVel: 800,
          filterQ: 1.2,
          vibratoHz: 5.5,
          vibratoDepth: 0.004,
        };
      case "flute":
        return {
          oscs: [{ type: "sine", gain: 0.5 }, { type: "triangle", ratio: 2, gain: 0.08 }],
          peak: 0.38,
          attack: 0.05,
          sustain: 0.28,
          decay1: 0.35,
          decay2: 1.8,
          tail: 0.05,
          filterType: "lowpass",
          filterStart: 3600,
          filterEnd: 1200,
          filterVel: 900,
          filterQ: 0.5,
          vibratoHz: 4.2,
          vibratoDepth: 0.004,
        };
      case "brass":
        return {
          oscs: [{ type: "square", gain: 0.22 }, { type: "sawtooth", gain: 0.28 }],
          peak: 0.44,
          attack: 0.03,
          sustain: 0.3,
          decay1: 0.4,
          decay2: 1.6,
          tail: 0.05,
          filterType: "lowpass",
          filterStart: 2200,
          filterEnd: 700,
          filterVel: 1100,
          filterQ: 1.4,
        };
      case "synth":
        return {
          oscs: [{ type: "sawtooth", gain: 0.32 }, { type: "square", ratio: 0.5, gain: 0.12 }],
          peak: 0.4,
          attack: 0.01,
          sustain: 0.22,
          decay1: 0.25,
          decay2: 1.2,
          tail: 0.04,
          filterType: "lowpass",
          filterStart: 4200,
          filterEnd: 800,
          filterVel: 2000,
          filterQ: 2.2,
        };
      default:
        return {
          oscs: [
            { type: "triangle", gain: 0.5 },
            { type: "sine", ratio: 2.01, gain: 0.22 },
            { type: "sine", ratio: 0.5, gain: 0.1 },
          ],
          peak: 0.38,
          attack: 0.012,
          sustain: 0.5,
          decay1: 0.35,
          decay2: 2.8,
          tail: 0.08,
          filterType: "lowpass",
          filterStart: 3200,
          filterEnd: 900,
          filterVel: 1800,
          filterQ: 0.7,
        };
    }
  }

  function buildVoice(ac, freq, vol, velocity, cfg) {
    const t = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * cfg.peak), t + cfg.attack);
    master.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, vol * cfg.sustain),
      t + cfg.decay1
    );
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * cfg.tail), t + cfg.decay2);

    const filter = ac.createBiquadFilter();
    filter.type = cfg.filterType || "lowpass";
    filter.frequency.setValueAtTime(cfg.filterStart + velocity * cfg.filterVel, t);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(200, cfg.filterEnd + velocity * cfg.filterVel * 0.25),
      t + cfg.decay2
    );
    filter.Q.value = cfg.filterQ ?? 0.7;
    filter.connect(master);
    master.connect(ac.destination);

    const oscNodes = [];
    for (const spec of cfg.oscs) {
      const osc = ac.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = freq * (spec.ratio || 1);
      const g = ac.createGain();
      g.gain.value = spec.gain;
      osc.connect(g);
      g.connect(filter);
      osc.start(t);
      oscNodes.push(osc);
    }

    let lfo = null;
    let lfoGain = null;
    const vibHz = cfg.vibratoHz ?? 0;
    const vibDepth = cfg.vibratoDepth ?? 0;
    if (vibHz > 0 && oscNodes[0]) {
      lfo = ac.createOscillator();
      lfoGain = ac.createGain();
      lfo.frequency.value = vibHz;
      lfoGain.gain.value = freq * vibDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(oscNodes[0].frequency);
      lfo.start(t);
      oscNodes.push(lfo);
    }

    return {
      oscs: oscNodes,
      master,
      filter,
      lfo,
      lfoGain,
      baseFreq: freq,
      maxVibratoDepth: freq * Math.max(vibDepth, 0.018),
      sustainGain: Math.max(0.0002, vol * cfg.sustain),
      started: t,
      peak: vol,
    };
  }

  function releaseVoiceEntry(entry, silent, releaseOverride) {
    const voice = entry.voice;
    const ac = ensure();
    const t = ac.currentTime;
    const scale = INSTRUMENTS[instrumentId]?.sustainScale ?? 1;
    const base = silent ? 0.001 : Math.max(0.001, (sustainMs / 1000) * scale);
    const release =
      releaseOverride != null ? releaseOverride : Math.min(SUSTAIN_MS_MAX / 1000 + 0.5, base);

    try {
      voice.master.gain.cancelScheduledValues(t);
      const now = Math.max(0.0001, voice.master.gain.value);
      voice.master.gain.setValueAtTime(now, t);
      voice.master.gain.exponentialRampToValueAtTime(0.0001, t + release);
      const stopAt = t + release + 0.08;
      for (const osc of voice.oscs) {
        try {
          osc.stop(stopAt);
        } catch {
          /* */
        }
      }
    } catch {
      for (const osc of voice.oscs) {
        try {
          osc.stop();
        } catch {
          /* */
        }
      }
    }
  }

  function noteOffVoice(voiceId, silent = false, releaseOverride = null) {
    const entry = voices.get(voiceId);
    if (!entry) return;
    voices.delete(voiceId);
    releaseVoiceEntry(entry, silent, releaseOverride);
  }

  function noteOffMidi(midi, silent = false, releaseOverride = null) {
    for (const [id, entry] of [...voices.entries()]) {
      if (entry.midi === midi) noteOffVoice(id, silent, releaseOverride);
    }
  }

  /** @returns {number} voiceId */
  function noteOn(midi, velocity = 0.75, opts = {}) {
    const ac = ensure();
    if (!opts.poly) noteOffMidi(midi, true);

    const freq = midiToFreq(midi);
    const vol = Math.min(0.92, velocity * 0.38 * loudnessCompensation(freq));
    const cfg = voiceConfig(instrumentId);
    const voice = buildVoice(ac, freq, vol, velocity, cfg);
    const id = nextVoiceId++;
    voices.set(id, { midi, voice });
    return id;
  }

  function noteOff(midi, silent = false, releaseOverride = null) {
    noteOffMidi(midi, silent, releaseOverride);
  }

  function noteOffPluck(voiceId) {
    const scale = INSTRUMENTS[instrumentId]?.sustainScale ?? 1;
    const rel =
      sustainMs <= 0
        ? 0.001
        : Math.min(SUSTAIN_MS_MAX / 1000 + 0.5, Math.max(0.001, (sustainMs / 1000) * scale));
    noteOffVoice(voiceId, false, rel);
  }

  function play(midi, velocity = 0.75, duration = 0.35) {
    const id = noteOn(midi, velocity);
    const ms = Math.max(80, duration * 1000);
    setTimeout(() => noteOffVoice(id), ms);
  }

  function entryForVoiceId(voiceId) {
    return voices.get(voiceId);
  }

  function setLiveVibrato(voiceIdOrMidi, depthMultiplier = 0, hz = null) {
    let entry = entryForVoiceId(voiceIdOrMidi);
    if (!entry) {
      for (const [, e] of voices) {
        if (e.midi === voiceIdOrMidi) {
          entry = e;
          break;
        }
      }
    }
    if (!entry?.voice?.lfoGain) return;
    const ac = ensure();
    const t = ac.currentTime;
    const depth = Math.max(0, depthMultiplier) * (entry.voice.maxVibratoDepth || 0);
    entry.voice.lfoGain.gain.setTargetAtTime(depth, t, 0.025);
    if (hz != null && entry.voice.lfo) {
      entry.voice.lfo.frequency.setTargetAtTime(hz, t, 0.025);
    }
  }

  function setLiveGain(voiceId, multiplier = 1) {
    const entry = entryForVoiceId(voiceId);
    if (!entry?.voice?.master) return;
    const ac = ensure();
    const t = ac.currentTime;
    const m = Math.max(0.12, Math.min(2, multiplier));
    const target = Math.max(0.0003, (entry.voice.sustainGain || 0.08) * m);
    entry.voice.master.gain.cancelScheduledValues(t);
    entry.voice.master.gain.setTargetAtTime(target, t, 0.028);
  }

  function stopAll() {
    for (const id of [...voices.keys()]) noteOffVoice(id, true);
  }

  return {
    ensure,
    noteOn,
    noteOff,
    noteOffVoice,
    noteOffPluck,
    play,
    stopAll,
    setLiveVibrato,
    setLiveGain,
    setDynamicPressure,
    setSustainMs,
    getSustainMs,
    setInstrument,
    getInstruments,
    velocityFromPointer,
    midiToFreq,
  };
})();

window.AudioEngine = AudioEngine;


/* === key-labels.js === */
/** Tuş etiketleri — nota, harf, özel veya tuş başına (sağ tık) */
const KeyLabels = (() => {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  const PRESET_GAME = "ZXCVBNMASDFGHJ".split("");
  const PRESET_PIANO = "AWSEDRTYUIOPGHJKL".split("");

  let mode = "note";
  let customString = "ZXCVBNMASDFGHJ";
  let letterPreset = "game";
  /** midi → tek harf (beyaz/siyah) */
  const midiLabels = new Map();

  function setMode(m) {
    mode = m || "note";
  }

  function setCustomString(s) {
    customString = String(s || "");
  }

  function setLetterPreset(p) {
    letterPreset = p || "game";
  }

  function getPresetLetters() {
    if (letterPreset === "piano") return PRESET_PIANO;
    return PRESET_GAME;
  }

  function parseCustomList(str) {
    return String(str)
      .split(/[,;\s]+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }

  function setMidiLabel(midi, letter) {
    const m = Number(midi);
    const ch = String(letter || "").trim();
    if (!ch) {
      midiLabels.delete(m);
      return;
    }
    midiLabels.set(m, ch.length === 1 ? ch : ch[0]);
  }

  function getMidiLabel(midi) {
    return midiLabels.get(Number(midi)) || "";
  }

  function getMidiLabelsObject() {
    const o = {};
    midiLabels.forEach((v, k) => {
      o[k] = v;
    });
    return o;
  }

  function loadMidiLabelsObject(obj) {
    midiLabels.clear();
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (v) midiLabels.set(Number(k), String(v).slice(0, 1));
    }
  }

  function noteNameForMidi(midi) {
    const oct = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[midi % 12]}${oct}`;
  }

  function labelForMidi(midi, startMidi, endMidi) {
    if (midiLabels.has(midi)) {
      return midiLabels.get(midi);
    }

    if (mode === "note") {
      return NOTE_NAMES[midi % 12];
    }

    const pc = midi % 12;
    const isWhite = WHITE_PC.includes(pc);

    if (mode === "letters") {
      if (!isWhite) return "·";
      let whiteIndex = 0;
      for (let m = startMidi; m <= endMidi; m++) {
        if (!WHITE_PC.includes(m % 12)) continue;
        if (m === midi) {
          const letters = getPresetLetters();
          return letters[whiteIndex % letters.length] || "?";
        }
        whiteIndex++;
      }
      return "";
    }

    if (mode === "custom") {
      const chars = parseCustomList(customString);
      if (!isWhite) return chars.length > 20 ? "·" : "";
      let wi = 0;
      for (let m = startMidi; m <= endMidi; m++) {
        if (!WHITE_PC.includes(m % 12)) continue;
        if (m === midi) return chars[wi]?.toUpperCase() || "?";
        wi++;
      }
    }

    return NOTE_NAMES[midi % 12];
  }

  function applyToKeys(keyMap, range) {
    const { startMidi, endMidi } = range;
    keyMap.forEach((el, midi) => {
      const label = el.querySelector(".key-label");
      if (!label) return;
      const text = labelForMidi(midi, startMidi, endMidi);
      label.textContent = text;
      const mapped = midiLabels.has(midi);
      label.classList.toggle("letter-mode", mode !== "note" || mapped);
      el.title = mapped
        ? `${noteNameForMidi(midi)} → "${text}" (sağ tık: değiştir)`
        : `${noteNameForMidi(midi)} — sağ tık ile harf ata`;
    });
  }

  return {
    setMode,
    setCustomString,
    setLetterPreset,
    setMidiLabel,
    getMidiLabel,
    getMidiLabelsObject,
    loadMidiLabelsObject,
    noteNameForMidi,
    labelForMidi,
    applyToKeys,
    getMode: () => mode,
    getCustomString: () => customString,
    hasMidiLabels: () => midiLabels.size > 0,
  };
})();

window.KeyLabels = KeyLabels;


/* === flame-styles.js === */
/** Alev / nota çizim stilleri */
const FlameStyles = (() => {
  const PITCH_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  let current = "aurora";

  function hueToRgb(h, a = 1) {
    const s = h / 360;
    const c = 0.9;
    const x = c * (1 - Math.abs(((s * 6) % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (s < 1 / 6) [r, g, b] = [c, x, 0];
    else if (s < 2 / 6) [r, g, b] = [x, c, 0];
    else if (s < 3 / 6) [r, g, b] = [0, c, x];
    else if (s < 4 / 6) [r, g, b] = [0, x, c];
    else if (s < 5 / 6) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return `${Math.round((r + 0.1) * 255)},${Math.round((g + 0.1) * 255)},${Math.round((b + 0.1) * 255)}`;
  }

  function pitchColor(midi, noteH, velocity, alpha = 1) {
    const hue = PITCH_HUES[midi % 12];
    const isSmall = noteH < 22;
    const sat = isSmall ? 95 : 75;
    const light = isSmall ? 72 : 52 + (velocity || 0.7) * 15;
    return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
  }

  const styles = {
    aurora: {
      name: "Aurora (mor)",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        const hu = (275 + (midi % 12) * 4) % 360;
        const r = Math.min(w * 0.48, 12);
        ctx.save();
        ctx.shadowColor = `hsla(${hu}, 100%, 65%, 0.85)`;
        ctx.shadowBlur = 14 * intensity;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, `hsla(${hu}, 75%, 75%, 0.95)`);
        g.addColorStop(1, `hsla(${hu}, 100%, 48%, 1)`);
        ctx.fillStyle = g;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
      },
      particle(p) {
        p.rgb = "200,120,255";
        p.star = true;
      },
    },

    fire: {
      name: "Alev",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, "rgba(180,255,200,0.4)");
          g.addColorStop(1, "rgba(34,160,80,1)");
          ctx.fillStyle = g;
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(180,50,50,0.55)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          const top = pitchColor(midi, h, vel, 0.85);
          g.addColorStop(0, top);
          g.addColorStop(0.4, `hsla(${(PITCH_HUES[midi % 12] + 40) % 360}, 90%, 65%, 0.9)`);
          g.addColorStop(0.75, "rgba(255,100,30,0.95)");
          g.addColorStop(1, "rgba(255,40,0,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(255,100,40,0.8)";
          ctx.shadowBlur = 14 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p, hot) {
        p.rgb = hot
          ? ["255,245,160", "255,120,32", "255,34,0"][Math.floor(Math.random() * 3)]
          : hueToRgb(PITCH_HUES[(p.midi || 0) % 12], 0.85);
      },
    },

    ice: {
      name: "Buz",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "rgba(120,255,200,0.9)";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(100,80,120,0.5)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, pitchColor(midi, h, vel, 0.9));
          g.addColorStop(0.5, "rgba(150,230,255,0.95)");
          g.addColorStop(1, "rgba(40,120,255,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(100,200,255,0.7)";
          ctx.shadowBlur = 12 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = p.hot ? "170,240,255" : hueToRgb(200);
      },
    },

    neon: {
      name: "Neon",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        const hue = PITCH_HUES[midi % 12];
        if (state === "hit") {
          ctx.fillStyle = `hsla(${hue},100%,60%,1)`;
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(80,80,80,0.4)";
        } else {
          ctx.fillStyle = pitchColor(midi, h, vel, 1);
          ctx.shadowColor = `hsl(${hue},100%,55%)`;
          ctx.shadowBlur = 20 * intensity;
          ctx.strokeStyle = `hsla(${hue},100%,80%,0.9)`;
          ctx.lineWidth = 2;
        }
        roundFill(ctx, x, y, w, h);
        if (state === "pending") roundStroke(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = hueToRgb(PITCH_HUES[(p.midi || 0) % 12]);
      },
    },

    rainbow: {
      name: "Gökkuşağı",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "#4ade80";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(120,80,80,0.45)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          const n = 5;
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const hue = (PITCH_HUES[midi % 12] + t * 120) % 360;
            g.addColorStop(t, `hsla(${hue}, 90%, ${h < 22 ? 70 : 55}%, 0.95)`);
          }
          ctx.fillStyle = g;
          ctx.shadowColor = pitchColor(midi, h, vel, 0.6);
          ctx.shadowBlur = 10 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = hueToRgb((PITCH_HUES[(p.midi || 0) % 12] + Math.random() * 80) % 360);
      },
    },

    minimal: {
      name: "Sade",
      drawNote(ctx, x, y, w, h, state, midi, vel) {
        if (state === "hit") ctx.fillStyle = "rgba(74,222,128,0.85)";
        else if (state === "miss") ctx.fillStyle = "rgba(248,113,113,0.45)";
        else ctx.fillStyle = pitchColor(midi, h, vel, 0.88);
        roundFill(ctx, x, y, w, h);
      },
      particle(p) {
        p.rgb = hueToRgb(PITCH_HUES[(p.midi || 0) % 12]);
      },
    },

    plasma: {
      name: "Plazma",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "#a78bfa";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(80,40,80,0.5)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, pitchColor(midi, h, vel, 0.7));
          g.addColorStop(0.5, "rgba(200,100,255,0.95)");
          g.addColorStop(1, "rgba(120,0,200,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(180,80,255,0.9)";
          ctx.shadowBlur = 16 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = p.hot ? "233,213,255" : hueToRgb(280 + ((p.midi || 0) % 12) * 5);
      },
    },
  };

  function roundFill(ctx, x, y, w, h) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(6, w * 0.2));
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  function roundStroke(ctx, x, y, w, h) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(6, w * 0.2));
      ctx.stroke();
    }
  }

  function setStyle(id) {
    if (styles[id]) current = id;
  }

  function getStyle() {
    return styles[current] || styles.fire;
  }

  function getStyleIds() {
    return Object.keys(styles);
  }

  function getStyleName(id) {
    return styles[id]?.name || id;
  }

  return {
    setStyle,
    getStyle,
    getStyleIds,
    getStyleName,
    pitchColor,
    styles,
  };
})();

window.FlameStyles = FlameStyles;


/* === note-utils.js === */
/** Nota birleştirme, üst üste binenleri tekilleştirme */
const NoteUtils = (() => {
  function mergeAdjacentNotes(notes, maxGapSec = 0.15) {
    if (!notes?.length) return [];
    const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
    const out = [];

    for (const n of sorted) {
      const last = out[out.length - 1];
      const end = last ? last.time + last.duration : 0;
      if (
        last &&
        last.midi === n.midi &&
        n.time - end <= maxGapSec
      ) {
        const newEnd = Math.max(end, n.time + (n.duration || 0));
        last.duration = Math.max(0.06, newEnd - last.time);
        last.velocity = Math.max(last.velocity || 0, n.velocity || 0);
        continue;
      }
      out.push({
        midi: n.midi,
        time: n.time,
        duration: Math.max(0.06, n.duration || 0.1),
        velocity: n.velocity ?? 0.75,
        name: n.name,
      });
    }
    return out;
  }

  /** Aynı perdede çakışan aralıkları birleştir */
  function mergeOverlappingSamePitch(notes) {
    const groups = new Map();
    for (const n of notes) {
      if (!groups.has(n.midi)) groups.set(n.midi, []);
      groups.get(n.midi).push(n);
    }
    const out = [];
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.time - b.time);
      let cur = { ...arr[0] };
      for (let i = 1; i < arr.length; i++) {
        const n = arr[i];
        const curEnd = cur.time + cur.duration;
        if (n.time < curEnd + 0.04) {
          const newEnd = Math.max(curEnd, n.time + n.duration);
          cur.duration = newEnd - cur.time;
          cur.velocity = Math.max(cur.velocity || 0, n.velocity || 0);
        } else {
          out.push(cur);
          cur = { ...n };
        }
      }
      out.push(cur);
    }
    return out.sort((a, b) => a.time - b.time || a.midi - b.midi);
  }

  function cleanupNotes(notes, minDuration = 0.08) {
    let list = mergeAdjacentNotes(notes, 0.18);
    list = mergeOverlappingSamePitch(list);
    list = mergeAdjacentNotes(list, 0.12);
    return list.filter((n) => (n.duration || 0) >= minDuration);
  }

  return { mergeAdjacentNotes, mergeOverlappingSamePitch, cleanupNotes };
})();

window.NoteUtils = NoteUtils;


/* === note-renderer.js === */
/** Mor/neon düşen notalar, vuruş parıltısı, aurora */
const NoteRenderer = (() => {
  function baseHue() {
    const v = window.__effectHue;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    const css = getComputedStyle(document.documentElement).getPropertyValue("--effect-hue");
    return Number(css) || 275;
  }

  function hue(midi) {
    return (baseHue() + (midi % 12) * 4) % 360;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, rad);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  function drawLane(ctx, x, w, h, hitY, midi, t, laneColor = null) {
    const hu = hue(midi);
    const pulse = 0.04 + Math.sin(t * 2.5 + midi * 0.08) * 0.02;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    if (laneColor) {
      g.addColorStop(0.45, `color-mix(in srgb, ${laneColor} 75%, transparent)`);
      g.addColorStop(0.55, `color-mix(in srgb, ${laneColor} 95%, white 5%)`);
    } else {
      g.addColorStop(0.45, `hsla(${hu}, 80%, 55%, ${pulse})`);
      g.addColorStop(0.55, `hsla(${hu}, 90%, 65%, ${pulse * 1.2})`);
    }
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 0.6, 0, w * 1.2, hitY + 8);
  }

  function drawNote(ctx, opts) {
    const { x, y, w, h, midi, vel, state, styleId, intensity, time, laneColor } = opts;
    if (h < 2) return;

    const style = window.FlameStyles?.styles?.[styleId];
    if (style?.drawNote && styleId && styleId !== "aurora") {
      style.drawNote(ctx, x, y, w, h, state, midi, vel, intensity);
      return;
    }

    const hu = hue(midi);
    const v = vel ?? 0.75;
    const cx = x + w / 2;
    const r = Math.min(w * 0.48, 12);

    if (state === "hit") {
      ctx.save();
      ctx.shadowColor = `hsla(${hu}, 100%, 75%, 1)`;
      ctx.shadowBlur = 22;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, `hsla(${hu}, 90%, 85%, 1)`);
      g.addColorStop(1, `hsla(${hu}, 100%, 55%, 1)`);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (state === "miss") {
      ctx.fillStyle = "rgba(248, 113, 113, 0.4)";
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.shadowColor = `hsla(${hu}, 100%, 65%, 0.9)`;
    ctx.shadowBlur = (14 + v * 8) * intensity;
    const body = ctx.createLinearGradient(x, y, x, y + h);
    if (laneColor) {
      body.addColorStop(0, `color-mix(in srgb, ${laneColor} 40%, white 60%)`);
      body.addColorStop(0.35, `color-mix(in srgb, ${laneColor} 85%, white 15%)`);
      body.addColorStop(0.75, laneColor);
      body.addColorStop(1, `color-mix(in srgb, ${laneColor} 72%, black 28%)`);
    } else {
      body.addColorStop(0, `hsla(${hu}, 70%, 78%, 0.95)`);
      body.addColorStop(0.35, `hsla(${hu}, 95%, 62%, 1)`);
      body.addColorStop(0.75, `hsla(${hu}, 100%, 52%, 1)`);
      body.addColorStop(1, `hsla(${hu}, 100%, 42%, 1)`);
    }
    ctx.fillStyle = body;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    const shine = ctx.createLinearGradient(x, y, x + w * 0.4, y + h * 0.3);
    shine.addColorStop(0, "rgba(255,255,255,0.4)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    roundRect(ctx, x + w * 0.08, y + 1, w * 0.3, Math.min(h * 0.3, 20), r * 0.4);
    ctx.fill();

    const bottomY = y + h;
    const cap = ctx.createRadialGradient(cx, bottomY, 0, cx, bottomY, w * 0.7);
    cap.addColorStop(0, `rgba(255,255,255,${0.5 + v * 0.3})`);
    cap.addColorStop(0.4, `hsla(${hu}, 100%, 75%, 0.85)`);
    cap.addColorStop(1, `hsla(${hu}, 100%, 50%, 0)`);
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(cx, bottomY, w * 0.5, Math.min(8, h * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function spawnImpactParticles(particles, x, y, w, midi, count = 16) {
    const hu = hue(midi);
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const sp = 2 + Math.random() * 5;
      particles.push({
        x: x + (Math.random() - 0.5) * w * 0.5,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 2 + Math.random() * 4,
        hot: true,
        midi,
        rgb: `${180 + (hu % 60)},${100 + Math.random() * 80},255`,
        star: Math.random() > 0.5,
      });
    }
  }

  function drawKeyAuroras(ctx, auras, hitY, w, t) {
    for (const [midi, aura] of auras) {
      const power = aura.power * Math.max(0, aura.life);
      if (power < 0.02) continue;
      const hu = hue(midi);
      const x = aura.x;
      const kw = aura.w || 40;

      const pillar = ctx.createLinearGradient(x, hitY, x, hitY - 120);
      pillar.addColorStop(0, `hsla(${hu}, 90%, 65%, ${0.45 * power})`);
      pillar.addColorStop(0.5, `hsla(${hu}, 80%, 50%, ${0.2 * power})`);
      pillar.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pillar;
      ctx.fillRect(x - kw * 0.55, hitY - 130, kw * 1.1, 130);

      for (let i = 0; i < 8; i++) {
        const sx = x + Math.sin(t * 3 + midi + i) * kw * 0.35;
        const sy = hitY - 15 - i * 12 - Math.sin(t * 2 + i) * 6;
        const a = 0.35 * power * (0.5 + Math.sin(t * 5 + i) * 0.5);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return {
    drawNote,
    drawLane,
    drawKeyAuroras,
    spawnImpactParticles,
    hue,
  };
})();

window.NoteRenderer = NoteRenderer;


/* === piano-range.js === */
/** 88 tuşlu piyano aralığı (A0 – C8) */
const PianoRange = (() => {
  const MIN_MIDI = 21;
  const MAX_MIDI = 108;
  const MIN_START_OCTAVE = 0;
  const MAX_START_OCTAVE = 8;
  const MAX_OCTAVES = 7;

  function startMidiFromOctave(octave) {
    return (Number(octave) + 1) * 12;
  }

  function clampRange(startOctave, octaveCount) {
    let startOct = Number(startOctave);
    let startMidi = startMidiFromOctave(startOct);
    let count = Math.max(1, Math.min(MAX_OCTAVES, Number(octaveCount)));
    let endMidi = startMidi + count * 12 - 1;

    if (startMidi < MIN_MIDI) {
      startMidi = MIN_MIDI;
      endMidi = startMidi + count * 12 - 1;
      startOct = Math.max(MIN_START_OCTAVE, Math.floor(startMidi / 12) - 1);
    }
    if (endMidi > MAX_MIDI) {
      endMidi = MAX_MIDI;
      const maxCount = Math.floor((MAX_MIDI - startMidi + 1) / 12);
      count = Math.max(1, maxCount);
      endMidi = startMidi + count * 12 - 1;
      if (endMidi > MAX_MIDI) endMidi = MAX_MIDI;
    }

    return {
      startOctave: startOct,
      octaveCount: count,
      startMidi,
      endMidi,
    };
  }

  function getStartOctaveOptions() {
    const opts = [];
    for (let o = MIN_START_OCTAVE; o <= MAX_START_OCTAVE; o++) {
      const midi = startMidiFromOctave(o);
      if (midi > MAX_MIDI - 12) continue;
      const name = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midi % 12];
      const label = `Oktav ${o} (${name}${o})`;
      opts.push({ value: o, label });
    }
    return opts;
  }

  /** Şarkı notalarına göre klavye aralığı (C tabanlı tam oktavlar) */
  function fitRangeToNotes(notes, paddingSemitones = 2) {
    if (!notes?.length) return null;
    let minMidi = MAX_MIDI;
    let maxMidi = MIN_MIDI;
    for (const n of notes) {
      minMidi = Math.min(minMidi, n.midi);
      maxMidi = Math.max(maxMidi, n.midi);
    }
    minMidi = Math.max(MIN_MIDI, minMidi - paddingSemitones);
    maxMidi = Math.min(MAX_MIDI, maxMidi + paddingSemitones);

    let startMidi = minMidi;
    while (startMidi > MIN_MIDI && startMidi % 12 !== 0) startMidi--;

    let count = Math.ceil((maxMidi - startMidi + 1) / 12);
    count = Math.max(1, Math.min(MAX_OCTAVES, count));
    const startOctave = Math.floor(startMidi / 12) - 1;
    return clampRange(startOctave, count);
  }

  function getOctaveCountOptions(startOctave) {
    const opts = [];
    const startMidi = Math.max(MIN_MIDI, startMidiFromOctave(startOctave));
    for (let c = 1; c <= MAX_OCTAVES; c++) {
      const end = startMidi + c * 12 - 1;
      if (end > MAX_MIDI) break;
      opts.push({ value: c, label: `${c} oktav` });
    }
    return opts.length ? opts : [{ value: 1, label: "1 oktav" }];
  }

  return {
    MIN_MIDI,
    MAX_MIDI,
    MAX_OCTAVES,
    clampRange,
    startMidiFromOctave,
    getStartOctaveOptions,
    getOctaveCountOptions,
    fitRangeToNotes,
  };
})();

window.PianoRange = PianoRange;


/* === piano.js === */
/** Dokunmatik piyano — 88 tuş, otomatik boyut */
const Piano = (() => {
  const WHITE_PATTERN = [0, 2, 4, 5, 7, 9, 11];

  let container = null;
  let wrapEl = null;
  let range = { startMidi: 48, endMidi: 83 };
  let keyMap = new Map();
  let activePointers = new Map();
  let keyboardHeld = new Set();
  const holdCount = new Map();
  let onNoteDown = null;
  let onNoteUp = null;
  let keyWidth = 48;
  let keyHeight = 160;
  let autoFitWidth = true;

  function applySize() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--white-key-width", `${keyWidth}px`);
    wrapEl.style.setProperty("--piano-height", `${keyHeight}px`);
    let chrome = 0;
    const banner = document.getElementById("authBanner");
    if (banner?.offsetHeight) chrome += banner.offsetHeight;
    const top = document.querySelector(".top-bar");
    if (top) chrome += top.offsetHeight;
    const usedH = keyHeight + 20;
    const maxFooter = Math.max(120, window.innerHeight - chrome);
    const footerH = Math.min(usedH, maxFooter);
    document.documentElement.style.setProperty("--footer-row-h", `${footerH}px`);
    const footerEl = document.getElementById("instrumentFooter");
    if (footerEl) {
      footerEl.style.height = `${footerH}px`;
      footerEl.style.minHeight = `${footerH}px`;
      footerEl.style.maxHeight = `${footerH}px`;
    }
    wrapEl.style.height = "100%";
    wrapEl.style.minHeight = "0";
    wrapEl.style.maxHeight = "100%";
    if (window.Game && typeof window.Game.resize === "function") {
      window.Game.resize();
    }
  }

  function autoSizeKeys() {
    if (!wrapEl || !container) return;
    const whites = [...keyMap.keys()].filter((m) => WHITE_PATTERN.includes(m % 12));
    if (!whites.length) return;
    const avail = wrapEl.clientWidth - 16;
    const fit = Math.floor(avail / whites.length) - 1;
    keyWidth = Math.max(20, Math.min(100, fit));
    applySize();
  }

  function setKeySize(width, height) {
    autoFitWidth = false;
    keyWidth = Math.max(20, Math.min(100, width));
    keyHeight = Math.max(90, Math.min(420, height));
    applySize();
  }

  function setAutoFit(on) {
    autoFitWidth = !!on;
    if (autoFitWidth) autoSizeKeys();
  }

  function getKeySize() {
    return { keyWidth, keyHeight };
  }

  function refreshLabels() {
    if (window.KeyLabels && keyMap.size) {
      window.KeyLabels.applyToKeys(keyMap, range);
    }
    window.KeyboardInput?.rebuild?.();
  }

  function buildKeys(startOctave, octaveCount) {
    if (!container) return;

    window.KeyboardInput?.releaseAll?.();

    const clamped = window.PianoRange
      ? window.PianoRange.clampRange(startOctave, octaveCount)
      : {
          startMidi: (startOctave + 1) * 12,
          endMidi: (startOctave + 1) * 12 + octaveCount * 12 - 1,
        };

    range = {
      startMidi: clamped.startMidi,
      endMidi: clamped.endMidi,
    };

    keyMap.clear();
    activePointers.clear();
    keyboardHeld.clear();
    container.innerHTML = "";

    const whites = [];
    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PATTERN.includes(m % 12)) whites.push(m);
    }

    for (const midi of whites) {
      const el = createKey(midi, "white");
      container.appendChild(el);
      keyMap.set(midi, el);
    }

    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PATTERN.includes(m % 12)) continue;
      const el = createKey(m, "black");
      let prev = m - 1;
      while (prev >= range.startMidi && !keyMap.has(prev)) prev--;
      const anchor = keyMap.get(prev);
      if (anchor?.nextSibling) container.insertBefore(el, anchor.nextSibling);
      else container.appendChild(el);
      keyMap.set(m, el);
    }

    if (autoFitWidth) autoSizeKeys();
    else applySize();
    refreshLabels();
    bindKeyboardSlide();
  }

  function createKey(midi, kind) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `key ${kind}`;
    el.dataset.midi = String(midi);
    const label = document.createElement("span");
    label.className = "key-label";
    label.textContent = "?";
    el.appendChild(label);
    bindPointer(el, midi);
    bindContextMenu(el, midi);
    return el;
  }

  function openLabelEditor(midi) {
    window.dispatchEvent(
      new CustomEvent("piano:edit-label", { detail: { midi: Number(midi) } })
    );
  }

  function bindContextMenu(el, midi) {
    const openMouse = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      openLabelEditor(midi);
    };

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.__touchPianoTouchInput) return;
      if (e.pointerType === "touch" || e.pointerType === "pen") return;
      openLabelEditor(midi);
    });

    el.addEventListener("auxclick", (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.__touchPianoTouchInput || e.pointerType === "touch" || e.pointerType === "pen")
        return;
      openMouse(e);
    });
  }

  function releaseAll() {
    slideCtl?.releaseAll?.();
    for (const [, m] of activePointers) {
      window.AudioEngine.noteOff(m);
    }
    activePointers.clear();
    for (const m of keyboardHeld) {
      window.AudioEngine.noteOff(m);
    }
    keyboardHeld.clear();
    holdCount.clear();
    keyMap.forEach((el) => {
      el.classList.remove("active", "hit-target", "miss-flash", "key-burst");
    });
  }

  function bindPointer(el, midi) {
    /* Oynatma kaydırma bindKeyboardSlide ile — yalnızca sağ tık etiket */
  }

  let slideCtl = null;

  function bindKeyboardSlide() {
    if (!container || !window.PointerSlide || slideCtl) return;
    slideCtl = window.PointerSlide.bind(container, {
      hitTest: (x, y) => {
        const el = document.elementFromPoint(x, y)?.closest?.(".key");
        if (!el || !container.contains(el)) return null;
        const midi = Number(el.dataset.midi);
        if (!midi) return null;
        return { el, midi };
      },
      onEnter: (st, target, e) => {
        st.el = target.el;
        st.midi = target.midi;
        target.el.classList.add("active");
        const vel = window.AudioEngine.velocityFromPointer(e);
        window.AudioEngine.noteOn(st.midi, vel, { poly: true });
        onNoteDown?.(st.midi, vel, e);
      },
      onLeave: (st, e) => {
        if (st.midi == null) return;
        st.el?.classList.remove("active");
        window.AudioEngine.noteOff(st.midi);
        onNoteUp?.(st.midi, e);
        st.midi = null;
        st.el = null;
      },
    });
  }

  function pressKey(midi, velocity = 0.85) {
    if (!midiInRange(midi)) return;
    const el = keyMap.get(midi);
    if (!el) return;
    const next = (holdCount.get(midi) || 0) + 1;
    holdCount.set(midi, next);
    if (next > 1) return;
    keyboardHeld.add(midi);
    el.classList.add("active");
    window.AudioEngine.noteOn(midi, velocity);
    onNoteDown?.(midi, velocity);
  }

  function releaseKey(midi) {
    const cur = holdCount.get(midi) || 0;
    if (cur <= 0) return;
    const next = cur - 1;
    if (next > 0) {
      holdCount.set(midi, next);
      return;
    }
    holdCount.delete(midi);
    if (!keyboardHeld.has(midi)) return;
    keyboardHeld.delete(midi);
    const el = keyMap.get(midi);
    if (el) el.classList.remove("active");
    window.AudioEngine.noteOff(midi);
    onNoteUp?.(midi);
  }

  function flash(midi, type) {
    const el = keyMap.get(midi);
    if (!el) return;
    el.classList.remove("hit-target", "miss-flash");
    el.classList.add(type === "good" ? "hit-target" : "miss-flash");
    if (type === "good") el.classList.add("key-burst");
    setTimeout(() => el.classList.remove("hit-target", "miss-flash", "key-burst"), 320);
  }

  function init(rootEl, wrap, noteDownCb, noteUpCb) {
    container = rootEl;
    wrapEl = wrap;
    onNoteDown = noteDownCb;
    onNoteUp = noteUpCb;
    bindKeyboardSlide();
    window.addEventListener("resize", () => {
      if (autoFitWidth) autoSizeKeys();
    });
  }

  function midiInRange(midi) {
    return midi >= range.startMidi && midi <= range.endMidi;
  }

  function applyLayout() {
    applySize();
  }

  return {
    init,
    buildKeys,
    flash,
    refreshLabels,
    pressKey,
    releaseKey,
    setKeySize,
    setAutoFit,
    getKeySize,
    applySize,
    applyLayout,
    midiInRange,
    getRange: () => ({ ...range }),
    getKeyMap: () => keyMap,
    getKeyElement: (midi) => keyMap.get(midi),
    releaseAll,
  };
})();

window.Piano = Piano;


/* === pointer-slide.js === */
/** Parmak kaydırma — tek hedef veya dokunma alanındaki tüm hedefler */
const PointerSlide = (() => {
  function touchRect(e, pad = 14) {
    let w = e.width > 0 ? e.width : 28;
    let h = e.height > 0 ? e.height : 28;
    if (e.radiusX > 0) w = Math.max(w, e.radiusX * 2);
    if (e.radiusY > 0) h = Math.max(h, e.radiusY * 2);
    w += pad * 2;
    h += pad * 2;
    return {
      left: e.clientX - w / 2,
      right: e.clientX + w / 2,
      top: e.clientY - h / 2,
      bottom: e.clientY + h / 2,
    };
  }

  function rectsIntersect(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function samplePath(x0, y0, x1, y1, stepPx = 8) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / stepPx));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
    return pts;
  }

  function targetKey(target) {
    if (!target) return null;
    if (target.midi != null) return `m${target.midi}`;
    if (target.stringIdx != null && target.fret != null) {
      return `s${target.stringIdx}f${target.fret}`;
    }
    if (target.row) return target.row;
    if (target.el) return target.el;
    return target;
  }

  function isPlayPointer(e) {
    if (e.pointerType === "mouse") return e.button === 0;
    return e.pointerType === "touch" || e.pointerType === "pen";
  }

  function bindPointerHandlers(rootEl, handlers) {
    const { down, move, end } = handlers;
    rootEl.addEventListener("pointerdown", down, { passive: false });
    rootEl.addEventListener("pointermove", move, { passive: false });
    rootEl.addEventListener("pointerup", end, { passive: false });
    rootEl.addEventListener("pointercancel", end, { passive: false });
    rootEl.addEventListener("lostpointercapture", end, { passive: false });

    const globalEnd = (e) => {
      if (!handlers.hasPointer(e.pointerId)) return;
      end(e);
    };
    window.addEventListener("pointerup", globalEnd, true);
    window.addEventListener("pointercancel", globalEnd, true);

    return () => {
      window.removeEventListener("pointerup", globalEnd, true);
      window.removeEventListener("pointercancel", globalEnd, true);
    };
  }

  function bindMultiArea(rootEl, opts) {
    const {
      collectTargets,
      onSync,
      onEnd,
      shouldHandle = () => true,
      keyOf = targetKey,
      sampleOnMove = true,
    } = opts;
    const pointers = new Map();

    function mergeTargets(st, e) {
      const merged = [];
      const seen = new Set();
      const add = (list) => {
        for (const t of list || []) {
          const k = keyOf(t);
          if (k == null || seen.has(k)) continue;
          seen.add(k);
          merged.push(t);
        }
      };
      add(collectTargets(e, rootEl));
      if (sampleOnMove && st.lastX != null && st.lastY != null) {
        const pts = samplePath(st.lastX, st.lastY, e.clientX, e.clientY, 6);
        for (const p of pts) {
          add(
            collectTargets(
              {
                ...e,
                clientX: p.x,
                clientY: p.y,
                width: 0,
                height: 0,
                radiusX: 0,
                radiusY: 0,
              },
              rootEl
            )
          );
        }
      }
      return merged;
    }

    const sync = (st, e) => {
      onSync(st, mergeTargets(st, e), e);
    };

    const down = (e) => {
      if (!shouldHandle(e)) return;
      if (!isPlayPointer(e)) return;
      if (pointers.has(e.pointerId)) return;
      const targets = collectTargets(e, rootEl) || [];
      if (!targets.length) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        rootEl.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      const st = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      pointers.set(e.pointerId, st);
      onSync(st, targets, e);
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      sync(st, e);
      st.lastX = e.clientX;
      st.lastY = e.clientY;
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      onEnd?.(st, e);
      pointers.delete(e.pointerId);
      try {
        rootEl.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };

    bindPointerHandlers(rootEl, {
      down,
      move,
      end,
      hasPointer: (id) => pointers.has(id),
    });

    return {
      releaseAll() {
        for (const [, st] of pointers) onEnd?.(st, {});
        pointers.clear();
      },
    };
  }

  function bind(rootEl, opts) {
    const {
      hitTest,
      onEnter,
      onLeave,
      onMove,
      shouldHandle = () => true,
    } = opts;
    const pointers = new Map();

    function leave(st, e) {
      if (st.target == null) return;
      onLeave?.(st, e);
      st.target = null;
      st.targetId = null;
    }

    function enter(st, target, e) {
      const id = targetKey(target);
      if (st.targetId === id) return;
      leave(st, e);
      st.targetId = id;
      st.target = target;
      if (target != null) onEnter?.(st, target, e);
    }

    function processMove(st, e) {
      const x0 = st.lastX ?? e.clientX;
      const y0 = st.lastY ?? e.clientY;
      const pts = samplePath(x0, y0, e.clientX, e.clientY);
      for (const p of pts) {
        const hit = hitTest(p.x, p.y);
        if (hit) {
          enter(st, hit, e);
          onMove?.(st, hit, e);
        }
      }
      const at = hitTest(e.clientX, e.clientY);
      if (at) {
        enter(st, at, e);
        onMove?.(st, at, e);
      }
      st.lastX = e.clientX;
      st.lastY = e.clientY;
    }

    const down = (e) => {
      if (!shouldHandle(e)) return;
      if (!isPlayPointer(e)) return;
      if (pointers.has(e.pointerId)) return;
      const hit = hitTest(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        rootEl.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      const st = { lastX: e.clientX, lastY: e.clientY, target: null };
      pointers.set(e.pointerId, st);
      enter(st, hit, e);
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      processMove(st, e);
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      leave(st, e);
      pointers.delete(e.pointerId);
      try {
        rootEl.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };

    bindPointerHandlers(rootEl, {
      down,
      move,
      end,
      hasPointer: (id) => pointers.has(id),
    });

    return {
      releaseAll() {
        for (const [, st] of pointers) leave(st, {});
        pointers.clear();
      },
    };
  }

  return { bind, bindMultiArea, touchRect, rectsIntersect, samplePath };
})();

window.PointerSlide = PointerSlide;


/* === fretted-instrument.js === */
/** Gitar / keman — sol kol + sağ teller (ortak mantık) */
function createFrettedInstrument(config) {
  const {
    id,
    STRING_OPEN,
    STRING_NAMES,
    DISPLAY_STRINGS,
    STRING_COLORS,
    STRING_THICK,
    FRET_COUNT,
    gripSettingKey,
    pluckMinVar,
    neckHintGrip,
    neckHintSingle,
    pluckTitle,
    cardNeckTitle,
    cardPluckTitle,
  } = config;

  return (() => {
    let fretsRoot = null;
    let stringsRoot = null;
    let pluckBundle = null;
    let wrapEl = null;
    let range = { startMidi: 40, endMidi: 78 };
    let onNoteDown = null;
    let onNoteUp = null;
    let cellMap = new Map();
    let fretCellsByString = {};
    let pluckRows = [];
    let fretted = {};
    let fretPointers = new Map();
    let autoFrets = {};
    let midiTargets = new Map();

    function gripAllStrings() {
      return !!window.AppSettings?.load?.()?.[gripSettingKey];
    }

    function neckNearbyEnabled() {
      const s = window.AppSettings?.load?.() || {};
      const key = id === "violin" ? "violinNeckNearbyTouch" : "guitarNeckNearbyTouch";
      return s[key] !== false;
    }

    function stringsNearbyEnabled() {
      const s = window.AppSettings?.load?.() || {};
      const key = id === "violin" ? "violinStringsNearbyTouch" : "guitarStringsNearbyTouch";
      return !!s[key];
    }

    function layoutFromSettings() {
      const s = window.AppSettings?.load?.() || {};
      const stringH = s.guitarStringHeight ?? 30;
      return {
        neckH: s.guitarNeckHeight ?? stringH,
        stringH,
        neckW: s.guitarNeckWidth ?? s.keyWidth ?? 42,
        pluckW: s.guitarPluckWidth ?? 220,
      };
    }

    function midiAt(stringIdx, fret) {
      return STRING_OPEN[stringIdx] + fret;
    }

    function currentMidiForString(stringIdx) {
      return midiAt(stringIdx, fretted[stringIdx] || 0);
    }

    function colorClass(stringIdx) {
      const i = DISPLAY_STRINGS.indexOf(stringIdx);
      return `guitar-str-color-${i >= 0 ? i : 0}`;
    }

    function getNeckRow(stringIdx) {
      return fretsRoot?.querySelector(`.guitar-string-row[data-string="${stringIdx}"]`);
    }

    function setNeckVibrato(stringIdx, intensity) {
      const row = getNeckRow(stringIdx);
      const wire = row?.querySelector(".guitar-row-wire");
      const light = intensity * 0.42;
      row?.classList.toggle("string-vibrating", light > 0.03);
      wire?.style.setProperty("--vib-intensity", String(light));
      if (light <= 0.03) wire?.style.removeProperty("--vib-intensity");
    }

    function clearNeckVibrato(stringIdx) {
      setNeckVibrato(stringIdx, 0);
    }

    function measureLayoutChrome() {
      let h = 0;
      const banner = document.getElementById("authBanner");
      if (banner && banner.offsetHeight > 0) h += banner.offsetHeight;
      const top = document.querySelector(".top-bar");
      if (top) h += top.offsetHeight;
      return h;
    }

    function applySizeVars() {
      const { neckH, stringH, neckW, pluckW } = layoutFromSettings();
      const requestedRow = Math.max(10, neckH);
      const requestedStr = Math.max(10, stringH);
      const requestedCell = Math.max(10, neckW);
      const colCount = FRET_COUNT + 1;
      const n = DISPLAY_STRINGS.length;
      const fretHeader = 34;
      const cardHead = 52;
      const chromePad = 170;
      const rowGaps = Math.max(0, n - 1) * 2;
      const strGaps = Math.max(0, n - 1) * 3 + 18;

      const baseNeckInner = fretHeader + n * requestedRow + rowGaps;
      const basePluckInner = n * requestedStr + strGaps;
      const baseUsedH = cardHead + Math.max(baseNeckInner, basePluckInner) + chromePad;

      const chrome = measureLayoutChrome();
      const maxFooter = Math.max(140, window.innerHeight - chrome);
      const heightScale = Math.min(1, maxFooter / Math.max(1, baseUsedH));
      let rowPx = Math.max(6, Math.floor(requestedRow * heightScale));
      let strPx = Math.max(6, Math.floor(requestedStr * heightScale));

      // Fit only by available footer height; do not lock to previous card size.
      const contentPad = 108;
      const availColumnH = Math.max(64, maxFooter - contentPad);
      const fitRowPx = Math.floor((availColumnH - fretHeader - rowGaps) / Math.max(1, n));
      const fitStrPx = Math.floor((availColumnH - strGaps) / Math.max(1, n));
      rowPx = Math.max(6, Math.min(rowPx, fitRowPx));
      strPx = Math.max(6, Math.min(strPx, fitStrPx));

      const neckInner = fretHeader + n * rowPx + rowGaps;
      const pluckInner = n * strPx + strGaps;
      const usedH = cardHead + Math.max(neckInner, pluckInner) + chromePad;
      const footerH = Math.min(usedH, maxFooter);

      let pluckPx = Math.max(80, pluckW);
      let cellPx = requestedCell;

      document.documentElement.style.setProperty("--footer-row-h", `${footerH}px`);

      const footerEl = document.getElementById("instrumentFooter");
      if (footerEl) {
        footerEl.style.height = `${footerH}px`;
        footerEl.style.minHeight = `${footerH}px`;
        footerEl.style.maxHeight = `${footerH}px`;
      }

      function applyDims(nextRow, nextStr, nextCell, nextPluck) {
        const cellW = `${nextCell}px`;
        const rowH = `${nextRow}px`;
        const strH = `${nextStr}px`;
        const pluck = `${nextPluck}px`;
        const gridCols = `repeat(${colCount}, ${cellW})`;

        const varTargets = [wrapEl, fretsRoot, stringsRoot].filter(Boolean);
        for (const el of varTargets) {
          el.style.setProperty("--inst-cell-w", cellW);
          el.style.setProperty("--inst-row-h", rowH);
          el.style.setProperty("--inst-string-h", strH);
          el.style.setProperty(pluckMinVar, pluck);
        }
        if (wrapEl) {
          wrapEl.style.height = "100%";
          wrapEl.style.minHeight = "0";
          wrapEl.style.maxHeight = "100%";
          DISPLAY_STRINGS.forEach((s, i) => {
            wrapEl.style.setProperty(`--str-thick-${i}`, `${STRING_THICK[i]}px`);
          });
        }

        fretsRoot
          ?.querySelectorAll(".guitar-fret-cells, .guitar-fret-header-cells")
          .forEach((grid) => {
            grid.style.gridTemplateColumns = gridCols;
          });

        fretsRoot?.querySelectorAll(".guitar-cell, .violin-cell").forEach((cell) => {
          cell.style.width = cellW;
          cell.style.height = rowH;
          cell.style.minHeight = rowH;
          cell.style.flexShrink = "0";
        });

        fretsRoot?.querySelectorAll(".guitar-string-row, .violin-string-row").forEach((row) => {
          row.style.height = rowH;
          row.style.minHeight = rowH;
        });

        const stringsPanel = stringsRoot?.closest(
          ".guitar-strings-panel, .guitar-strings-card, .violin-strings-card"
        );
        if (stringsPanel) {
          stringsPanel.style.width = pluck;
          stringsPanel.style.minWidth = pluck;
        }

        const fretsPanel = fretsRoot?.closest(".guitar-frets-panel");
        if (fretsPanel) {
          const panelW = Math.max(120, colCount * (nextCell + 2) + 48);
          fretsPanel.style.width = `${panelW}px`;
          fretsPanel.style.maxWidth = "100%";
        }

        pluckRows.forEach(({ el }) => {
          el.style.height = strH;
          el.style.minHeight = strH;
          el.style.flexBasis = strH;
        });
      }

      applyDims(rowPx, strPx, cellPx, pluckPx);
    }

    function applySize() {
      applySizeVars();
      if (window.Game?.isReady?.()) window.Game.resize();
    }

    if (!window.__frettedLayoutResizeBound) {
      window.__frettedLayoutResizeBound = true;
      window.addEventListener("resize", () => {
        if (wrapEl && !wrapEl.closest(".hidden")) applySizeVars();
      });
    }

    function applyLayout() {
      applySize();
    }

    function setKeySize(width, height) {
      const s = window.AppSettings?.load?.() || {};
      window.AppSettings?.save?.({
        guitarNeckWidth: width ?? s.guitarNeckWidth,
        guitarNeckHeight: height ?? s.guitarNeckHeight,
        keyWidth: width ?? s.keyWidth,
        keyHeight: height ?? s.keyHeight,
      });
      applySize();
    }

    function setAutoFit() {
      applySize();
    }

    function getKeySize() {
      const L = layoutFromSettings();
      return { keyWidth: L.neckW, keyHeight: L.neckH };
    }

    function getRange() {
      return { ...range };
    }

    function refreshLabels() {}

    function noteLabel(midi) {
      return window.KeyLabels?.noteNameForMidi?.(midi) || String(midi);
    }

    function getTouchedFretsByString() {
      const map = {};
      for (const st of fretPointers.values()) {
        if (st.cells?.length) {
          for (const c of st.cells) {
            if (!map[c.stringIdx]) map[c.stringIdx] = [];
            map[c.stringIdx].push(c.fret);
          }
        } else if (st.gripAll) {
          for (const s of DISPLAY_STRINGS) {
            if (!map[s]) map[s] = [];
            map[s].push(st.fret);
          }
        } else if (st.stringIdx != null) {
          if (!map[st.stringIdx]) map[st.stringIdx] = [];
          map[st.stringIdx].push(st.fret);
        }
      }
      return map;
    }

    function openStringWord() {
      return window.I18n?.t?.("inst.openString") || "open";
    }

    function formatActiveString(fret, midi, touchedFrets) {
      const note = noteLabel(midi);
      if (touchedFrets.length > 1) {
        const uniq = [...new Set(touchedFrets)].sort((a, b) => a - b);
        return `P${fret} · ${note} (${uniq.join("+")}→${fret})`;
      }
      if (fret > 0) return `P${fret} · ${note}`;
      return `${openStringWord()} · ${note}`;
    }

    function updateStringHighlights() {
      const touched = getTouchedFretsByString();
      pluckRows.forEach(({ el, stringIdx }) => {
        const fret = fretted[stringIdx] || 0;
        const midi = currentMidiForString(stringIdx);
        el.dataset.midi = String(midi);
        el.classList.toggle("has-fret", fret > 0);
        const label = el.querySelector(".guitar-string-fret");
        if (label) label.textContent = formatActiveString(fret, midi, touched[stringIdx] || []);
      });
      DISPLAY_STRINGS.forEach((s) => {
        const row = getNeckRow(s);
        const activeEl = row?.querySelector(".guitar-neck-active");
        if (!activeEl) return;
        const fret = fretted[s] || 0;
        const midi = currentMidiForString(s);
        const touches = touched[s] || [];
        if (touches.length || fret > 0 || autoFrets[s] != null) {
          activeEl.textContent = formatActiveString(fret, midi, touches);
        } else {
          activeEl.textContent = "";
        }
      });
    }

    function repaintFretCells() {
      for (const s of DISPLAY_STRINGS) {
        fretCellsByString[s]?.forEach((cell) => {
          const f = Number(cell.dataset.fret);
          const held = fretted[s] ?? 0;
          cell.classList.remove("active-touch");
          cell.classList.toggle("fret-held", f === held && held > 0);
        });
      }
      for (const st of fretPointers.values()) {
        if (st.cells?.length) {
          for (const c of st.cells) {
            fretCellsByString[c.stringIdx]?.[c.fret]?.classList.add("active-touch");
          }
        } else if (st.gripAll) {
          for (const s of DISPLAY_STRINGS) {
            const cell = fretCellsByString[s]?.[st.fret];
            cell?.classList.add("active-touch");
          }
        } else if (st.stringIdx != null) {
          fretCellsByString[st.stringIdx]?.[st.fret]?.classList.add("active-touch");
        }
      }
      updateStringHighlights();
    }

    function mergeFrettedDisplay() {
      const next = {};
      for (const st of fretPointers.values()) {
        if (st.cells?.length) {
          for (const c of st.cells) {
            next[c.stringIdx] = Math.max(next[c.stringIdx] ?? 0, c.fret);
          }
        } else if (st.gripAll) {
          for (const s of DISPLAY_STRINGS) next[s] = Math.max(next[s] ?? 0, st.fret);
        } else if (st.stringIdx != null) {
          next[st.stringIdx] = Math.max(next[st.stringIdx] ?? 0, st.fret);
        }
      }
      for (const s of DISPLAY_STRINGS) {
        if (next[s] == null && autoFrets[s] != null) next[s] = autoFrets[s];
      }
      fretted = next;
      repaintFretCells();
    }

    function pickBarreFret(cells, clientX) {
      const byFret = new Map();
      for (const c of cells) {
        const prev = byFret.get(c.fret) || { count: 0, dist: Infinity };
        const r = c.el.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        byFret.set(c.fret, {
          count: prev.count + 1,
          dist: Math.min(prev.dist, Math.abs(cx - clientX)),
        });
      }
      let best = 0;
      let bestCount = -1;
      let bestDist = Infinity;
      for (const [f, { count, dist }] of byFret) {
        if (count > bestCount || (count === bestCount && dist < bestDist)) {
          bestCount = count;
          bestDist = dist;
          best = f;
        }
      }
      return best;
    }

    function pointerStateFromCells(cells, e) {
      if (gripAllStrings() && cells.length) {
        return { gripAll: true, fret: pickBarreFret(cells, e.clientX) };
      }
      return {
        multi: true,
        cells: cells.map((c) => ({ stringIdx: c.stringIdx, fret: c.fret })),
      };
    }

    function collectNeckCells(e, root) {
      if (!neckNearbyEnabled()) {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".guitar-cell");
        if (!el || !root.contains(el)) return [];
        return [
          {
            el,
            stringIdx: Number(el.dataset.string),
            fret: Number(el.dataset.fret),
            midi: Number(el.dataset.midi),
          },
        ];
      }
      const area = window.PointerSlide.touchRect(e, 18);
      const cells = [];
      root.querySelectorAll(".guitar-cell").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!window.PointerSlide.rectsIntersect(r, area)) return;
        cells.push({
          el,
          stringIdx: Number(el.dataset.string),
          fret: Number(el.dataset.fret),
          midi: Number(el.dataset.midi),
        });
      });
      return cells;
    }

    let neckSlideCtl = null;

    function releaseAll() {
      neckSlideCtl?.releaseAll?.();
      fretPointers.clear();
      autoFrets = {};
      fretted = {};
      window.AudioEngine?.stopAll?.();
      fretsRoot?.querySelectorAll(".guitar-cell").forEach((el) => {
        el.classList.remove("active", "fret-held", "active-touch", "open-selected");
      });
      pluckRows.forEach(({ el, stringIdx }) => {
        el.classList.remove("active", "string-held", "string-vibrating", "has-fret", "hit-target");
        clearNeckVibrato(stringIdx);
      });
    }

    function bindNeckSlide() {
      if (!fretsRoot || !window.PointerSlide?.bindMultiArea || neckSlideCtl) return;
      neckSlideCtl = window.PointerSlide.bindMultiArea(fretsRoot, {
        shouldHandle: (e) => !e.target.closest?.(".move-handle"),
        collectTargets: collectNeckCells,
        onSync: (st, cells, e) => {
          st.pointerId = e.pointerId;
          fretPointers.set(e.pointerId, pointerStateFromCells(cells, e));
          mergeFrettedDisplay();
        },
        onEnd: (st) => {
          if (st.pointerId != null) fretPointers.delete(st.pointerId);
          mergeFrettedDisplay();
        },
      });
    }

    function bindFretCell() {
      /* Perde kaydırma bindNeckSlide ile */
    }

    function buildFretGrid() {
      if (!fretsRoot) return;
      fretsRoot.innerHTML = "";
      fretsRoot.className = "guitar-neck";
      cellMap.clear();
      fretCellsByString = {};
      fretted = {};
      autoFrets = {};
      midiTargets = new Map();

      const header = document.createElement("div");
      header.className = "guitar-fret-header";
      header.innerHTML =
        '<span class="guitar-corner"></span><div class="guitar-fret-cells guitar-fret-header-cells"></div>';
      const nums = header.querySelector(".guitar-fret-header-cells");
      for (let f = 0; f <= FRET_COUNT; f++) {
        const h = document.createElement("span");
        h.className = "guitar-fret-num";
        h.textContent = f === 0 ? "∅" : String(f);
        nums.appendChild(h);
      }
      fretsRoot.appendChild(header);

      DISPLAY_STRINGS.forEach((s, colorIdx) => {
        fretCellsByString[s] = [];
        const row = document.createElement("div");
        row.className = `guitar-string-row ${colorClass(s)}`;
        row.dataset.string = String(s);
        row.style.setProperty("--str-color", STRING_COLORS[colorIdx]);
        row.style.setProperty("--str-thick", `${STRING_THICK[colorIdx]}px`);

        const labelWrap = document.createElement("div");
        labelWrap.className = "guitar-string-label-wrap";
        labelWrap.innerHTML = `<span class="guitar-string-label">${STRING_NAMES[colorIdx]}</span><span class="guitar-neck-active" aria-live="polite"></span>`;
        row.appendChild(labelWrap);

        const lane = document.createElement("div");
        lane.className = "guitar-fret-lane";
        const wire = document.createElement("div");
        wire.className = "guitar-row-wire";
        wire.setAttribute("aria-hidden", "true");
        lane.appendChild(wire);

        const cells = document.createElement("div");
        cells.className = "guitar-fret-cells";

        for (let f = 0; f <= FRET_COUNT; f++) {
          const midi = midiAt(s, f);
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "guitar-cell";
          cell.dataset.midi = String(midi);
          cell.dataset.string = String(s);
          cell.dataset.fret = String(f);
          if (f === 0) cell.classList.add("open-fret");
          cellMap.set(midi, cell);
          const prev = midiTargets.get(midi);
          if (!prev || f < prev.fret) midiTargets.set(midi, { cell, stringIdx: s, fret: f });
          fretCellsByString[s].push(cell);
          cells.appendChild(cell);
        }

        lane.appendChild(cells);
        row.appendChild(lane);
        fretsRoot.appendChild(row);
      });

      range = {
        startMidi: Math.min(...DISPLAY_STRINGS.map((s) => STRING_OPEN[s])),
        endMidi: Math.max(...DISPLAY_STRINGS.map((s) => STRING_OPEN[s] + FRET_COUNT)),
      };
      bindNeckSlide();
    }

    function buildStringPlucks() {
      if (!stringsRoot) return;
      stringsRoot.innerHTML = "";
      stringsRoot.className = "guitar-strings-bundle";
      pluckRows = [];

      pluckBundle = document.createElement("div");
      pluckBundle.className = "strings-bundle-inner guitar-pluck-bundle";

      DISPLAY_STRINGS.forEach((s, colorIdx) => {
        const row = document.createElement("div");
        row.className = `guitar-string string-touch-target ${colorClass(s)}`;
        row.dataset.string = String(s);
        row.dataset.midi = String(STRING_OPEN[s]);
        row.style.setProperty("--str-color", STRING_COLORS[colorIdx]);
        row.style.setProperty("--str-thick", `${STRING_THICK[colorIdx]}px`);
        row.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[colorIdx]}</span><span class="guitar-string-fret">${openStringWord()}</span><span class="guitar-string-line string-line"></span>`;

        const entry = {
          el: row,
          stringIdx: s,
          getMidi: () => currentMidiForString(s),
          onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
          onUp: (m, e) => onNoteUp?.(m, e),
          onVibrate: (intensity) => setNeckVibrato(s, intensity),
          onVibrateEnd: () => clearNeckVibrato(s),
        };
        pluckRows.push(entry);
        pluckBundle.appendChild(row);
      });

      stringsRoot.appendChild(pluckBundle);
      window.StringTouch?.bindPluckBundle(pluckBundle, () => pluckRows, {
        useNearbyTouch: () => stringsNearbyEnabled(),
      });
      updateStringHighlights();
    }

    function buildKeys() {
      buildFretGrid();
      buildStringPlucks();
      applySize();
    }

    function init(fretsEl, stringsEl, wrap, noteDownCb, noteUpCb) {
      fretsRoot = fretsEl;
      stringsRoot = stringsEl;
      wrapEl = wrap;
      onNoteDown = noteDownCb;
      onNoteUp = noteUpCb;
      buildKeys();
    }

    function highlightMidi(midi, on) {
      const target = midiTargets.get(midi);
      if (target?.cell) target.cell.classList.toggle("hit-target", on);
      if (target?.stringIdx != null) {
        const row = pluckRows.find((r) => r.stringIdx === target.stringIdx);
        if (row) row.el.classList.toggle("hit-target", on);
      }
    }

    function flash(midi, type) {
      highlightMidi(midi, type === "good");
      setTimeout(() => highlightMidi(midi, false), 320);
    }

    function pressKey(midi, velocity = 0.85) {
      const target = midiTargets.get(midi);
      if (target) {
        autoFrets[target.stringIdx] = target.fret;
        mergeFrettedDisplay();
      }
      const el = target?.cell || cellMap.get(midi);
      if (el) el.classList.add("active");
      window.AudioEngine.noteOn(midi, velocity, { poly: true });
      onNoteDown?.(midi, velocity);
      if (target?.stringIdx != null) {
        setNeckVibrato(target.stringIdx, 0.35);
        const row = pluckRows.find((r) => r.stringIdx === target.stringIdx)?.el;
        if (row) {
          row.classList.add("active", "string-held", "string-vibrating");
          row.style.setProperty("--vib-intensity", "0.35");
        }
      }
      highlightMidi(midi, true);
    }

    function releaseKey(midi) {
      const target = midiTargets.get(midi);
      const el = target?.cell || cellMap.get(midi);
      if (el) el.classList.remove("active");
      window.AudioEngine.noteOff(midi);
      onNoteUp?.(midi);
      if (target?.stringIdx != null) {
        if (autoFrets[target.stringIdx] != null) {
          delete autoFrets[target.stringIdx];
          mergeFrettedDisplay();
        }
        const rowEntry = pluckRows.find((r) => r.stringIdx === target.stringIdx);
        const ms = window.AudioEngine?.getSustainMs?.() ?? 550;
        if (rowEntry) {
          window.StringTouch?.decayPluckVisual?.(rowEntry, ms);
        } else {
          clearNeckVibrato(target.stringIdx);
        }
      }
      highlightMidi(midi, false);
    }

    function getMidiTarget(midi) {
      return midiTargets.get(midi);
    }

    return {
      id,
      init,
      buildKeys,
      applyLayout,
      getRange,
      releaseAll,
      setKeySize,
      setAutoFit,
      getKeySize,
      refreshLabels,
      highlightMidi,
      flash,
      pressKey,
      releaseKey,
      getMidiTarget,
      getWrap: () => wrapEl,
      getNeckHint: () => (gripAllStrings() ? neckHintGrip : neckHintSingle),
      cardNeckTitle,
      cardPluckTitle,
      pluckTitle,
    };
  })();
}

window.createFrettedInstrument = createFrettedInstrument;


/* === guitar.js === */
/** 6 telli gitar — E A D G B e */
const Guitar = createFrettedInstrument({
  id: "guitar",
  STRING_OPEN: [40, 45, 50, 55, 59, 64],
  STRING_NAMES: ["E", "A", "D", "G", "B", "e"],
  DISPLAY_STRINGS: [5, 4, 3, 2, 1, 0],
  STRING_COLORS: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"],
  STRING_THICK: [1.2, 1.5, 1.85, 2.2, 2.65, 3.2],
  FRET_COUNT: 14,
  gripSettingKey: "guitarGripAllStrings",
  pluckMinVar: "--guitar-pluck-min-w",
  neckHintGrip: "Bir perdeye basınca tüm teller sıkılır (barre)",
  neckHintSingle: "Her tele ayrı perde — parmak altındaki hücreler",
  pluckTitle: "Parmağı kaydırarak tel seçin",
  cardNeckTitle: "Gitar kolu",
  cardPluckTitle: "Teller (titreştir)",
});

window.Guitar = Guitar;


/* === violin.js === */
/** 4 telli keman — G D A E (ince → kalın) */
const Violin = createFrettedInstrument({
  id: "violin",
  STRING_OPEN: [55, 62, 69, 76],
  STRING_NAMES: ["E", "A", "D", "G"],
  DISPLAY_STRINGS: [3, 2, 1, 0],
  STRING_COLORS: ["#f472b6", "#fb923c", "#facc15", "#4ade80"],
  STRING_THICK: [1.4, 1.75, 2.1, 2.5],
  FRET_COUNT: 13,
  gripSettingKey: "violinGripAllStrings",
  pluckMinVar: "--guitar-pluck-min-w",
  neckHintGrip: "Bir pozisyona basınca tüm teller sıkılır",
  neckHintSingle: "Her tele ayrı pozisyon",
  pluckTitle: "Parmağı kaydırarak tel seçin",
  cardNeckTitle: "Keman kolu",
  cardPluckTitle: "Teller (titreştir)",
});

window.Violin = Violin;


/* === string-touch.js === */
/** Tel vuruşu — dokunma alanındaki tüm teller çalar, ayrılınca sustain süresince söner */
const StringTouch = (() => {
  const bundles = new Map();
  const decaying = new Map();

  function resolveMidi(getMidi) {
    return typeof getMidi === "function" ? getMidi() : getMidi;
  }

  function vibratoSens() {
    return window.AppSettings?.load?.()?.stringVibratoSens ?? 1;
  }

  function sustainMs() {
    return window.AudioEngine?.getSustainMs?.() ?? 550;
  }

  function releaseVoice(voiceId) {
    if (voiceId == null) return;
    if (window.AudioEngine.noteOffPluck) window.AudioEngine.noteOffPluck(voiceId);
    else window.AudioEngine.noteOffVoice?.(voiceId);
  }

  function rowsInTouch(rows, e, useNearbyTouch) {
    const nearbyOn =
      typeof useNearbyTouch === "function" ? !!useNearbyTouch(e) : !!useNearbyTouch;
    if (nearbyOn) {
      const area = window.PointerSlide?.touchRect?.(e, 16);
      if (area) {
        const out = [];
        for (const row of rows) {
          const r = row.el.getBoundingClientRect();
          if (window.PointerSlide.rectsIntersect(r, area)) out.push(row);
        }
        return out;
      }
    }
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const el = hit?.closest?.(".string-touch-target");
    const found = el ? rows.find((r) => r.el === el) : null;
    return found ? [found] : [];
  }

  function rowLineEl(row) {
    return (
      row.el.querySelector(".string-line") ||
      row.el.querySelector(".guitar-string-line") ||
      row.el.querySelector(".violin-string-line") ||
      row.el
    );
  }

  function rowVisualState(row) {
    return {
      row,
      el: row.el,
      lineEl: rowLineEl(row),
    };
  }

  function cancelDecay(el) {
    const id = decaying.get(el);
    if (id != null) cancelAnimationFrame(id);
    decaying.delete(el);
  }

  function applyVisualIntensity(rowState, intensity) {
    const light = Math.max(0, intensity);
    rowState.el.style.setProperty("--vib-intensity", String(light));
    rowState.el.classList.toggle("string-vibrating", light > 0.03);
    rowState.el.classList.toggle("active", light > 0.03);
    rowState.lineEl?.style.setProperty("--vib-intensity", String(light));
    rowState.lineEl?.classList.toggle("string-line-active", light > 0.03);
    rowState.row?.onVibrate?.(light);
  }

  function clearRowVisual(rowState) {
    if (!rowState?.el) return;
    cancelDecay(rowState.el);
    rowState.el.classList.remove("active", "string-held", "string-vibrating");
    rowState.el.style.removeProperty("--vib-intensity");
    rowState.lineEl?.classList.remove("string-line-active");
    rowState.lineEl?.style.removeProperty("--vib-intensity");
    rowState.row?.onVibrateEnd?.();
  }

  function decayPluckVisual(rowEntry, durationMs) {
    if (!rowEntry?.el) return;
    const rowState = rowVisualState(rowEntry);
    const ms = Math.max(0, Number(durationMs) || 0);
    if (ms <= 0) {
      clearRowVisual(rowState);
      return;
    }
    cancelDecay(rowEntry.el);
    const startIntensity =
      parseFloat(rowState.el.style.getPropertyValue("--vib-intensity")) || 0.35;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const intensity = startIntensity * (1 - t);
      if (t >= 1) {
        clearRowVisual(rowState);
        return;
      }
      applyVisualIntensity(rowState, intensity);
      decaying.set(rowEntry.el, requestAnimationFrame(tick));
    };
    decaying.set(rowEntry.el, requestAnimationFrame(tick));
  }

  function startRowVoice(st, row, e) {
    cancelDecay(row.el);
    const midi = resolveMidi(row.getMidi);
    if (!midi) return null;

    const vel = window.AudioEngine.velocityFromPointer(e, 0.55);
    const lineEl = rowLineEl(row);
    row.el.classList.add("active", "string-held");
    lineEl?.classList.add("string-line-active");

    const voiceId = window.AudioEngine.noteOn(midi, vel, { poly: true });
    window.AudioEngine.setLiveGain?.(voiceId, vel);
    row.onDown?.(midi, vel, e);

    return {
      row,
      el: row.el,
      lineEl,
      getMidi: row.getMidi,
      midi,
      voiceId,
      baseVel: vel,
      pluck: vel,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      smooth: 0,
    };
  }

  function moveRowVoice(rowState, e) {
    const now = performance.now();
    const dt = Math.max(1, now - rowState.lastT);
    rowState.lastT = now;

    const midi = resolveMidi(rowState.getMidi);
    if (midi !== rowState.midi) {
      window.AudioEngine.setLiveVibrato?.(rowState.voiceId, 0);
      releaseVoice(rowState.voiceId);
      rowState.midi = midi;
      const v = window.AudioEngine.velocityFromPointer(e, rowState.baseVel);
      rowState.voiceId = window.AudioEngine.noteOn(midi, v, { poly: true });
      rowState.baseVel = v;
      rowState.pluck = v;
    }

    const dx = e.clientX - rowState.lastX;
    const dy = e.clientY - rowState.lastY;
    rowState.lastX = e.clientX;
    rowState.lastY = e.clientY;

    const speed = Math.hypot(dx, dy);
    const vSpeed = Math.abs(dy) / dt;
    rowState.smooth = rowState.smooth * 0.55 + speed * 0.45;

    const sens = vibratoSens();
    const depth = Math.min(4, 0.2 + rowState.smooth * 0.12 * sens);
    const hz = 4.5 + Math.min(6, rowState.smooth * 0.14 * sens);
    window.AudioEngine.setLiveVibrato?.(rowState.voiceId, depth, hz);

    const pluckBoost = Math.min(1.85, 0.35 + vSpeed * 0.022 * sens + rowState.smooth * 0.04);
    rowState.pluck = Math.max(rowState.pluck, pluckBoost);
    window.AudioEngine.setLiveGain?.(rowState.voiceId, rowState.pluck);

    const intensity = Math.min(1, rowState.pluck / 1.2);
    applyVisualIntensity(rowState, intensity);
  }

  function releaseRowVoice(rowState, e) {
    if (rowState.voiceId != null) {
      window.AudioEngine.setLiveVibrato?.(rowState.voiceId, 0);
      releaseVoice(rowState.voiceId);
      rowState.row?.onUp?.(rowState.midi, e);
    }
    rowState.el.classList.remove("string-held");
    decayPluckVisual(rowState.row, sustainMs());
  }

  function syncRows(st, rows, e) {
    if (!st.activeRows) st.activeRows = new Map();
    const want = new Set(rows.map((r) => r.el));

    for (const [el, rowState] of [...st.activeRows]) {
      if (want.has(el)) continue;
      releaseRowVoice(rowState, e);
      st.activeRows.delete(el);
    }

    for (const row of rows) {
      let rowState = st.activeRows.get(row.el);
      if (!rowState) {
        rowState = startRowVoice(st, row, e);
        if (rowState) st.activeRows.set(row.el, rowState);
      } else {
        moveRowVoice(rowState, e);
      }
    }
  }

  function releaseAllRows(st, e) {
    if (!st.activeRows) return;
    for (const rowState of st.activeRows.values()) releaseRowVoice(rowState, e);
    st.activeRows.clear();
  }

  function bindPluckBundle(bundleEl, getRows, options = {}) {
    if (!window.PointerSlide?.bindMultiArea) return;
    const ctl = window.PointerSlide.bindMultiArea(bundleEl, {
      collectTargets: (e) => rowsInTouch(getRows(), e, options.useNearbyTouch),
      onSync: (st, rows, e) => syncRows(st, rows, e),
      onEnd: (st, e) => releaseAllRows(st, e),
    });
    if (!bundleEl.__stringTouchGuardBound) {
      bundleEl.__stringTouchGuardBound = true;
      window.addEventListener("blur", () => ctl.releaseAll?.(), { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) ctl.releaseAll?.();
      });
    }
    bundles.set(bundleEl, ctl);
  }

  function bind(el, getMidi, callbacks = {}) {
    bindPluckBundle(el, () => [
      {
        el,
        getMidi,
        onDown: callbacks.onDown,
        onUp: callbacks.onUp,
        onVibrate: callbacks.onVibrate,
        onVibrateEnd: callbacks.onVibrateEnd,
      },
    ]);
  }

  return { bind, bindPluckBundle, decayPluckVisual };
})();

window.StringTouch = StringTouch;


/* === play-surface.js === */
/** Aktif çalma yüzeyi — piyano / gitar / keman */
const PlaySurface = (() => {
  function modeLabel(id) {
    const t = window.I18n?.t?.bind(window.I18n);
    if (!t) return { piano: "Piano", guitar: "Guitar", violin: "Violin" }[id] || id;
    return t(`inst.${id}`);
  }

  const MODES = {
    piano: { icon: "🎹", sound: "piano" },
    guitar: { icon: "🎸", sound: "guitar" },
    violin: { icon: "🎻", sound: "violin" },
  };

  let mode = "piano";
  let noteDownCb = null;
  let noteUpCb = null;

  function activeModule() {
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  function getWrapEl() {
    if (mode === "guitar") return document.getElementById("guitarWrap");
    if (mode === "violin") return document.getElementById("violinWrap");
    return document.getElementById("pianoWrap");
  }

  function showPanel() {
    document.getElementById("pianoWrap")?.classList.toggle("hidden", mode !== "piano");
    document.getElementById("guitarWrap")?.classList.toggle("hidden", mode !== "guitar");
    document.getElementById("violinWrap")?.classList.toggle("hidden", mode !== "violin");
    document.body.dataset.playMode = mode;
    if (window.InstrumentMove) window.InstrumentMove.applyLayout(window.AppSettings.load());
  }

  function setMode(next, opts = {}) {
    const m = MODES[next] ? next : "piano";
    /* label via getModes() */
    if (m === mode && !opts.force) return mode;

    window.Piano?.releaseAll?.();
    window.Guitar?.releaseAll?.();
    window.Violin?.releaseAll?.();
    window.KeyboardInput?.releaseAll?.();

    mode = m;
    showPanel();

    const mod = activeModule();
    if (mod && noteDownCb) {
      if (mode === "piano") {
        mod.init?.(
          document.getElementById("pianoKeys"),
          document.getElementById("pianoWrap"),
          noteDownCb,
          noteUpCb
        );
      } else if (mode === "guitar") {
        mod.init?.(
          document.getElementById("guitarFrets"),
          document.getElementById("guitarStrings"),
          document.getElementById("guitarWrap"),
          noteDownCb,
          noteUpCb
        );
      } else if (mode === "violin") {
        mod.init?.(
          document.getElementById("violinBoard"),
          document.getElementById("violinStrings"),
          document.getElementById("violinWrap"),
          noteDownCb,
          noteUpCb
        );
      }
    }

    if (opts.syncSound !== false) {
      window.AudioEngine?.setInstrument?.(MODES[mode].sound);
    }

    mod?.applyLayout?.();

    window.dispatchEvent(new CustomEvent("touch-piano:play-mode", { detail: { mode } }));
    requestAnimationFrame(() => {
      mod?.applyLayout?.();
      if (window.Game?.isReady?.()) window.Game.resize();
    });
    return mode;
  }

  function getMode() {
    return mode;
  }

  function getModes() {
    const out = {};
    for (const [id, meta] of Object.entries(MODES)) {
      out[id] = { ...meta, label: modeLabel(id) };
    }
    return out;
  }

  function init(noteDown, noteUp) {
    noteDownCb = noteDown;
    noteUpCb = noteUp;
    const s = window.AppSettings?.load?.() || {};
    setMode(s.playMode || "piano", { force: true, syncSound: false });
    if (s.instrumentId) window.AudioEngine?.setInstrument?.(s.instrumentId);
    activeModule()?.applyLayout?.();
    requestAnimationFrame(() => {
      activeModule()?.applyLayout?.();
      window.Game?.refreshView?.() || window.Game?.resize?.();
    });
  }

  function delegate(name, ...args) {
    const mod = activeModule();
    if (mod && typeof mod[name] === "function") return mod[name](...args);
  }

  function flash(midi, type) {
    const mod = activeModule();
    if (mod?.flash) return mod.flash(midi, type);
    if (mod?.highlightMidi) return mod.highlightMidi(midi, type === "good");
  }

  function pressKey(midi, velocity) {
    return delegate("pressKey", midi, velocity);
  }

  function releaseKey(midi) {
    return delegate("releaseKey", midi);
  }

  return {
    init,
    setMode,
    getMode,
    getModes,
    getWrapEl,
    getRange: () => delegate("getRange"),
    releaseAll: () => {
      window.Piano?.releaseAll?.();
      window.Guitar?.releaseAll?.();
      window.Violin?.releaseAll?.();
    },
    buildKeys: (...a) => delegate("buildKeys", ...a),
    setKeySize: (...a) => delegate("setKeySize", ...a),
    setAutoFit: (...a) => delegate("setAutoFit", ...a),
    getKeySize: () => delegate("getKeySize"),
    refreshLabels: () => delegate("refreshLabels"),
    getMidiTarget: (midi) => delegate("getMidiTarget", midi),
    flash,
    pressKey,
    releaseKey,
    activeModule,
  };
})();

window.PlaySurface = PlaySurface;


/* === instrument-move.js === */
/** Enstrüman panellerini sürükleyerek konumlandır (alt kenara sabitli — yukarı büyür) */
const InstrumentMove = (() => {
  let moveMode = false;
  let drag = null;

  const PANELS = {
    guitarFrets: { selector: "#guitarFretsPanel", defaultPos: { x: 1, y: 0 } },
    guitarStrings: { selector: "#guitarStringsPanel", defaultPos: { x: 72, y: 0 } },
    violinBoard: { selector: "#violinBoardPanel", defaultPos: { x: 1, y: 0 } },
    violinStrings: { selector: "#violinStringsPanel", defaultPos: { x: 72, y: 0 } },
  };

  function layoutKey(id) {
    return `panel_${id}`;
  }

  function applyPanelPosition(el, pos) {
    if (!el || !pos) return;
    el.style.left = `${pos.x}%`;
    el.style.top = "auto";
    el.style.bottom = `${pos.y}%`;
  }

  function readPanelY(panel) {
    const bottom = parseFloat(panel.style.bottom);
    if (!Number.isNaN(bottom) && panel.style.bottom) return bottom;
    const top = parseFloat(panel.style.top);
    if (!Number.isNaN(top) && panel.style.top) {
      return Math.max(0, Math.min(92, 100 - top - 14));
    }
    return 0;
  }

  function applyLayout(settings) {
    const layout = settings?.panelLayout || {};
    for (const [id, meta] of Object.entries(PANELS)) {
      const el = document.querySelector(meta.selector);
      if (!el) continue;
      const saved = layout[layoutKey(id)];
      const pos = saved || meta.defaultPos;
      applyPanelPosition(el, pos);
      if (saved?.fromTop && !saved?.migrated) {
        applyPanelPosition(el, {
          x: saved.x,
          y: Math.max(0, Math.min(92, 100 - saved.y - 14)),
        });
      }
    }
  }

  function savePanelPosition(id, x, y) {
    const s = window.AppSettings.load();
    const layout = { ...(s.panelLayout || {}) };
    layout[layoutKey(id)] = {
      x: Math.max(0, Math.min(92, x)),
      y: Math.max(0, Math.min(92, y)),
      anchor: "bottom",
    };
    window.AppSettings.save({ panelLayout: layout });
  }

  function syncMoveBtn() {
    const btn = document.getElementById("btnMoveInstrument");
    if (!btn || !window.I18n) return;
    const on = moveMode;
    btn.classList.toggle("active", on);
    btn.textContent = on ? window.I18n.t("settings.moveSave") : window.I18n.t("settings.move");
  }

  function setMoveMode(on) {
    moveMode = !!on;
    document.body.classList.toggle("instrument-move-mode", moveMode);
    syncMoveBtn();
  }

  function isMoveMode() {
    return moveMode;
  }

  function onPointerDown(e) {
    if (!moveMode) return;
    const handle = e.target.closest(".move-handle");
    if (!handle) return;
    const panel = handle.closest(".movable-panel");
    if (!panel) return;
    e.preventDefault();
    e.stopPropagation();
    const parent = panel.offsetParent || panel.parentElement;
    const pr = parent.getBoundingClientRect();
    const left = parseFloat(panel.style.left) || 0;
    const bottom = readPanelY(panel);
    drag = {
      panel,
      id: panel.dataset.moveId,
      parentW: pr.width,
      parentH: pr.height,
      startX: e.clientX,
      startY: e.clientY,
      origX: left,
      origY: bottom,
    };
    panel.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    const dx = ((e.clientX - drag.startX) / drag.parentW) * 100;
    const dy = ((e.clientY - drag.startY) / drag.parentH) * 100;
    const x = Math.max(0, Math.min(92, drag.origX + dx));
    const y = Math.max(0, Math.min(92, drag.origY - dy));
    drag.panel.style.left = `${x}%`;
    drag.panel.style.top = "auto";
    drag.panel.style.bottom = `${y}%`;
  }

  function onPointerUp(e) {
    if (!drag) return;
    const x = parseFloat(drag.panel.style.left) || 0;
    const y = readPanelY(drag.panel);
    if (drag.id) savePanelPosition(drag.id, x, y);
    try {
      drag.panel.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    drag = null;
    window.Game?.resize?.();
  }

  function bind() {
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("pointermove", onPointerMove, { capture: true });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerUp, { capture: true });
  }

  bind();

  window.addEventListener("staveflow:locale", () => syncMoveBtn());

  return { setMoveMode, isMoveMode, applyLayout, syncMoveBtn };
})();

window.InstrumentMove = InstrumentMove;


/* === keyboard-layout.js === */
/** Klavye düzeni algılama — fiziksel tuş (code) ↔ yazılan harf (key) */
const KeyboardLayout = (() => {
  const LAYOUTS = {
    qwerty: {
      KeyQ: "q", KeyW: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyY: "y", KeyU: "u", KeyI: "i", KeyO: "o", KeyP: "p",
      BracketLeft: "[", BracketRight: "]", Backslash: "\\",
      KeyA: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      Semicolon: ";", Quote: "'",
      KeyZ: "z", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
      Comma: ",", Period: ".", Slash: "/",
      Backquote: "`", Minus: "-", Equal: "=",
      Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4", Digit5: "5",
      Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9", Digit0: "0",
    },
    qwertz: {
      KeyQ: "q", KeyW: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyZ: "z", KeyU: "u", KeyI: "i", KeyO: "o", KeyP: "p",
      KeyA: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      KeyY: "y", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
    },
    azerty: {
      KeyA: "q", KeyZ: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyY: "u", KeyU: "i", KeyI: "o", KeyO: "p",
      KeyQ: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      KeyW: "z", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
    },
    "tr-q": {
      KeyQ: "q", KeyW: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyY: "y", KeyU: "u", KeyI: "ı", KeyO: "o", KeyP: "p",
      KeyA: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      KeyZ: "z", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
      Comma: "ş", Period: "i", Slash: "ö",
    },
    "tr-f": {
      KeyQ: "f", KeyW: "g", KeyE: "ğ", KeyR: "ı", KeyT: "o", KeyY: "d", KeyU: "r", KeyI: "n", KeyO: "h", KeyP: "p",
      BracketLeft: "q", BracketRight: "w",
      KeyA: "u", KeyS: "i", KeyD: "e", KeyF: "a", KeyG: "ü", KeyH: "t", KeyJ: "k", KeyK: "m", KeyL: "l",
      Semicolon: "y", Quote: "ş",
      KeyZ: "x", KeyX: "j", KeyC: "ö", KeyV: "v", KeyB: "c", KeyN: "ç", KeyM: "z",
      Comma: "s", Period: "b", Slash: ".",
    },
  };

  const PROBE_CODES = ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyZ", "BracketRight"];

  let layoutId = "auto";
  const learned = new Map();
  const scores = Object.create(null);
  let layoutMapReady = null;

  function normChar(ch) {
    if (!ch || ch.length !== 1) return "";
    return ch.toLocaleLowerCase("tr");
  }

  function mergeLayout(baseId) {
    const base = LAYOUTS[baseId] || LAYOUTS.qwerty;
    const out = { ...base };
    learned.forEach((ch, code) => {
      out[code] = ch;
    });
    return out;
  }

  function scoreLayout(id, code, key) {
    const expected = LAYOUTS[id]?.[code];
    if (!expected) return;
    if (normChar(expected) === normChar(key)) {
      scores[id] = (scores[id] || 0) + 2;
    }
  }

  function localeGuess() {
    const lang = (navigator.language || "").toLowerCase();
    if (lang.startsWith("tr")) return "tr-f";
    if (lang.startsWith("de") || lang.startsWith("at") || lang.startsWith("ch")) return "qwertz";
    if (lang.startsWith("fr")) return "azerty";
    return "qwerty";
  }

  function getDetectedId() {
    if (layoutId !== "auto") return layoutId;

    let best = null;
    let bestScore = 0;
    for (const [id, s] of Object.entries(scores)) {
      if (s > bestScore) {
        bestScore = s;
        best = id;
      }
    }
    if (best && bestScore >= 4) return best;
    if (learned.size >= 4) return "learned";
    return localeGuess();
  }

  function getActiveMap() {
    const id = getDetectedId();
    if (id === "learned") return mergeLayout(localeGuess());
    return mergeLayout(id);
  }

  function charForCode(code) {
    const map = getActiveMap();
    return map[code] || LAYOUTS.qwerty[code] || null;
  }

  function codeForChar(char) {
    const target = normChar(char);
    if (!target) return null;

    for (const [code, ch] of learned) {
      if (normChar(ch) === target) return code;
    }

    const map = getActiveMap();
    for (const [code, ch] of Object.entries(map)) {
      if (normChar(ch) === target) return code;
    }

    for (const [code, ch] of Object.entries(LAYOUTS.qwerty)) {
      if (normChar(ch) === target) return code;
    }
    return null;
  }

  function learnFromEvent(code, key) {
    if (!code || !key || key.length !== 1) return;
    if (key === "Dead" || key === "Unidentified" || key === "Process") return;

    learned.set(code, key);
    for (const id of Object.keys(LAYOUTS)) scoreLayout(id, code, key);

    const detected = getDetectedId();
    if (window.AppSettings && layoutId === "auto") {
      try {
        window.AppSettings.save({ keyboardLayoutDetected: detected });
      } catch {
        /* ignore */
      }
    }
  }

  function setLayoutId(id) {
    layoutId = id || "auto";
    if (id === "auto") return;
    learned.clear();
    for (const k of Object.keys(scores)) delete scores[k];
  }

  function getLayoutId() {
    return layoutId;
  }

  function getDetectedLabel() {
    const id = getDetectedId();
    const labels = {
      qwerty: "QWERTY",
      qwertz: "QWERTZ",
      azerty: "AZERTY",
      "tr-q": "Türkçe Q",
      "tr-f": "Türkçe F",
      learned: "Öğrenildi",
    };
    return labels[id] || id;
  }

  async function tryLayoutMapApi() {
    if (!navigator.keyboard?.getLayoutMap) return;
    try {
      const map = await navigator.keyboard.getLayoutMap();
      for (const code of PROBE_CODES) {
        const ch = map.get(code);
        if (ch) learnFromEvent(code, ch);
      }
      layoutMapReady = true;
    } catch {
      /* izin yok veya desteklenmiyor */
    }
  }

  function loadLearned(obj) {
    learned.clear();
    if (!obj || typeof obj !== "object") return;
    for (const [code, ch] of Object.entries(obj)) {
      if (code && ch) learned.set(code, String(ch).slice(0, 1));
    }
  }

  function getLearnedObject() {
    const o = {};
    learned.forEach((ch, code) => {
      o[code] = ch;
    });
    return o;
  }

  tryLayoutMapApi();

  return {
    charForCode,
    codeForChar,
    learnFromEvent,
    setLayoutId,
    getLayoutId,
    getDetectedId,
    getDetectedLabel,
    loadLearned,
    getLearnedObject,
    LAYOUTS,
  };
})();

window.KeyboardLayout = KeyboardLayout;


/* === keyboard-input.js === */
/** Bilgisayar klavyesi → piyano (oktav değişince yeniden eşleme) */
const KeyboardInput = (() => {
  const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  /** Beyaz tuş sırası → fiziksel klavye konumu (US taban) */
  const WHITE_CODES = [
    "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM",
    "Comma", "KeyL", "Period", "Semicolon", "Slash",
    "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP",
    "BracketLeft", "BracketRight", "Backslash",
    "Digit1", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
    "Minus", "Equal",
  ];

  const BLACK_CODES = [
    "KeyS", "KeyD", "KeyG", "KeyH", "KeyJ",
    "KeyU", "KeyO", "KeyI", "KeyP",
    "KeyY", "KeyT", "KeyR", "KeyE", "KeyW", "KeyQ",
    "Digit2", "Digit3", "Digit5", "Digit6", "Digit7", "Digit9", "Digit0",
    "Minus", "Equal", "Backquote", "BracketLeft", "BracketRight",
  ];

  let enabled = true;
  let codeToMidi = new Map();
  let charToMidi = new Map();
  let held = new Set();
  let bound = false;

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function usesLetterMapping() {
    const mode = window.KeyLabels?.getMode?.();
    return mode === "letters" || mode === "custom" || window.KeyLabels?.hasMidiLabels?.();
  }

  function releaseAll() {
    for (const midi of [...held]) {
      held.delete(midi);
      window.Piano?.releaseKey?.(midi);
    }
  }

  function isPlayableLabel(text) {
    return text && text !== "·" && text !== "?" && text.length === 1;
  }

  function codeForWhiteSlot(slot, label, usedCodes) {
    let code = window.KeyboardLayout?.codeForChar?.(label) || null;
    if (!code || usedCodes.has(code)) {
      code = WHITE_CODES[slot] || null;
    }
    return code;
  }

  function bindLetterMappings(range, whites, blacks) {
    const usedCodes = new Set();
    const seenChars = new Set();

    whites.forEach((midi, slot) => {
      const label = window.KeyLabels?.labelForMidi?.(midi, range.startMidi, range.endMidi);
      if (!isPlayableLabel(label)) return;

      const code = codeForWhiteSlot(slot, label, usedCodes);
      if (code) {
        codeToMidi.set(code, midi);
        usedCodes.add(code);
      }

      const lower = label.toLocaleLowerCase("tr");
      const upper = label.toLocaleUpperCase("tr");
      if (!seenChars.has(lower)) {
        charToMidi.set(lower, midi);
        charToMidi.set(upper, midi);
        seenChars.add(lower);
      }
    });

    blacks.forEach((midi, slot) => {
      const label = window.KeyLabels?.labelForMidi?.(midi, range.startMidi, range.endMidi);
      if (!isPlayableLabel(label)) return;

      let code = window.KeyboardLayout?.codeForChar?.(label) || null;
      if (!code || usedCodes.has(code)) code = BLACK_CODES[slot] || null;
      if (!code) return;

      codeToMidi.set(code, midi);
      usedCodes.add(code);

      const lower = label.toLocaleLowerCase("tr");
      const upper = label.toLocaleUpperCase("tr");
      if (!seenChars.has(lower)) {
        charToMidi.set(lower, midi);
        charToMidi.set(upper, midi);
        seenChars.add(lower);
      }
    });
  }

  function rebuild() {
    releaseAll();
    codeToMidi.clear();
    charToMidi.clear();
    if (!window.Piano) return;

    const range = window.Piano.getRange();
    const whites = [];
    const blacks = [];

    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PC.includes(m % 12)) whites.push(m);
      else blacks.push(m);
    }

    if (usesLetterMapping()) {
      bindLetterMappings(range, whites, blacks);
    } else {
      whites.forEach((midi, i) => {
        if (WHITE_CODES[i]) codeToMidi.set(WHITE_CODES[i], midi);
      });
      blacks.forEach((midi, i) => {
        if (BLACK_CODES[i]) codeToMidi.set(BLACK_CODES[i], midi);
      });
    }
  }

  function resolveMidiFromChar(key) {
    if (!key || key.length !== 1) return null;
    const upper = key.toLocaleUpperCase("tr");
    const lower = key.toLocaleLowerCase("tr");
    if (charToMidi.has(upper)) return charToMidi.get(upper);
    if (charToMidi.has(lower)) return charToMidi.get(lower);
    if (charToMidi.has(key)) return charToMidi.get(key);
    return null;
  }

  function resolveMidi(e) {
    window.KeyboardLayout?.learnFromEvent?.(e.code, e.key);

    if (usesLetterMapping()) {
      if (codeToMidi.has(e.code)) return codeToMidi.get(e.code);
      const fromChar = resolveMidiFromChar(e.key);
      if (fromChar != null) return fromChar;
      return null;
    }

    if (codeToMidi.has(e.code)) return codeToMidi.get(e.code);
    return resolveMidiFromChar(e.key);
  }

  function noteOn(midi) {
    if (midi == null || held.has(midi)) return;
    if (!window.Piano?.midiInRange?.(midi)) return;
    held.add(midi);
    window.Piano.pressKey(midi, 0.85);
  }

  function noteOff(midi) {
    if (!held.has(midi)) return;
    held.delete(midi);
    window.Piano.releaseKey(midi);
  }

  function onKeyDown(e) {
    if (!enabled) return;
    if (e.repeat) return;
    if (isTypingTarget(e.target)) return;
    if (e.code === "F11" || e.code === "Escape") return;

    const midi = resolveMidi(e);
    if (midi == null) return;

    e.preventDefault();
    noteOn(midi);
  }

  function onKeyUp(e) {
    if (!enabled) return;
    if (isTypingTarget(e.target)) return;

    const midi = resolveMidi(e);
    if (midi == null) return;

    e.preventDefault();
    noteOff(midi);
  }

  function onBlur() {
    releaseAll();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) releaseAll();
  }

  function bind() {
    if (bound) return;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    bound = true;
  }

  function unbind() {
    if (!bound) return;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    releaseAll();
    bound = false;
  }

  return {
    bind,
    unbind,
    rebuild,
    releaseAll,
    setEnabled,
    isEnabled: () => enabled,
    getHeldCount: () => held.size,
  };
})();

window.KeyboardInput = KeyboardInput;


/* === game.js === */
/** Düşen notalar — stiller, renkler, süre */
const Game = (() => {
  const NOTE_HEIGHT_PX = 14;
  const LOOKAHEAD_SEC = 3;
  const HIT_LINE_FALLBACK = 0.88;

  let canvas, ctx;
  let notes = [];
  let pendingHits = [];
  let particles = [];
  let playing = false;
  let startTime = 0;
  let pausedAt = 0;
  let speed = 1;
  let animId = null;
  let timingWindowMs = 200;
  let score = 0;
  let combo = 0;
  let songDuration = 0;
  let flameIntensity = 1;
  let flameStyleId = "aurora";
  let trimStartSec = 0;
  let trimEndSec = 0;
  const keyAuras = new Map();
  const impactCooldown = new Map();
  let onScoreChange = null;
  let onFeedback = null;
  let onTimeUpdate = null;
  let keyPositions = new Map();
  let lastFrameT = 0;
  let autoPlayMode = false;
  let skyStars = [];
  let skySize = { w: 0, h: 0 };

  function effectHue() {
    const v = window.__effectHue;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    const css = getComputedStyle(document.documentElement).getPropertyValue("--effect-hue");
    const n = Number(css);
    return Number.isNaN(n) ? 275 : n;
  }

  function rebuildSky(w, h) {
    if (w === skySize.w && h === skySize.h && skyStars.length) return;
    skySize = { w, h };
    const count = Math.min(320, Math.floor((w * h) / 3800));
    skyStars = [];
    for (let i = 0; i < count; i++) {
      skyStars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.94,
        r: Math.random() * 1.5 + 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 1.4,
        bright: 0.3 + Math.random() * 0.7,
      });
    }
  }

  function drawStars(w, h, t) {
    for (const s of skyStars) {
      const tw = s.bright * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      const a = tw * 0.9;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.1 && tw > 0.75) {
        ctx.fillStyle = `rgba(200,220,255,${a * 0.35})`;
        ctx.fillRect(s.x - 2, s.y, 4, 0.5);
        ctx.fillRect(s.x, s.y - 2, 0.5, 4);
      }
    }
  }

  function drawAurora(w, h, t, hue) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const bands = [
      { y: h * 0.18, amp: h * 0.09, alpha: 0.14, speed: 0.22, hueOff: -28 },
      { y: h * 0.32, amp: h * 0.11, alpha: 0.11, speed: 0.17, hueOff: 18 },
      { y: h * 0.48, amp: h * 0.08, alpha: 0.09, speed: 0.28, hueOff: -55 },
    ];
    for (const band of bands) {
      const h1 = (hue + band.hueOff + 360) % 360;
      const h2 = (hue + band.hueOff + 42) % 360;
      const grad = ctx.createLinearGradient(0, band.y - band.amp, 0, band.y + band.amp * 1.6);
      grad.addColorStop(0, `hsla(${h1}, 72%, 58%, 0)`);
      grad.addColorStop(0.35, `hsla(${h1}, 78%, 62%, ${band.alpha})`);
      grad.addColorStop(0.55, `hsla(${h2}, 85%, 68%, ${band.alpha * 1.15})`);
      grad.addColorStop(1, `hsla(${h2}, 70%, 52%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, band.y);
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const x = (w / steps) * i;
        const wave =
          Math.sin(x * 0.004 + t * band.speed) * band.amp * 0.55 +
          Math.sin(x * 0.009 - t * band.speed * 0.7) * band.amp * 0.35;
        ctx.lineTo(x, band.y + wave);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function stringLabelForMode(mode, stringIdx) {
    if (mode === "guitar") {
      const names = ["E", "A", "D", "G", "B", "e"];
      return names[stringIdx] ?? String(stringIdx);
    }
    if (mode === "violin") {
      const names = ["G", "D", "A", "E"];
      return names[stringIdx] ?? String(stringIdx);
    }
    return "";
  }

  function init(canvasEl, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
    onScoreChange = callbacks.onScoreChange;
    onFeedback = callbacks.onFeedback;
    onTimeUpdate = callbacks.onTimeUpdate;
    resize();
    window.addEventListener("resize", resize);
    const observeTargets = [
      document.getElementById("instrumentFooter"),
      document.getElementById("pianoWrap"),
      document.getElementById("pianoKeys"),
      document.getElementById("guitarWrap"),
      document.getElementById("guitarFrets"),
      document.getElementById("violinWrap"),
      document.getElementById("violinBoard"),
    ].filter(Boolean);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        resize();
        updateKeyPositions();
      });
      for (const el of observeTargets) ro.observe(el);
    }
    window.addEventListener("touch-piano:play-mode", () => {
      const sync = () => {
        resize();
        updateKeyPositions();
        if (!playing) draw(pausedAt || 0);
      };
      requestAnimationFrame(sync);
      setTimeout(sync, 100);
      setTimeout(sync, 400);
    });
    window.addEventListener("staveflow:booted", () => {
      setTimeout(() => resize(), 50);
      setTimeout(() => resize(), 400);
    });
  }

  function setFlameIntensity(level) {
    flameIntensity = Math.max(0.3, Math.min(2, level));
  }

  function setFlameStyle(styleId) {
    flameStyleId = styleId || "aurora";
    window.FlameStyles?.setStyle(flameStyleId);
  }

  function setTrim(startSec, endSec) {
    trimStartSec = Math.max(0, Number(startSec) || 0);
    trimEndSec = Math.max(0, Number(endSec) || 0);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function emitTime(t) {
    const total = songDuration || 0;
    const remaining = Math.max(0, total - t);
    onTimeUpdate?.({
      current: t,
      total,
      remaining,
      currentText: formatTime(t),
      totalText: formatTime(total),
      remainingText: formatTime(remaining),
      percent: total > 0 ? Math.min(100, (t / total) * 100) : 0,
    });
  }

  function isReady() {
    return !!(canvas && canvas.parentElement);
  }

  function resize() {
    if (!canvas?.parentElement) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth * devicePixelRatio;
    canvas.height = parent.clientHeight * devicePixelRatio;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    rebuildSky(parent.clientWidth, parent.clientHeight);
    positionHitLine();
  }

  function getPlaySurfaceEl() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar") {
      return (
        document.getElementById("guitarFrets") ||
        document.getElementById("guitarWrap")
      );
    }
    if (mode === "violin") {
      return (
        document.getElementById("violinBoard") ||
        document.getElementById("violinWrap")
      );
    }
    return document.getElementById("pianoKeys") || document.getElementById("pianoWrap");
  }

  function getHitY() {
    const area = canvas?.parentElement;
    if (!area) return 400;
    const mode = window.PlaySurface?.getMode?.() || "piano";
    const ar = area.getBoundingClientRect();

    let target = getPlaySurfaceEl();
    if (mode === "guitar") {
      target =
        document.getElementById("guitarFrets") ||
        document.getElementById("guitarWrap") ||
        target;
    } else if (mode === "violin") {
      target =
        document.getElementById("violinBoard") ||
        document.getElementById("violinWrap") ||
        target;
    }

    if (!target || target.closest(".hidden")) {
      return area.clientHeight * HIT_LINE_FALLBACK;
    }

    const pr = target.getBoundingClientRect();
    if (pr.height < 4) {
      return area.clientHeight * HIT_LINE_FALLBACK;
    }

    let y = Math.round(pr.top - ar.top - 3);

    // Alt satır dock: enstrüman oyun alanının altında — çizgiyi klavye üstüne sabitle
    if (y > area.clientHeight - 8) {
      const footer = document.getElementById("instrumentFooter");
      const fr = footer?.getBoundingClientRect();
      if (fr && fr.height > 8) {
        y = Math.round(fr.top - ar.top - 3);
      }
    }

    return Math.max(56, Math.min(area.clientHeight - 6, y));
  }

  function positionHitLine() {
    const line = document.getElementById("hitLine");
    if (!line) return;
    const y = getHitY();
    line.style.top = `${y - 2}px`;
  }

  function updateKeyPositions() {
    keyPositions.clear();
    if (!canvas?.parentElement) return;
    const surface = window.PlaySurface;
    if (!surface) return;
    const range = surface.getRange();
    if (!range) return;
    const mode = surface.getMode();
    const area = canvas.parentElement;
    const areaRect = area.getBoundingClientRect();

    if (mode === "guitar" || mode === "violin") {
      const mod = surface.activeModule?.();
      const midis = new Set();
      document.querySelectorAll(".guitar-neck .guitar-cell").forEach((key) => {
        const midi = Number(key.dataset.midi);
        if (midi >= range.startMidi && midi <= range.endMidi) midis.add(midi);
      });
      for (const midi of midis) {
        const target = mod?.getMidiTarget?.(midi);
        const cell = target?.cell;
        if (!cell) continue;
        const r = cell.getBoundingClientRect();
        const centerX = r.left + r.width / 2 - areaRect.left;
        const fret = target.fret;
        const stringIdx = target.stringIdx;
        const label = `${stringLabelForMode(mode, stringIdx)}${fret}`;
        const laneColor =
          getComputedStyle(cell).getPropertyValue("--str-color")?.trim() || null;
        keyPositions.set(midi, { x: centerX, w: r.width, fret, label, laneColor });
      }
      return;
    }

    let selector = ".piano-keys .key";
    document.querySelectorAll(selector).forEach((key) => {
      const midi = Number(key.dataset.midi);
      if (!midi || midi < range.startMidi || midi > range.endMidi) return;
      const r = key.getBoundingClientRect();
      const centerX = r.left + r.width / 2 - areaRect.left;
      keyPositions.set(midi, { x: centerX, w: r.width });
    });
  }

  function clearAutoFlags() {
    for (const n of notes) {
      n._autoStarted = false;
      n._autoEnded = false;
    }
  }

  function setAutoPlayMode(on) {
    autoPlayMode = !!on;
    clearAutoFlags();
  }

  function isAutoPlayMode() {
    return autoPlayMode;
  }

  function releaseAllSound() {
    window.AudioEngine?.stopAll?.();
    window.PlaySurface?.releaseAll?.();
    window.KeyboardInput?.releaseAll?.();
  }

  function loadNotes(trackNotes, range) {
    stop();
    particles = [];
    keyAuras.clear();
    let list = trackNotes;
    if (window.NoteUtils?.cleanupNotes) {
      list = window.NoteUtils.cleanupNotes(trackNotes);
    }
    if (list.length && (trimStartSec > 0 || trimEndSec > 0)) {
      const rawEnd =
        list.length > 0 ? Math.max(...list.map((n) => n.time + n.duration)) : 0;
      const endLimit = Math.max(0, rawEnd - trimEndSec);
      list = list
        .filter((n) => n.time >= trimStartSec && n.time + n.duration <= endLimit + 0.001)
        .map((n) => ({
          ...n,
          time: Math.max(0, n.time - trimStartSec),
        }));
    }
    notes = list
      .filter((n) => n.midi >= range.startMidi && n.midi <= range.endMidi)
      .map((n) => ({
        midi: n.midi,
        time: n.time,
        duration: Math.max(0.08, n.duration),
        velocity: n.velocity,
        hit: false,
        missed: false,
        _autoStarted: false,
        _autoEnded: false,
      }))
      .sort((a, b) => a.time - b.time);

    pendingHits = notes.map((n) => ({ ...n, id: `${n.midi}-${n.time}` }));
    songDuration =
      notes.length > 0
        ? Math.max(...notes.map((n) => n.time + n.duration)) + 1.5
        : 0;
    score = 0;
    combo = 0;
    emitScore();
    emitTime(0);
    updateKeyPositions();
    draw(0);
  }

  function spawnFlame(x, y, w, count, hot, midi) {
    const style = window.FlameStyles?.getStyle();
    const n = Math.floor(count * flameIntensity);
    for (let i = 0; i < n; i++) {
      const p = {
        x: x + (Math.random() - 0.5) * w,
        y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.5 - Math.random() * 2.5,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: 2 + Math.random() * 4,
        hot: hot !== false,
        midi: midi || 0,
      };
      style?.particle?.(p, p.hot);
      particles.push(p);
    }
  }

  function spawnHitBurst(x, y, midi) {
    const style = window.FlameStyles?.getStyle();
    for (let i = 0; i < 18 * flameIntensity; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      const p = {
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3 + Math.random() * 5,
        hot: true,
        midi: midi || 0,
      };
      style?.particle?.(p, true);
      particles.push(p);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.08;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = (p.life / p.maxLife) * 0.9;
      const rgb = p.rgb || "200,120,255";
      if (p.star) {
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        ctx.fillRect(p.x, p.y - 2, 1, 4);
        ctx.fillRect(p.x - 2, p.y, 4, 1);
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBackground(w, h, t) {
    rebuildSky(w, h);
    const hue = effectHue();

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#010208");
    sky.addColorStop(0.35, "#060a18");
    sky.addColorStop(0.72, "#0a1028");
    sky.addColorStop(1, "#0c1430");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    drawAurora(w, h, t, hue);
    drawStars(w, h, t);

    const hitY = getHitY();
    const vig = ctx.createRadialGradient(w * 0.5, hitY * 0.55, w * 0.12, w * 0.5, hitY, w * 0.95);
    vig.addColorStop(0, "rgba(40, 60, 120, 0.05)");
    vig.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createLinearGradient(0, hitY - 60, 0, hitY + 35);
    glow.addColorStop(0, "rgba(168, 85, 247, 0)");
    glow.addColorStop(0.4, `hsla(${hue}, 80%, 68%, ${0.12 + Math.sin(t * 2.6) * 0.04})`);
    glow.addColorStop(1, `hsla(${hue}, 70%, 48%, 0.28)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, hitY - 65, w, 100);

    ctx.strokeStyle = "rgba(216, 180, 254, 0.9)";
    ctx.lineWidth = 2;
    ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.85)`;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function play() {
    if (!notes.length) return;
    window.AudioEngine.ensure();
    clearAutoFlags();
    keyAuras.clear();
    updateKeyPositions();
    playing = true;
    startTime = performance.now() / 1000 - pausedAt;
    lastFrameT = currentTime();
    tick();
  }

  function stop() {
    playing = false;
    pausedAt = 0;
    autoPlayMode = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    releaseAllSound();
    clearAutoFlags();
    keyAuras.clear();
    draw(0);
    emitTime(0);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    pausedAt = currentTime();
    if (animId) cancelAnimationFrame(animId);
    releaseAllSound();
    emitTime(pausedAt);
  }

  function currentTime() {
    if (!playing && pausedAt) return pausedAt;
    return (performance.now() / 1000 - startTime) * speed;
  }

  function setSpeed(s) {
    const t = currentTime();
    speed = s;
    if (playing) {
      startTime = performance.now() / 1000 - t / speed;
    } else {
      pausedAt = t;
    }
  }

  function resetNoteStatesFrom(timeSec) {
    for (const n of notes) {
      n.hit = n.time < timeSec - 0.02;
      n.missed = false;
      n._autoStarted = n.time < timeSec;
      n._autoEnded = n.time + n.duration < timeSec;
      n._impactDone = n.time < timeSec;
    }
    pendingHits = notes.map((n) => ({ ...n, id: `${n.midi}-${n.time}` }));
    impactCooldown.clear();
    keyAuras.clear();
    particles = particles.filter((p) => p.life > 0.05);
  }

  function seekTo(sec) {
    const total = songDuration || 0;
    const t = Math.max(0, Math.min(total, Number(sec) || 0));
    pausedAt = t;
    if (playing) {
      startTime = performance.now() / 1000 - t / speed;
    }
    lastFrameT = t;
    resetNoteStatesFrom(t);
    window.AudioEngine?.stopAll?.();
    emitTime(t);
    draw(t);
  }

  function getCurrentTime() {
    return currentTime();
  }

  function setTimingWindow(ms) {
    timingWindowMs = ms;
  }

  function playInstrumentApi() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  function processAutoPlay(t) {
    if (!autoPlayMode || !playing) return;
    const inst = playInstrumentApi();
    const sound = window.PlaySurface?.getModes?.()?.[window.PlaySurface.getMode()]?.sound;
    if (sound) window.AudioEngine?.setInstrument?.(sound);
    for (const n of notes) {
      if (!n._autoStarted && t >= n.time) {
        n._autoStarted = true;
        const vel = Math.max(0.2, Math.min(1, n.velocity ?? 0.75));
        inst?.pressKey?.(n.midi, vel);
        boostKeyAura(n.midi, 1);
      }
      if (n._autoStarted && !n._autoEnded && t >= n.time + n.duration) {
        n._autoEnded = true;
        inst?.releaseKey?.(n.midi);
      }
      if (n._autoStarted && t >= n.time && !n.hit) {
        n.hit = true;
      }
    }
  }

  /** Çubuk vuruş çizgisindeyken sürekli aurora */
  function syncHeldLineEffects(t) {
    for (const n of notes) {
      if (t < n.time || t >= n.time + n.duration) continue;
      boostKeyAura(n.midi, 0.2);
      const pos = keyPositions.get(n.midi);
      if (!pos) continue;
      const aura = keyAuras.get(n.midi);
      if (aura) {
        aura.life = 1;
        aura.power = Math.min(1, aura.power + 0.05);
      }
    }
  }

  function boostKeyAura(midi, amount = 0.8) {
    const pos = keyPositions.get(midi);
    if (!pos) return;
    const prev = keyAuras.get(midi);
    keyAuras.set(midi, {
      x: pos.x,
      w: pos.w,
      power: Math.min(1, (prev?.power || 0) + amount),
      life: 1,
    });
  }

  function updateKeyAuras(dt) {
    for (const [midi, a] of keyAuras) {
      a.life -= dt * 1.8;
      a.power *= 0.92;
      if (a.life <= 0 || a.power < 0.03) keyAuras.delete(midi);
    }
    document.querySelectorAll(".piano-keys .key.active").forEach((el) => {
      const midi = Number(el.dataset.midi);
      const pos = keyPositions.get(midi);
      if (!pos) return;
      keyAuras.set(midi, {
        x: pos.x,
        w: pos.w,
        power: 1,
        life: 1,
      });
    });
  }

  function checkNoteImpacts(t, hitY, pxPerSec) {
    const NR = window.NoteRenderer;
    if (!NR?.spawnImpactParticles) return;
    for (const n of notes) {
      if (n.hit || n.missed || n._impactDone) continue;
      const dist = (n.time - t) * pxPerSec;
      if (dist > 0 && dist < 6) {
        n._impactDone = true;
        const pos = keyPositions.get(n.midi);
        if (!pos) continue;
        const key = `${n.midi}-${Math.floor(n.time * 20)}`;
        if (impactCooldown.has(key)) continue;
        impactCooldown.set(key, t);
        NR.spawnImpactParticles(particles, pos.x, hitY, pos.w, n.midi, 14);
        boostKeyAura(n.midi, 0.7);
        window.Piano?.flash?.(n.midi, "good");
      }
    }
    for (const [k, when] of impactCooldown) {
      if (t - when > 0.5) impactCooldown.delete(k);
    }
  }

  function tick() {
    if (!playing) return;
    const t = currentTime();
    const dt = Math.min(0.05, t - lastFrameT || 0.016);
    lastFrameT = t;
    processAutoPlay(t);
    syncHeldLineEffects(t);
    if (!autoPlayMode) checkMisses(t);
    draw(t, dt);
    emitTime(t);
    if (songDuration > 0 && t >= songDuration) {
      playing = false;
      window.AudioEngine?.stopAll?.();
      onFeedback?.("complete");
      emitTime(songDuration);
      return;
    }
    animId = requestAnimationFrame(tick);
  }

  function checkMisses(t) {
    const windowSec = timingWindowMs / 1000;
    for (const n of pendingHits) {
      if (n.hit || n.missed) continue;
      if (t > n.time + windowSec) {
        n.missed = true;
        combo = 0;
        onFeedback?.("miss");
        window.PlaySurface?.flash?.(n.midi, "miss");
        emitScore();
      }
    }
  }

  function handleKeyPress(midi) {
    if (autoPlayMode) return false;
    if (!playing && !pausedAt) return false;
    const t = currentTime();
    const windowSec = timingWindowMs / 1000;

    let best = null;
    let bestDelta = Infinity;
    for (const n of pendingHits) {
      if (n.hit || n.missed || n.midi !== midi) continue;
      const delta = Math.abs(t - n.time);
      if (delta <= windowSec && delta < bestDelta) {
        best = n;
        bestDelta = delta;
      }
    }

    if (!best) return false;

    best.hit = true;
    const points = Math.round(100 + Math.max(0, 50 - bestDelta * 200));
    combo += 1;
    score += points + combo * 5;
    onFeedback?.("good", points);

    const pos = keyPositions.get(midi);
    const hitY = getHitY();
    if (pos) {
      window.NoteRenderer?.spawnImpactParticles?.(particles, pos.x, hitY, pos.w, midi, 18);
      spawnHitBurst(pos.x, hitY - 4, midi);
      boostKeyAura(midi, 1);
    }

    window.PlaySurface?.flash?.(midi, "good");
    emitScore();
    return true;
  }

  function emitScore() {
    onScoreChange?.({ score, combo });
  }

  function draw(t, dt = 0.016) {
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    updateParticles(dt);
    drawBackground(w, h, t);

    const hitY = getHitY();
    const pxPerSec = hitY / LOOKAHEAD_SEC;
    positionHitLine();
    const NR = window.NoteRenderer;

    updateKeyAuras(dt);
    checkNoteImpacts(t, hitY, pxPerSec);
    NR?.drawKeyAuroras?.(ctx, keyAuras, hitY, w, t);

    const seenLanes = new Set();
    const mode = window.PlaySurface?.getMode?.() || "piano";
    for (const n of notes) {
      if (n.time > t + LOOKAHEAD_SEC || n.time + n.duration < t - 0.2) continue;
      const pos = keyPositions.get(n.midi);
      if (!pos || seenLanes.has(n.midi)) continue;
      seenLanes.add(n.midi);
      NR?.drawLane(ctx, pos.x, pos.w, h, hitY, n.midi, t, pos.laneColor);
    }

    for (const n of notes) {
      if (n.time > t + LOOKAHEAD_SEC || n.time + n.duration < t - 0.2) continue;
      const pos = keyPositions.get(n.midi);
      if (!pos) continue;

      const noteBottom = hitY - (n.time - t) * pxPerSec;
      const noteH = Math.max(NOTE_HEIGHT_PX, n.duration * pxPerSec);
      const width = pos.w * 0.92;
      const x = pos.x - width / 2;
      const y = noteBottom - noteH;
      const state = n.hit ? "hit" : n.missed ? "miss" : "pending";

      if (NR) {
        NR.drawNote(ctx, {
          x,
          y,
          w: width,
          h: noteH,
          midi: n.midi,
          vel: n.velocity,
          state,
          styleId: flameStyleId,
          intensity: flameIntensity,
          time: t,
          laneColor: pos.laneColor,
        });
      }
      if ((mode === "guitar" || mode === "violin") && pos.label) {
        ctx.save();
        ctx.font = "10px Segoe UI";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.textAlign = "center";
        ctx.fillText(pos.label, x + width / 2, y + Math.min(12, noteH - 2));
        ctx.restore();
      }

    }

    drawParticles();
  }

  function resetScore() {
    score = 0;
    combo = 0;
    emitScore();
  }

  function resetRound() {
    autoPlayMode = false;
    stop();
    particles = [];
    impactCooldown.clear();
    for (const n of notes) {
      n.hit = false;
      n.missed = false;
      n._autoStarted = false;
      n._autoEnded = false;
      n._impactDone = false;
    }
    pendingHits = notes.map((n) => ({ ...n, id: `${n.midi}-${n.time}` }));
    resetScore();
    draw(0);
  }

  return {
    init,
    loadNotes,
    play,
    stop,
    pause,
    setSpeed,
    setTimingWindow,
    setFlameIntensity,
    setFlameStyle,
    setTrim,
    setAutoPlayMode,
    isAutoPlayMode,
    handleKeyPress,
    resetScore,
    resetRound,
    getSongDuration: () => songDuration,
    getCurrentTime,
    seekTo,
    isPlaying: () => playing,
    hasNotes: () => notes.length > 0,
    isReady,
    resize: () => {
      resize();
      updateKeyPositions();
    },
    refreshView: () => {
      resize();
      updateKeyPositions();
      const t = playing ? currentTime() : pausedAt || 0;
      draw(t, 0);
    },
  };
})();

window.Game = Game;


/* === library.js === */
/** Kütüphane ve şarkı verisi */
const LibraryStore = (() => {
  let data = { libraries: [] };
  let activeLibraryId = null;
  let activeSongId = null;
  let parsedMidi = null;
  let selectedTrackIndex = 0;

  async function load() {
    data = await window.pianoApi.getLibraries();
    if (!data.libraries) data = { libraries: [] };
    return data;
  }

  async function save() {
    await window.pianoApi.saveLibraries(data);
  }

  function createLibrary(name) {
    const lib = {
      id: `lib-${Date.now()}`,
      name: name.trim(),
      songs: [],
      createdAt: new Date().toISOString(),
    };
    data.libraries.push(lib);
    return lib;
  }

  function dataPushStarter(lib) {
    if (data.libraries.some((l) => l.id === lib.id)) return;
    data.libraries.unshift(lib);
  }

  /** Bulut kaydı olmadan belleğe şarkı ekle (örnek parça / CMS hatası yedek) */
  function addSongsInMemory(libraryId, entries) {
    const lib = getLibrary(libraryId);
    if (!lib || !Array.isArray(entries)) return false;
    if (!Array.isArray(lib.songs)) lib.songs = [];
    for (const item of entries) {
      if (lib.songs.some((s) => s.id === item.id)) continue;
      const entry = {
        id: item.id,
        name: item.name,
        fileName: item.fileName,
      };
      if (item.midiUrl) entry.midiUrl = item.midiUrl;
      if (item.midiBase64) entry.midiBase64 = item.midiBase64;
      if (item.storage) entry.storage = item.storage;
      if (item.relativePath) entry.relativePath = item.relativePath;
      lib.songs.push(entry);
    }
    return true;
  }

  function getLibraries() {
    return data.libraries;
  }

  function getLibrary(id) {
    return data.libraries.find((l) => l.id === id);
  }

  function setActiveLibrary(id) {
    activeLibraryId = id;
    activeSongId = null;
    parsedMidi = null;
  }

  function setActiveSong(songId) {
    activeSongId = songId;
    parsedMidi = null;
  }

  function songStorageRef(song) {
    return song.midiUrl || song.relativePath;
  }

  async function importSongs(libraryId, imported) {
    const lib = getLibrary(libraryId);
    if (!lib) {
      throw new Error("Kütüphane bulunamadı. Listeyi yenileyip tekrar deneyin.");
    }
    const fromCloud =
      window.pianoApi?.isMember?.() &&
      imported.length > 0 &&
      imported.every((item) => item.storage === "cms");
    if (fromCloud) {
      await reload();
      return;
    }
    if (!Array.isArray(lib.songs)) lib.songs = [];
    for (const item of imported) {
      if (lib.songs.some((s) => s.id === item.id)) continue;
      const entry = {
        id: item.id,
        name: item.name,
        fileName: item.fileName,
      };
      if (item.midiUrl) entry.midiUrl = item.midiUrl;
      if (item.midiBase64) entry.midiBase64 = item.midiBase64;
      if (item.storage) entry.storage = item.storage;
      if (item.relativePath) entry.relativePath = item.relativePath;
      lib.songs.push(entry);
    }
    await save();
  }

  async function reload() {
    const prevLib = activeLibraryId;
    const prevSong = activeSongId;
    await load();
    if (prevLib && getLibrary(prevLib)) {
      activeLibraryId = prevLib;
      if (prevSong && getLibrary(prevLib)?.songs?.some((s) => s.id === prevSong)) {
        activeSongId = prevSong;
      }
    }
  }

  async function loadSongMidi(song) {
    if (song.midiBase64) {
      const binary = atob(song.midiBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      parsedMidi = window.pianoApi.parseMidi(Array.from(bytes));
      return parsedMidi;
    }
    if (
      window.pianoApi.isWeb &&
      (song.storage === "cms" || (!song.midiUrl && !song.relativePath && song.id))
    ) {
      const bytes = await window.pianoApi.readMidi(`cms:${song.id}`);
      parsedMidi = window.pianoApi.parseMidi(bytes);
      return parsedMidi;
    }
    const ref = songStorageRef(song);
    if (!ref) throw new Error("Şarkı dosya adresi yok");
    const bytes = await window.pianoApi.readMidi(ref);
    parsedMidi = window.pianoApi.parseMidi(bytes);
    return parsedMidi;
  }

  function getParsedMidi() {
    return parsedMidi;
  }

  function getActiveSong() {
    const lib = getLibrary(activeLibraryId);
    return lib?.songs.find((s) => s.id === activeSongId);
  }

  function setTrackIndex(index) {
    selectedTrackIndex = index;
  }

  function getTrackNotes() {
    if (!parsedMidi?.tracks?.length) return [];
    const track = parsedMidi.tracks[selectedTrackIndex];
    const raw = track?.notes ?? [];
    if (window.NoteUtils?.cleanupNotes) {
      return window.NoteUtils.cleanupNotes(raw);
    }
    return raw;
  }

  async function deleteSong(libraryId, songId) {
    const lib = getLibrary(libraryId);
    if (!lib) return;
    const idx = lib.songs.findIndex((s) => s.id === songId);
    if (idx < 0) return;
    const song = lib.songs[idx];
    const ref = songStorageRef(song);
    if (window.pianoApi.isWeb) {
      await window.pianoApi.deleteMidi(ref, {
        songId: song.id,
        libraryId,
      });
    } else {
      await window.pianoApi.deleteMidi(ref);
    }
    lib.songs.splice(idx, 1);
    if (activeSongId === songId) {
      activeSongId = null;
      parsedMidi = null;
    }
    await save();
  }

  return {
    load,
    reload,
    save,
    createLibrary,
    dataPushStarter,
    addSongsInMemory,
    getLibraries,
    getLibrary,
    setActiveLibrary,
    setActiveSong,
    importSongs,
    loadSongMidi,
    getParsedMidi,
    getActiveSong,
    setTrackIndex,
    getTrackNotes,
    deleteSong,
    getActiveLibraryId: () => activeLibraryId,
    getActiveSongId: () => activeSongId,
    getSelectedTrackIndex: () => selectedTrackIndex,
  };
})();

window.LibraryStore = LibraryStore;


/* === starter-library.js === */
/** Tüm kullanıcılara telifsiz örnek MIDI (Bach BWV 846 — kamu malı) */
const StarterLibrary = (() => {
  const LIB_ID = "lib-starter";
  const ASSET = "assets/bach_846.mid";

  function songMeta() {
    const t = window.I18n?.t?.bind(window.I18n) || ((k) => k);
    return {
      id: "song-bach-846",
      name: t("starter.song"),
      fileName: "bach_846.mid",
      license: "public-domain",
    };
  }

  function libName() {
    return window.I18n?.t?.("starter.lib") || "Sample tracks (royalty-free)";
  }

  async function fetchBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Örnek MIDI yüklenemedi (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function ensure(LibraryStore) {
    if (!window.pianoApi?.isWeb) return false;
    if (LibraryStore.getLibrary("lib-demo")?.songs?.length) return false;

    const lib = LibraryStore.getLibrary(LIB_ID);
    const SONG_META = songMeta();
    if (lib?.songs?.some((s) => s.id === SONG_META.id || s.fileName === SONG_META.fileName)) {
      return false;
    }

    if (!lib) {
      LibraryStore.dataPushStarter({
        id: LIB_ID,
        name: libName(),
        songs: [],
        createdAt: new Date().toISOString(),
        starter: true,
      });
      try {
        await LibraryStore.save();
      } catch (err) {
        console.warn("Starter kütüphane kaydı:", err);
      }
    }

    let base64;
    try {
      base64 = await fetchBase64(ASSET);
    } catch (err) {
      console.warn("Starter MIDI:", err);
      return false;
    }

    const localEntry = {
      ...SONG_META,
      midiBase64: base64,
      storage: "local",
    };

    const api = window.pianoApi;
    if (api?.isMember?.()) {
      try {
        const entry = await api.uploadMidiBase64(
          LIB_ID,
          SONG_META.fileName,
          base64,
          SONG_META.name
        );
        try {
          await LibraryStore.importSongs(LIB_ID, [entry]);
        } catch (importErr) {
          console.warn("Starter bulut içe aktarma:", importErr);
          LibraryStore.addSongsInMemory(LIB_ID, [entry]);
        }
        return true;
      } catch (uploadErr) {
        console.warn("Starter bulut yükleme:", uploadErr);
      }
    }

    LibraryStore.addSongsInMemory(LIB_ID, [localEntry]);
    try {
      await LibraryStore.save();
    } catch (err) {
      console.warn("Starter yerel kayıt:", err);
    }
    return true;
  }

  return { LIB_ID, ensure };
})();

window.StarterLibrary = StarterLibrary;


/* === intro-splash.js === */
/** Açılış — responsive aurora splash + isteğe bağlı video */
const IntroSplash = (() => {
  const MIN_SHOW_MS = 2600;
  const MAX_SHOW_MS = 9000;
  const APP_NAME = window.__appName || window.I18n?.APP_NAME || "StaveFlow";
  let playing = false;

  function $(id) {
    return document.getElementById(id);
  }

  function viewSize() {
    return {
      w: document.documentElement.clientWidth || window.innerWidth,
      h: document.documentElement.clientHeight || window.innerHeight,
    };
  }

  function drawAuroraFrame(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#03030a");
    g.addColorStop(0.42, "#0a0818");
    g.addColorStop(1, "#140a1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const starCount = Math.min(140, Math.floor((w * h) / 9000));
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 97) % 1000) / 1000;
      const sy = ((i * 53) % 1000) / 1000;
      const tw = 0.35 + 0.65 * Math.sin(t * 1.2 + i * 0.7);
      ctx.fillStyle = `rgba(255,255,255,${0.1 + tw * 0.32})`;
      ctx.beginPath();
      ctx.arc(sx * w, sy * h * 0.78, 0.45 + (i % 4) * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let band = 0; band < 3; band++) {
      const y = h * (0.22 + band * 0.14) + Math.sin(t * 0.48 + band * 1.1) * h * 0.018;
      const grad = ctx.createLinearGradient(0, y - h * 0.08, w, y + h * 0.12);
      grad.addColorStop(0, "rgba(88,28,135,0)");
      grad.addColorStop(0.4, `rgba(168,85,247,${0.1 + band * 0.03})`);
      grad.addColorStop(0.62, `rgba(56,189,248,${0.08 + band * 0.025})`);
      grad.addColorStop(1, "rgba(88,28,135,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - h * 0.09, w, h * 0.18);
    }

    const vign = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.15, w * 0.5, h * 0.5, w * 0.75);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, w, h);
  }

  function resizeCanvas(canvas) {
    const { w, h } = viewSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function startCanvasLoop(canvas) {
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let size = resizeCanvas(canvas);
    const loop = (now) => {
      const t = now / 1000;
      drawAuroraFrame(ctx, size.w, size.h, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }

  function finish(overlay, stopLoop, resolve) {
    if (!overlay || overlay.classList.contains("intro-done")) return;
    overlay.classList.add("intro-fade-out");
    setTimeout(() => {
      overlay.classList.add("hidden", "intro-done");
      overlay.setAttribute("aria-hidden", "true");
      stopLoop?.();
      playing = false;
      resolve();
    }, 480);
  }

  function play() {
    if (playing) return Promise.resolve();
    const overlay = $("introSplash");
    if (!overlay) return Promise.resolve();

    const video = $("introSplashVideo");
    const canvas = $("introSplashCanvas");
    const skipBtn = $("introSplashSkip");
    const logoEl = overlay.querySelector(".intro-splash-logo");
    const tagEl = overlay.querySelector(".intro-splash-tag");
    const hintEl = overlay.querySelector(".intro-splash-hint");
    if (logoEl) logoEl.textContent = APP_NAME;
    if (tagEl && window.I18n) tagEl.textContent = window.I18n.t("intro.tag");
    if (hintEl && window.I18n) hintEl.textContent = window.I18n.t("intro.hint");
    if (skipBtn && window.I18n) skipBtn.textContent = window.I18n.t("intro.skip");
    if (!canvas) return Promise.resolve();

    playing = true;
    overlay.classList.remove("hidden", "intro-done", "intro-fade-out");
    overlay.setAttribute("aria-hidden", "false");

    resizeCanvas(canvas);
    const onResize = () => resizeCanvas(canvas);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const stopLoop = startCanvasLoop(canvas);

    return new Promise((resolve) => {
      const started = performance.now();
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
        finish(overlay, stopLoop, resolve);
      };

      const tryClose = () => {
        const elapsed = performance.now() - started;
        if (elapsed < MIN_SHOW_MS) {
          setTimeout(tryClose, MIN_SHOW_MS - elapsed);
          return;
        }
        done();
      };

      skipBtn?.addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          tryClose();
        },
        { once: true }
      );
      overlay.addEventListener("click", (e) => {
        if (e.target === skipBtn) return;
        tryClose();
      });

      if (video) {
        const sources = ["assets/intro.webm", "assets/intro.mp4"];
        let srcIdx = 0;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        const loadNext = () => {
          if (srcIdx >= sources.length) {
            video.classList.add("hidden");
            return;
          }
          const onReady = () => {
            video.removeEventListener("canplay", onReady);
            video.classList.remove("hidden");
            video.play().catch(() => video.classList.add("hidden"));
          };
          video.addEventListener("canplay", onReady);
          video.src = sources[srcIdx++];
        };
        video.addEventListener("error", loadNext);
        video.addEventListener("ended", tryClose, { once: true });
        loadNext();
      }

      setTimeout(tryClose, MAX_SHOW_MS);
    });
  }

  return { play };
})();

window.IntroSplash = IntroSplash;


window.mainJsOk = true;

/* === app.js === */
/** Ana uygulama */
(function () {
  window.I18n?.init();
  const t = (key, vars) => window.I18n?.t(key, vars) ?? key;
  const APP_NAME = window.I18n?.APP_NAME || "StaveFlow";
  const APP_VERSION = "v0.9.7";
  const $ = (sel) => document.querySelector(sel);

  function mods() {
    return {
      Piano: window.Piano,
      PianoRange: window.PianoRange,
      PlaySurface: window.PlaySurface,
      Game: window.Game,
      LibraryStore: window.LibraryStore,
      AppSettings: window.AppSettings,
      AudioEngine: window.AudioEngine,
      KeyLabels: window.KeyLabels,
    };
  }

  function requireStore() {
    if (!window.LibraryStore) {
      throw new Error("Kütüphane modülü yüklenemedi. Uygulamayı kapatıp npm start ile açın.");
    }
    return window.LibraryStore;
  }

  function requireMods() {
    const m = mods();
    if (!m.Piano || !m.Game || !m.PlaySurface) {
      throw new Error("Piyano modülü yüklenemedi. Uygulamayı kapatıp npm start ile açın.");
    }
    if (!m.LibraryStore) throw new Error("Kütüphane modülü yüklenemedi.");
    return m;
  }

  function playInstrument() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  if (!window.mainJsOk || !window.LibraryStore) {
    $("#apiError")?.classList.remove("hidden");
    $("#apiError").innerHTML = t("apiError.desktop");
    return;
  }

  if (!window.Piano || !window.PianoRange) {
    $("#apiError")?.classList.remove("hidden");
    $("#apiError").innerHTML = t("apiError.desktop");
  }

  if (!window.pianoApi) {
    $("#apiError")?.classList.remove("hidden");
    return;
  }

  const libraryList = $("#libraryList");
  const songList = $("#songList");
  const trackSelect = $("#trackSelect");
  const scoreValue = $("#scoreValue");
  const comboValue = $("#comboValue");
  const btnPlay = $("#btnPlay");
  const btnAutoPlay = $("#btnAutoPlay");
  const btnStop = $("#btnStop");
  const btnImport = $("#btnImportMidi");
  const btnImportAudio = $("#btnImportAudio");
  const audioImportOverlay = $("#audioImportOverlay");
  const audioImportBarFill = $("#audioImportBarFill");
  const audioImportStatus = $("#audioImportStatus");
  const audioImportFile = $("#audioImportFile");
  const btnNewLib = $("#btnNewLibrary");
  const octaveStart = $("#octaveStart");
  const octaveCount = $("#octaveCount");
  const keyWidthRange = $("#keyWidthRange");
  const keyHeightRange = $("#keyHeightRange");
  const keyWidthLabel = $("#keyWidthLabel");
  const keyHeightLabel = $("#keyHeightLabel");
  const pianoDock = $("#pianoDock");
  const pianoAlign = $("#pianoAlign");
  const instrumentSelect = $("#instrumentSelect");
  const pianoWrap = $("#pianoWrap");
  const playModeSelect = $("#playModeSelect");
  const btnMoveInstrument = $("#btnMoveInstrument");
  const instrumentPickerModal = $("#instrumentPickerModal");
  const stabKeys = $("#stabKeys");
  const keyWidthDesc = $("#keyWidthDesc");
  const keyHeightDesc = $("#keyHeightDesc");
  const dockDesc = $("#dockDesc");
  const alignDesc = $("#alignDesc");
  const stringVibratoSens = $("#stringVibratoSens");
  const vibratoSensLabel = $("#vibratoSensLabel");
  const guitarGripAllStrings = $("#guitarGripAllStrings");
  const violinGripAllStrings = $("#violinGripAllStrings");
  const guitarNeckNearbyTouch = $("#guitarNeckNearbyTouch");
  const guitarStringsNearbyTouch = $("#guitarStringsNearbyTouch");
  const violinNeckNearbyTouch = $("#violinNeckNearbyTouch");
  const violinStringsNearbyTouch = $("#violinStringsNearbyTouch");
  const guitarNeckHeight = $("#guitarNeckHeight");
  const guitarStringHeight = $("#guitarStringHeight");
  const guitarNeckWidth = $("#guitarNeckWidth");
  const guitarPluckWidth = $("#guitarPluckWidth");
  const guitarNeckHeightLabel = $("#guitarNeckHeightLabel");
  const guitarStringHeightLabel = $("#guitarStringHeightLabel");
  const guitarNeckWidthLabel = $("#guitarNeckWidthLabel");
  const guitarPluckWidthLabel = $("#guitarPluckWidthLabel");
  const appVersion = $("#appVersion");
  const dynamicPressure = $("#dynamicPressure");
  const sustainRange = $("#sustainRange");
  const sustainLabel = $("#sustainLabel");
  const speedRange = $("#speedRange");
  const speedLabel = $("#speedLabel");
  const timingWindow = $("#timingWindow");
  const timingLabel = $("#timingLabel");
  const libraryModal = $("#libraryModal");
  const libraryForm = $("#libraryForm");
  const libraryNameInput = $("#libraryNameInput");
  const libraryCancel = $("#libraryCancel");
  const libraryBackdrop = $("#libraryBackdrop");
  const inlineLibraryForm = $("#inlineLibraryForm");
  const inlineLibraryName = $("#inlineLibraryName");
  const libraryHint = $("#libraryHint");
  const songHint = $("#songHint");
  const toastEl = $("#toast");
  const timeCurrent = $("#timeCurrent");
  const timeTotal = $("#timeTotal");
  const timeRemaining = $("#timeRemaining");
  const progressTrack = $("#progressTrack");
  const progressFill = $("#progressFill");
  const progressThumb = $("#progressThumb");
  const localeSelect = $("#localeSelect");
  const timeRemainingLabel = $("#timeRemainingLabel");
  const labelMode = $("#labelMode");
  const labelPreset = $("#labelPreset");
  const labelPresetWrap = $("#labelPresetWrap");
  const customLabelsWrap = $("#customLabelsWrap");
  const customLabels = $("#customLabels");
  const btnApplyLabels = $("#btnApplyLabels");
  const flameRange = $("#flameRange");
  const flameLabel = $("#flameLabel");
  const flameStyle = $("#flameStyle");
  const trimStartInput = $("#trimStart");
  const trimEndInput = $("#trimEnd");
  const effectHueInput = $("#effectHue");
  const keyColorTopInput = $("#keyColorTop");
  const keyColorMidInput = $("#keyColorMid");
  const keyColorBottomInput = $("#keyColorBottom");
  const hitLineColorInput = $("#hitLineColor");
  const labelAssignModal = $("#labelAssignModal");
  const labelAssignTitle = $("#labelAssignTitle");
  const labelAssignHint = $("#labelAssignHint");
  const labelAssignInput = $("#labelAssignInput");
  const labelAssignSave = $("#labelAssignSave");
  const labelAssignCancel = $("#labelAssignCancel");
  const labelAssignClear = $("#labelAssignClear");
  const labelAssignBackdrop = $("#labelAssignBackdrop");
  const keyboardEnabled = $("#keyboardEnabled");
  const keyboardLayout = $("#keyboardLayout");
  const keyboardLayoutHint = $("#keyboardLayoutHint");
  const btnToggleSidebar = $("#btnToggleSidebar");
  const btnFullscreen = $("#btnFullscreen");
  const comboFlare = $("#comboFlare");

  let editingLibraryId = null;
  let labelEditMidi = null;
  let lastComboShown = 0;
  let toastTimer = null;

  function setupSettingsTabs() {
    const tabs = document.querySelectorAll(".settings-tabs .stab");
    const panels = document.querySelectorAll(".stab-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === id));
      });
    });
  }

  function setupSidebarTabs() {
    const tabs = document.querySelectorAll(".sidebar-tab");
    const panels = document.querySelectorAll(".sidebar-panel");
    if (!tabs.length) return;
    tabs.forEach((tab) => {
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => {
        const id = tab.dataset.sidebarTab;
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => p.classList.toggle("active", p.dataset.sidebarPanel === id));
        try {
          localStorage.setItem("staveflow-sidebar-tab", id);
        } catch {
          /* */
        }
      });
    });
    try {
      const saved = localStorage.getItem("staveflow-sidebar-tab");
      if (saved) {
        const tab = document.querySelector(`.sidebar-tab[data-sidebar-tab="${saved}"]`);
        tab?.click();
      }
    } catch {
      /* */
    }
  }

  function syncMoveInstrumentBtn() {
    window.InstrumentMove?.syncMoveBtn?.();
  }

  function syncTransportButtons({ playing = false, autoPlaying = false } = {}) {
    if (btnPlay) btnPlay.textContent = playing ? t("header.pause") : t("header.play");
    if (btnAutoPlay) {
      btnAutoPlay.textContent = autoPlaying ? t("header.autoplayPause") : t("header.autoplay");
    }
    if (btnStop) btnStop.textContent = t("header.stop");
  }

  function resetTrackSelectEmpty() {
    if (!trackSelect) return;
    trackSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = t("settings.trackEmpty");
    trackSelect.appendChild(opt);
  }

  const themeInputs = () => ({
    effectHue: effectHueInput,
    keyColorTop: keyColorTopInput,
    keyColorMid: keyColorMidInput,
    keyColorBottom: keyColorBottomInput,
    hitLineColor: hitLineColorInput,
  });

  function applyThemeFromSettings(s, playMode) {
    const mode = playMode || s?.playMode || window.PlaySurface?.getMode?.() || "piano";
    window.AppTheme?.fromSettings?.(s || AppSettings.load(), mode);
    window.AppTheme?.fillInputs?.(themeInputs(), {
      ...(window.AppTheme.getPreset(mode)),
      ...((s || AppSettings.load()).themesByMode?.[mode] || {}),
    });
    document.body.dataset.themeMode = mode;
  }

  function persistThemeFromInputs() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    const theme = window.AppTheme.readFromInputs(themeInputs(), mode);
    const s = AppSettings.load();
    const themesByMode = window.AppTheme.saveForMode(mode, theme, s);
    persistSettings({ themesByMode });
    applyThemeFromSettings(AppSettings.load(), mode);
  }

  function openLabelAssignModal(midi) {
    labelEditMidi = midi;
    const name = KeyLabels?.noteNameForMidi?.(midi) || `MIDI ${midi}`;
    labelAssignTitle.textContent = t("modal.assignKey");
    labelAssignHint.textContent = t("modal.assignHint", { name });
    labelAssignInput.placeholder = t("modal.oneLetter");
    labelAssignInput.value = KeyLabels?.getMidiLabel?.(midi) || "";
    labelAssignModal.classList.remove("hidden");
    labelAssignModal.setAttribute("aria-hidden", "false");
    setTimeout(() => labelAssignInput.focus(), 50);
  }

  function closeLabelAssignModal() {
    labelAssignModal.classList.add("hidden");
    labelAssignModal.setAttribute("aria-hidden", "true");
    labelEditMidi = null;
  }

  function saveLabelAssign() {
    if (labelEditMidi == null) return;
    const ch = labelAssignInput.value.trim();
    KeyLabels.setMidiLabel(labelEditMidi, ch);
    persistSettings({
      labelMode: "custom",
      midiLabels: KeyLabels.getMidiLabelsObject(),
    });
    applyLabelSettings(AppSettings.load());
    window.KeyboardInput?.rebuild?.();
    toast(ch ? t("modal.assignSet", { ch }) : t("modal.assignClear"));
    closeLabelAssignModal();
  }

  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("error", isError);
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3200);
  }

  function syncLocaleSelect() {
    if (!localeSelect || !window.I18n) return;
    const locales = window.I18n.getLocales();
    if (!locales.length) return;
    if (localeSelect.options.length !== locales.length) {
      localeSelect.innerHTML = "";
      for (const loc of locales) {
        const opt = document.createElement("option");
        opt.value = loc.id;
        opt.textContent = loc.label;
        localeSelect.appendChild(opt);
      }
    } else {
      locales.forEach((loc, i) => {
        const opt = localeSelect.options[i];
        if (!opt) return;
        opt.value = loc.id;
        opt.textContent = loc.label;
      });
    }
    const pref = AppSettings.load().locale || "auto";
    localeSelect.value = [...localeSelect.options].some((o) => o.value === pref)
      ? pref
      : "auto";
  }

  function syncPlayModeSelect() {
    if (!playModeSelect) return;
    const modes = window.PlaySurface?.getModes?.() || {};
    for (const opt of playModeSelect.options) {
      const m = modes[opt.value];
      if (m) opt.textContent = `${m.icon} ${m.label}`;
    }
  }

  function syncInstrumentPicker() {
    instrumentPickerModal?.querySelectorAll("[data-mode]").forEach((btn) => {
      const m = window.PlaySurface?.getModes?.()[btn.dataset.mode];
      const label = btn.querySelector(".instrument-pick-label");
      if (label && m) label.textContent = m.label;
    });
  }

  function applyAppTranslations() {
    if (!window.I18n) return;
    window.I18n.applyDOM();
    syncLocaleSelect();
    syncPlayModeSelect();
    syncInstrumentPicker();
    const scoreLbl = $(".score-label");
    if (scoreLbl) scoreLbl.textContent = t("header.score");
    if (timeRemainingLabel) timeRemainingLabel.textContent = t("header.remaining");
    try {
      if (btnPlay && !requireMods().Game.isPlaying()) btnPlay.textContent = t("header.play");
    } catch {
      if (btnPlay) btnPlay.textContent = t("header.play");
    }
    if (btnAutoPlay) btnAutoPlay.textContent = t("header.autoplay");
    if (btnStop) btnStop.textContent = t("header.stop");
    document.title = `${APP_NAME} — ${t("app.tagline")}`;
    const brandEl = document.querySelector(".top-bar h1");
    if (brandEl) brandEl.textContent = APP_NAME;
    const introLogo = document.querySelector(".intro-splash-logo");
    if (introLogo) introLogo.textContent = APP_NAME;
    updateSettingsForPlayMode(window.PlaySurface?.getMode?.() || "piano");
    syncMoveInstrumentBtn();
    updateHints();
    updateKeyboardLayoutHint();
    if (flameLabel) flameLabel.textContent = flameLabelText(Number(flameRange?.value || 100));
    if (vibratoSensLabel) {
      vibratoSensLabel.textContent = vibratoSensLabelText(Number(stringVibratoSens?.value || 100));
    }
    if (btnToggleSidebar) {
      const visible = !document.body.classList.contains("sidebar-hidden");
      btnToggleSidebar.textContent = visible ? t("header.menu") : t("header.menuOpen");
    }
    if (btnFullscreen) {
      btnFullscreen.textContent = document.fullscreenElement
        ? t("header.window")
        : t("header.fullscreen");
    }
    if (playModeSelect) playModeSelect.title = t("header.instrument");
    if (labelAssignClear) labelAssignClear.textContent = t("modal.clear");
    if (labelAssignCancel) labelAssignCancel.textContent = t("modal.cancel");
    if (labelAssignSave) labelAssignSave.textContent = t("modal.save");
    if (trackSelect?.disabled && trackSelect.options[0]?.value === "") {
      trackSelect.options[0].textContent = t("settings.trackEmpty");
    }
    syncPlatformUI();
  }

  function syncPlatformUI() {
    const desktop = !!window.pianoApi?.isDesktop;
    document.body.classList.toggle("is-desktop", desktop);
    btnImportAudio?.classList.toggle("hidden", !desktop);
    document.querySelector(".songs-hint-audio")?.classList.toggle("hidden", !desktop);
    document.querySelector(".songs-hint-web")?.classList.toggle("hidden", desktop);
  }

  function openModal(editId = null) {
    editingLibraryId = editId;
    $("#libraryDialogTitle").textContent = editId ? t("modal.renameLib") : t("modal.newLib");
    libraryNameInput.value = editId ? requireStore().getLibrary(editId)?.name ?? "" : "";
    libraryModal.classList.remove("hidden");
    libraryModal.setAttribute("aria-hidden", "false");
    setTimeout(() => libraryNameInput.focus(), 50);
  }

  function closeModal() {
    libraryModal.classList.add("hidden");
    libraryModal.setAttribute("aria-hidden", "true");
    editingLibraryId = null;
  }

  async function saveLibraryName(name) {
    const LibraryStore = requireStore();
    const trimmed = name.trim();
    if (!trimmed) {
      toast(t("toast.libEmpty"), true);
      return false;
    }
    try {
      if (editingLibraryId) {
        const lib = LibraryStore.getLibrary(editingLibraryId);
        if (lib) {
          lib.name = trimmed;
          toast(t("toast.libRenamed"));
        }
      } else {
        const lib = LibraryStore.createLibrary(trimmed);
        LibraryStore.setActiveLibrary(lib.id);
        toast(t("toast.libAdded", { name: trimmed }));
      }
      await LibraryStore.save();
      if (window.pianoApi?.isMember?.()) {
        await LibraryStore.reload();
      }
      if (!libraryModal.classList.contains("hidden")) closeModal();
      renderLibraries();
      renderSongs();
      updateHints();
      return true;
    } catch (err) {
      toast(t("toast.saveError", { msg: err.message }), true);
      return false;
    }
  }

  function updateKeyboardLayoutHint() {
    if (!keyboardLayoutHint || !window.KeyboardLayout) return;
    const detected = window.KeyboardLayout.getDetectedLabel();
    keyboardLayoutHint.textContent =
      keyboardLayout?.value === "auto"
        ? t("settings.kb.detected", { name: detected })
        : t("settings.kb.selected", {
            name: keyboardLayout.options[keyboardLayout.selectedIndex]?.text || detected,
          });
  }

  function applyKeyboardLayoutSettings(s) {
    if (!window.KeyboardLayout) return;
    window.KeyboardLayout.setLayoutId(s.keyboardLayout || "auto");
    window.KeyboardLayout.loadLearned(s.keyboardLearned || {});
    if (keyboardLayout) keyboardLayout.value = s.keyboardLayout || "auto";
    updateKeyboardLayoutHint();
    window.KeyboardInput?.rebuild?.();
  }

  function applyLabelSettings(s) {
    if (!window.KeyLabels) return;
    KeyLabels.loadMidiLabelsObject(s.midiLabels);
    KeyLabels.setMode(s.labelMode);
    KeyLabels.setLetterPreset(s.labelPreset);
    KeyLabels.setCustomString(s.customLabels);
    labelMode.value = s.labelMode;
    labelPreset.value = s.labelPreset;
    customLabels.value = s.customLabels;
    labelPresetWrap.classList.toggle("hidden", s.labelMode !== "letters");
    customLabelsWrap.classList.toggle("hidden", s.labelMode !== "custom");
    try {
      requireMods().Piano.refreshLabels();
      window.KeyboardInput?.rebuild?.();
    } catch {
      /* henüz hazır değil */
    }
  }

  function vibratoSensLabelText(v) {
    if (v < 70) return t("intensity.light");
    if (v < 130) return t("intensity.normal");
    if (v < 170) return t("intensity.strong");
    return t("intensity.max");
  }

  function applyInstrumentKeySize(w, h) {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "piano") {
      requireMods().Piano.setKeySize(w, h);
      return;
    }
    window.Guitar?.applyLayout?.();
    window.Violin?.applyLayout?.();
  }

  function scheduleInstrumentLayoutSync() {
    const run = () => {
      const mode = window.PlaySurface?.getMode?.() || "piano";
      if (mode === "piano") {
        window.Piano?.applyLayout?.();
      } else {
        window.PlaySurface?.activeModule?.()?.applyLayout?.();
      }
      if (window.Game?.refreshView) window.Game.refreshView();
      else window.Game?.resize?.();
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
    setTimeout(run, 100);
    setTimeout(run, 350);
    setTimeout(run, 700);
    setTimeout(run, 1200);
  }

  function syncFrettedSizeSliders(s) {
    if (guitarNeckHeight) guitarNeckHeight.value = String(s.guitarNeckHeight ?? 30);
    if (guitarStringHeight) guitarStringHeight.value = String(s.guitarStringHeight ?? 30);
    if (guitarNeckWidth) guitarNeckWidth.value = String(s.guitarNeckWidth ?? 42);
    if (guitarPluckWidth) guitarPluckWidth.value = String(s.guitarPluckWidth ?? 220);
    if (guitarNeckHeightLabel) guitarNeckHeightLabel.textContent = `${s.guitarNeckHeight ?? 30} px`;
    if (guitarStringHeightLabel) guitarStringHeightLabel.textContent = `${s.guitarStringHeight ?? 30} px`;
    if (guitarNeckWidthLabel) guitarNeckWidthLabel.textContent = `${s.guitarNeckWidth ?? 42} px`;
    if (guitarPluckWidthLabel) guitarPluckWidthLabel.textContent = `${s.guitarPluckWidth ?? 220} px`;
  }

  function applyFrettedLayoutFromSliders() {
    const partial = {
      guitarNeckHeight: Number(guitarNeckHeight?.value || 30),
      guitarStringHeight: Number(guitarStringHeight?.value || 30),
      guitarNeckWidth: Number(guitarNeckWidth?.value || 42),
      guitarPluckWidth: Number(guitarPluckWidth?.value || 220),
    };
    if (guitarNeckHeightLabel) guitarNeckHeightLabel.textContent = `${partial.guitarNeckHeight} px`;
    if (guitarStringHeightLabel) guitarStringHeightLabel.textContent = `${partial.guitarStringHeight} px`;
    if (guitarNeckWidthLabel) guitarNeckWidthLabel.textContent = `${partial.guitarNeckWidth} px`;
    if (guitarPluckWidthLabel) guitarPluckWidthLabel.textContent = `${partial.guitarPluckWidth} px`;
    persistSettings(partial);
    syncFrettedSizeSliders({ ...window.AppSettings.load(), ...partial });
    window.Guitar?.applyLayout?.();
    window.Violin?.applyLayout?.();
    setTimeout(() => requireMods().Game.resize(), 60);
  }

  function updateSettingsForPlayMode(mode) {
    const m = mode || window.PlaySurface?.getMode?.() || "piano";
    document.body.dataset.playMode = m;
    if (stabKeys) {
      stabKeys.textContent =
        m === "guitar" || m === "violin" ? t(`inst.${m}`) : t("settings.tab.keys");
    }
    if (keyWidthDesc) {
      keyWidthDesc.textContent =
        m === "piano" ? t("settings.keyWidth.piano") : t("settings.keyWidth.fretted");
    }
    if (keyHeightDesc) {
      keyHeightDesc.textContent =
        m === "piano" ? t("settings.keyHeight.piano") : t("settings.keyHeight.fretted");
    }
    if (dockDesc) {
      dockDesc.textContent = m === "piano" ? t("settings.dock.piano") : t("settings.dock.other");
    }
    if (alignDesc) {
      alignDesc.textContent = m === "piano" ? t("settings.align.piano") : t("settings.align.other");
    }

    if (pianoAlign && m !== "piano") {
      pianoAlign.querySelector('option[value="stretch"]')?.toggleAttribute(
        "disabled",
        true
      );
      if (pianoAlign.value === "stretch") pianoAlign.value = "center";
    } else {
      pianoAlign?.querySelector('option[value="stretch"]')?.removeAttribute("disabled");
    }
  }

  function flameLabelText(v) {
    if (v < 60) return t("intensity.light");
    if (v < 120) return t("intensity.normal");
    if (v < 160) return t("intensity.strong");
    return t("intensity.flame");
  }

  function applyPlayMode(mode, opts = {}) {
    const { PlaySurface, AudioEngine } = requireMods();
    const m = PlaySurface.setMode(mode, opts);
    const sound = PlaySurface.getModes()[m]?.sound || "piano";
    AudioEngine.setInstrument(sound);
    if (playModeSelect) playModeSelect.value = m;
    if (instrumentSelect) instrumentSelect.value = sound;
    persistSettings({ playMode: m, instrumentId: sound, ...(opts.markPrompt ? { instrumentPromptDone: true } : {}) });
    applyPianoLayout(AppSettings.load());
    updateSettingsForPlayMode(m);
    applyThemeFromSettings(AppSettings.load(), m);
    const s = AppSettings.load();
    if (m === "piano") {
      const { Piano, PianoRange } = requireMods();
      if (!PianoRange?.clampRange) {
        throw new Error("PianoRange modülü yüklenemedi");
      }
      Piano.setAutoFit((s.pianoAlign || "stretch") === "stretch");
      Piano.setKeySize(s.keyWidth, s.keyHeight);
      const clamped = PianoRange.clampRange(s.octaveStart, s.octaveCount);
      Piano.buildKeys(clamped.startOctave, clamped.octaveCount);
      applyLabelSettings(s);
    } else if (m === "guitar" || m === "violin") {
      syncFrettedSizeSliders(s);
      window.PlaySurface?.activeModule?.()?.applyLayout?.();
    }
    scheduleInstrumentLayoutSync();
    setTimeout(() => {
      requireMods().Game.refreshView?.();
      reloadTrackNotes();
    }, 100);
    setTimeout(() => requireMods().Game.resize(), 500);
    return m;
  }

  function showInstrumentPickerIfNeeded() {
    const s = AppSettings.load();
    if (!instrumentPickerModal) return;
    if (s.instrumentPromptDone) {
      instrumentPickerModal.classList.add("hidden");
      instrumentPickerModal.setAttribute("aria-hidden", "true");
      return;
    }
    instrumentPickerModal.classList.remove("hidden");
    instrumentPickerModal.setAttribute("aria-hidden", "false");
    instrumentPickerModal.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.onclick = () => {
        applyPlayMode(btn.dataset.mode, { force: true, markPrompt: true });
        instrumentPickerModal.classList.add("hidden");
        instrumentPickerModal.setAttribute("aria-hidden", "true");
        toast(
          t("toast.instrument", {
            name: window.PlaySurface.getModes()[btn.dataset.mode]?.label || btn.dataset.mode,
          })
        );
      };
    });
  }

  function effectivePianoDock(s) {
    const mode = window.PlaySurface?.getMode?.() || s?.playMode || "piano";
    if (mode === "guitar" || mode === "violin") return "middle";
    return s?.pianoDock || "bottom";
  }

  function applyPianoLayout(s) {
    const dock = effectivePianoDock(s);
    const align = s.pianoAlign || "stretch";
    document.body.classList.remove("piano-dock-bottom", "piano-dock-top", "piano-dock-middle");
    document.body.classList.add(`piano-dock-${dock}`);
    if (pianoWrap) {
      pianoWrap.classList.remove(
        "piano-align-stretch",
        "piano-align-left",
        "piano-align-center",
        "piano-align-right"
      );
      pianoWrap.classList.add(`piano-align-${align}`);
    }
    if (pianoDock) pianoDock.value = dock;
    if (pianoAlign) pianoAlign.value = align;
    setTimeout(() => {
      try {
        requireMods().Game.resize();
      } catch {
        /* */
      }
    }, 80);
  }

  function applySettings(s) {
    const { Piano, Game, AudioEngine } = requireMods();
    keyWidthRange.value = String(s.keyWidth);
    keyHeightRange.value = String(s.keyHeight);
    keyWidthLabel.textContent = `${s.keyWidth} px`;
    keyHeightLabel.textContent = `${s.keyHeight} px`;
    dynamicPressure.checked = s.dynamicPressure;
    const sustainMs = Math.max(0, Math.min(10000, Math.round(s.sustainMs ?? 550)));
    if (sustainRange) sustainRange.value = String(sustainMs);
    if (sustainLabel) sustainLabel.textContent = `${sustainMs} ms`;
    timingWindow.value = String(s.timingWindow);
    timingLabel.textContent = `${s.timingWindow} ms`;
    speedRange.value = String(s.speed);
    speedLabel.textContent = `${s.speed}%`;
    flameRange.value = String(Math.round((s.flameIntensity || 1) * 100));
    flameLabel.textContent = flameLabelText(Number(flameRange.value));
    flameStyle.value = s.flameStyle || "aurora";
    if (trimStartInput) trimStartInput.value = String(s.trimStart ?? 0);
    if (trimEndInput) trimEndInput.value = String(s.trimEnd ?? 0);
    keyboardEnabled.checked = s.keyboardEnabled !== false;

    AudioEngine.setDynamicPressure(s.dynamicPressure);
    AudioEngine.setSustainMs(sustainMs);
    const playMode = s.playMode || "piano";
    const modeSound = window.PlaySurface?.getModes?.()?.[playMode]?.sound || s.instrumentId || "piano";
    AudioEngine.setInstrument(modeSound);
    if (instrumentSelect) instrumentSelect.value = modeSound;
    Game.setTimingWindow(s.timingWindow);
    Game.setSpeed(s.speed / 100);
    Game.setFlameIntensity(s.flameIntensity || 1);
    Game.setTrim(s.trimStart ?? 0, s.trimEnd ?? 0);
    Game.setFlameStyle(s.flameStyle || "aurora");
    window.KeyboardInput?.setEnabled(s.keyboardEnabled !== false);
    applyKeyboardLayoutSettings(s);
    if (effectHueInput) effectHueInput.value = String(s.effectHue ?? 275);
    if (keyColorTopInput) keyColorTopInput.value = s.keyColorTop || "#e8d4ff";
    if (keyColorMidInput) keyColorMidInput.value = s.keyColorMid || "#a855f7";
    if (keyColorBottomInput) keyColorBottomInput.value = s.keyColorBottom || "#6b21a8";
    if (hitLineColorInput) hitLineColorInput.value = s.hitLineColor || "#d8b4fe";
    applyThemeFromSettings(s);
    applyLabelSettings(s);
    setSidebarVisible(s.sidebarVisible !== false, false);
    applyPianoLayout(s);
    populateOctaveSelects(s.octaveStart, s.octaveCount);
    if (playModeSelect) playModeSelect.value = playMode;
    const { PlaySurface } = requireMods();
    PlaySurface.setMode(playMode, { force: true, syncSound: false });
    updateSettingsForPlayMode(playMode);
    applyInstrumentKeySize(s.keyWidth, s.keyHeight);
    if (stringVibratoSens) {
      const vib = Math.round((s.stringVibratoSens ?? 1) * 100);
      stringVibratoSens.value = String(vib);
      if (vibratoSensLabel) vibratoSensLabel.textContent = vibratoSensLabelText(vib);
    }
    if (guitarGripAllStrings) guitarGripAllStrings.checked = !!s.guitarGripAllStrings;
    if (violinGripAllStrings) violinGripAllStrings.checked = !!s.violinGripAllStrings;
    if (guitarNeckNearbyTouch) guitarNeckNearbyTouch.checked = s.guitarNeckNearbyTouch !== false;
    if (violinNeckNearbyTouch) violinNeckNearbyTouch.checked = s.violinNeckNearbyTouch !== false;
    if (guitarStringsNearbyTouch) guitarStringsNearbyTouch.checked = !!s.guitarStringsNearbyTouch;
    if (violinStringsNearbyTouch) violinStringsNearbyTouch.checked = !!s.violinStringsNearbyTouch;
    if (guitarNeckHeight) guitarNeckHeight.value = String(s.guitarNeckHeight ?? 30);
    if (guitarStringHeight) guitarStringHeight.value = String(s.guitarStringHeight ?? 30);
    if (guitarNeckWidth) guitarNeckWidth.value = String(s.guitarNeckWidth ?? 42);
    if (guitarPluckWidth) guitarPluckWidth.value = String(s.guitarPluckWidth ?? 220);
    if (guitarNeckHeightLabel) guitarNeckHeightLabel.textContent = `${s.guitarNeckHeight ?? 30} px`;
    if (guitarStringHeightLabel) guitarStringHeightLabel.textContent = `${s.guitarStringHeight ?? 30} px`;
    if (guitarNeckWidthLabel) guitarNeckWidthLabel.textContent = `${s.guitarNeckWidth ?? 42} px`;
    if (guitarPluckWidthLabel) guitarPluckWidthLabel.textContent = `${s.guitarPluckWidth ?? 220} px`;
    if ((s.playMode || "piano") === "guitar" || s.playMode === "violin") {
      window.Guitar?.applyLayout?.();
      window.Violin?.applyLayout?.();
    }
    if (playMode === "piano") {
      const { Piano, PianoRange } = requireMods();
      Piano.setAutoFit((s.pianoAlign || "stretch") === "stretch");
      Piano.setKeySize(s.keyWidth, s.keyHeight);
      if (PianoRange?.clampRange) {
        const clamped = PianoRange.clampRange(s.octaveStart, s.octaveCount);
        Piano.buildKeys(clamped.startOctave, clamped.octaveCount);
      }
    }
    scheduleInstrumentLayoutSync();
  }

  function setSidebarVisible(visible, save = true) {
    document.body.classList.toggle("sidebar-hidden", !visible);
    btnToggleSidebar.textContent = visible ? t("header.menu") : t("header.menuOpen");
    if (save) persistSettings({ sidebarVisible: visible });
    setTimeout(() => requireMods().Game.resize(), 120);
  }

  async function toggleFullscreen() {
    if (!window.pianoApi?.toggleFullscreen) return;
    const on = await window.pianoApi.toggleFullscreen();
    btnFullscreen.textContent = on ? t("header.window") : t("header.fullscreen");
    toast(on ? t("toast.fullscreenOn") : t("toast.windowMode"));
    setTimeout(() => {
      try {
        requireMods().Game.resize();
      } catch {
        /* */
      }
    }, 200);
  }

  function persistSettings(partial) {
    window.AppSettings.save(partial);
  }

  function populateOctaveSelects(startVal, countVal) {
    if (!window.PianoRange) return;
    const start = startVal ?? (Number(octaveStart.value) || 3);
    const count = countVal ?? (Number(octaveCount.value) || 2);

    octaveStart.innerHTML = "";
    for (const o of PianoRange.getStartOctaveOptions()) {
      const opt = document.createElement("option");
      opt.value = String(o.value);
      opt.textContent = o.label;
      octaveStart.appendChild(opt);
    }

    octaveCount.innerHTML = "";
    const countOpts = PianoRange.getOctaveCountOptions(start);
    for (const o of countOpts) {
      const opt = document.createElement("option");
      opt.value = String(o.value);
      opt.textContent = o.label;
      octaveCount.appendChild(opt);
    }

    const clamped = PianoRange.clampRange(start, count);
    octaveStart.value = String(clamped.startOctave);
    octaveCount.value = String(clamped.octaveCount);
    return clamped;
  }

  function getOctaveRange() {
    return PianoRange
      ? PianoRange.clampRange(Number(octaveStart.value), Number(octaveCount.value))
      : {
          startOctave: Number(octaveStart.value),
          octaveCount: Number(octaveCount.value),
        };
  }

  function rebuildPiano() {
    if (window.PlaySurface?.getMode?.() !== "piano") {
      toast(t("toast.octavePianoOnly"));
      return;
    }
    const { Piano, Game } = requireMods();
    window.KeyboardInput?.releaseAll?.();

    const clamped =
      populateOctaveSelects(
        Number(octaveStart.value),
        Number(octaveCount.value)
      ) || getOctaveRange();

    Piano.setAutoFit((AppSettings.load().pianoAlign || "stretch") === "stretch");
    Piano.buildKeys(clamped.startOctave, clamped.octaveCount);
    window.KeyboardInput?.rebuild?.();
    applyLabelSettings(AppSettings.load());
    persistSettings({
      octaveStart: clamped.startOctave,
      octaveCount: clamped.octaveCount,
      octaveLockManual: true,
      autoKeyboardFromSong: false,
    });

    setTimeout(() => {
      Game.resize();
      reloadTrackNotes();
    }, 80);

    toast(t("toast.octaveSet", { start: clamped.startOctave, count: clamped.octaveCount }));
  }

  function fitKeyboardToSong(notes) {
    const s = AppSettings.load();
    if ((window.PlaySurface?.getMode?.() || s.playMode || "piano") !== "piano") return null;
    if (s.octaveLockManual || !s.autoKeyboardFromSong || !notes?.length) return null;
    if (!window.PianoRange?.fitRangeToNotes) return null;

    const fit = window.PianoRange.fitRangeToNotes(notes);
    populateOctaveSelects(fit.startOctave, fit.octaveCount);
    const { Piano } = requireMods();
    Piano.setAutoFit((s.pianoAlign || "stretch") === "stretch");
    Piano.buildKeys(fit.startOctave, fit.octaveCount);
    applyLabelSettings(AppSettings.load());
    persistSettings({
      octaveStart: fit.startOctave,
      octaveCount: fit.octaveCount,
      autoKeyboardFromSong: true,
    });
    return fit;
  }

  async function reloadTrackNotes() {
    const { Piano, Game, LibraryStore } = requireMods();
    const notes = LibraryStore.getTrackNotes();
    const s = AppSettings.load();
    Game.setTrim(s.trimStart ?? 0, s.trimEnd ?? 0);
    const fit = fitKeyboardToSong(notes);
    if (fit) {
      toast(t("toast.fitSong", { count: fit.octaveCount }), false);
    } else if ((window.PlaySurface?.getMode?.() || "piano") === "piano") {
      Piano.setAutoFit((s.pianoAlign || "stretch") === "stretch");
      window.KeyboardInput?.rebuild?.();
    }
    const range = playInstrument().getRange();
    Game.loadNotes(notes, range);
    btnPlay.disabled = !Game.hasNotes();
    if (btnAutoPlay) btnAutoPlay.disabled = !Game.hasNotes();
    setTimeout(() => Game.resize(), 100);
  }

  function updateImportButtons() {
    const LibraryStore = requireStore();
    const activeId = LibraryStore.getActiveLibraryId();
    const isWebGuest =
      window.pianoApi?.isWeb && !window.pianoApi.getSession?.()?.memberId;
    btnImport.disabled = !activeId;
    if (btnImportAudio) btnImportAudio.disabled = !activeId;
    if (btnImport && isWebGuest) {
      btnImport.title = t("import.memberTitle");
    } else if (btnImport) {
      btnImport.title = "";
    }
  }

  function updateHints() {
    const LibraryStore = requireStore();
    const libId = LibraryStore.getActiveLibraryId();
    const lib = libId ? LibraryStore.getLibrary(libId) : null;
    const isWeb = !!window.pianoApi?.isWeb;
    libraryHint.textContent = lib
      ? t("libs.hintSelected", { name: lib.name })
      : isWeb
        ? window.pianoApi.getSession?.()?.memberId
          ? t("libs.hint")
          : t("libs.hintGuest")
        : t("libs.hintDesktop");
    const activeSong = LibraryStore.getActiveSongId();
    let playReady = false;
    try {
      playReady = !!requireMods().Game.hasNotes();
    } catch {
      /* */
    }
    if (lib && activeSong && playReady) {
      songHint.textContent = t("songs.hintPlay");
    } else if (lib) {
      songHint.textContent = lib.songs.length ? t("songs.hintPick") : t("songs.hintAddMidi");
    } else {
      songHint.textContent = t("songs.hintSelectLib");
    }
  }

  function renderLibraries() {
    const LibraryStore = requireStore();
    const libs = LibraryStore.getLibraries();
    libraryList.innerHTML = "";
    const activeId = LibraryStore.getActiveLibraryId();
    if (!libs.length) {
      const empty = document.createElement("li");
      empty.className = "hint";
      empty.textContent = t("libs.empty");
      libraryList.appendChild(empty);
    }
    for (const lib of libs) {
      const li = document.createElement("li");
      li.textContent = lib.name;
      li.title = t("libs.renameTitle");
      li.className = lib.id === activeId ? "active" : "";
      li.addEventListener("click", () => selectLibrary(lib.id));
      li.addEventListener("dblclick", (e) => {
        e.preventDefault();
        openModal(lib.id);
      });
      libraryList.appendChild(li);
    }
    updateImportButtons();
    updateHints();
  }

  function showAudioImportProgress(show) {
    if (!audioImportOverlay) return;
    audioImportOverlay.classList.toggle("hidden", !show);
    if (!show) {
      audioImportBarFill.style.width = "0%";
      audioImportStatus.textContent = "";
      audioImportFile.textContent = "";
    }
  }

  function updateAudioImportProgress({ pct, message, file }) {
    const p = Math.round((pct || 0) * 100);
    audioImportBarFill.style.width = `${p}%`;
    audioImportStatus.textContent = message || "";
    if (file) audioImportFile.textContent = file;
  }

  function renderSongs() {
    const LibraryStore = requireStore();
    const lib = LibraryStore.getLibrary(LibraryStore.getActiveLibraryId());
    songList.innerHTML = "";
    if (!lib) {
      updateHints();
      return;
    }
    const activeSongId = LibraryStore.getActiveSongId();
    if (!lib.songs.length) {
      const empty = document.createElement("li");
      empty.className = "hint";
      empty.textContent = t("songs.empty");
      songList.appendChild(empty);
    }
    for (const song of lib.songs) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = song.name;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn small";
      del.textContent = "×";
      del.title = t("songs.delete");
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSong(song.id);
      });
      li.appendChild(name);
      li.appendChild(del);
      li.className = song.id === activeSongId ? "active" : "";
      li.addEventListener("click", () => selectSong(song.id));
      songList.appendChild(li);
    }
    updateHints();
  }

  async function selectLibrary(id) {
    const LibraryStore = requireStore();
    LibraryStore.setActiveLibrary(id);
    renderLibraries();
    renderSongs();
    resetTrackSelectEmpty();
    trackSelect.disabled = true;
    btnPlay.disabled = true;
    try {
      requireMods().Game.stop();
    } catch {
      /* oyun modülü yok */
    }
  }

  async function selectSong(songId) {
    const LibraryStore = requireStore();
    try {
      LibraryStore.setActiveSong(songId);
      renderSongs();
      const song = LibraryStore.getActiveSong();
      if (!song) return;

      const parsed = await LibraryStore.loadSongMidi(song);
      if (parsed.error) {
        toast(parsed.error, true);
        return;
      }
      if (!parsed.tracks.length) {
        toast(t("toast.noNotes"), true);
        return;
      }

      trackSelect.innerHTML = "";
      parsed.tracks.forEach((track, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        const inst = track.instrument ? ` — ${track.instrument}` : "";
        opt.textContent = t("songs.trackOption", {
          name: track.name,
          count: track.noteCount,
          inst,
        });
        trackSelect.appendChild(opt);
      });
      trackSelect.disabled = false;
      LibraryStore.setTrackIndex(0);
      trackSelect.value = "0";
      await reloadTrackNotes();
      try {
        btnPlay.disabled = !requireMods().Game.hasNotes();
      } catch {
        btnPlay.disabled = false;
      }
      toast(t("toast.songLoaded", { name: song.name }));
    } catch (err) {
      toast(t("toast.songLoadFail", { msg: err.message }), true);
    }
  }

  async function deleteSong(songId) {
    const LibraryStore = requireStore();
    try {
      await LibraryStore.deleteSong(LibraryStore.getActiveLibraryId(), songId);
      renderSongs();
      resetTrackSelectEmpty();
      trackSelect.disabled = true;
      try {
        requireMods().Game.stop();
      } catch {
        /* */
      }
      btnPlay.disabled = true;
      toast(t("toast.songDeleted"));
    } catch (err) {
      toast(t("toast.deleteFail", { msg: err.message }), true);
    }
  }

  function showFeedback(type, points) {
    if (type === "complete") {
      toast(t("toast.trackDone"));
      try {
        requireMods().Game.setAutoPlayMode(false);
      } catch {
        /* */
      }
      syncTransportButtons();
      return;
    }
    const el = document.createElement("div");
    el.className = `feedback-pop ${type}`;
    el.textContent = type === "good" ? t("feedback.good", { points }) : t("feedback.miss");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function onTimeUpdate(t) {
    timeCurrent.textContent = t.currentText;
    timeTotal.textContent = t.totalText;
    timeRemaining.textContent = t.remainingText;
    progressFill.style.width = `${t.percent}%`;
    if (progressThumb) progressThumb.style.left = `${t.percent}%`;
  }

  function seekFromPointer(clientX) {
    const { Game } = requireMods();
    const dur = Game.getSongDuration();
    if (!dur || !progressTrack) return;
    const rect = progressTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    Game.seekTo(pct * dur);
  }

  function bindProgressSeek() {
    if (!progressTrack) return;
    let dragging = false;
    const onMove = (e) => {
      if (!dragging) return;
      seekFromPointer(e.clientX);
    };
    const stopDrag = () => {
      dragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stopDrag);
    };
    progressTrack.addEventListener("pointerdown", (e) => {
      try {
        if (!requireMods().Game.getSongDuration()) return;
      } catch {
        return;
      }
      dragging = true;
      progressTrack.setPointerCapture?.(e.pointerId);
      seekFromPointer(e.clientX);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", stopDrag);
    });
  }

  function onScoreChange({ score, combo }) {
    scoreValue.textContent = String(score);
    comboValue.textContent = combo > 1 ? `×${combo}` : "";
    if (combo >= 5 && combo % 5 === 0 && combo !== lastComboShown) {
      lastComboShown = combo;
      comboFlare.textContent = `COMBO ×${combo}!`;
      comboFlare.classList.remove("hidden");
      setTimeout(() => comboFlare.classList.add("hidden"), 500);
    }
  }

  btnNewLib.addEventListener("click", () => openModal());
  libraryCancel.addEventListener("click", closeModal);
  libraryBackdrop.addEventListener("click", closeModal);

  libraryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveLibraryName(libraryNameInput.value);
  });

  inlineLibraryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    editingLibraryId = null;
    const ok = await saveLibraryName(inlineLibraryName.value);
    if (ok) inlineLibraryName.value = "";
  });

  btnImport.addEventListener("click", async () => {
    const LibraryStore = requireStore();
    const libId = LibraryStore.getActiveLibraryId();
    if (!libId) {
      toast(t("toast.pickLib"), true);
      return;
    }
    try {
      try {
        requireMods().AudioEngine.ensure();
      } catch {
        /* ses yoksa da MIDI eklenebilir */
      }
      const imported = await window.pianoApi.importMidi(libId);
      if (!imported.length) return;
      await LibraryStore.importSongs(libId, imported);
      LibraryStore.setActiveLibrary(libId);
      renderLibraries();
      renderSongs();
      const cloud = window.pianoApi.isMember?.();
      toast(
        cloud
          ? t("toast.midiCloud", { n: imported.length })
          : t("toast.midiLocal", { n: imported.length })
      );
    } catch (err) {
      toast(t("toast.midiFail", { msg: err.message }), true);
    }
  });

  let unbindAudioProgress = null;
  btnImportAudio?.addEventListener("click", async () => {
    const LibraryStore = requireStore();
    const libId = LibraryStore.getActiveLibraryId();
    if (!libId) {
      toast(t("toast.pickLib"), true);
      return;
    }
    if (!window.pianoApi?.importAudio) {
      toast(t("toast.audioNoImport"), true);
      return;
    }
    if (btnImportAudio) btnImportAudio.disabled = true;
    btnImport.disabled = true;
    showAudioImportProgress(true);
    unbindAudioProgress?.();
    unbindAudioProgress = window.pianoApi.onAudioProgress(updateAudioImportProgress);

    try {
      const imported = await window.pianoApi.importAudio(libId);
      if (!imported.length) {
        toast(t("toast.importCancel"));
        return;
      }
      await LibraryStore.importSongs(libId, imported);
      renderSongs();
      const totalNotes = imported.reduce((s, x) => s + (x.noteCount || 0), 0);
      toast(t("toast.audioConverted", { n: imported.length, notes: totalNotes }));
      if (imported.length === 1) {
        LibraryStore.setActiveSong(imported[0].id);
        await selectSong(imported[0].id);
      }
    } catch (err) {
      toast(t("toast.convertFail", { msg: err.message }), true);
    } finally {
      unbindAudioProgress?.();
      unbindAudioProgress = null;
      showAudioImportProgress(false);
      const activeId = LibraryStore.getActiveLibraryId();
      btnImport.disabled = !activeId;
      if (btnImportAudio) btnImportAudio.disabled = !activeId;
    }
  });

  trackSelect.addEventListener("change", () => reloadTrackNotes());
  octaveStart.addEventListener("change", () => {
    persistSettings({ octaveLockManual: true, autoKeyboardFromSong: false });
    populateOctaveSelects(Number(octaveStart.value), Number(octaveCount.value));
    rebuildPiano();
  });
  octaveCount.addEventListener("change", () => {
    persistSettings({ octaveLockManual: true, autoKeyboardFromSong: false });
    rebuildPiano();
  });

  keyWidthRange.addEventListener("input", () => {
    const w = Number(keyWidthRange.value);
    keyWidthLabel.textContent = `${w} px`;
    const h = Number(keyHeightRange.value);
    applyInstrumentKeySize(w, h);
    persistSettings({ keyWidth: w, octaveLockManual: true });
    reloadTrackNotes();
  });

  keyHeightRange.addEventListener("input", () => {
    const h = Number(keyHeightRange.value);
    keyHeightLabel.textContent = `${h} px`;
    const w = Number(keyWidthRange.value);
    applyInstrumentKeySize(w, h);
    persistSettings({ keyHeight: h, octaveLockManual: true });
    reloadTrackNotes();
  });

  stringVibratoSens?.addEventListener("input", () => {
    const v = Number(stringVibratoSens.value);
    if (vibratoSensLabel) vibratoSensLabel.textContent = vibratoSensLabelText(v);
    persistSettings({ stringVibratoSens: v / 100 });
  });

  guitarGripAllStrings?.addEventListener("change", () => {
    persistSettings({ guitarGripAllStrings: guitarGripAllStrings.checked });
    window.Guitar?.applyLayout?.();
  });

  violinGripAllStrings?.addEventListener("change", () => {
    persistSettings({ violinGripAllStrings: violinGripAllStrings.checked });
    window.Violin?.applyLayout?.();
  });

  guitarNeckNearbyTouch?.addEventListener("change", () => {
    persistSettings({ guitarNeckNearbyTouch: guitarNeckNearbyTouch.checked });
  });

  violinNeckNearbyTouch?.addEventListener("change", () => {
    persistSettings({ violinNeckNearbyTouch: violinNeckNearbyTouch.checked });
  });

  guitarStringsNearbyTouch?.addEventListener("change", () => {
    persistSettings({ guitarStringsNearbyTouch: guitarStringsNearbyTouch.checked });
  });

  violinStringsNearbyTouch?.addEventListener("change", () => {
    persistSettings({ violinStringsNearbyTouch: violinStringsNearbyTouch.checked });
  });

  [guitarNeckHeight, guitarStringHeight, guitarNeckWidth, guitarPluckWidth].forEach((el) => {
    el?.addEventListener("input", applyFrettedLayoutFromSliders);
  });

  window.addEventListener("touch-piano:play-mode", (e) => {
    updateSettingsForPlayMode(e.detail?.mode);
  });

  pianoDock?.addEventListener("change", () => {
    persistSettings({ pianoDock: pianoDock.value });
    applyPianoLayout(AppSettings.load());
  });

  pianoAlign?.addEventListener("change", () => {
    const align = pianoAlign.value;
    persistSettings({ pianoAlign: align });
    const s = AppSettings.load();
    requireMods().Piano.setAutoFit(align === "stretch");
    applyPianoLayout(s);
    rebuildKeyboardFromSettings();
  });

  instrumentSelect?.addEventListener("change", () => {
    const id = instrumentSelect.value;
    requireMods().AudioEngine.setInstrument(id);
    persistSettings({ instrumentId: id });
    toast(t("toast.sound", { name: instrumentSelect.selectedOptions[0]?.textContent || id }));
  });

  playModeSelect?.addEventListener("change", () => {
    try {
      const m = applyPlayMode(playModeSelect.value, { force: true });
      reloadTrackNotes();
      updateSettingsForPlayMode(m);
      toast(t("toast.instrument", { name: window.PlaySurface.getModes()[m]?.label || m }));
    } catch (err) {
      console.error(err);
      updateSettingsForPlayMode(playModeSelect.value);
      toast(t("toast.instrumentRefreshFail", { msg: err.message }), true);
    }
  });

  btnMoveInstrument?.addEventListener("click", () => {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "piano") {
      toast(t("toast.moveHintPiano"));
      return;
    }
    const IM = window.InstrumentMove;
    if (IM) IM.setMoveMode(!IM.isMoveMode());
  });

  dynamicPressure.addEventListener("change", () => {
    requireMods().AudioEngine.setDynamicPressure(dynamicPressure.checked);
    persistSettings({ dynamicPressure: dynamicPressure.checked });
    toast(dynamicPressure.checked ? t("toast.dynamicOn") : t("toast.dynamicOff"));
  });

  sustainRange?.addEventListener("input", () => {
    const ms = Number(sustainRange.value);
    if (sustainLabel) sustainLabel.textContent = `${ms} ms`;
    requireMods().AudioEngine.setSustainMs(ms);
    persistSettings({ sustainMs: ms });
  });

  sustainRange?.addEventListener("change", () => {
    toast(t("toast.sustainMs", { ms: Number(sustainRange.value) }));
  });

  speedRange.addEventListener("input", () => {
    const pct = Number(speedRange.value);
    speedLabel.textContent = `${pct}%`;
    requireMods().Game.setSpeed(pct / 100);
    persistSettings({ speed: pct });
  });

  timingWindow.addEventListener("input", () => {
    const ms = Number(timingWindow.value);
    timingLabel.textContent = `${ms} ms`;
    requireMods().Game.setTimingWindow(ms);
    persistSettings({ timingWindow: ms });
  });

  labelMode.addEventListener("change", () => {
    const mode = labelMode.value;
    persistSettings({ labelMode: mode });
    applyLabelSettings(AppSettings.load());
  });

  labelPreset.addEventListener("change", () => {
    persistSettings({ labelPreset: labelPreset.value });
    applyLabelSettings(AppSettings.load());
  });

  btnApplyLabels.addEventListener("click", () => {
    persistSettings({ customLabels: customLabels.value });
    applyLabelSettings(AppSettings.load());
    toast(t("toast.labelsUpdated"));
  });

  customLabels.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnApplyLabels.click();
  });

  flameRange.addEventListener("input", () => {
    const v = Number(flameRange.value);
    const intensity = v / 100;
    flameLabel.textContent = flameLabelText(v);
    requireMods().Game.setFlameIntensity(intensity);
    persistSettings({ flameIntensity: intensity });
  });

  flameStyle.addEventListener("change", () => {
    const id = flameStyle.value;
    requireMods().Game.setFlameStyle(id);
    persistSettings({ flameStyle: id });
    toast(t("toast.flameStyle", { name: window.FlameStyles?.getStyleName(id) || id }));
  });

  function applyTrim() {
    const start = Number(trimStartInput?.value) || 0;
    const end = Number(trimEndInput?.value) || 0;
    persistSettings({ trimStart: start, trimEnd: end });
    try {
      requireMods().Game.setTrim(start, end);
      reloadTrackNotes();
      toast(t("toast.trim", { start, end }));
    } catch {
      /* */
    }
  }

  trimStartInput?.addEventListener("change", applyTrim);
  trimEndInput?.addEventListener("change", applyTrim);

  setupSettingsTabs();
  setupSidebarTabs();
  effectHueInput?.addEventListener("input", persistThemeFromInputs);
  keyColorTopInput?.addEventListener("input", persistThemeFromInputs);
  keyColorMidInput?.addEventListener("input", persistThemeFromInputs);
  keyColorBottomInput?.addEventListener("input", persistThemeFromInputs);
  hitLineColorInput?.addEventListener("input", persistThemeFromInputs);

  labelAssignSave?.addEventListener("click", saveLabelAssign);
  labelAssignCancel?.addEventListener("click", closeLabelAssignModal);
  labelAssignBackdrop?.addEventListener("click", closeLabelAssignModal);
  labelAssignClear?.addEventListener("click", () => {
    labelAssignInput.value = "";
    saveLabelAssign();
  });
  labelAssignInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveLabelAssign();
    if (e.key === "Escape") closeLabelAssignModal();
  });

  window.addEventListener("piano:edit-label", (e) => {
    openLabelAssignModal(e.detail?.midi);
  });

  keyboardEnabled.addEventListener("change", () => {
    const on = keyboardEnabled.checked;
    window.KeyboardInput?.setEnabled(on);
    if (on) window.KeyboardInput?.rebuild?.();
    persistSettings({ keyboardEnabled: on });
    toast(on ? t("toast.kbOn") : t("toast.kbOff"));
  });

  keyboardLayout?.addEventListener("change", () => {
    const id = keyboardLayout.value;
    window.KeyboardLayout?.setLayoutId(id);
    persistSettings({ keyboardLayout: id });
    updateKeyboardLayoutHint();
    window.KeyboardInput?.rebuild?.();
    toast(
      id === "auto"
        ? t("toast.kbLayoutAuto")
        : t("toast.kbLayoutPick", {
            name: keyboardLayout.options[keyboardLayout.selectedIndex].text,
          })
    );
  });

  let keyboardLayoutSaveTimer = null;
  window.addEventListener("keydown", () => {
    if (keyboardLayout?.value !== "auto") return;
    updateKeyboardLayoutHint();
    clearTimeout(keyboardLayoutSaveTimer);
    keyboardLayoutSaveTimer = setTimeout(() => {
      if (window.KeyboardLayout?.getLearnedObject) {
        persistSettings({ keyboardLearned: window.KeyboardLayout.getLearnedObject() });
      }
    }, 800);
  });

  btnToggleSidebar.addEventListener("click", () => {
    const hidden = document.body.classList.contains("sidebar-hidden");
    setSidebarVisible(hidden);
  });

  btnFullscreen.addEventListener("click", () => toggleFullscreen());

  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.code === "Escape" && document.body.classList.contains("sidebar-hidden") === false) {
      /* Esc tam ekrandan çıkar — Electron halleder */
    }
  });

  btnPlay.addEventListener("click", () => {
    const { AudioEngine, Game } = requireMods();
    Game.setAutoPlayMode(false);
    AudioEngine.ensure();
    if (Game.isPlaying()) {
      Game.pause();
      syncTransportButtons();
    } else {
      Game.play();
      syncTransportButtons({ playing: true });
      btnStop.disabled = false;
    }
  });

  btnAutoPlay?.addEventListener("click", () => {
    const { AudioEngine, Game } = requireMods();
    AudioEngine.ensure();
    Game.setAutoPlayMode(true);
    if (Game.isPlaying()) {
      Game.pause();
      syncTransportButtons();
    } else {
      Game.play();
      syncTransportButtons({ playing: true, autoPlaying: true });
      btnStop.disabled = false;
      toast(t("toast.autoPlayOn"));
    }
  });

  btnStop.addEventListener("click", () => {
    const { Game, PlaySurface } = requireMods();
    Game.setAutoPlayMode(false);
    PlaySurface.releaseAll?.();
    window.KeyboardInput?.releaseAll?.();
    Game.resetRound();
    syncTransportButtons();
    btnPlay.disabled = !Game.hasNotes();
    btnAutoPlay.disabled = !Game.hasNotes();
    btnStop.disabled = true;
  });

  applyThemeFromSettings(AppSettings.load());

  localeSelect?.addEventListener("change", () => {
    const pref = localeSelect.value || "auto";
    AppSettings.save({ locale: pref });
    window.I18n.setPreference(pref);
    applyAppTranslations();
    renderLibraries();
    renderSongs();
  });

  window.addEventListener("staveflow:locale", () => applyAppTranslations());

  (async function boot() {
    const smokeBoot = new URLSearchParams(window.location.search).has("smoke");
    const savedLoc = AppSettings.load().locale;
    if (savedLoc) window.I18n.setPreference(savedLoc);
    else window.I18n.init();
    window.__appVersion = APP_VERSION;
    window.__appName = APP_NAME;
    if (appVersion) appVersion.textContent = `${APP_NAME} ${APP_VERSION}`;
    applyAppTranslations();
    syncPlatformUI();
    bindProgressSeek();
    window.__bootStatus = "başlıyor";

    if (smokeBoot) {
      AppSettings.save({ instrumentPromptDone: true });
    }

    let cloudLibError = null;
    const libraryBootPromise = (async () => {
      try {
        if (window.pianoApi?.isWeb && window.pianoApi.waitForSession) {
          await window.pianoApi.waitForSession(4500);
        }
        try {
          await requireStore().load();
        } catch (loadErr) {
          cloudLibError = loadErr.message;
          if (!window.pianoApi?.isWeb) throw loadErr;
        }
        if (window.StarterLibrary?.ensure) {
          try {
            await window.StarterLibrary.ensure(requireStore());
          } catch (err) {
            console.warn("Örnek kütüphane:", err);
          }
        }
        return true;
      } catch (err) {
        window.__bootStatus = "hata: " + err.message;
        if (window.pianoApi?.isWeb) {
          cloudLibError = cloudLibError || err.message;
          return false;
        }
        toast(t("toast.bootLibError", { msg: err.message }), true);
        console.error(err);
        return false;
      }
    })();

    if (!smokeBoot) {
      try {
        if (window.IntroSplash?.play) {
          await window.IntroSplash.play();
        }
      } catch (err) {
        console.warn("Intro:", err);
      }
    }

    try {
      const { PlaySurface, Game, AppSettings } = requireMods();
      Game.init($("#notesCanvas"), {
        onScoreChange,
        onFeedback: showFeedback,
        onTimeUpdate,
      });
      PlaySurface.init(
        (midi) => Game.handleKeyPress(midi),
        () => {}
      );
      if (window.InstrumentMove) window.InstrumentMove.applyLayout(AppSettings.load());
      applySettings(AppSettings.load());
      scheduleInstrumentLayoutSync();
      window.KeyboardInput?.bind?.();
      window.KeyboardInput?.rebuild?.();
      if (!smokeBoot) showInstrumentPickerIfNeeded();
      updateSettingsForPlayMode(PlaySurface.getMode());
      applyAppTranslations();
      window.__bootStatus = "piyano hazır";
    } catch (err) {
      window.__bootStatus = "piyano hata: " + err.message;
      toast(t("toast.pianoWarn", { msg: err.message }), true);
      console.error(err);
    }

    const libOk = await libraryBootPromise;
    if (libOk) {
      window.__bootStatus = "kütüphane yüklendi";
      renderLibraries();
      renderSongs();
      updateImportButtons();
    } else if (window.pianoApi?.isWeb) {
      renderLibraries();
      updateImportButtons();
    } else if (!libOk) {
      return;
    }

    if (cloudLibError) {
      if (window.pianoApi?.isMember?.()) {
        toast(t("toast.cloudLibError", { msg: cloudLibError }), true);
      } else if (window.pianoApi?.isWeb) {
        toast(t("toast.bootGuest"), false);
      }
    }

    let lastCloudMemberId = window.pianoApi.getSession?.().memberId || null;
    window.addEventListener("touch-piano:session", async (e) => {
      const mid = e.detail?.memberId || null;
      if (mid && mid !== lastCloudMemberId) {
        lastCloudMemberId = mid;
        try {
          await requireStore().reload();
          if (window.StarterLibrary?.ensure) {
            await window.StarterLibrary.ensure(requireStore());
          }
          renderLibraries();
          renderSongs();
        } catch (err) {
          console.error(err);
          toast(t("toast.cloudLibError", { msg: err.message }), true);
        }
      } else if (!mid) {
        lastCloudMemberId = null;
      }
      updateImportButtons();
      updateHints();
    });

    try {
      const demo =
        requireStore().getLibrary("lib-starter") ||
        requireStore().getLibrary("lib-demo");
      if (demo) {
        requireStore().setActiveLibrary(demo.id);
        renderLibraries();
        renderSongs();
        if (demo.songs.length) {
          await selectSong(demo.songs[0].id);
        }
        window.__bootStatus = "hazır";
      }
    } catch (err) {
      window.__bootStatus = "demo hata: " + err.message;
      toast(t("toast.demoError", { msg: err.message }), true);
      console.error(err);
    }

    applyAppTranslations();
    scheduleInstrumentLayoutSync();
    setTimeout(scheduleInstrumentLayoutSync, 150);
    setTimeout(() => {
      try {
        window.dispatchEvent(new Event("resize"));
        requireMods().Game.resize();
      } catch {
        /* */
      }
    }, 400);
    window.dispatchEvent(new CustomEvent("staveflow:booted"));
  })();
})();

