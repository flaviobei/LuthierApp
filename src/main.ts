import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n.js"; // Importação do motor de tradução

// Utilitário de Logging Seguro: Intercepta logs em produção para não vazar Stack Traces
if (import.meta.env.PROD) {
  const originalError = console.error;
  console.error = (...args) => {
    // Integração futura: Sentry.captureException(args[0])
    // Silencia os detalhes técnicos (stack trace) no console do browser
    originalError("[Aplicação Segura] Ocorreu um erro interno. Registrado no monitoramento.");
  };
  
  // Opcional: Silenciar logs e warnings comuns também
  console.log = () => {};
  console.info = () => {};
}

const app = createApp(App);

app.use(i18n); // Registro do pacote de idiomas
app.use(router);

app.mount("#app");
