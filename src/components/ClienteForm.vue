<script setup>
import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";

const emit = defineEmits(["clienteSalvo"]);

const form = ref({ nome: "", telefone: "", email: "", cpf_cnpj: "" });
const loading = ref(false);
const mensagem = ref("");

async function salvarCliente() {
  if (!form.value.nome) return alert("O nome é obrigatório!");

  loading.value = true;
  mensagem.value = "";

  const { error } = await supabase.from("clientes").insert([form.value]);

  loading.value = false;

  if (error) {
    mensagem.value = "Erro: " + error.message;
  } else {
    mensagem.value = "Cliente salvo com sucesso!";
    form.value = { nome: "", telefone: "", email: "", cpf_cnpj: "" };
    emit("clienteSalvo");
    setTimeout(() => (mensagem.value = ""), 3000);
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

    <p
      v-if="mensagem"
      class="msg-retorno"
      :class="{ erro: mensagem.includes('Erro') }"
    >
      {{ mensagem }}
    </p>
  </div>
</template>

<style scoped>
/* O design do card, inputs e botões já vem automaticamente do App.vue! */
.msg-retorno {
  margin-top: 15px;
  font-weight: bold;
  text-align: center;
  color: var(--success);
  font-size: 0.9rem;
}
.msg-retorno.erro {
  color: var(--danger);
}
</style>
