<script setup>
import { useToast } from "../composables/useToast";

const { showToast, toastMessage, toastType } = useToast();
</script>

<template>
  <transition name="slide-fade">
    <div v-if="showToast" class="toast-container" :class="'toast-' + toastType">
      <span class="icon-dinamico" style="font-size: 1.5rem; margin-right: 8px">
        {{
          toastType === "success"
            ? "check_circle"
            : toastType === "error"
              ? "cancel"
              : "info"
        }}
      </span>
      <span class="message">{{ toastMessage }}</span>
    </div>
  </transition>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  padding: 15px 25px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  font-weight: 600;
  font-size: 0.95rem;
  min-width: 250px;
  color: white;
}

.toast-success {
  background-color: #10b981; /* Verde */
  border-left: 5px solid #059669;
}

.toast-error {
  background-color: #ef4444; /* Vermelho */
  border-left: 5px solid #b91c1c;
}

.toast-info {
  background-color: #3b82f6; /* Azul */
  border-left: 5px solid #2563eb;
}

.icon {
  font-size: 1.2rem;
}

/* Animação suave de entrada e saída */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.4s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(50px);
  opacity: 0;
}
</style>
