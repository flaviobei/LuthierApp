import { createI18n } from "vue-i18n";
import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";

// Verifica o idioma do navegador
const lang = navigator.language.substring(0, 2);
let userLocale = "pt-BR";

// Lista de idiomas suportados (além do padrão pt-BR)
const supportedLocales = ["en", "es", "fr", "it", "ja"];

// Se o idioma do navegador estiver na lista de suportados, usa ele
if (supportedLocales.includes(lang)) {
  userLocale = lang;
}

export const i18n = createI18n({
  legacy: false, // Necessário false para Vue 3 Composition API (script setup)
  locale: userLocale,
  fallbackLocale: "pt-BR",
  messages: {
    "pt-BR": ptBR,
    en: en,
    es: es,
    fr: fr,
    it: it,
    ja: ja,
  },
});
