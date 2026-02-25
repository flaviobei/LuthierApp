<script setup>
/**
 * ============================================================================
 * @file        DashboardAtividades.vue
 * @description Painel principal de indicadores (KPIs). Oferece uma visão
 * rápida sobre o volume de serviços em aberto, entregues e faturamento mensal.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - vue: ref, onMounted.
 * - supabaseClient: Consultas agregadas na tabela 'servicos'.
 * * @functions
 * - carregarEstatisticas(): Calcula os totais e status das Ordens de Serviço.
 * * @notes
 * - Primeira tela visualizada pelo luthier ao entrar no sistema.
 * ============================================================================
 */

import { ref, computed, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { abrirWhatsapp } from "../lib/whatsappUtils";

const emit = defineEmits(["abrirOS"]);

const servicosAbertos = ref([]);
const oportunidadesPosVenda = ref([]);
const loading = ref(true);

// MUDANÇA AQUI: Começa por defeito em 'lista'
const visaoAtual = ref("lista");

// As colunas do nosso Kanban
const fasesKanban = [
  "Fila de Espera",
  "Aguardando Peças",
  "Na Bancada",
  "Secagem / Cura",
  "Testes / Setup",
  "Pronto para Entrega",
];

async function carregarPendencias() {
  loading.value = true;

  const { data, error } = await supabase
    .from("servicos")
    .select(
      `
      *, 
      instrumentos ( marca, modelo, cliente:clientes (nome, telefone) ),
      diario_servico ( descricao, foto_url, data_registro )
    `,
    )
    .neq("status", "Entregue")
    .order("data_previsao_entrega", { ascending: true });

  if (!error && data) {
    servicosAbertos.value = data.map((os) => {
      if (!os.fase_projeto) os.fase_projeto = "Fila de Espera";

      if (os.diario_servico && os.diario_servico.length > 0) {
        os.diario_servico.sort(
          (a, b) => new Date(b.data_registro) - new Date(a.data_registro),
        );
        os.ultima_atualizacao = os.diario_servico[0];
      } else {
        os.ultima_atualizacao = null;
      }
      return os;
    });
  }

  loading.value = false;
  carregarPosVenda();
}

const servicosPorFase = computed(() => {
  const colunas = {};
  fasesKanban.forEach((f) => (colunas[f] = []));

  servicosAbertos.value.forEach((os) => {
    if (colunas[os.fase_projeto]) {
      colunas[os.fase_projeto].push(os);
    } else {
      colunas["Fila de Espera"].push(os);
    }
  });
  return colunas;
});

// --- LÓGICA DE ARRASTAR E SOLTAR (DRAG & DROP) ---
function onDragStart(event, osId) {
  event.dataTransfer.dropEffect = "move";
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("osId", osId);
}

async function onDrop(event, novaFase) {
  const osId = event.dataTransfer.getData("osId");
  if (!osId) return;

  const os = servicosAbertos.value.find((s) => s.id === osId);
  if (os && os.fase_projeto !== novaFase) {
    const faseAntiga = os.fase_projeto;
    os.fase_projeto = novaFase;

    await supabase
      .from("servicos")
      .update({ fase_projeto: novaFase })
      .eq("id", osId);

    const entradaDiario = {
      servico_id: osId,
      descricao: `📌 Status alterado de "${faseAntiga}" para "${novaFase}".`,
      fase_projeto: novaFase,
    };
    await supabase.from("diario_servico").insert([entradaDiario]);
    carregarPendencias();
  }
}
// --------------------------------------------------

// --- LÓGICA DO PÓS-VENDA (CRM) ---
async function carregarPosVenda() {
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - 6);
  const hoje = new Date().toISOString();

  const { data, error } = await supabase
    .from("servicos")
    .select(
      `*, instrumentos ( marca, modelo, cliente:clientes (nome, telefone) )`,
    )
    .eq("status", "Entregue")
    .eq("pos_venda_contatado", false)
    .lte("data_conclusao", dataCorte.toISOString())
    .or(`data_lembrete_pos_venda.is.null,data_lembrete_pos_venda.lte.${hoje}`)
    .order("data_conclusao", { ascending: true })
    .limit(5);

  if (!error && data) oportunidadesPosVenda.value = data;
}

function chamarClientePosVenda(os) {
  const cli = os.instrumentos?.cliente;
  if (!cli || !cli.telefone)
    return alert("Este cliente não tem telefone registado.");
  const msg = `Olá *${cli.nome}*! Tudo bem?\n\nAqui é da Luthieria. Notei que já faz um tempo que entregámos o seu *${os.instrumentos.marca} ${os.instrumentos.modelo}* (O.S. #${os.numero_os}).\n\nComo ele se tem comportado? Se precisar de dar uma revisão ou um ajuste para manter a tocabilidade 100%, é só dizer! 🎸`;
  abrirWhatsapp(cli, msg);
}

async function marcarComoContatado(osId) {
  await supabase
    .from("servicos")
    .update({ pos_venda_contatado: true })
    .eq("id", osId);
  oportunidadesPosVenda.value = oportunidadesPosVenda.value.filter(
    (o) => o.id !== osId,
  );
}

async function adiarPosVenda(osId, dias) {
  const novaDataLembrete = new Date();
  novaDataLembrete.setDate(novaDataLembrete.getDate() + dias);
  await supabase
    .from("servicos")
    .update({ data_lembrete_pos_venda: novaDataLembrete })
    .eq("id", osId);
  oportunidadesPosVenda.value = oportunidadesPosVenda.value.filter(
    (o) => o.id !== osId,
  );
}
// ---------------------------------

function corFase(fase) {
  switch (fase) {
    case "Fila de Espera":
      return "var(--text-muted)";
    case "Aguardando Peças":
      return "var(--danger)";
    case "Secagem / Cura":
      return "#6f42c1";
    case "Na Bancada":
      return "var(--primary)";
    case "Testes / Setup":
      return "#17a2b8";
    case "Pronto para Entrega":
      return "var(--success)";
    default:
      return "var(--warning)";
  }
}

function formatarData(dataIso) {
  if (!dataIso) return "--/--";
  const dataSegura = dataIso.includes("T") ? dataIso : dataIso + "T12:00:00";
  return new Date(dataSegura).toLocaleDateString("pt-BR");
}

function formatarDataCurta(dataIso) {
  if (!dataIso) return "";
  return new Date(dataIso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

onMounted(() => carregarPendencias());
</script>

<template>
  <div class="dash-container">
    <div v-if="oportunidadesPosVenda.length > 0" class="crm-box card">
      <div class="crm-header">
        <h3 style="margin: 0; color: #fff">
          💡 Retenção de Clientes (Pós-Venda)
        </h3>
        <span class="badge-crm"
          >{{ oportunidadesPosVenda.length }} Pendentes</span
        >
      </div>
      <p style="margin: 10px 0 15px 0; font-size: 0.9rem; color: #555">
        Estes instrumentos foram entregues há mais de 6 meses. Mande uma
        mensagem para gerar um novo serviço!
      </p>

      <div class="crm-list">
        <div
          v-for="opp in oportunidadesPosVenda"
          :key="opp.id"
          class="crm-item"
        >
          <div class="crm-info">
            <strong style="color: var(--primary); font-size: 1.1rem">{{
              opp.instrumentos?.cliente?.nome
            }}</strong>
            <span style="font-weight: bold; color: var(--text-muted)"
              >{{ opp.instrumentos?.marca }}
              {{ opp.instrumentos?.modelo }}</span
            >
            <small style="color: var(--danger)"
              >Entregue em: {{ formatarData(opp.data_conclusao) }}</small
            >
          </div>

          <div class="crm-actions-container">
            <button
              class="btn-success"
              @click="chamarClientePosVenda(opp)"
              style="flex: 1"
            >
              📱 Chamar
            </button>
            <div class="crm-actions-secundary">
              <button
                class="btn-icon bg-light"
                @click="adiarPosVenda(opp.id, 15)"
                title="Lembrar daqui a 15 dias"
              >
                ⏰ Adiar 15d
              </button>
              <button
                class="btn-icon bg-light text-success"
                @click="marcarComoContatado(opp.id)"
                title="Marcar como Concluído"
              >
                ✅ Feito
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 10px;
      "
    >
      <h2 style="color: var(--primary); margin: 0">🛠️ Bancada de Trabalho</h2>
      <div class="toggle-visao">
        <button
          :class="{ active: visaoAtual === 'lista' }"
          @click="visaoAtual = 'lista'"
        >
          🗂️ Lista
        </button>
        <button
          :class="{ active: visaoAtual === 'kanban' }"
          @click="visaoAtual = 'kanban'"
        >
          📋 Quadro (Kanban)
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-muted text-center" style="padding: 40px">
      A preparar a bancada...
    </div>

    <div v-else-if="servicosAbertos.length === 0" class="card empty-state">
      <p>🎉 Nenhuma pendência! Tudo entregue ou bancada limpa.</p>
    </div>

    <div v-else>
      <div v-if="visaoAtual === 'lista'" class="grid-cards">
        <div
          v-for="os in servicosAbertos"
          :key="os.id"
          class="card card-os"
          @click="$emit('abrirOS', os)"
        >
          <div
            class="status-badge"
            :style="{ backgroundColor: corFase(os.fase_projeto) }"
          >
            #{{ os.numero_os }} - {{ os.fase_projeto || os.status }}
          </div>
          <h3 class="modelo">{{ os.instrumentos?.modelo }}</h3>
          <span class="marca">{{ os.instrumentos?.marca }}</span>
          <div class="cliente">👤 {{ os.instrumentos?.cliente?.nome }}</div>
          <p class="desc">
            {{
              os.descricao_cliente?.length > 50
                ? os.descricao_cliente.slice(0, 50) + "..."
                : os.descricao_cliente
            }}
          </p>

          <div v-if="os.ultima_atualizacao" class="ultima-atualizacao">
            <div class="atualizacao-header">
              <small
                >Último passo ({{
                  formatarDataCurta(os.ultima_atualizacao.data_registro)
                }}):</small
              >
            </div>
            <div class="atualizacao-body">
              <img
                v-if="os.ultima_atualizacao.foto_url"
                :src="os.ultima_atualizacao.foto_url"
                class="miniatura-diario"
              />
              <p class="texto-diario">
                {{
                  os.ultima_atualizacao.descricao.length > 55
                    ? os.ultima_atualizacao.descricao.slice(0, 55) + "..."
                    : os.ultima_atualizacao.descricao
                }}
              </p>
            </div>
          </div>
          <div v-else style="flex-grow: 1"></div>

          <div class="footer-card">
            <small>Entrada: {{ formatarData(os.data_entrada) }}</small>
            <small
              v-if="os.data_previsao_entrega"
              style="color: var(--danger); font-weight: bold"
            >
              Prazo: {{ formatarData(os.data_previsao_entrega) }}
            </small>
          </div>
        </div>
      </div>

      <div v-if="visaoAtual === 'kanban'" class="kanban-board">
        <div
          v-for="fase in fasesKanban"
          :key="fase"
          class="kanban-column"
          @dragover.prevent
          @dragenter.prevent
          @drop="onDrop($event, fase)"
        >
          <div
            class="kanban-column-header"
            :style="{ borderTopColor: corFase(fase) }"
          >
            <span class="column-title">{{ fase }}</span>
            <span class="column-count">{{ servicosPorFase[fase].length }}</span>
          </div>

          <div class="kanban-cards-container">
            <div
              v-for="os in servicosPorFase[fase]"
              :key="os.id"
              class="kanban-card"
              draggable="true"
              @dragstart="onDragStart($event, os.id)"
              @click="$emit('abrirOS', os)"
            >
              <div class="card-os-header">
                <strong>#{{ os.numero_os }}</strong>
                <small
                  v-if="os.data_previsao_entrega"
                  style="
                    color: var(--danger);
                    font-weight: bold;
                    font-size: 0.7rem;
                  "
                >
                  {{ formatarDataCurta(os.data_previsao_entrega) }}
                </small>
              </div>

              <div class="kanban-modelo">{{ os.instrumentos?.modelo }}</div>
              <div class="kanban-marca">{{ os.instrumentos?.marca }}</div>
              <div class="kanban-cliente">
                👤 {{ os.instrumentos?.cliente?.nome?.split(" ")[0] }}
              </div>

              <div v-if="os.ultima_atualizacao" class="kanban-diario-mini">
                {{
                  os.ultima_atualizacao.descricao.length > 35
                    ? os.ultima_atualizacao.descricao.slice(0, 35) + "..."
                    : os.ultima_atualizacao.descricao
                }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash-container {
  margin-bottom: 30px;
}

/* CONTROLO DE VISÃO (TOGGLE) */
.toggle-visao {
  display: flex;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.toggle-visao button {
  padding: 8px 15px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: bold;
  color: var(--text-muted);
  transition: 0.2s;
}
.toggle-visao button.active {
  background: var(--primary);
  color: white;
}

/* --- KANBAN BOARD ESTILOS --- */
.kanban-board {
  display: flex;
  gap: 15px;
  overflow-x: auto;
  padding-bottom: 15px;
  align-items: flex-start;
  min-height: 60vh;
}
.kanban-column {
  background: #f4f5f7;
  border-radius: 8px;
  min-width: 280px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  border: 1px solid #e1e4e8;
}
.kanban-column-header {
  padding: 12px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e1e4e8;
  border-top: 4px solid var(--primary);
  border-radius: 8px 8px 0 0;
  background: white;
}
.column-title {
  font-weight: bold;
  font-size: 0.95rem;
  color: var(--primary);
}
.column-count {
  background: var(--bg-body);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--text-muted);
  border: 1px solid var(--border);
}
.kanban-cards-container {
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-grow: 1;
}

/* KANBAN CARD */
.kanban-card {
  background: white;
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border);
  cursor: grab;
  transition:
    transform 0.1s,
    box-shadow 0.1s;
}
.kanban-card:active {
  cursor: grabbing;
  opacity: 0.8;
  transform: scale(0.98);
}
.kanban-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--accent);
}
.card-os-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}
.kanban-modelo {
  font-size: 1rem;
  color: var(--primary);
  font-weight: bold;
  line-height: 1.2;
}
.kanban-marca {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.kanban-cliente {
  font-size: 0.85rem;
  color: var(--text-main);
  border-top: 1px dashed var(--border);
  padding-top: 5px;
}
.kanban-diario-mini {
  margin-top: 8px;
  font-size: 0.75rem;
  color: #666;
  background: #fffdfa;
  padding: 6px;
  border-radius: 4px;
  border-left: 2px solid var(--accent);
  font-style: italic;
}

/* --- CRM E LISTA ANTIGA MANTIDOS --- */
.crm-box {
  border: 2px solid var(--accent);
  background: #fffdfa;
  margin-bottom: 30px;
  padding: 0;
  overflow: hidden;
}
.crm-header {
  background: var(--accent);
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.badge-crm {
  background: #fff;
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 0.85rem;
}
.crm-list {
  padding: 0 20px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.crm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border: 1px solid var(--border);
  padding: 15px;
  border-radius: 6px;
  flex-wrap: wrap;
  gap: 15px;
}
.crm-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.crm-actions-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 180px;
}
.crm-actions-secundary {
  display: flex;
  gap: 5px;
}
.crm-actions-secundary button {
  flex: 1;
  font-size: 0.85rem;
  padding: 6px;
  border: 1px solid var(--border);
}
.crm-actions-secundary button:hover {
  border-color: var(--primary);
}

.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 15px;
}
.card-os {
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.card-os:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
  border-color: var(--accent);
}
.status-badge {
  position: absolute;
  top: 0;
  right: 0;
  padding: 5px 12px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: bold;
  border-bottom-left-radius: 8px;
  box-shadow: -2px 2px 5px rgba(0, 0, 0, 0.1);
}
.modelo {
  margin: 15px 0 2px 0;
  font-size: 1.2rem;
  color: var(--primary);
}
.marca {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.cliente {
  margin: 12px 0;
  font-size: 0.95rem;
  color: var(--text-main);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  font-weight: 500;
}
.desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
  margin-bottom: 10px;
}
.ultima-atualizacao {
  background: #fdfdfd;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 15px;
  flex-grow: 1;
}
.atualizacao-header {
  margin-bottom: 5px;
  color: var(--accent);
  font-weight: bold;
}
.atualizacao-body {
  display: flex;
  gap: 10px;
  align-items: center;
}
.miniatura-diario {
  width: 45px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.texto-diario {
  font-size: 0.8rem;
  color: var(--text-main);
  margin: 0;
  line-height: 1.3;
}
.footer-card {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: auto;
  background: var(--bg-body);
  padding: 8px;
  border-radius: 4px;
}
.empty-state {
  text-align: center;
  padding: 40px;
}

/* Scrollbar personalizada para o Kanban para ficar mais elegante */
.kanban-board::-webkit-scrollbar {
  height: 8px;
}
.kanban-board::-webkit-scrollbar-track {
  background: transparent;
}
.kanban-board::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}
.kanban-board::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}
.kanban-cards-container::-webkit-scrollbar {
  width: 4px;
}
.kanban-cards-container::-webkit-scrollbar-track {
  background: transparent;
}
.kanban-cards-container::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 4px;
}

@media (max-width: 600px) {
  .crm-item {
    flex-direction: column;
    align-items: flex-start;
  }
  .crm-actions-container {
    width: 100%;
  }
}
</style>
