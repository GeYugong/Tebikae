import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh-CN.json';
import editorEn from './editor-en.json';
import editorZh from './editor-zh-CN.json';

export function detectLanguage(languages: readonly string[]): 'en' | 'zh-CN' {
  for (const language of languages) {
    if (/^zh(?:-|$)/i.test(language)) return 'zh-CN';
    if (/^en(?:-|$)/i.test(language)) return 'en';
  }
  return 'en';
}
let language = detectLanguage(navigator.languages);
try {
  const saved = localStorage.getItem('tebikae.language');
  if (saved === 'en' || saved === 'zh-CN') language = saved;
} catch {
  /* Preferences are optional. */
}
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, editor: editorEn } },
    'zh-CN': { translation: { ...zh, editor: editorZh } },
  },
  lng: language,
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh-CN'],
  interpolation: { escapeValue: false },
});
document.documentElement.lang = language;
i18n.on('languageChanged', (value) => {
  document.documentElement.lang = value;
});
export default i18n;
