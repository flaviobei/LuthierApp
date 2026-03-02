<script setup>
/**
 * ============================================================================
 * @file        RelatoriosDashboard.vue
 * @description Dashboard analítico avançado. Focado em métricas de performance
 * financeira e operacional para auxílio na tomada de decisão.
 * ATUALIZAÇÃO: Correção de status (Finalizado/Entregue), cálculo de dias e ícones.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - chart.js: Renderização de gráficos de barras e pizzas.
 * - supabaseClient: Agrupamento de dados financeiros.
 * ============================================================================
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import Chart from "chart.js/auto";

const transacoes = ref([]);
const servicos = ref([]);
const loading = ref(true);

const tipoGraficoDash = ref("resumo"); // 'resumo' (6 Meses) ou 'temporal'
const periodoTemporal = ref(90); // 30, 60, 90, 180, 365, ou 9999 (Todo o período)
const graficoDashRef = ref(null);
let instanceGraficoDash = null;

async function carregarDados() {
  loading.value = true;

  // Resolvemos remover o limite matemático de 6 meses da query para que a visão temporal
  // possa exibir até 'Todo o período'. A carga para aplicações de pequeno/médio porte em Luthieria é mínima.
  const { data: dadosTransacoes } = await supabase
    .from("transacoes")
    .select("tipo, valor_bruto, data_pagamento");

  if (dadosTransacoes) transacoes.value = dadosTransacoes;

  // Busca os serviços globalmente (Para ter o 'Todo o período' ou métricas globais se necessário)
  const { data: dadosServicos } = await supabase
    .from("servicos")
    .select("status, data_entrada, data_conclusao");

  if (dadosServicos) servicos.value = dadosServicos;

  loading.value = false;
}

// --- KPIs GERAIS (MÊS ATUAL) ---
const mesAtual = new Date().getMonth();
const anoAtual = new Date().getFullYear();

const transacoesMesAtual = computed(() => {
  return transacoes.value.filter((t) => {
    const d = new Date(
      t.data_pagamento + (t.data_pagamento.includes("T") ? "" : "T12:00:00"),
    );
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });
});

const faturamentoMes = computed(() =>
  transacoesMesAtual.value
    .filter((t) => t.tipo === "Entrada")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);

const despesasMes = computed(() =>
  transacoesMesAtual.value
    .filter((t) => t.tipo === "Saida")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);

const lucroMes = computed(() => faturamentoMes.value - despesasMes.value);

// --- KPIs DE PRODUÇÃO ---

// OS em Andamento: Conta todas que NÃO são "Finalizado" nem "Entregue"
const osEmAndamento = computed(
  () =>
    servicos.value.filter(
      (s) => s.status !== "Entregue" && s.status !== "Finalizado",
    ).length,
);

// OS Finalizadas/Entregues no Mês atual
const osFinalizadasMes = computed(() => {
  return servicos.value.filter((s) => {
    if (s.status !== "Entregue" && s.status !== "Finalizado") return false;
    if (!s.data_conclusao) return false;

    const d = new Date(
      s.data_conclusao + (s.data_conclusao.includes("T") ? "" : "T12:00:00"),
    );
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;
});

// Tempo Médio (apenas de OS Finalizadas ou Entregues)
const tempoMedioServico = computed(() => {
  const concluidos = servicos.value.filter(
    (s) =>
      (s.status === "Entregue" || s.status === "Finalizado") &&
      s.data_entrada &&
      s.data_conclusao,
  );

  if (concluidos.length === 0) return 0;

  const totalDias = concluidos.reduce((acc, s) => {
    const inicio = new Date(
      s.data_entrada + (s.data_entrada.includes("T") ? "" : "T12:00:00"),
    );
    const fim = new Date(
      s.data_conclusao + (s.data_conclusao.includes("T") ? "" : "T12:00:00"),
    );

    // Zera a hora para calcular a diferença exata de dias
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(fim - inicio);
    // Se fez no mesmo dia, conta como 1 dia de trabalho. Se não, conta os dias normais.
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return acc + diffDays;
  }, 0);

  return Math.round(totalDias / concluidos.length);
});

// --- LÓGICA DO GRÁFICO DE BARRAS (ÚLTIMOS 6 MESES) ---
const ultimos6Meses = computed(() => {
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    meses.push({
      mes: d.getMonth(),
      ano: d.getFullYear(),
      label: d.toLocaleString("pt-BR", { month: "short" }).toUpperCase(),
      entrada: 0,
      saida: 0,
    });
  }

  transacoes.value.forEach((t) => {
    const d = new Date(
      t.data_pagamento + (t.data_pagamento.includes("T") ? "" : "T12:00:00"),
    );
    const index = meses.findIndex(
      (m) => m.mes === d.getMonth() && m.ano === d.getFullYear(),
    );
    if (index !== -1) {
      if (t.tipo === "Entrada") meses[index].entrada += Number(t.valor_bruto);
      if (t.tipo === "Saida") meses[index].saida += Number(t.valor_bruto);
    }
  });

  return meses;
});

const dadosTemporais = computed(() => {
  const trintaDiasAtras = new Date();
  if (periodoTemporal.value === 9999) {
    // Arbitrariamente 20 anos atrás para cobrir 'tudo'
    trintaDiasAtras.setFullYear(trintaDiasAtras.getFullYear() - 20);
  } else {
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - periodoTemporal.value);
  }
  trintaDiasAtras.setHours(0, 0, 0, 0);

  const diasAgrupados = {};

  // Se o período for maior ou igual a 6 meses (180 dias), o gráfico diário ficará
  // ilegível com centenas de pontos. Por isso, agrupamos por "Mês/Ano".
  const agruparPorMes = periodoTemporal.value >= 180;

  transacoes.value.forEach((t) => {
    const d = new Date(
      t.data_pagamento + (t.data_pagamento.includes("T") ? "" : "T12:00:00"),
    );

    // Só pega as transações dentro do período de corte
    if (d >= trintaDiasAtras) {
      let labelStr = "";
      if (agruparPorMes) {
        // Ex: "03/2026"
        labelStr = d.toLocaleDateString("pt-BR", {
          month: "2-digit",
          year: "numeric",
        });
      } else {
        // Ex: "15/03"
        labelStr = d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
      }

      if (!diasAgrupados[labelStr]) {
        diasAgrupados[labelStr] = { ganhos: 0, gastos: 0, dateObj: d };
      }

      if (t.tipo === "Entrada") {
        diasAgrupados[labelStr].ganhos += Number(t.valor_bruto);
      } else if (t.tipo === "Saida") {
        diasAgrupados[labelStr].gastos += Number(t.valor_bruto);
      }
    }
  });

  // Ordenar as chaves (datas) cronologicamente
  const labelsOrdenadas = Object.values(diasAgrupados)
    .sort((a, b) => a.dateObj - b.dateObj)
    .map((x) => {
      if (agruparPorMes) {
        return x.dateObj.toLocaleDateString("pt-BR", {
          month: "2-digit",
          year: "numeric",
        });
      }
      return x.dateObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
    });

  const dataGanhos = [];
  const dataGastos = [];

  labelsOrdenadas.forEach((lbl) => {
    dataGanhos.push(diasAgrupados[lbl]?.ganhos || 0);
    dataGastos.push(diasAgrupados[lbl]?.gastos || 0);
  });

  return {
    labels: labelsOrdenadas,
    ganhos: dataGanhos,
    gastos: dataGastos,
  };
});

// --- RENDERIZAR CHART.JS ---
function construirGraficoDash() {
  if (instanceGraficoDash) instanceGraficoDash.destroy();
  if (!graficoDashRef.value) return;

  const ctx = graficoDashRef.value.getContext("2d");

  if (tipoGraficoDash.value === "resumo") {
    // VISÃO 6 MESES (BARRAS)
    const dados = ultimos6Meses.value;
    instanceGraficoDash = new Chart(ctx, {
      type: "bar",
      data: {
        labels: dados.map((d) => d.label),
        datasets: [
          {
            label: "Entradas / Receitas (R$)",
            data: dados.map((d) => d.entrada),
            backgroundColor: "#27ae60",
            borderRadius: 4,
          },
          {
            label: "Saídas / Despesas (R$)",
            data: dados.map((d) => d.saida),
            backgroundColor: "#c0392b",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  } else if (tipoGraficoDash.value === "temporal") {
    // VISÃO TEMPORAL (DINÂMICA)
    const dados = dadosTemporais.value;
    const isAgrupadoPorMes = periodoTemporal.value >= 180;
    instanceGraficoDash = new Chart(ctx, {
      type: "line",
      data: {
        labels: dados.labels,
        datasets: [
          {
            label: isAgrupadoPorMes
              ? "Ganhos Mensais (R$)"
              : "Ganhos Diários (R$)",
            data: dados.ganhos,
            borderColor: "#27ae60",
            backgroundColor: "rgba(39, 174, 96, 0.1)",
            tension: 0.3,
            fill: true,
          },
          {
            label: isAgrupadoPorMes
              ? "Gastos Mensais (R$)"
              : "Gastos Diários (R$)",
            data: dados.gastos,
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
          legend: { position: "bottom" },
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

watch([tipoGraficoDash, periodoTemporal], () => {
  nextTick(() => construirGraficoDash());
});

onMounted(async () => {
  await carregarDados();
  construirGraficoDash();
});

onUnmounted(() => {
  if (instanceGraficoDash) instanceGraficoDash.destroy();
});
</script>

<template>
  <div
    v-if="loading"
    class="text-muted text-center"
    style="
      padding: 40px;
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
    A calcular métricas...
  </div>

  <div v-else class="relatorios-container">
    <div class="kpi-grid">
      <div class="kpi-card">
        <span
          class="kpi-title"
          style="display: flex; align-items: center; gap: 6px"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; color: var(--primary)"
            >account_balance_wallet</span
          >
          Faturamento (Mês)
        </span>
        <strong class="kpi-value text-primary"
          >R$ {{ faturamentoMes.toFixed(2) }}</strong
        >
      </div>
      <div class="kpi-card">
        <span
          class="kpi-title"
          style="display: flex; align-items: center; gap: 6px"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; color: var(--danger)"
            >money_off</span
          >
          Custos / Despesas (Mês)
        </span>
        <strong class="kpi-value text-danger"
          >R$ {{ despesasMes.toFixed(2) }}</strong
        >
      </div>
      <div class="kpi-card highlight">
        <span
          class="kpi-title"
          style="color: white; display: flex; align-items: center; gap: 6px"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >trending_up</span
          >
          Lucro Líquido (Mês)
        </span>
        <strong class="kpi-value">R$ {{ lucroMes.toFixed(2) }}</strong>
      </div>
    </div>

    <div class="main-grid">
      <div class="card chart-card">
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
            style="
              margin-top: 0;
              margin-bottom: 0;
              display: flex;
              align-items: center;
              gap: 8px;
            "
          >
            <span class="icon-dinamico">insights</span> Evolução Financeira
          </h3>
          <div style="display: flex; gap: 5px">
            <button
              class="btn-tab"
              :class="{ active: tipoGraficoDash === 'resumo' }"
              @click="tipoGraficoDash = 'resumo'"
              style="
                padding: 4px 10px;
                font-size: 0.8rem;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
              "
            >
              <span class="icon-dinamico" style="font-size: 0.75rem"
                >bar_chart</span
              >
              Balanço
            </button>
            <button
              class="btn-tab"
              :class="{ active: tipoGraficoDash === 'temporal' }"
              @click="tipoGraficoDash = 'temporal'"
              style="
                padding: 4px 10px;
                font-size: 0.8rem;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
              "
            >
              <span class="icon-dinamico" style="font-size: 0.75rem"
                >show_chart</span
              >
              Curva
            </button>
            <select
              v-if="tipoGraficoDash === 'temporal'"
              v-model="periodoTemporal"
              style="
                padding: 4px 8px;
                font-size: 0.8rem;
                border-radius: 4px;
                border: 1px solid var(--border);
                color: var(--text-main);
                background-color: var(--bg-card);
              "
            >
              <option :value="90">90 Dias</option>
              <option :value="180">6 Meses</option>
              <option :value="365">1 Ano</option>
              <option :value="9999">Tudo</option>
            </select>
          </div>
        </div>

        <div class="chart-wrapper" style="border: none; padding-top: 5px">
          <canvas ref="graficoDashRef"></canvas>
        </div>
      </div>

      <div class="producao-grid">
        <div class="card kpi-prod">
          <div class="icon">
            <span class="icon-dinamico" style="color: var(--primary)"
              >hourglass_bottom</span
            >
          </div>
          <div class="info">
            <span class="kpi-title">Tempo Médio de Entrega</span><br />
            <strong class="kpi-value">{{ tempoMedioServico }} dias</strong>
          </div>
        </div>

        <div class="card kpi-prod">
          <div class="icon">
            <span class="icon-dinamico" style="color: var(--warning)"
              >build</span
            >
          </div>
          <div class="info">
            <span class="kpi-title">Na Bancada (Ativas)</span><br />
            <strong class="kpi-value">{{ osEmAndamento }} O.S.</strong>
          </div>
        </div>

        <div class="card kpi-prod">
          <div class="icon">
            <span class="icon-dinamico" style="color: var(--success)"
              >check_circle</span
            >
          </div>
          <div class="info">
            <span class="kpi-title">Entregues neste mês</span><br />
            <strong class="kpi-value">{{ osFinalizadasMes }} O.S.</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.relatorios-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Grid Superior de KPIs */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 15px;
}
.kpi-card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: var(--shadow);
}
.kpi-card.highlight {
  background: var(--success);
  color: white;
  border: none;
}
.kpi-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 5px;
  font-weight: bold;
}
.kpi-value {
  font-size: 1.5rem;
  line-height: 1;
}

/* Grid Principal (Gráfico + Produtividade) */
.main-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}
@media (max-width: 768px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

/* Produtividade Vertical */
.producao-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.kpi-prod {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
}
.kpi-prod .icon {
  font-size: 2rem;
  background: var(--bg-body);
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.kpi-prod .icon .icon-dinamico {
  font-size: 2rem;
}

/* Chart Component */
.chart-card {
  display: flex;
  flex-direction: column;
}

.chart-wrapper {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 250px;
  padding-top: 20px;
  margin-bottom: 10px;
  position: relative;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
