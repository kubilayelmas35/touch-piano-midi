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
