<script setup>
import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";

const loading = ref(false);
const email = ref("");
const password = ref("");
const isLogin = ref(true); // Alterado para coincidir com o template
const errorMsg = ref("");
const successMsg = ref("");

async function handleAuth() {
  loading.value = true;
  errorMsg.value = "";
  successMsg.value = "";

  try {
    if (!isLogin.value) {
      if (password.value.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }
      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      });
      if (error) throw error;
      successMsg.value = "Conta criada! Verifique o seu e-mail.";
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (error) throw error;
    }
  } catch (error) {
    errorMsg.value = error.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="card auth-card">
      <h1 style="text-align: center; color: var(--primary)">
        🎸 Gestão Luthieria
      </h1>
      <h3
        style="
          text-align: center;
          margin-bottom: 30px;
          color: var(--text-muted);
        "
      >
        {{ isLogin ? "Entrar" : "Criar Conta" }}
      </h3>

      <div class="form-group">
        <label>E-mail</label>
        <input v-model="email" type="email" placeholder="seu@email.com" />
      </div>

      <div class="form-group">
        <label>Senha</label>
        <input v-model="password" type="password" placeholder="********" />
      </div>

      <button
        class="btn-primary"
        @click="handleAuth"
        :disabled="loading"
        style="width: 100%; padding: 12px; margin-top: 10px; font-size: 1.1rem"
      >
        {{ loading ? "⏳ Aguarde..." : isLogin ? "Entrar" : "Registar" }}
      </button>

      <p v-if="errorMsg" class="auth-message text-danger">{{ errorMsg }}</p>
      <p v-if="successMsg" class="auth-message text-success">
        {{ successMsg }}
      </p>

      <div style="text-align: center; margin-top: 20px">
        <button
          class="btn-icon"
          style="color: var(--accent); text-decoration: underline"
          @click="
            isLogin = !isLogin;
            errorMsg = '';
            successMsg = '';
          "
        >
          {{ isLogin ? "Não tem conta? Registe-se" : "Já tem conta? Login" }}
        </button>
        <h6 style="margin-top: 10px; opacity: 0.5">versão beta</h6>
      </div>
    </div>
  </div>
</template>
