const translations = {
  en: ["Swipe to Color", "Download Now"],
  pt: ["Deslize para colorir", "Baixe agora"],
  es: ["Desliza para colorear", "Descargar ahora"],
  tr: ["Renklendirmek İçin Kaydır", "Şimdi İndir"],
  de: ["Wischen zum Ausmalen", "Jetzt herunterladen"],
  fr: ["Glisse pour colorier", "Télécharger maintenant"],
  pl: ["Przesuń, aby pokolorować", "Pobierz teraz"],
  it: ["Scorri per colorare", "Scarica ora"],
  nl: ["Veeg om in te kleuren", "Nu downloaden"],
  ar: ["اسحب للتلوين", "حمّل الآن"],
  sv: ["Svep för att färglägga", "Ladda ner nu"],
};

function supportedLanguage(value) {
  const code = String(value || "").trim().toLowerCase().split(/[-_]/)[0];
  return code === "se" ? "sv" : Object.hasOwn(translations, code) ? code : null;
}

const previewLanguage = new URLSearchParams(window.location.search).get("language");
export const language = previewLanguage !== null
  ? supportedLanguage(previewLanguage) || "en"
  : (navigator.languages || [navigator.language]).map(supportedLanguage).find(Boolean) || "en";
export const direction = language === "ar" ? "rtl" : "ltr";
export const copy = {
  heading: translations[language][0], cta: translations[language][1],
};

let preparation;
// Shared, bounded font readiness: both text owners settle before the entrance starts.
export function prepareTypography() {
  if (preparation) return preparation;
  preparation = new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const context = document.createElement("canvas").getContext("2d");
      const fit = (text, font, size, width) => {
        if (!context) return size;
        context.font = `${font} ${size}px ${font === 800 ? '"Byrd Simply"' : '"Inter"'}`;
        const actualWidth = Math.max(...text.split("\n").map(line => {
          const measured = context.measureText(line);
          return Math.max(measured.width, Math.abs(measured.actualBoundingBoxLeft || 0) + Math.abs(measured.actualBoundingBoxRight || 0));
        }));
        return Math.min(size, Math.floor(size * width / Math.max(1, actualWidth) * 100) / 100);
      };
      resolve({
        heading: fit(copy.heading, 800, 100, 960), cta: fit(copy.cta, 700, 58.38, 500),
      });
    };
    const timer = setTimeout(finish, 1800);
    if (!document.fonts?.load) { finish(); return; }
    Promise.allSettled([
      document.fonts.load('800 100px "Byrd Simply"', copy.heading),
      document.fonts.load('700 58.38px "Inter"', copy.cta),
    ]).then(finish);
  });
  return preparation;
}
