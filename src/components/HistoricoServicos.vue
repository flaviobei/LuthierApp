<script setup>
/**
 * ============================================================================
 * @file        HistoricoServicos.vue
 * @description Módulo de arquivo morto e relatórios.
 * ATUALIZAÇÃO: Correção do nome da função de exportação e ordenação.
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

async function carregarHistorico() {
  carregando.value = true;
  try {
    // Chama o serviço que já traz os dados cruzados com as transações (Valor OS)
    servicosEntregues.value = await osService.buscarHistorico();
  } catch (error) {
    triggerToast("Erro ao carregar histórico: " + error.message, "error");
  } finally {
    carregando.value = false;
  }
}

function getMediaTicketCliente(clienteId) {
  if (!clienteId) return 0;
  const osDoCliente = servicosEntregues.value.filter(
    (os) => os.instrumentos?.cliente?.id === clienteId,
  );
  if (osDoCliente.length === 0) return 0;
  const valorTotalGasto = osDoCliente.reduce(
    (acc, os) => acc + (os._valor_calculado || 0),
    0,
  );
  return valorTotalGasto / osDoCliente.length;
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

/**
 * FUNÇÃO DE EXPORTAÇÃO (Nome corrigido para bater com o @click do template)
 */
async function exportarHistoricoCSV() {
  if (servicosFiltrados.value.length === 0) {
    return triggerToast(
      "Não há dados para exportar com estes filtros.",
      "warning",
    );
  }

  exportando.value = true;
  try {
    // Chama o utilitário que criamos na pasta /lib/
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
          <span class="icon-dinamico" style="font-size: 1.1rem">
            {{ exportando ? "hourglass_empty" : "download" }}
          </span>
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
          <label style="display: flex; align-items: center; gap: 4px">
            <span class="icon-dinamico" style="font-size: 1.1rem">search</span>
            Procurar por Cliente, Instrumento ou Nº O.S:
          </label>
          <input v-model="termoBusca" placeholder="Ex: Fender, João, 1024..." />
        </div>
        <div style="flex: 1; min-width: 150px">
          <label style="display: flex; align-items: center; gap: 4px">
            <span class="icon-dinamico" style="font-size: 1.1rem"
              >calendar_month</span
            >
            Mês de Fechamento:
          </label>
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
          <tr v-for="os in servicosFiltrados" :key="os.id">
            <td style="font-weight: bold; color: var(--text-main)">
              {{ formatarData(os.data_conclusao) }}
              <br />
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
                >
                {{ os.status }}
              </span>
            </td>
            <td style="color: var(--primary); font-weight: bold">
              #{{ os.numero_os }}
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
                >
                {{ os.instrumentos?.cliente?.telefone || "--" }}
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
              <button
                class="btn-primary"
                @click="$emit('abrirOS', os)"
                style="
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  font-size: 0.85rem;
                  padding: 6px 12px;
                "
              >
                <span class="icon-dinamico" style="font-size: 1.1rem"
                  >visibility</span
                >
                Ver Registo
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.th-sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}
.th-sortable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
.th-sortable .icon-dinamico {
  font-size: 1.1rem;
  vertical-align: middle;
  color: var(--text-muted);
  opacity: 0.5;
}
.th-sortable:hover .icon-dinamico {
  opacity: 1;
}
.text-right {
  text-align: right;
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
