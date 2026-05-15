<script setup>
/**
 * ============================================================================
 * @file        ScannerQR.vue
 * @description Leitor de etiquetas refatorado para usar osService.
 * ============================================================================
 */
import { onMounted, onUnmounted, ref } from "vue";
import { Html5QrcodeScanner } from "html5-qrcode";
import { osService } from "../services/osService"; // Importação do Serviço
import { useToast } from "../composables/useToast";
import { useI18n } from "vue-i18n";

const emit = defineEmits(["fechar", "osLida"]);
const { triggerToast } = useToast();
const { t } = useI18n();

const buscando = ref(false);
let scanner = null;

onMounted(() => {
  scanner = new Html5QrcodeScanner(
    "leitor-qr",
    { fps: 10, qrbox: { width: 250, height: 250 } },
    /* verbose= */ false,
  );
  scanner.render(sucessoAoLer, erroAoLer);
});

onUnmounted(() => {
  if (scanner) {
    scanner
      .clear()
      .catch((error) => console.error("Falha ao limpar o scanner", error));
  }
});

async function sucessoAoLer(textoDecodificado) {
  // Regex para validar se é um UUID (ID da O.S.)
  const regexUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!regexUUID.test(textoDecodificado)) return;
  if (buscando.value) return;

  buscando.value = true;
  scanner.pause();

  try {
    // Chamada limpa via Service
    const data = await osService.buscarPorId(textoDecodificado);

    if (!data) {
      triggerToast(t('scanner.nao_encontrada'), "error");
      scanner.resume();
    } else {
      triggerToast(t('scanner.localizada'), "success");
      scanner.clear();
      emit("osLida", data);
    }
  } catch (err) {
    triggerToast(t('scanner.erro') + err.message, "error");
    scanner.resume();
  } finally {
    buscando.value = false;
  }
}

function erroAoLer(err) {
  /* Erros de foco ignorados */
}

function fecharModal() {
  if (scanner) scanner.clear();
  emit("fechar");
}
</script>

<template>
  <div class="modal-overlay">
    <div class="modal-card">
      <div class="flex-between mb-2">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 8px">
          <span class="icon-dinamico">qr_code_scanner</span> {{ $t('scanner.titulo') }}
        </h3>
        <button type="button" class="btn-icon text-danger" @click="fecharModal">
          <span class="icon-dinamico">close</span>
        </button>
      </div>

      <p
        class="text-muted text-center"
        style="font-size: 0.85rem; margin-bottom: 15px"
      >
        {{ $t('scanner.desc') }}
      </p>

      <div id="leitor-qr"></div>

      <div v-if="buscando" class="buscando-overlay">
        <span
          class="icon-dinamico"
          style="
            font-size: 3rem;
            animation: spin 1s linear infinite;
            color: white;
          "
          >sync</span
        >
        <p style="color: white; font-weight: bold; margin-top: 10px">
          {{ $t('scanner.procurando') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Estilos originais mantidos integralmente */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(4px);
}
.modal-card {
  background: white;
  padding: 20px;
  border-radius: var(--radius);
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#leitor-qr {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}
.buscando-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
