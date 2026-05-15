import { createI18n } from 'vue-i18n'
import ptBR from './locales/pt-BR.json'
import en from './locales/en.json'

// Verifica se o idioma do navegador é inglês, caso contrário cai no padrão português
const userLocale = navigator.language.substring(0, 2) === 'en' ? 'en' : 'pt-BR'

export const i18n = createI18n({
  legacy: false, // Necessário false para Vue 3 Composition API (script setup)
  locale: userLocale,
  fallbackLocale: 'pt-BR',
  messages: {
    'pt-BR': ptBR,
    en: en
  }
})
