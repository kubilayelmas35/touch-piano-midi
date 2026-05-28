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
  neckHintGrip: "Çok parmakla birden fazla perdeye basın",
  neckHintSingle: "Her tele ayrı perde — aynı anda birden fazla hücre",
  pluckTitle: "Parmağı kaydırarak tel seçin",
  cardNeckTitle: "Gitar kolu",
  cardPluckTitle: "Teller (titreştir)",
});

window.Guitar = Guitar;
