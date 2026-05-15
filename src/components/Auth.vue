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
import { useI18n } from "vue-i18n";

const loading = ref(false);
const email = ref("");
const password = ref("");
const isLogin = ref(true);
const message = ref(""); // Centralizado para exibir sucessos e erros
const { t } = useI18n();

async function handleAuth() {
  loading.value = true;
  message.value = "";

  try {
    if (!isLogin.value) {
      if (password.value.length < 6) {
        throw new Error(t('auth.erro_senha_curta'));
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
      message.value = t('auth.conta_criada');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (error) throw error;
    }
  } catch (error) {
    message.value = t('auth.erro_prefixo') + error.message;
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
        {{ $t('auth.titulo') }}
      </h1>
      <h3
        style="
          text-align: center;
          margin-bottom: 30px;
          color: var(--text-muted);
        "
      >
        {{ isLogin ? $t('auth.entrar') : $t('auth.criar_conta') }}
      </h3>

      <div class="form-group">
        <label>{{ $t('auth.email') }}</label>
        <input v-model="email" type="email" :placeholder="$t('auth.email_placeholder')" />
      </div>

      <div class="form-group">
        <label>{{ $t('auth.senha') }}</label>
        <input v-model="password" type="password" placeholder="********" />
      </div>

      <button type="button"
        class="btn-primary"
        @click="handleAuth"
        :disabled="loading"
        style="width: 100%; padding: 12px; margin-top: 10px; font-size: 1.1rem"
      >
        {{ loading ? $t('auth.aguarde') : isLogin ? $t('auth.entrar') : $t('auth.registrar') }}
      </button>

      <p
        v-if="message"
        class="auth-message"
        :class="{ 'text-danger': message.includes($t('auth.erro_prefixo').trim()) }"
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
            isLogin ? $t('auth.nao_tem_conta') : $t('auth.ja_tem_conta')
          }}
        </button>
        <h6 style="margin-top: 10px; opacity: 0.5">{{ $t('auth.versao_beta') }}</h6>
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
