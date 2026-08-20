<script setup>
/**
 * ============================================================================
 * @file        RelatoriosDashboard.vue
 * @description Dashboard analítico avançado. Focado em métricas de performance
 * financeira e operacional para auxílio na tomada de decisão.
 * ============================================================================
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import Chart from "chart.js/auto";
import { osService } from "../services/osService";
import { useI18n } from "vue-i18n";

const transacoes = ref([]);
const servicos = ref([]);
const faturamentoParado = ref([]);
const recebiveisBancada = ref({ totalRecebivel: 0, quantidade: 0 });
const loading = ref(true);

const tipoGraficoDash = ref("resumo");
const periodoTemporal = ref(90);
const graficoDashRef = ref(null);
const graficoMarcasRef = ref(null);
const graficoTiposRef = ref(null);

const { t } = useI18n();

let instanceGraficoDash = null;
let instanceGraficoMarcas = null;
let instanceGraficoTipos = null;

async function carregarDados() {
  loading.value = true;

  // Busca transações incluindo o servico_id para cruzar com os instrumentos
  const { data: dadosTransacoes } = await supabase
    .from("transacoes")
    .select("tipo, valor_bruto, data_pagamento, servico_id");

  if (dadosTransacoes) transacoes.value = dadosTransacoes;

  // Busca os serviços puxando a relação com a marca do instrumento
  const { data: dadosServicos } = await supabase
    .from("servicos")
    .select(
      "id, status, data_entrada, data_conclusao, tipo_os, instrumentos(marca)",
    );

  if (dadosServicos) servicos.value = dadosServicos;

  try {
    const [faturamentoP, recebiveisB] = await Promise.all([
      osService.buscarFaturamentoParado(),
      osService.buscarRecebiveisBancada()
    ]);
    faturamentoParado.value = faturamentoP;
    recebiveisBancada.value = recebiveisB;
  } catch (err) {
    console.error(t('dashboard.erro_buscar_dados'), err);
  }

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
    .filter((t) => t.tipo === "Saida" || t.tipo === "Saída")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);

const taxasMes = computed(() =>
  transacoesMesAtual.value
    .filter((t) => t.tipo === "Entrada")
    .reduce((acc, t) => acc + (Number(t.taxa_taxa) || 0), 0),
);

const lucroMes = computed(() => (faturamentoMes.value - taxasMes.value) - despesasMes.value);

const totalFaturamentoParado = computed(() => {
  return faturamentoParado.value.reduce((acc, os) => acc + os.saldoDevedor, 0);
});

const totalReceberGlobal = computed(() => {
  return totalFaturamentoParado.value + (recebiveisBancada.value?.totalRecebivel || 0);
});

// --- KPIs DE PRODUÇÃO ---
const mostrarTodoHistoricoProd = ref(false);

const servicosParaMétricas = computed(() => {
  if (mostrarTodoHistoricoProd.value) return servicos.value;
  
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - 6);

  return servicos.value.filter(s => {
    if (s.status !== "Entregue" && s.status !== "Finalizado") return true;
    if (!s.data_conclusao) return true;
    const dataConc = new Date(s.data_conclusao + (s.data_conclusao.includes("T") ? "" : "T12:00:00"));
    return dataConc >= dataCorte;
  });
});

const osEmAndamento = computed(
  () =>
    servicosParaMétricas.value.filter(
      (s) => s.status !== "Entregue" && s.status !== "Finalizado",
    ).length,
);

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

// Tempo Médio GERAL
const tempoMedioServico = computed(() => {
  const concluidos = servicosParaMétricas.value.filter(
    (s) =>
      (s.status === "Entregue" || s.status === "Finalizado") &&
      s.data_entrada &&
      s.data_conclusao &&
      s.tipo_os !== "Retrabalho",
  );

  if (concluidos.length === 0) return 0;

  const totalDias = concluidos.reduce((acc, s) => {
    const inicio = new Date(
      s.data_entrada + (s.data_entrada.includes("T") ? "" : "T12:00:00"),
    );
    const fim = new Date(
      s.data_conclusao + (s.data_conclusao.includes("T") ? "" : "T12:00:00"),
    );
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(fim - inicio);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return acc + diffDays;
  }, 0);

  return Math.round(totalDias / concluidos.length);
});

// Tempo Médio RETRABALHO
const tempoMedioRetrabalho = computed(() => {
  const concluidos = servicosParaMétricas.value.filter(
    (s) =>
      (s.status === "Entregue" || s.status === "Finalizado") &&
      s.data_entrada &&
      s.data_conclusao &&
      s.tipo_os === "Retrabalho",
  );

  if (concluidos.length === 0) return 0;

  const totalDias = concluidos.reduce((acc, s) => {
    const inicio = new Date(
      s.data_entrada + (s.data_entrada.includes("T") ? "" : "T12:00:00"),
    );
    const fim = new Date(
      s.data_conclusao + (s.data_conclusao.includes("T") ? "" : "T12:00:00"),
    );
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(fim - inicio);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return acc + diffDays;
  }, 0);

  return Math.round(totalDias / concluidos.length);
});

// --- LÓGICA DE DADOS PARA GRÁFICOS AVANÇADOS ---

// Ranking de Marcas (Top 5 Faturamento)
const dadosMarcas = computed(() => {
  const agregados = {};
  transacoes.value.forEach((t) => {
    if (t.tipo === "Entrada") {
      const svc = servicos.value.find((s) => s.id === t.servico_id);
      let marca = svc?.instrumentos?.marca;
      if (!marca || typeof marca !== "string" || marca.trim() === "") {
        marca = t('dashboard.outras_marcas');
      } else {
        marca = marca.trim();
        marca = marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
      }
      agregados[marca] = (agregados[marca] || 0) + Number(t.valor_bruto);
    }
  });

  const sorted = Object.keys(agregados)
    .map((k) => ({ marca: k, valor: agregados[k] }))
    .sort((a, b) => b.valor - a.valor);

  const top5 = sorted.slice(0, 10);

  return {
    labels: top5.map((x) => x.marca),
    valores: top5.map((x) => x.valor),
  };
});

// Volume de Retrabalho (O.S. Normal vs Garantia)
const dadosTiposOS = computed(() => {
  let retrabalho = 0;
  let normal = 0;
  servicosParaMétricas.value.forEach((s) => {
    if (s.tipo_os === "Retrabalho") retrabalho++;
    else normal++;
  });
  return [normal, retrabalho];
});

// Evolução 6 Meses
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
      if (t.tipo === "Saida" || t.tipo === "Saída") meses[index].saida += Number(t.valor_bruto);
    }
  });
  return meses;
});

const dadosTemporais = computed(() => {
  const trintaDiasAtras = new Date();
  if (periodoTemporal.value === 9999) {
    trintaDiasAtras.setFullYear(trintaDiasAtras.getFullYear() - 20);
  } else {
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - periodoTemporal.value);
  }
  trintaDiasAtras.setHours(0, 0, 0, 0);

  const diasAgrupados = {};
  const agruparPorMes = periodoTemporal.value >= 180;

  transacoes.value.forEach((t) => {
    const d = new Date(
      t.data_pagamento + (t.data_pagamento.includes("T") ? "" : "T12:00:00"),
    );

    if (d >= trintaDiasAtras) {
      let labelStr = "";
      if (agruparPorMes) {
        labelStr = d.toLocaleDateString("pt-BR", {
          month: "2-digit",
          year: "numeric",
        });
      } else {
        labelStr = d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
      }

      if (!diasAgrupados[labelStr])
        diasAgrupados[labelStr] = { ganhos: 0, gastos: 0, dateObj: d };
      if (t.tipo === "Entrada")
        diasAgrupados[labelStr].ganhos += Number(t.valor_bruto);
      else if (t.tipo === "Saida" || t.tipo === "Saída")
        diasAgrupados[labelStr].gastos += Number(t.valor_bruto);
    }
  });

  const labelsOrdenadas = Object.values(diasAgrupados)
    .sort((a, b) => a.dateObj - b.dateObj)
    .map((x) =>
      agruparPorMes
        ? x.dateObj.toLocaleDateString("pt-BR", {
            month: "2-digit",
            year: "numeric",
          })
        : x.dateObj.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
    );

  const dataGanhos = [];
  const dataGastos = [];
  labelsOrdenadas.forEach((lbl) => {
    dataGanhos.push(diasAgrupados[lbl]?.ganhos || 0);
    dataGastos.push(diasAgrupados[lbl]?.gastos || 0);
  });

  return { labels: labelsOrdenadas, ganhos: dataGanhos, gastos: dataGastos };
});

// --- RENDERIZAR CHART.JS ---
function construirGraficoDash() {
  if (instanceGraficoDash) instanceGraficoDash.destroy();
  if (!graficoDashRef.value) return;

  const ctx = graficoDashRef.value.getContext("2d");

  if (tipoGraficoDash.value === "resumo") {
    const dados = ultimos6Meses.value;
    instanceGraficoDash = new Chart(ctx, {
      type: "bar",
      data: {
        labels: dados.map((d) => d.label),
        datasets: [
          {
            label: t('dashboard.receitas_rs'),
            data: dados.map((d) => d.entrada),
            backgroundColor: "#27ae60",
            borderRadius: 4,
          },
          {
            label: t('dashboard.despesas_rs'),
            data: dados.map((d) => d.saida),
            backgroundColor: "#c0392b",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  } else if (tipoGraficoDash.value === "temporal") {
    const dados = dadosTemporais.value;
    const isAgrupadoPorMes = periodoTemporal.value >= 180;
    instanceGraficoDash = new Chart(ctx, {
      type: "line",
      data: {
        labels: dados.labels,
        datasets: [
          {
            label: isAgrupadoPorMes ? t('dashboard.ganhos_mensais') : t('dashboard.ganhos_diarios'),
            data: dados.ganhos,
            borderColor: "#27ae60",
            backgroundColor: "rgba(39, 174, 96, 0.1)",
            tension: 0.3,
            fill: true,
          },
          {
            label: isAgrupadoPorMes ? t('dashboard.gastos_mensais') : t('dashboard.gastos_diarios'),
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
        plugins: { legend: { position: "bottom" } },
        interaction: { mode: "nearest", axis: "x", intersect: false },
      },
    });
  }
}

function construirGraficosAvancados() {
  if (instanceGraficoMarcas) instanceGraficoMarcas.destroy();
  if (instanceGraficoTipos) instanceGraficoTipos.destroy();

  // Gráfico Horizontal de Marcas Rentáveis
  if (graficoMarcasRef.value && dadosMarcas.value.labels.length > 0) {
    instanceGraficoMarcas = new Chart(graficoMarcasRef.value.getContext("2d"), {
      type: "bar",
      data: {
        labels: dadosMarcas.value.labels,
        datasets: [
          {
            label: t('dashboard.faturamento_label'),
            data: dadosMarcas.value.valores,
            backgroundColor: "#3498db",
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y", // Barra horizontal
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${t('dashboard.moeda')} ${ctx.parsed.x.toFixed(2)}`,
            },
          },
        },
        scales: { x: { ticks: { callback: (val) => `${t('dashboard.moeda')} ${val}` } } },
      },
    });
  }

  // Gráfico Circular de Retrabalho
  if (graficoTiposRef.value) {
    instanceGraficoTipos = new Chart(graficoTiposRef.value.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: [t('dashboard.os_padrao'), t('dashboard.retrabalho_garantia')],
        datasets: [
          {
            data: dadosTiposOS.value,
            backgroundColor: ["#2c3e50", "#e74c3c"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const perc =
                  total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                return t('dashboard.os_qtd_perc', { qtd: ctx.parsed, perc });
              },
            },
          },
        },
      },
    });
  }
}

watch([tipoGraficoDash, periodoTemporal], () => {
  nextTick(() => construirGraficoDash());
});

watch(mostrarTodoHistoricoProd, () => {
  nextTick(() => construirGraficosAvancados());
});

onMounted(async () => {
  await carregarDados();
  construirGraficoDash();
  construirGraficosAvancados();
});

onUnmounted(() => {
  if (instanceGraficoDash) instanceGraficoDash.destroy();
  if (instanceGraficoMarcas) instanceGraficoMarcas.destroy();
  if (instanceGraficoTipos) instanceGraficoTipos.destroy();
});
</script>

<template>
  <div
    v-if="loading"
    class="text-muted text-center py-5"
    style="
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
    {{ $t('dashboard.calcular_metricas') }}
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
          {{ $t('dashboard.faturamento_mes') }}
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
          {{ $t('dashboard.custos_mes') }}
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
          {{ $t('dashboard.lucro_liquido_mes') }}
        </span>
        <strong class="kpi-value">R$ {{ lucroMes.toFixed(2) }}</strong>
      </div>
      <div class="kpi-card">
        <span
          class="kpi-title"
          style="display: flex; align-items: center; gap: 6px"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem; color: var(--info, #3b82f6)"
            >account_balance</span
          >
          {{ $t('dashboard.total_receber_os') }}
        </span>
        <strong class="kpi-value" style="color: var(--text-main); margin-bottom: 8px;">R$ {{ totalReceberGlobal.toFixed(2) }}</strong>
        
        <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--border); padding-top: 8px; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; color: var(--text-muted);">
            <span>{{ $t('dashboard.na_bancada_qtd', { qtd: recebiveisBancada.quantidade }) }}</span>
            <strong style="color: var(--text-main)">R$ {{ (recebiveisBancada?.totalRecebivel || 0).toFixed(2) }}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; color: var(--text-muted);">
            <span>{{ $t('dashboard.pronto_retirada_qtd', { qtd: faturamentoParado.length }) }}</span>
            <strong style="color: var(--warning)">R$ {{ totalFaturamentoParado.toFixed(2) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="card chart-card mb-2">
      <div class="flex-between mb-2" style="flex-wrap: wrap">
        <h3
          class="title-section"
          style="margin: 0; display: flex; align-items: center; gap: 8px"
        >
          <span class="icon-dinamico">insights</span> {{ $t('dashboard.evolucao_financeira') }}
        </h3>
        <div style="display: flex; gap: 5px; align-items: center">
          <button type="button"
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
            {{ $t('dashboard.balanco') }}
          </button>
          <button type="button"
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
            {{ $t('dashboard.curva') }}
          </button>
          <select
            v-if="tipoGraficoDash === 'temporal'"
            v-model="periodoTemporal"
            style="
              padding: 4px 8px;
              font-size: 0.8rem;
              border-radius: 4px;
              border: 1px solid var(--border);
            "
          >
            <option :value="90">{{ $t('dashboard.noventa_dias') }}</option>
            <option :value="180">{{ $t('dashboard.seis_meses') }}</option>
            <option :value="365">{{ $t('dashboard.um_ano') }}</option>
            <option :value="9999">{{ $t('dashboard.tudo') }}</option>
          </select>
        </div>
      </div>
      <div class="chart-wrapper" style="height: 250px">
        <canvas ref="graficoDashRef"></canvas>
      </div>
    </div>

    <div class="advanced-grid">
      <div class="card chart-card">
        <h3
          class="title-section"
          style="
            margin-top: 0;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 6px;
          "
        >
          <span class="icon-dinamico" style="color: #3498db"
            >workspace_premium</span
          >
          {{ $t('dashboard.top_marcas') }}
        </h3>
        <div class="chart-wrapper" style="height: 200px">
          <canvas
            ref="graficoMarcasRef"
            v-if="dadosMarcas.labels.length > 0"
          ></canvas>
          <div
            v-else
            class="text-muted text-center w-full"
            style="padding-top: 50px; font-size: 0.85rem"
          >
            {{ $t('dashboard.sem_dados_comerciais') }}
          </div>
        </div>
      </div>

      <div class="producao-grid">
        <div class="card" style="margin-bottom: 0; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem; color: var(--text-main); font-weight: bold; display: flex; align-items: center; gap: 6px;">
            <span class="icon-dinamico" style="font-size: 1rem; color: var(--text-muted);">date_range</span>
            {{ mostrarTodoHistoricoProd ? $t('dashboard.todo_historico') : $t('dashboard.ultimos_6_meses') }}
          </span>
          <button 
            type="button" 
            class="btn-outline" 
            style="padding: 4px 10px; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;" 
            @click="mostrarTodoHistoricoProd = !mostrarTodoHistoricoProd"
          >
            <span class="icon-dinamico" style="font-size: 0.9rem;">{{ mostrarTodoHistoricoProd ? 'filter_alt' : 'history' }}</span>
            {{ mostrarTodoHistoricoProd ? $t('dashboard.mostrar_6_meses') : $t('dashboard.carregar_tudo') }}
          </button>
        </div>
        <div class="card kpi-prod">
          <div class="icon">
            <span class="icon-dinamico" style="color: var(--primary)"
              >hourglass_bottom</span
            >
          </div>
          <div class="info">
            <span class="kpi-title">{{ $t('dashboard.tempo_medio_geral') }}</span><br />
            <strong class="kpi-value">{{ $t('dashboard.dias_qtd', { dias: tempoMedioServico }) }}</strong>
          </div>
        </div>
        <div class="card kpi-prod">
          <div class="icon">
            <span class="icon-dinamico" style="color: var(--danger)"
              >assignment_return</span
            >
          </div>
          <div class="info">
            <span class="kpi-title">{{ $t('dashboard.tempo_retrabalho') }}</span><br />
            <strong class="kpi-value">{{ $t('dashboard.dias_qtd', { dias: tempoMedioRetrabalho }) }}</strong>
          </div>
        </div>
        <div class="card kpi-prod">
          <div class="icon">
            <span class="icon-dinamico" style="color: var(--warning)"
              >build</span
            >
          </div>
          <div class="info">
            <span class="kpi-title">{{ $t('dashboard.na_bancada_ativas') }}</span><br />
            <strong class="kpi-value">{{ $t('dashboard.os_qtd', { qtd: osEmAndamento }) }}</strong>
          </div>
        </div>
      </div>

      <div class="card chart-card">
        <h3
          class="title-section"
          style="
            margin-top: 0;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 6px;
          "
        >
          <span class="icon-dinamico" style="color: #e74c3c">pie_chart</span>
          {{ $t('dashboard.taxa_retrabalho') }}
        </h3>
        <div class="chart-wrapper" style="height: 200px">
          <canvas ref="graficoTiposRef"></canvas>
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

/* KPIs Superiores (Financeiro) */
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

/* Grid Inferior (Avançado) */
.advanced-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
@media (max-width: 1024px) {
  .advanced-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 768px) {
  .advanced-grid {
    grid-template-columns: 1fr;
  }
}

/* Produtividade Vertical */
.producao-grid {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 15px;
}
.kpi-prod {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px 20px;
  margin-bottom: 0;
  flex: 1;
}
.kpi-prod .icon {
  font-size: 2rem;
  background: var(--bg-body);
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.kpi-prod .icon .icon-dinamico {
  font-size: 1.8rem;
}

/* Estrutura do Chart */
.chart-card {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}
.chart-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  position: relative;
  width: 100%;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
