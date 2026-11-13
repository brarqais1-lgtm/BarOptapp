import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import en from './locales/en.json'

export type SupportedLocale = 'ar' | 'en'
export const DEFAULT_LOCALE: SupportedLocale = 'ar'

export const resources = {
  ar: { translation: ar },
  en: { translation: en },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })

export default i18n

/** Call to switch language and update document direction */
export function setLocale(locale: SupportedLocale): void {
  i18n.changeLanguage(locale)
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = locale
}
