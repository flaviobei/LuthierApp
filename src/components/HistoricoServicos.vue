<script setup>
/**
 * ============================================================================
 * @file        HistoricoServicos.vue
 * @description Módulo de arquivo morto e relatórios.
 * ATUALIZAÇÃO: Adicionada função de gerar O.S. de Retrabalho/Garantia.
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { useToast } from "../composables/useToast";
import { osService } from "../services/osService";
import { gerarRelatorioHistoricoCSV } from "../lib/exportUtils";

const emit = defineEmits(["voltar", "abrirOS"]);
const { triggerToast } = useToast();

const servicosEntregues = ref([]);
const carregando = ref(true);
const exportando = ref(false);

const termoBusca = ref("");
const mesFiltro = ref("");
const ordenacao = ref({ coluna: "data_conclusao", direcao: "desc" });

// ESTADOS PARA O MODAL DE RETRABALHO
const osParaRetrabalho = ref(null);
const motivoRetrabalho = ref("");
const salvandoRetrabalho = ref(false);

async function carregarHistorico() {
  carregando.value = true;
  try {
    servicosEntregues.value = await osService.buscarHistorico();
  } catch (error) {
    triggerToast("Erro ao carregar histórico: " + error.message, "error");
  } finally {
    carregando.value = false;
  }
}

const servicosFiltrados = computed(() => {
  let resultado = [...servicosEntregues.value];

  if (termoBusca.value) {
    const termo = termoBusca.value.toLowerCase();
    resultado = resultado.filter((os) => {
      const cli = os.instrumentos?.cliente?.nome?.toLowerCase() || "";
      const inst =
        `${os.instrumentos?.marca} ${os.instrumentos?.modelo}`.toLowerCase();
      return (
        cli.includes(termo) ||
        inst.includes(termo) ||
        String(os.numero_os).includes(termo)
      );
    });
  }

  if (mesFiltro.value) {
    resultado = resultado.filter((os) =>
      os.data_conclusao?.startsWith(mesFiltro.value),
    );
  }

  resultado.sort((a, b) => {
    const col = ordenacao.value.coluna;
    const dir = ordenacao.value.direcao === "asc" ? 1 : -1;
    let valA, valB;

    switch (col) {
      case "data_conclusao":
        valA = new Date(a.data_conclusao || 0).getTime();
        valB = new Date(b.data_conclusao || 0).getTime();
        break;
      case "numero_os":
        valA = Number(a.numero_os);
        valB = Number(b.numero_os);
        break;
      case "cliente":
        valA = (a.instrumentos?.cliente?.nome || "").toLowerCase();
        valB = (b.instrumentos?.cliente?.nome || "").toLowerCase();
        break;
      case "valor_os":
        valA = a._valor_calculado || 0;
        valB = b._valor_calculado || 0;
        break;
      default:
        valA = 0;
        valB = 0;
    }

    return valA < valB ? -1 * dir : valA > valB ? 1 * dir : 0;
  });

  return resultado;
});

// --- LÓGICA DE RETRABALHO ---
function iniciarRetrabalho(os) {
  osParaRetrabalho.value = os;
  motivoRetrabalho.value = "";
}

function cancelarRetrabalho() {
  osParaRetrabalho.value = null;
  motivoRetrabalho.value = "";
}

async function confirmarRetrabalho() {
  if (!motivoRetrabalho.value.trim()) {
    return triggerToast("Por favor, informe o motivo do retorno.", "warning");
  }

  salvandoRetrabalho.value = true;
  try {
    // Usa a nova função que criámos no osService
    const novaOs = await osService.gerarRetrabalho(
      osParaRetrabalho.value.id,
      motivoRetrabalho.value,
    );

    triggerToast(
      `Retrabalho gerado! O.S. #${novaOs.numero_os} está na Fila de Espera.`,
      "success",
    );
    cancelarRetrabalho();

    // Opcional: Já manda o usuário abrir a nova OS para editar.
    emit("abrirOS", novaOs);
  } catch (error) {
    triggerToast("Erro ao gerar retrabalho: " + error.message, "error");
  } finally {
    salvandoRetrabalho.value = false;
  }
}

// --- EXPORTAÇÃO E FORMATAÇÃO ---
async function exportarHistoricoCSV() {
  if (servicosFiltrados.value.length === 0)
    return triggerToast(
      "Não há dados para exportar com estes filtros.",
      "warning",
    );
  exportando.value = true;
  try {
    await gerarRelatorioHistoricoCSV(
      servicosFiltrados.value,
      servicosEntregues.value,
      mesFiltro.value,
    );
    triggerToast("Relatório exportado com sucesso!", "success");
  } catch (err) {
    triggerToast("Falha ao exportar: " + err.message, "error");
  } finally {
    exportando.value = false;
  }
}

function alterarOrdenacao(coluna) {
  if (ordenacao.value.coluna === coluna) {
    ordenacao.value.direcao =
      ordenacao.value.direcao === "asc" ? "desc" : "asc";
  } else {
    ordenacao.value.coluna = coluna;
    ordenacao.value.direcao = "asc";
  }
}

function getIconeOrdenacao(coluna) {
  if (ordenacao.value.coluna !== coluna) return "unfold_more";
  return ordenacao.value.direcao === "asc" ? "expand_less" : "expand_more";
}

function formatarData(dataIso) {
  if (!dataIso) return "--";
  const dataSegura = dataIso.includes("T") ? dataIso : dataIso + "T12:00:00";
  return new Date(dataSegura).toLocaleDateString("pt-BR");
}

onMounted(() => carregarHistorico());
</script>

<template>
  <div class="card" style="text-align: left">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 10px;
      "
    >
      <div>
        <h2
          class="title-section"
          style="
            margin: 0;
            border: none;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">inventory_2</span> Arquivo Morto /
          Histórico
        </h2>
        <p class="text-muted" style="margin: 5px 0 0 0; font-size: 0.9rem">
          Consulte as Ordens de Serviço antigas (Finalizadas / Entregues).
        </p>
      </div>

      <div style="display: flex; gap: 10px">
        <button
          class="btn-outline"
          style="
            border-color: #27ae60;
            color: #27ae60;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          "
          @click="exportarHistoricoCSV"
          :disabled="exportando"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">{{
            exportando ? "hourglass_empty" : "download"
          }}</span>
          {{ exportando ? "A gerar ficheiro..." : "Relatório Excel Completo" }}
        </button>
      </div>
    </div>

    <div
      class="box"
      style="
        margin-bottom: 20px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      "
    >
      <div style="display: flex; gap: 15px; flex-wrap: wrap">
        <div style="flex: 2; min-width: 250px">
          <label style="display: flex; align-items: center; gap: 4px"
            ><span class="icon-dinamico" style="font-size: 1.1rem">search</span>
            Procurar por Cliente, Instrumento ou Nº O.S:</label
          >
          <input v-model="termoBusca" placeholder="Ex: Fender, João, 1024..." />
        </div>
        <div style="flex: 1; min-width: 150px">
          <label style="display: flex; align-items: center; gap: 4px"
            ><span class="icon-dinamico" style="font-size: 1.1rem"
              >calendar_month</span
            >
            Mês de Fechamento:</label
          >
          <input type="month" v-model="mesFiltro" />
        </div>
      </div>
    </div>

    <div
      v-if="carregando"
      class="text-muted"
      style="
        padding: 40px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      "
    >
      <span
        class="icon-dinamico"
        style="font-size: 2.5rem; animation: spin 1s linear infinite"
        >sync</span
      >
      A recuperar histórico...
    </div>

    <div v-else class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th class="th-sortable" @click="alterarOrdenacao('data_conclusao')">
              Entrega
              <span class="icon-dinamico">{{
                getIconeOrdenacao("data_conclusao")
              }}</span>
            </th>
            <th class="th-sortable" @click="alterarOrdenacao('numero_os')">
              O.S.
              <span class="icon-dinamico">{{
                getIconeOrdenacao("numero_os")
              }}</span>
            </th>
            <th class="th-sortable" @click="alterarOrdenacao('cliente')">
              Cliente
              <span class="icon-dinamico">{{
                getIconeOrdenacao("cliente")
              }}</span>
            </th>
            <th class="th-sortable" @click="alterarOrdenacao('instrumento')">
              Instrumento
              <span class="icon-dinamico">{{
                getIconeOrdenacao("instrumento")
              }}</span>
            </th>
            <th
              class="th-sortable text-right"
              @click="alterarOrdenacao('valor_os')"
            >
              Valor OS
              <span class="icon-dinamico">{{
                getIconeOrdenacao("valor_os")
              }}</span>
            </th>
            <th style="text-align: center">Ação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="servicosFiltrados.length === 0">
            <td
              colspan="6"
              class="text-muted"
              style="text-align: center; padding: 30px"
            >
              Nenhum registo encontrado para os filtros atuais.
            </td>
          </tr>
          <tr
            v-for="os in servicosFiltrados"
            :key="os.id"
            :class="{ 'linha-retrabalho': os.tipo_os === 'Retrabalho' }"
          >
            <td style="font-weight: bold; color: var(--text-main)">
              {{ formatarData(os.data_conclusao) }}<br />
              <span
                style="
                  font-size: 0.75rem;
                  color: #16a34a;
                  font-weight: normal;
                  display: inline-flex;
                  align-items: center;
                  gap: 2px;
                "
              >
                <span class="icon-dinamico" style="font-size: 0.9rem"
                  >check_circle</span
                >{{ os.status }}
              </span>
            </td>
            <td style="color: var(--primary); font-weight: bold">
              #{{ os.numero_os }}<br />
              <span v-if="os.tipo_os === 'Retrabalho'" class="badge-retrabalho"
                >Retrabalho</span
              >
            </td>
            <td>
              <strong>{{ os.instrumentos?.cliente?.nome }}</strong
              ><br />
              <small
                class="text-muted"
                style="display: inline-flex; align-items: center; gap: 4px"
              >
                <span class="icon-dinamico" style="font-size: 0.9rem"
                  >smartphone</span
                >{{ os.instrumentos?.cliente?.telefone || "--" }}
              </small>
            </td>
            <td>
              <strong style="color: var(--accent)">{{
                os.instrumentos?.marca
              }}</strong
              ><br />
              <small>{{ os.instrumentos?.modelo }}</small>
            </td>
            <td align="right" style="font-weight: bold; color: var(--success)">
              R$ {{ (os._valor_calculado || 0).toFixed(2) }}
            </td>
            <td align="center">
              <div
                class="card-actions"
                style="display: flex; gap: 5px; justify-content: center"
              >
                <button
                  class="btn-primary"
                  @click="$emit('abrirOS', os)"
                  style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.85rem;
                    padding: 6px 10px;
                  "
                >
                  <span class="icon-dinamico" style="font-size: 1.1rem"
                    >visibility</span
                  >
                  Ver
                </button>
                <button
                  class="btn-outline"
                  @click="iniciarRetrabalho(os)"
                  style="
                    border-color: #ef4444;
                    color: #ef4444;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.85rem;
                    padding: 6px 10px;
                  "
                  title="Cliente devolveu o instrumento?"
                >
                  <span class="icon-dinamico" style="font-size: 1.1rem"
                    >build_circle</span
                  >
                  Garantia
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="osParaRetrabalho" class="modal-overlay">
      <div class="modal-card">
        <h3
          style="
            color: #ef4444;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 0;
          "
        >
          <span class="icon-dinamico">build_circle</span> Acionar Garantia /
          Retorno
        </h3>
        <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 15px">
          Isto criará uma nova O.S. de valor R$ 0,00 ligada à O.S.
          <strong>#{{ osParaRetrabalho.numero_os }}</strong> para o instrumento
          <strong
            >{{ osParaRetrabalho.instrumentos?.marca }}
            {{ osParaRetrabalho.instrumentos?.modelo }}</strong
          >.
        </p>

        <div class="form-group">
          <label>Qual o motivo da devolução/retrabalho?</label>
          <textarea
            v-model="motivoRetrabalho"
            rows="3"
            placeholder="Ex: Cliente achou a ação das cordas alta; Rastilho soltou..."
            style="
              width: 100%;
              border: 1px solid var(--border);
              border-radius: 6px;
              padding: 10px;
            "
          ></textarea>
        </div>

        <div
          style="
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
          "
        >
          <button
            class="btn-outline"
            @click="cancelarRetrabalho"
            :disabled="salvandoRetrabalho"
          >
            Cancelar
          </button>
          <button
            class="btn-primary"
            style="background: #ef4444"
            @click="confirmarRetrabalho"
            :disabled="salvandoRetrabalho"
          >
            {{ salvandoRetrabalho ? "A gerar..." : "Confirmar Retrabalho" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.badge-retrabalho {
  background: #fee2e2;
  color: #dc2626;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  display: inline-block;
  margin-top: 2px;
}
.linha-retrabalho {
  background: #fffafa; /* Um leve tom vermelho de fundo na linha */
}

/* Modal CSS (Padrão do seu sistema) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

/* ========================================================= */
/* AÇÕES DOS CARDS (BOTÕES LADO A LADO NO MOBILE) */
/* ========================================================= */
.card-actions {
  display: flex;
  width: 100%;
  gap: 12px;
  margin-top: 15px; /* Dá um respiro em relação ao preço (R$ 0.00) */
}

.card-actions button {
  flex: 1; /* O SEGREDO 1: Obriga os botões a dividirem o espaço 50/50 */
  white-space: nowrap; /* O SEGREDO 2: Proíbe terminantemente a palavra de quebrar */
  justify-content: center;
  padding-left: 4px; /* Reduz o padding lateral interno para telas muito estreitas */
  padding-right: 4px;
}
</style>
