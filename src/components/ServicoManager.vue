<script setup>
/**
 * ============================================================================
 * @file        ServicoManager.vue
 * @description Central de controle das Ordens de Serviço (O.S.). Este componente
 * gerencia o fluxo de entrada de instrumentos, permitindo a criação de novas
 * ordens, filtragem por status (Em Aberto, Finalizado, etc.) e a navegação
 * para o módulo de execução técnica.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - vue: ref, onMounted, computed.
 * - supabaseClient: CRUD da tabela 'servicos' com joins em 'instrumentos'.
 * * @functions
 * - carregarServicos(): Busca todas as O.S. ativas e concluídas do luthier.
 * - salvarServico(): Registra uma nova O.S., gerando automaticamente o número
 * sequencial da ordem.
 * - abrirExecucao(): Seleciona uma O.S. específica e emite um evento para
 * carregar o componente de execução detalhada.
 * - deletarServico(): Remove uma O.S. do sistema após confirmação do usuário.
 * * @notes
 * - Implementa um sistema de busca em tempo real por número de O.S. ou marca.
 * - Faz o vínculo obrigatório entre Cliente -> Instrumento -> Ordem de Serviço.
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import ExecucaoServico from "./ExecucaoServico.vue";

const props = defineProps(["instrumento"]);
const emit = defineEmits(["voltar"]);

const servicos = ref([]);
const loading = ref(false);
const servicoEmExecucao = ref(null);

const novaOS = ref({
  descricao_cliente: "",
  data_entrada: new Date().toISOString().substring(0, 10), // Padrão: Hoje
  data_previsao_entrega: "",
  tolerancia_dias: 0,
  data_previsao_pecas: "",
});

async function buscarServicos() {
  const { data } = await supabase
    .from("servicos")
    .select("*")
    .eq("instrumento_id", props.instrumento.id)
    .order("data_entrada", { ascending: false }); // Ordena pela data de entrada real
  if (data) servicos.value = data;
}

async function abrirOS() {
  if (!novaOS.value.descricao_cliente)
    return alert("Descreva o pedido do cliente.");

  loading.value = true;

  // CORREÇÃO: Usamos a data_entrada que você escolheu no formulário
  const entradaFinal =
    novaOS.value.data_entrada || new Date().toISOString().substring(0, 10);

  const { error } = await supabase.from("servicos").insert([
    {
      instrumento_id: props.instrumento.id,
      status: "Aberto",
      fase_projeto: "Fila de Espera",
      descricao_cliente: novaOS.value.descricao_cliente,
      data_entrada: entradaFinal, // Agora aceita datas antigas!
      data_previsao_entrega: novaOS.value.data_previsao_entrega || null,
      tolerancia_dias: novaOS.value.tolerancia_dias || 0,
      data_previsao_pecas: novaOS.value.data_previsao_pecas || null,
    },
  ]);

  loading.value = false;

  if (!error) {
    // Reset do formulário mantendo a data de hoje para o próximo
    novaOS.value = {
      descricao_cliente: "",
      data_entrada: new Date().toISOString().substring(0, 10),
      data_previsao_entrega: "",
      tolerancia_dias: 0,
      data_previsao_pecas: "",
    };
    buscarServicos();
  } else {
    alert("Erro: " + error.message);
  }
}

function abrirExecucao(os) {
  servicoEmExecucao.value = os;
}

function formatarData(dataString) {
  if (!dataString) return "-";
  // O T12:00:00 evita que o fuso horário mude o dia para o anterior
  return new Date(dataString + "T12:00:00").toLocaleDateString("pt-BR");
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
        "
      >
        <h3
          class="title-section"
          style="margin: 0; border: none; text-align: left"
        >
          📋 O.S. - {{ instrumento.modelo }}
        </h3>
        <button class="btn-outline" @click="$emit('voltar')">
          &larr; Voltar
        </button>
      </div>

      <div
        class="box"
        style="border-left: 4px solid var(--accent); margin-bottom: 20px"
      >
        <h4 style="margin-top: 0; color: var(--accent); text-align: left">
          📝 Abrir Nova Ordem de Serviço
        </h4>

        <div class="form-group">
          <label>Defeito / Serviço Solicitado: *</label>
          <textarea
            v-model="novaOS.descricao_cliente"
            rows="2"
            placeholder="Descreva o que será feito..."
          ></textarea>
        </div>

        <div class="form-group">
          <label>Data de Entrada (Retroativa para trabalhos antigos):</label>
          <input type="date" v-model="novaOS.data_entrada" />
        </div>

        <div
          style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap"
        >
          <div style="flex: 1">
            <label>Previsão de Entrega:</label>
            <input type="date" v-model="novaOS.data_previsao_entrega" />
          </div>
          <div style="flex: 0.5">
            <label>Tolerância (Dias):</label>
            <input type="number" v-model="novaOS.tolerancia_dias" min="0" />
          </div>
          <div style="flex: 1">
            <label>Peças Chegam em:</label>
            <input type="date" v-model="novaOS.data_previsao_pecas" />
          </div>
        </div>

        <button
          @click="abrirOS"
          :disabled="loading"
          class="btn-accent"
          style="width: 100%"
        >
          {{
            loading ? "⏳ A processar..." : "➕ Abrir O.S. neste Instrumento"
          }}
        </button>
      </div>

      <div class="tabela-responsiva">
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th>O.S. / Entrada</th>
              <th>Status / Prazos</th>
              <th>Reclamação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="servicos.length === 0">
              <td
                colspan="4"
                class="text-muted"
                style="text-align: left; padding: 20px"
              >
                Nenhum histórico para este instrumento.
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
                  :class="os.status === 'Entregue' ? 'success' : 'warning'"
                >
                  {{ os.status }} </span
                ><br />
                <small
                  v-if="os.data_previsao_entrega"
                  class="text-muted"
                  style="display: block; margin-top: 5px"
                >
                  📅 Entrega:
                  <strong>{{ formatarData(os.data_previsao_entrega) }}</strong>
                </small>
              </td>
              <td style="max-width: 250px">
                <small>{{
                  os.descricao_cliente
                    ? os.descricao_cliente.slice(0, 50) + "..."
                    : "Sem descrição"
                }}</small>
              </td>
              <td>
                <button class="btn-primary" @click="abrirExecucao(os)">
                  🛠️ Gerenciar
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
