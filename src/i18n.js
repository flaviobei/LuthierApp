import { createI18n } from 'vue-i18n'
import ptBR from './locales/pt-BR.json'
import en from './locales/en.json'
import es from './locales/es.json'

// Verifica se o idioma do navegador é inglês ou espanhol
const lang = navigator.language.substring(0, 2)
let userLocale = 'pt-BR'
if (lang === 'en') userLocale = 'en'
if (lang === 'es') userLocale = 'es'

export const i18n = createI18n({
  legacy: false, // Necessário false para Vue 3 Composition API (script setup)
  locale: userLocale,
  fallbackLocale: 'pt-BR',
  messages: {
    'pt-BR': ptBR,
    en: en,
    es: es
  }
})
