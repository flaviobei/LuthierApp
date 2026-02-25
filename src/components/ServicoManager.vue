<script setup>
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
  data_previsao_entrega: "",
  tolerancia_dias: 0,
  data_previsao_pecas: "",
});

async function buscarServicos() {
  const { data } = await supabase
    .from("servicos")
    .select("*")
    .eq("instrumento_id", props.instrumento.id)
    .order("created_at", { ascending: false });
  if (data) servicos.value = data;
}

async function abrirOS() {
  if (!novaOS.value.descricao_cliente)
    return alert("Descreva o pedido do cliente.");
  loading.value = true;
  const { error } = await supabase.from("servicos").insert([
    {
      instrumento_id: props.instrumento.id,
      status: "Aberto",
      fase_projeto: "Fila de Espera",
      descricao_cliente: novaOS.value.descricao_cliente,
      data_entrada: new Date(),
      data_previsao_entrega: novaOS.value.data_previsao_entrega || null,
      tolerancia_dias: novaOS.value.tolerancia_dias || 0,
      data_previsao_pecas: novaOS.value.data_previsao_pecas || null,
    },
  ]);
  loading.value = false;
  if (!error) {
    novaOS.value = {
      descricao_cliente: "",
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
  return dataString
    ? new Date(dataString + "T12:00:00").toLocaleDateString()
    : "-";
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

    <div v-else class="card">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        "
      >
        <h3 class="title-section" style="margin: 0; border: none">
          📋 O.S. - {{ instrumento.modelo }}
        </h3>
        <button class="btn-outline" @click="$emit('voltar')">
          &larr; Voltar p/ Instrumentos
        </button>
      </div>

      <div
        class="box"
        style="border-left: 4px solid var(--accent); margin-bottom: 20px"
      >
        <h4 style="margin-top: 0; color: var(--accent)">
          📝 Nova Ordem de Serviço
        </h4>
        <div class="form-group">
          <label>Defeito reclamado / Serviço solicitado: *</label>
          <textarea
            v-model="novaOS.descricao_cliente"
            rows="2"
            placeholder="Ex: Trastejando na 12ª casa..."
          ></textarea>
        </div>
        <div
          style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap"
        >
          <div style="flex: 1">
            <label>Previsão de Entrega:</label
            ><input type="date" v-model="novaOS.data_previsao_entrega" />
          </div>
          <div style="flex: 0.5">
            <label>Tolerância (Dias):</label
            ><input type="number" v-model="novaOS.tolerancia_dias" min="0" />
          </div>
          <div style="flex: 1">
            <label>Chegada de Peças:</label
            ><input type="date" v-model="novaOS.data_previsao_pecas" />
          </div>
        </div>
        <button
          @click="abrirOS"
          :disabled="loading"
          class="btn-accent"
          style="width: 100%"
        >
          {{ loading ? "⏳ Abrindo..." : "➕ Abrir O.S." }}
        </button>
      </div>

      <div class="tabela-responsiva">
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th>O.S. / Entrada</th>
              <th>Status / Prazos</th>
              <th>Reclamação</th>
              <th style="text-align: center">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="servicos.length === 0">
              <td colspan="4" align="center" class="text-muted">
                Nenhuma O.S. registrada.
              </td>
            </tr>
            <tr v-for="os in servicos" :key="os.id">
              <td>
                <strong style="color: var(--primary); font-size: 1.1rem"
                  >#{{ os.numero_os }}</strong
                ><br />
                <small class="text-muted">{{
                  new Date(os.data_entrada).toLocaleDateString()
                }}</small>
              </td>
              <td>
                <span
                  style="
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    color: white;
                    font-weight: bold;
                  "
                  :style="{
                    background:
                      os.status === 'Entregue'
                        ? 'var(--success)'
                        : 'var(--warning)',
                  }"
                  >{{ os.status }}</span
                ><br />
                <small
                  v-if="os.data_previsao_entrega"
                  class="text-muted"
                  style="display: block; margin-top: 5px"
                  >📅 Prev:
                  <strong>{{
                    formatarData(os.data_previsao_entrega)
                  }}</strong></small
                >
              </td>
              <td>
                <small>{{ os.descricao_cliente.slice(0, 60) }}...</small>
              </td>
              <td align="center">
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
