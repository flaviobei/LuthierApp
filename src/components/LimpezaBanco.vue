<script setup>
/**
 * ============================================================================
 * @file        LimpezaBanco.vue
 * @description Módulo de segurança ("Zona de Perigo") para eliminação de dados.
 * AGORA 100% BLINDADO: Delegação total da limpeza para função RPC no Supabase.
 * ============================================================================
 */

import { ref, computed } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const textoConfirmacao = ref("");
const statusMensagem = ref("");
const processando = ref(false);

const podeLimpar = computed(() => textoConfirmacao.value === "LIMPAR");

async function apagarDados(tipo) {
  if (!podeLimpar.value) return;

  processando.value = true;
  statusMensagem.value = t('ferramentas.processando_limpeza');

  try {
    // A mágica da segurança atómica! Um único pedido fechado envia a ordem para o Supabase
    // O backend verifica por si mesmo se o utilizador é Super Admin antes de permitir qualquer exclusão
    const { error } = await supabase.rpc("limpar_dados_oficina", {
      tipo_limpeza: tipo,
    });

    if (error) throw error;

    // MENSAGENS DE SUCESSO
    if (tipo === "financeiro")
      statusMensagem.value = t('ferramentas.mov_zeradas');
    else if (tipo === "os")
      statusMensagem.value = t('ferramentas.os_apagadas');
    else if (tipo === "instrumentos")
      statusMensagem.value = t('ferramentas.inst_apagados');
    else if (tipo === "clientes")
      statusMensagem.value = t('ferramentas.cli_apagados');
    else if (tipo === "catalogo")
      statusMensagem.value = t('ferramentas.cat_apagado');
    else if (tipo === "tudo")
      statusMensagem.value = t('ferramentas.tudo_apagado');

    textoConfirmacao.value = "";
  } catch (err) {
    statusMensagem.value = t('ferramentas.erro_seguranca') + err.message;
    console.error(err);
  } finally {
    processando.value = false;
  }
}
</script>

<template>
  <div class="admin-limpeza-container">
    <div
      class="card"
      style="text-align: left; border: 2px solid #ef4444;"
    >
      <div
        style="
          background: #fef2f2;
          padding: 20px;
          border-radius: 8px;
          border-bottom: 1px solid #fee2e2;
        "
      >
        <h3
          style="
            margin-top: 0;
            color: var(--danger);
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">warning</span> {{ $t('ferramentas.titulo_perigo') }}
        </h3>
        <p class="text-danger" v-html="$t('ferramentas.desc_perigo')"></p>

        <div
          style="
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #fca5a5;
            display: inline-block;
            margin-top: 10px;
          "
        >
          <label class="text-danger" style="font-weight: bold">
            {{ $t('ferramentas.label_limpar') }}</label
          ><br />
          <input
            v-model="textoConfirmacao"
            :placeholder="$t('ferramentas.placeholder_limpar')"
            style="
              margin-top: 8px;
              padding: 10px;
              border: 2px solid #fca5a5;
              border-radius: 4px;
              font-weight: bold;
              width: 200px;
            "
          />
        </div>
      </div>

      <div
        style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 20px;
        "
      >
        <button type="button"
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('os')"
        >
          <span class="icon-dinamico">cleaning_services</span> {{ $t('ferramentas.btn_limpar_os') }}
        </button>
        <button type="button"
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('instrumentos')"
        >
          <span class="icon-dinamico">music_note</span> {{ $t('ferramentas.btn_limpar_inst') }}
        </button>
        <button type="button"
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('financeiro')"
        >
          <span class="icon-dinamico">money_off</span> {{ $t('ferramentas.btn_limpar_fin') }}
        </button>
        <button type="button"
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('clientes')"
        >
          <span class="icon-dinamico">group_remove</span> {{ $t('ferramentas.btn_limpar_cli') }}
        </button>
        <button type="button"
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('catalogo')"
          style="grid-column: 1 / -1"
        >
          <span class="icon-dinamico">inventory_2</span> {{ $t('ferramentas.btn_limpar_cat') }}
        </button>
        <button type="button"
          class="btn-clean btn-nuke"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('tudo')"
          style="grid-column: 1 / -1; margin-top: 10px"
        >
          <span class="icon-dinamico">delete_forever</span> {{ $t('ferramentas.btn_apagar_tudo') }}
        </button>
      </div>

      <div
        v-if="statusMensagem"
        style="
          margin-top: 20px;
          padding: 15px;
          border-radius: 6px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 10px;
        "
        :style="{
          background: statusMensagem.includes('Erro') ? '#fef2f2' : '#333',
          color: statusMensagem.includes('Erro') ? '#b91c1c' : '#fff',
        }"
      >
        <span
          class="icon-dinamico"
          :style="{
            animation: processando ? 'spin 1s linear infinite' : 'none',
          }"
        >
          {{
            processando
              ? "sync"
              : statusMensagem.includes("Erro")
                ? "error"
                : "check_circle"
          }}
        </span>
        {{ statusMensagem }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-limpeza-container {
  display: flex;
  flex-direction: column;
}

.btn-clean {
  padding: 15px;
  border-radius: 6px;
  font-weight: bold;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
  transition: 0.3s;
  width: 100%;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-clean:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f0f0f0;
  border-color: #ddd;
  color: #999;
}

.btn-clean:not(:disabled):hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #b91c1c;
}

.btn-nuke:not(:disabled) {
  background: #ef4444;
  color: white;
  border-color: #b91c1c;
  font-size: 1.1rem;
}

.btn-nuke:not(:disabled):hover {
  background: #dc2626;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .card > div:nth-child(2) > div:nth-child(2) {
    grid-template-columns: 1fr !important;
  }
}
</style>
