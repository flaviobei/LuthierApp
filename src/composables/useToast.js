/**
 * src/composables/useToast.js
 * Sistema global de notificações (Toast).
 */
import { ref } from "vue";

const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref("success"); // 'success', 'error', 'info'
let timeoutId = null;

export function useToast() {
  const triggerToast = (message, type = "success") => {
    toastMessage.value = message;
    toastType.value = type;
    showToast.value = true;

    // Limpa o timeout anterior se o utilizador clicar várias vezes rápido
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Esconde a mensagem após 3.5 segundos
    timeoutId = setTimeout(() => {
      showToast.value = false;
    }, 3500);
  };

  return {
    showToast,
    toastMessage,
    toastType,
    triggerToast,
  };
}
