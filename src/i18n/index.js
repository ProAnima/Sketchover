import ru from './ru.js';
import en from './en.js';
import de from './de.js';
import es from './es.js';
import fr from './fr.js';
import pt from './pt.js';
import zh from './zh.js';
import ja from './ja.js';
import ko from './ko.js';
import ar from './ar.js';
import hi from './hi.js';

// Названия языков не переводятся: каждый подписан на самом себе.
export const LANGS = {
  ru: { name: 'Русский', dict: ru },
  en: { name: 'English', dict: en },
  de: { name: 'Deutsch', dict: de },
  es: { name: 'Español', dict: es },
  fr: { name: 'Français', dict: fr },
  pt: { name: 'Português', dict: pt },
  zh: { name: '中文', dict: zh },
  ja: { name: '日本語', dict: ja },
  ko: { name: '한국어', dict: ko },
  ar: { name: 'العربية', dict: ar, rtl: true },
  hi: { name: 'हिन्दी', dict: hi },
};

let current = 'en';

export function systemLang() {
  const code = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS[code] ? code : 'en';
}

export const lang = () => current;
export const isRtl = () => Boolean(LANGS[current].rtl);

export function setLang(code) {
  current = LANGS[code] ? code : systemLang();
  document.documentElement.lang = current;
}

// Нет перевода — английский, нет и его — сам ключ (видно в интерфейсе, легко заметить).
export function t(key, params = {}) {
  const text = LANGS[current].dict[key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

// Статичные подписи в разметке: data-i18n — текст, data-i18n-title — подсказка.
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}
