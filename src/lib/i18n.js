import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import uz from '../locales/uz.json'
import ru from '../locales/ru.json'
import en from '../locales/en.json'

export const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en']
const STORAGE_KEY = 'nontizimi_language'

function getInitialLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored
  return 'uz'
}

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'uz',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return
  localStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

export function localeTag(lang) {
  return { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }[lang] || 'uz-UZ'
}

export default i18n
