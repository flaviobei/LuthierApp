<script setup>
/**
 * ============================================================================
 * @file        ClienteForm.vue
 * @description Componente de gestão de clientes. Responsável pelo cadastro,
 * edição e listagem dos proprietários dos instrumentos.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast"; // <-- 1. Importa o Toast

const emit = defineEmits(["clienteSalvo"]);

const { triggerToast } = useToast(); // <-- 2. Inicializa o Toast

const form = ref({ nome: "", telefone: "", email: "", cpf_cnpj: "" });
const loading = ref(false);

async function salvarCliente() {
  if (!form.value.nome) {
    // SUBSTITUÍDO: alert() por triggerToast()
    return triggerToast("O nome do cliente é obrigatório!", "error");
  }

  loading.value = true;

  const { error } = await supabase.from("clientes").insert([form.value]);

  loading.value = false;

  if (error) {
    triggerToast("Erro ao cadastrar: " + error.message, "error");
  } else {
    // SUBSTITUÍDO: Mensagem de texto na tela pelo Toast
    triggerToast("Cliente cadastrado com sucesso!", "success");
    form.value = { nome: "", telefone: "", email: "", cpf_cnpj: "" };
    emit("clienteSalvo");
  }
}
</script>

<template>
  <div class="card">
    <h3 class="title-section">👤 Novo Cliente</h3>

    <div class="form-group">
      <label>Nome Completo:</label>
      <input v-model="form.nome" type="text" placeholder="Ex: João da Silva" />
    </div>

    <div class="form-group">
      <label>WhatsApp:</label>
      <input
        v-model="form.telefone"
        type="text"
        placeholder="(00) 00000-0000"
      />
    </div>

    <div class="form-group">
      <label>Email (Opcional):</label>
      <input v-model="form.email" type="email" placeholder="joao@email.com" />
    </div>

    <div class="form-group">
      <label>CPF/CNPJ (Opcional):</label>
      <input v-model="form.cpf_cnpj" type="text" placeholder="000.000.000-00" />
    </div>

    <button
      class="btn-accent"
      style="width: 100%; margin-top: 10px"
      @click="salvarCliente"
      :disabled="loading"
    >
      {{ loading ? "⏳ Salvando..." : "➕ Cadastrar Cliente" }}
    </button>
  </div>
</template>

<style scoped>
/* O design do card, inputs e botões já vem automaticamente do App.vue! */
</style>