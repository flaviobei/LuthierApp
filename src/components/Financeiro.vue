<script setup>
import { ref, onMounted, watch, computed, nextTick, onUnmounted } from "vue";
import { useToast } from "../composables/useToast";
import { financeiroService } from "../services/financeiroService";
import Chart from "chart.js/auto";

const { triggerToast } = useToast();

const transacoes = ref([]);
const carregando = ref(true);
const mesFiltro = ref(new Date().toISOString().substring(0, 7));
const graficoRef = ref(null);
const tipoGrafico = ref("resumo"); // 'resumo' ou 'temporal'
let instanceGrafico = null;

const kpis = ref({
  receitaBruta: 0,
  receitaLiquida: 0,
  despesas: 0,
  lucroReal: 0,
});

const filtroDataInicio = ref("");
const filtroDataFim = ref("");
const filtroCategoria = ref("Todas");

function getLocalDatetime() {
  return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const novaDespesa = ref({
  descricao: "",
  valor: null,
  categoria: "Outros",
  data_pagamento: getLocalDatetime(),
});

// LÓGICA DE FILTRO: Só filtra se o input tiver algo escrito
const transacoesFiltradas = computed(() => {
  if (!transacoes.value) return [];
  return transacoes.value.filter((t) => {
    const dataPag = t.data_pagamento.substring(0, 10);
    const passaInicio =
      !filtroDataInicio.value || dataPag >= filtroDataInicio.value;
    const passaFim =
      !filtroDataFim.value || dataPag <= filtroDataFim.value;
    const passaCategoria =
      filtroCategoria.value === "Todas" ||
      t.categoria === filtroCategoria.value;
    return passaInicio && passaFim && passaCategoria;
  });
});

const totalEntradas = computed(() => kpis.value.receitaBruta || 0);
const totalSaidas = computed(() => kpis.value.despesas || 0);

// GRÁFICO
function renderizarGrafico() {
  if (instanceGrafico) instanceGrafico.destroy();
  if (!graficoRef.value) return;

  const ctx = graficoRef.value.getContext("2d");

  if (tipoGrafico.value === "resumo") {
    instanceGrafico = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Faturamento Bruto", "Despesas", "Saldo Real"],
        datasets: [
          {
            label: "Movimentações (R$)",
            data: [
              kpis.value.receitaBruta,
              kpis.value.despesas,
              kpis.value.lucroReal,
            ],
            backgroundColor: ["#27ae60", "#c0392b", "#2980b9"],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  } else if (tipoGrafico.value === "temporal") {
    // Agrupar por dia
    const diasAgrupados = {};

    [...transacoesFiltradas.value]
      .sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento))
      .forEach((t) => {
        const d = t.data_pagamento.substring(5, 10); // MM-DD
        const labelStr = d.split("-").reverse().join("/"); // DD/MM

        if (!diasAgrupados[labelStr]) {
          diasAgrupados[labelStr] = { ganhos: 0, gastos: 0 };
        }

        if (t.tipo === "Entrada") {
          diasAgrupados[labelStr].ganhos += t.valor_bruto || 0;
        } else {
          diasAgrupados[labelStr].gastos += t.valor_bruto || 0;
        }
      });

    const labelsData = Object.keys(diasAgrupados);
    const ganhosData = labelsData.map((d) => diasAgrupados[d].ganhos);
    const gastosData = labelsData.map((d) => diasAgrupados[d].gastos);

    instanceGrafico = new Chart(ctx, {
      type: "line",
      data: {
        labels: labelsData,
        datasets: [
          {
            label: "Ganhos / Entradas (R$)",
            data: ganhosData,
            borderColor: "#27ae60",
            backgroundColor: "rgba(39, 174, 96, 0.1)",
            tension: 0.3,
            fill: true,
          },
          {
            label: "Gastos / Saídas (R$)",
            data: gastosData,
            borderColor: "#c0392b",
            backgroundColor: "transparent",
            borderDash: [5, 5],
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
        interaction: {
          mode: "nearest",
          axis: "x",
          intersect: false,
        },
      },
    });
  }
}

// CARREGAMENTO BRUTO (Vem do banco)
async function carregarDadosFinanceiros() {
  carregando.value = true;
  try {
    const dados = await financeiroService.buscarTransacoes(
      mesFiltro.value,
      filtroDataInicio.value,
      filtroDataFim.value,
    );
    transacoes.value = dados || [];
    // Não calculamos os KPIs aqui. O "watcher" abaixo fará isso.
  } catch (error) {
    triggerToast("Erro ao carregar banco: " + error.message, "error");
  } finally {
    carregando.value = false;
  }
}

// SALVAR SAÍDA
async function salvarDespesa() {
  if (
    !novaDespesa.value.descricao ||
    !novaDespesa.value.valor ||
    novaDespesa.value.valor <= 0
  ) {
    return triggerToast(
      "Preencha a descrição e um valor maior que zero.",
      "warning",
    );
  }
  try {
    await financeiroService.salvarGasto({
      descricao: novaDespesa.value.descricao,
      valor_bruto: novaDespesa.value.valor,
      categoria: novaDespesa.value.categoria,
      data_pagamento: novaDespesa.value.data_pagamento ? new Date(novaDespesa.value.data_pagamento).toISOString() : new Date().toISOString(),
      tipo: "Saída",
    });
    triggerToast("Saída registrada!", "success");
    novaDespesa.value.descricao = "";
    novaDespesa.value.valor = null;
    await carregarDadosFinanceiros();
  } catch (e) {
    triggerToast("Erro ao salvar.", "error");
  }
}

function acionarImpressao() {
  window.print();
}
function exportarParaCSV() {
  /* Código anterior omitido para brevidade */
}

// --- REATIVIDADE (A MÁGICA ACONTECE AQUI) ---

// 1. Quando altera o mês geral, ajusta os inputs de data e carrega do banco
watch(mesFiltro, (novoMes) => {
  const [ano, mes] = novoMes.split("-");
  filtroDataInicio.value = `${novoMes}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  filtroDataFim.value = `${novoMes}-${String(ultimoDia).padStart(2, "0")}`;

  carregarDadosFinanceiros();
});

// 2. Quando a tabela filtrada muda (seja por carregamento do banco ou mexer nas datas/categoria)
// Recalcula os Totais (KPIs) e atualiza o Gráfico dinamicamente!
watch(
  transacoesFiltradas,
  async (novaLista) => {
    kpis.value = await financeiroService.calcularResumoMensal(novaLista);
    await nextTick();
    renderizarGrafico();
  },
  { deep: true },
);

// 3. Quando o utilizador mudar o tipo de gráfico (linha vs barra)
watch(tipoGrafico, () => {
  nextTick(() => renderizarGrafico());
});

// Atualiza o backend quando os filtros de data manual são alterados, para garantir sincronia UI x Banco
watch([filtroDataInicio, filtroDataFim], () => {
  carregarDadosFinanceiros();
});

onMounted(() => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");

  filtroDataInicio.value = `${ano}-${mes}-01`;
  const ultimo = new Date(ano, hoje.getMonth() + 1, 0).getDate();
  filtroDataFim.value = `${ano}-${mes}-${ultimo}`;

  carregarDadosFinanceiros();
});

onUnmounted(() => {
  if (instanceGrafico) instanceGrafico.destroy();
});
</script>

<template>
  <div class="financeiro-wrapper">
    <div class="card mb-2 tela-nao-imprimivel">
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
        <h4
          style="
            margin: 0;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">analytics</span> Filtros de Relatório
        </h4>
        <div style="display: flex; gap: 10px">
          <button type="button"
            class="btn-outline"
            style="
              border-color: #27ae60;
              color: #27ae60;
              display: flex;
              align-items: center;
              gap: 6px;
            "
            @click="exportarParaCSV"
          >
            <span class="icon-dinamico" style="font-size: 1.1rem"
              >file_download</span
            >
            Exportar Excel
          </button>
          <button type="button"
            class="btn-outline"
            style="display: flex; align-items: center; gap: 6px"
            @click="acionarImpressao"
          >
            <span class="icon-dinamico" style="font-size: 1.1rem">print</span>
            Imprimir PDF
          </button>
        </div>
      </div>
      <div class="filtros-row">
        <div class="f-item">
          <label>Início:</label><input type="date" v-model="filtroDataInicio" />
        </div>
        <div class="f-item">
          <label>Fim:</label><input type="date" v-model="filtroDataFim" />
        </div>
        <div class="f-item">
          <label>Categoria:</label>
          <select v-model="filtroCategoria">
            <option>Todas</option>
            <option>Servico</option>
            <option>Aluguel</option>
            <option>Luz/Água</option>
            <option>Ferramentas</option>
            <option>Materiais</option>
            <option>Outros</option>
          </select>
        </div>
        <div class="f-item">
          <label>Mês de Referência:</label>
          <input type="month" v-model="mesFiltro" />
        </div>
      </div>
    </div>

    <div
      class="card mb-2 chart-container"
      style="position: relative; height: 360px; padding-top: 50px"
    >
      <div
        style="
          position: absolute;
          top: 15px;
          left: 15px;
          display: flex;
          gap: 5px;
        "
      >
        <button type="button"
          class="btn-tab"
          :class="{ active: tipoGrafico === 'resumo' }"
          @click="tipoGrafico = 'resumo'"
          style="
            padding: 4px 10px;
            font-size: 0.8rem;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
          "
        >
          <span class="icon-dinamico" style="font-size: 1rem">bar_chart</span>
          Resumo
        </button>
        <button type="button"
          class="btn-tab"
          :class="{ active: tipoGrafico === 'temporal' }"
          @click="tipoGrafico = 'temporal'"
          style="
            padding: 4px 10px;
            font-size: 0.8rem;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
          "
        >
          <span class="icon-dinamico" style="font-size: 1rem">show_chart</span>
          Evolução Temporal
        </button>
      </div>
      <canvas ref="graficoRef"></canvas>
    </div>

    <div class="resumo-grid mb-2">
      <div class="resumo-card verde">
        <small>Faturamento (Bruto)</small>
        <strong>R$ {{ (totalEntradas || 0).toFixed(2) }}</strong>
      </div>
      <div class="resumo-card vermelho">
        <small>Despesas</small>
        <strong>R$ {{ (totalSaidas || 0).toFixed(2) }}</strong>
      </div>
      <div class="resumo-card azul">
        <small>Saldo Real (Líquido)</small>
        <strong>R$ {{ (totalEntradas - totalSaidas).toFixed(2) }}</strong>
      </div>
    </div>

    <div class="financeiro-layout">
      <div class="card col-form-fin tela-nao-imprimivel">
        <h4
          class="title-section"
          style="display: flex; align-items: center; gap: 8px; margin-top: 0"
        >
          <span class="icon-dinamico">paid</span> Lançar Despesa
        </h4>
        <div class="form-group">
          <label>Descrição</label>
          <input v-model="novaDespesa.descricao" placeholder="Ex: Aluguel" />
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 10px">
          <div style="flex: 1">
            <label>Valor (R$)</label>
            <input
              v-model.number="novaDespesa.valor"
              type="number"
              step="0.01"
            />
          </div>
          <div style="flex: 1">
            <label>Categoria</label>
            <select v-model="novaDespesa.categoria">
              <option>Aluguel</option>
              <option>Luz/Água</option>
              <option>Ferramentas</option>
              <option>Materiais</option>
              <option>Outros</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Data</label>
          <input v-model="novaDespesa.data_pagamento" type="datetime-local" />
        </div>
        <button type="button"
          class="btn-primary"
          @click="salvarDespesa"
          style="
            width: 100%;
            background: var(--danger);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          "
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >add_circle</span
          >
          Registar Saída
        </button>
      </div>

      <div class="card col-tabela-fin">
        <h4
          class="title-section"
          style="display: flex; align-items: center; gap: 8px; margin-top: 0"
        >
          <span class="icon-dinamico">receipt_long</span> Movimentações
          Detalhadas
        </h4>
        <div v-if="carregando" class="text-center p-2">
          Processando caixa...
        </div>
        <div v-else class="tabela-responsiva">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th align="right">Bruto</th>
                <th align="right">Taxa</th>
                <th align="right">Líquido</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="transacoesFiltradas.length === 0">
                <td
                  colspan="5"
                  class="text-center text-muted"
                  style="padding: 20px"
                >
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
              <tr v-for="t in transacoesFiltradas" :key="t.id">
                <td>
                  {{
                    new Date(t.data_pagamento + (t.data_pagamento.includes("T") ? "" : "T12:00:00")).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                  }}
                </td>
                <td>
                  {{ t.descricao }}
                  <div
                    v-if="t.tipo === 'Entrada'"
                    class="text-muted"
                    style="font-size: 0.8rem"
                  >
                    Categoria: {{ t.categoria }}
                  </div>
                </td>
                <td align="right">R$ {{ (t.valor_bruto || 0).toFixed(2) }}</td>
                <td align="right" class="text-danger">
                  <span v-if="t.taxa_taxa > 0"
                    >- R$ {{ t.taxa_taxa.toFixed(2) }}</span
                  >
                  <span v-else>--</span>
                </td>
                <td
                  align="right"
                  :class="t.tipo === 'Entrada' ? 'text-success' : 'text-danger'"
                  style="font-weight: bold"
                >
                  {{ t.tipo === "Entrada" ? "+" : "-" }} R$
                  {{
                    (
                      t.valor_liquido ?? t.valor_bruto - (t.taxa_taxa || 0)
                    ).toFixed(2)
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filtros-row {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}
.f-item {
  flex: 1;
  min-width: 140px;
}
.resumo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 15px;
}
.resumo-card {
  padding: 15px;
  border-radius: 8px;
  color: white;
}
.resumo-card strong {
  font-size: 1.5rem;
  display: block;
  margin-top: 5px;
}
.verde {
  background: #27ae60;
}
.vermelho {
  background: #c0392b;
}
.azul {
  background: var(--primary);
}
.financeiro-layout {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.col-form-fin {
  flex: 1;
  min-width: 280px;
}
.col-tabela-fin {
  flex: 2;
  min-width: 350px;
}

@media print {
  .tela-nao-imprimivel {
    display: none !important;
  }
  .financeiro-wrapper {
    padding: 0;
  }
  .card {
    border: none !important;
    box-shadow: none !important;
    padding: 10px 0 !important;
  }
  .resumo-card {
    border: 1px solid #eee;
    color: black !important;
    background: white !important;
  }
  .resumo-card strong {
    color: black !important;
  }
  .col-tabela-fin {
    width: 100% !important;
    flex: none !important;
  }
}
</style>
