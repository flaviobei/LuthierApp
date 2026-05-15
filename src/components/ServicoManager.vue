<script setup>
/**
 * ============================================================================
 * @file        ServicoManager.vue
 * @description Central de controle das Ordens de Serviço (O.S.). Este componente
 * gerencia o fluxo de entrada de instrumentos, permitindo a criação de novas
 * ordens, filtragem por status (Em Aberto, Finalizado, etc.) e a navegação
 * para o módulo de execução técnica.
 * ATUALIZAÇÃO: Padronização de botões e ícones dinâmicos.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import ExecucaoServico from "./ExecucaoServico.vue";
import { useToast } from "../composables/useToast"; // <-- 1. Importa o Toast
import { useI18n } from "vue-i18n";

const props = defineProps(["instrumento"]);
const emit = defineEmits(["voltar"]);

const { triggerToast } = useToast(); // <-- 2. Inicializa o Toast
const { t } = useI18n();

const servicos = ref([]);
const loading = ref(false);
const servicoEmExecucao = ref(null);

function getLocalDatetime() {
  return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const novaOS = ref({
  descricao_cliente: "",
  data_entrada: getLocalDatetime(), // Padrão: Agora
  data_previsao_entrega: "",
  tolerancia_dias: 0,
  data_previsao_pecas: "",
});

async function buscarServicos() {
  const { data } = await supabase
    .from("servicos")
    .select("*")
    .eq("instrumento_id", props.instrumento.id)
    .order("data_entrada", { ascending: false });
  if (data) servicos.value = data;
}

async function abrirOS() {
  if (!novaOS.value.descricao_cliente) {
    // SUBSTITUÍDO: alert() por triggerToast()
    return triggerToast(t('servicos.erro_descricao_vazia'), "error");
  }

  loading.value = true;

  const entradaFinal = novaOS.value.data_entrada
    ? new Date(novaOS.value.data_entrada).toISOString()
    : new Date().toISOString();

  const { error } = await supabase.from("servicos").insert([
    {
      instrumento_id: props.instrumento.id,
      status: "Aberto",
      fase_projeto: "Fila de Espera",
      descricao_cliente: novaOS.value.descricao_cliente,
      data_entrada: entradaFinal,
      data_previsao_entrega: novaOS.value.data_previsao_entrega || null,
      tolerancia_dias: novaOS.value.tolerancia_dias || 0,
      data_previsao_pecas: novaOS.value.data_previsao_pecas || null,
    },
  ]);

  loading.value = false;

  if (!error) {
    novaOS.value = {
      descricao_cliente: "",
      data_entrada: getLocalDatetime(),
      data_previsao_entrega: "",
      tolerancia_dias: 0,
      data_previsao_pecas: "",
    };
    triggerToast(t('servicos.os_aberta_sucesso'), "success"); // <-- MENSAGEM DE SUCESSO
    buscarServicos();
  } else {
    // SUBSTITUÍDO: alert() por triggerToast()
    triggerToast(t('servicos.erro_abrir_os') + error.message, "error");
  }
}

function abrirExecucao(os) {
  servicoEmExecucao.value = os;
}

function formatarData(dataString) {
  if (!dataString) return "-";
  const d = new Date(dataString + (dataString.includes("T") ? "" : "T12:00:00"));
  if (dataString.includes("T")) {
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  } else {
    return d.toLocaleDateString("pt-BR");
  }
}

onMounted(() => buscarServicos());
</script>

<template>
  <div>
    <div v-if="servicoEmExecucao">
      <ExecucaoServico
        :servico="servicoEmExecucao"
        @voltar="
          servicoEmExecucao = null;
          buscarServicos();
        "
      />
    </div>

    <div v-else class="card" style="text-align: left">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
        "
      >
        <h3
          class="title-section"
          style="
            margin: 0;
            border: none;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">assignment</span> {{ $t('servicos.titulo_os_instrumento') }}
          {{ instrumento.modelo }}
        </h3>
        <button type="button"
          class="btn-outline"
          @click="$emit('voltar')"
          style="display: inline-flex; align-items: center; gap: 6px"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >arrow_back</span
          >
          {{ $t('geral.voltar') }}
        </button>
      </div>

      <div
        class="box"
        style="border-left: 4px solid var(--accent); margin-bottom: 20px"
      >
        <h4
          style="
            margin-top: 0;
            color: var(--accent);
            text-align: left;
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">note_add</span> {{ $t('servicos.abrir_nova_os') }}
        </h4>

        <div class="form-group">
          <label>{{ $t('servicos.label_defeito_servico') }}</label>
          <textarea
            v-model="novaOS.descricao_cliente"
            rows="2"
            :placeholder="$t('servicos.placeholder_defeito')"
          ></textarea>
        </div>

        <div class="form-group">
          <label>{{ $t('servicos.label_data_entrada') }}</label>
          <input type="datetime-local" v-model="novaOS.data_entrada" />
        </div>

        <div
          style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap"
        >
          <div style="flex: 1; min-width: 140px">
            <label>{{ $t('servicos.label_previsao_entrega') }}</label>
            <input type="date" v-model="novaOS.data_previsao_entrega" />
          </div>
          <div style="flex: 0.5; min-width: 100px">
            <label>{{ $t('servicos.label_tolerancia_dias') }}</label>
            <input type="number" v-model="novaOS.tolerancia_dias" min="0" />
          </div>
          <div style="flex: 1; min-width: 140px">
            <label>{{ $t('servicos.label_previsao_pecas') }}</label>
            <input type="date" v-model="novaOS.data_previsao_pecas" />
          </div>
        </div>

        <button type="button"
          @click="abrirOS"
          :disabled="loading"
          class="btn-accent"
          style="
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
          "
        >
          <span class="icon-dinamico" style="font-size: 1.2rem">
            {{ loading ? "hourglass_empty" : "add_circle" }}
          </span>
          {{ loading ? $t('servicos.processando') : $t('servicos.btn_abrir_os') }}
        </button>
      </div>

      <div class="tabela-responsiva">
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th>{{ $t('servicos.coluna_os_entrada') }}</th>
              <th>{{ $t('servicos.coluna_status_prazos') }}</th>
              <th>{{ $t('servicos.coluna_reclamacao') }}</th>
              <th style="text-align: center">{{ $t('servicos.coluna_acao') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="servicos.length === 0">
              <td
                colspan="4"
                class="text-muted"
                style="text-align: left; padding: 20px"
              >
                {{ $t('servicos.nenhum_historico') }}
              </td>
            </tr>
            <tr v-for="os in servicos" :key="os.id">
              <td>
                <strong style="color: var(--primary)"
                  >#{{ os.numero_os }}</strong
                ><br />
                <small class="text-muted">{{
                  formatarData(os.data_entrada)
                }}</small>
              </td>
              <td>
                <span
                  class="status-pill"
                  :class="
                    os.status === 'Entregue' || os.status === 'Finalizado'
                      ? 'success'
                      : 'warning'
                  "
                >
                  {{ os.status }} </span
                ><br />
                <small
                  v-if="os.data_previsao_entrega"
                  class="text-muted"
                  style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 5px;
                  "
                >
                  <span class="icon-dinamico" style="font-size: 1rem"
                    >event</span
                  >
                  {{ $t('servicos.entrega_label') }}
                  <strong>{{ formatarData(os.data_previsao_entrega) }}</strong>
                </small>
              </td>
              <td style="max-width: 250px">
                <small>{{
                  os.descricao_cliente
                    ? os.descricao_cliente.slice(0, 50) + "..."
                    : $t('os.sem_descricao')
                }}</small>
              </td>
              <td align="center">
                <button type="button"
                  class="btn-primary"
                  @click="abrirExecucao(os)"
                  style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    font-size: 0.85rem;
                  "
                >
                  <span class="icon-dinamico" style="font-size: 1.1rem"
                    >build</span
                  >
                  {{ $t('servicos.gerenciar') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-pill {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: white;
  font-weight: bold;
}
.status-pill.success {
  background: var(--success);
}
.status-pill.warning {
  background: var(--warning);
}
.title-section {
  text-align: left;
}
</style>
