<script setup>
/**
 * ============================================================================
 * @file        ScannerQR.vue
 * @description Ferramenta de leitura de códigos QR para identificação rápida.
 * Permite abrir uma O.S. ou histórico apenas apontando a câmera para a etiqueta.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - vue-qrcode-reader (ou similar): Para processamento de imagem em tempo real.
 * * @functions
 * - onDetect(): Processa o código lido e redireciona para o serviço correspondente.
 * ============================================================================
 */

import { onMounted, onUnmounted } from "vue";
import { Html5QrcodeScanner } from "html5-qrcode";

const emit = defineEmits(["detectado", "fechar"]);

let html5QrcodeScanner = null;

onMounted(() => {
  // Configuração do Scanner
  html5QrcodeScanner = new Html5QrcodeScanner(
    "reader",
    {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    },
    false,
  );

  function onScanSuccess(decodedText) {
    // Para a câmera imediatamente após a leitura
    html5QrcodeScanner
      .clear()
      .then(() => {
        emit("detectado", decodedText);
      })
      .catch((err) => {
        console.error("Erro ao parar scanner:", err);
        emit("detectado", decodedText);
      });
  }

  html5QrcodeScanner.render(onScanSuccess, (err) => {
    // Erros de leitura (comum enquanto a câmera foca) são ignorados para não poluir o log
  });
});

onUnmounted(() => {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
  }
});
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('fechar')">
    <div class="modal-content" style="max-width: 500px">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        "
      >
        <h3 style="margin: 0; color: var(--primary)">
          📷 Escanear Instrumento
        </h3>
        <button class="btn-icon" @click="$emit('fechar')">✖</button>
      </div>

      <div
        id="reader"
        style="width: 100%; border-radius: 8px; overflow: hidden; border: none"
      ></div>

      <p
        class="text-muted"
        style="text-align: center; margin-top: 15px; font-size: 0.9rem"
      >
        Posicione o QR Code da etiqueta dentro do quadrado.
      </p>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: white;
  padding: 20px;
  border-radius: var(--radius);
  width: 90%;
}
/* Estilização interna da lib html5-qrcode para ficar mais limpa */
#reader button {
  padding: 8px 12px;
  background-color: var(--primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}
#reader img {
  display: none;
} /* Esconde o ícone de imagem da lib */
</style>
