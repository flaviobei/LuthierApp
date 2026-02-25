<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";

const userEmail = ref("");
const novoEmail = ref("");
const novaSenha = ref("");
const loading = ref(false);
const mensagem = ref({ texto: "", tipo: "" });

async function carregarUsuario() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    userEmail.value = user.email;
  }
}

async function atualizarConta() {
  loading.value = true;
  mensagem.value = { texto: "", tipo: "" };

  const atualizacoes = {};
  if (novoEmail.value && novoEmail.value !== userEmail.value) {
    atualizacoes.email = novoEmail.value;
  }
  if (novaSenha.value) {
    atualizacoes.password = novaSenha.value;
  }

  if (Object.keys(atualizacoes).length === 0) {
    mensagem.value = { texto: "Nenhum dado foi alterado.", tipo: "warning" };
    loading.value = false;
    return;
  }

  const { data, error } = await supabase.auth.updateUser(atualizacoes);

  if (error) {
    mensagem.value = { texto: "Erro: " + error.message, tipo: "danger" };
  } else {
    mensagem.value = {
      texto: atualizacoes.email
        ? "Verifique o seu e-mail para confirmar a alteração de endereço. A senha foi atualizada (se preenchida)."
        : "Credenciais atualizadas com sucesso!",
      tipo: "success",
    };
    novoEmail.value = "";
    novaSenha.value = "";
    carregarUsuario();
  }
  loading.value = false;
}

onMounted(() => carregarUsuario());
</script>

<template>
  <div class="card">
    <h3 class="title-section" style="margin-top: 0">🔐 Segurança e Acesso</h3>

    <div class="box" style="margin-bottom: 20px; background: var(--bg-body)">
      <p style="margin-top: 0; color: var(--text-muted)">
        A sua conta atual está registada com o e-mail:
        <strong style="color: var(--primary)">{{ userEmail }}</strong>
      </p>
    </div>

    <div class="form-group">
      <label>Alterar E-mail de Acesso (Opcional):</label>
      <input
        v-model="novoEmail"
        type="email"
        placeholder="Novo endereço de e-mail..."
      />
      <small class="text-muted" style="display: block; margin-top: 5px"
        >* Será enviado um link de confirmação para o novo e-mail.</small
      >
    </div>

    <div class="form-group" style="margin-top: 20px">
      <label>Alterar Senha (Opcional):</label>
      <input
        v-model="novaSenha"
        type="password"
        placeholder="Digite uma nova senha forte..."
      />
      <small class="text-muted" style="display: block; margin-top: 5px"
        >* Deixe em branco se não quiser alterar a senha.</small
      >
    </div>

    <div
      v-if="mensagem.texto"
      :class="'box bg-' + mensagem.tipo"
      style="
        margin: 15px 0;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 4px;
        text-align: center;
        font-weight: bold;
      "
    >
      {{ mensagem.texto }}
    </div>

    <button
      class="btn-primary"
      @click="atualizarConta"
      :disabled="loading"
      style="width: 100%; padding: 12px; margin-top: 15px; font-size: 1.1rem"
    >
      {{ loading ? "⏳ A atualizar..." : "💾 Salvar Alterações" }}
    </button>
  </div>
</template>

<style scoped>
.bg-success {
  background-color: var(--success);
}
.bg-danger {
  background-color: var(--danger);
}
.bg-warning {
  background-color: var(--warning);
  color: #333 !important;
}
</style>
