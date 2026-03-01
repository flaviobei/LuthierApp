<script setup>
/**
 * ============================================================================
 * @file        GerenciarSaaS.vue
 * @description Painel de controle do administrador master. Corrigido para
 * manipular corretamente datas no formato ISO para input date.
 * ATUALIZAÇÃO: Padronização de botões e ícones dinâmicos.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";

const assinantes = ref([]);
const loading = ref(true);
const mensagem = ref("");

async function carregarAssinantes() {
  loading.value = true;
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .order("data_inicio_trial", { ascending: false });

  if (!error && data) {
    // 🛠️ CORREÇÃO 1: Limpa as datas para o formato do input type="date"
    assinantes.value = data.map((assinante) => {
      return {
        ...assinante,
        data_fim_trial: assinante.data_fim_trial
          ? assinante.data_fim_trial.substring(0, 10)
          : "",
      };
    });
  }
  loading.value = false;
}

async function atualizarStatus(assinante) {
  mensagem.value = "A guardar...";

  // 🛠️ CORREÇÃO 2: Envia todos os campos que foram potencialmente editados na linha
  const { error } = await supabase
    .from("assinaturas")
    .update({
      status: assinante.status,
      plano_id: assinante.plano_id, // Adicionado para gravar se você mudar o plano no select
      data_fim_trial: assinante.data_fim_trial || null,
    })
    .eq("user_id", assinante.user_id);

  if (error) {
    mensagem.value = "Erro: " + error.message;
  } else {
    mensagem.value = "✅ Alteração guardada com sucesso!";
    setTimeout(() => (mensagem.value = ""), 3000);
  }
}

function formatarDataHora(dataIso) {
  if (!dataIso) return "--/--";
  return new Date(dataIso).toLocaleDateString("pt-BR");
}

onMounted(() => carregarAssinantes());
</script>

<template>
  <div class="card" style="border-top: 5px solid var(--danger)">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      "
    >
      <h2
        style="
          margin: 0;
          color: var(--danger);
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">admin_panel_settings</span> Módulo Master:
        Gestão do SaaS
      </h2>
      <span
        v-if="mensagem"
        style="
          background: var(--success);
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: bold;
        "
      >
        {{ mensagem }}
      </span>
    </div>

    <p class="text-muted" style="margin-bottom: 20px">
      Este painel é confidencial e só aparece para si (Dono do Software). Aqui
      controla quem tem acesso ao sistema.
    </p>

    <div
      v-if="loading"
      class="text-center text-muted"
      style="
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      "
    >
      <span
        class="icon-dinamico"
        style="font-size: 2rem; animation: spin 1s linear infinite"
        >sync</span
      >
      A carregar base de clientes...
    </div>

    <div v-else class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Início / Fim do Teste</th>
            <th>Plano</th>
            <th>Status Atual</th>
            <th style="text-align: center">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="assinante in assinantes" :key="assinante.user_id">
            <td>
              <strong style="color: var(--primary)">{{
                assinante.email || "S/ E-mail"
              }}</strong
              ><br />
              <small class="text-muted" style="font-size: 0.7rem"
                >ID: {{ assinante.user_id.split("-")[0] }}...</small
              >
            </td>
            <td>
              <small
                >Entrou:
                {{ formatarDataHora(assinante.data_inicio_trial) }}</small
              ><br />
              <div
                style="
                  display: flex;
                  gap: 5px;
                  align-items: center;
                  margin-top: 5px;
                "
              >
                <small style="font-weight: bold">Fim:</small>
                <input
                  type="date"
                  v-model="assinante.data_fim_trial"
                  style="padding: 2px 5px; font-size: 0.8rem; width: auto"
                />
              </div>
            </td>
            <td>
              <select
                v-model="assinante.plano_id"
                style="padding: 4px; font-size: 0.85rem; width: auto"
              >
                <option value="free">Free (Trial)</option>
                <option value="mensal_49">Pro (Mensal - R$49)</option>
                <option value="anual_490">Pro (Anual - R$490)</option>
              </select>
            </td>
            <td>
              <select
                v-model="assinante.status"
                style="padding: 4px; font-size: 0.85rem; width: 120px"
                :style="{
                  backgroundColor:
                    assinante.status === 'ativo'
                      ? '#e8f5e9'
                      : assinante.status === 'expirado'
                        ? '#ffebee'
                        : '#fff3cd',
                }"
              >
                <option value="trial">Trial (Teste)</option>
                <option value="ativo">Ativo (Pagante)</option>
                <option value="expirado">Expirado (Bloqueado)</option>
                <option value="inadimplente">Inadimplente (Bloq.)</option>
              </select>
            </td>
            <td align="center">
              <button
                class="btn-primary"
                @click="atualizarStatus(assinante)"
                style="
                  padding: 6px 12px;
                  font-size: 0.85rem;
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                "
              >
                <span class="icon-dinamico" style="font-size: 1.1rem"
                  >save</span
                >
                Salvar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
