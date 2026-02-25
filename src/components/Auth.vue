<script setup>
/**
 * ============================================================================
 * @file        Auth.vue
 * @description Componente de autenticação do LuthierApp. Gere o acesso de
 * utilizadores através de e-mail e palavra-passe, permitindo tanto o login
 * de contas existentes como a criação de novos registos (Sign Up).
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - vue: Utilizado para estados reativos (ref).
 * - supabaseClient: Fornece os métodos `signInWithPassword` e `signUp`.
 * * @functions
 * - handleAuth(): Função principal que executa a lógica de autenticação.
 * Diferencia entre login e registo com base no estado `isSignUp`.
 * - toggleMode(): Alterna a interface entre os modos "Entrar" e "Criar Conta",
 * limpando mensagens de erro ou sucesso anteriores.
 * * @notes
 * - Implementa uma validação básica de comprimento de palavra-passe (mín. 6 caracteres).
 * - Utiliza estados de 'loading' para desativar botões durante a comunicação com o servidor.
 * ============================================================================
 */

import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";

// --- ESTADOS DO COMPONENTE ---
const loading = ref(false);
const email = ref("");
const password = ref("");
const isSignUp = ref(false); // Define se o utilizador está a tentar entrar ou registar-se
const errorMsg = ref("");
const successMsg = ref("");

/**
 * Alterna entre o modo de Login e o modo de Registo.
 * Limpa as mensagens de feedback para o utilizador.
 */
function toggleMode() {
  isSignUp.value = !isSignUp.value;
  errorMsg.value = "";
  successMsg.value = "";
}

/**
 * Executa a autenticação via Supabase.
 * Se isSignUp for verdadeiro, tenta criar uma conta.
 * Caso contrário, tenta realizar o login.
 */
async function handleAuth() {
  loading.value = true;
  errorMsg.value = "";
  successMsg.value = "";

  try {
    if (isSignUp.value) {
      // Validação simples antes de enviar para o servidor
      if (password.value.length < 6) {
        throw new Error("A palavra-passe deve ter pelo menos 6 caracteres.");
      }

      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      });
      if (error) throw error;
      successMsg.value = "Conta criada! Verifique o seu e-mail para confirmar.";
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (error) throw error;
    }
  } catch (error) {
    // Captura e exibe erros retornados pelo Supabase ou validações locais
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

      <button
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
        <button
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
        <h6>versão beta</h6>
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
