<script setup>
/**
 * ============================================================================
 * @file        Auth.vue
 * @description Componente de autenticação. Corrigido para sincronizar
 * variáveis de estado com o template (isLogin e message).
 * ============================================================================
 */
import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";

const loading = ref(false);
const email = ref("");
const password = ref("");
const isLogin = ref(true);
const message = ref(""); // Centralizado para exibir sucessos e erros

async function handleAuth() {
  loading.value = true;
  message.value = "";

  try {
    if (!isLogin.value) {
      if (password.value.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }
      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          // Isto pega automaticamente o domínio atual ou IP que está no navegador
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      message.value = "Conta criada! Verifique o seu e-mail para confirmar.";
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (error) throw error;
    }
  } catch (error) {
    message.value = "Erro: " + error.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="card auth-card">
      <h1
        style="
          text-align: center;
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico" style="font-size: 2.5rem">music_note</span>
        Gestão Luthieria
      </h1>
      <h3
        style="
          text-align: center;
          margin-bottom: 30px;
          color: var(--text-muted);
        "
      >
        {{ isLogin ? "Entrar" : "Criar Conta de Luthier" }}
      </h3>

      <div class="form-group">
        <label>E-mail</label>
        <input v-model="email" type="email" placeholder="seu@email.com" />
      </div>

      <div class="form-group">
        <label>Senha</label>
        <input v-model="password" type="password" placeholder="********" />
      </div>

      <button type="button"
        class="btn-primary"
        @click="handleAuth"
        :disabled="loading"
        style="width: 100%; padding: 12px; margin-top: 10px; font-size: 1.1rem"
      >
        {{ loading ? "⏳ Aguarde..." : isLogin ? "Entrar" : "Registar" }}
      </button>

      <p
        v-if="message"
        class="auth-message"
        :class="{ 'text-danger': message.includes('Erro') }"
      >
        {{ message }}
      </p>

      <div style="text-align: center; margin-top: 20px">
        <button type="button"
          class="btn-icon"
          style="color: var(--accent); text-decoration: underline"
          @click="
            isLogin = !isLogin;
            message = '';
          "
        >
          {{
            isLogin ? "Não tem conta? Registe-se" : "Já tem conta? Fazer Login"
          }}
        </button>
        <h6 style="margin-top: 10px; opacity: 0.5">versão beta</h6>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--bg-body);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 40px 30px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}
.auth-message {
  text-align: center;
  margin-top: 15px;
  font-weight: bold;
  color: var(--success);
}
</style>
