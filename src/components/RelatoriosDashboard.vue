<script setup>
import { ref, computed, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";

const transacoes = ref([]);
const servicos = ref([]);
const loading = ref(true);

async function carregarDados() {
  loading.value = true;

  // Busca as transações financeiras
  const { data: dadosTransacoes } = await supabase
    .from("transacoes")
    .select("tipo, valor_bruto, data_pagamento");
  if (dadosTransacoes) transacoes.value = dadosTransacoes;

  // Busca os serviços para analisar tempo de entrega e volume
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
    const d = new Date(t.data_pagamento);
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
const osEmAndamento = computed(
  () => servicos.value.filter((s) => s.status !== "Entregue").length,
);
const osFinalizadasMes = computed(() => {
  return servicos.value.filter((s) => {
    if (s.status !== "Entregue" || !s.data_conclusao) return false;
    const d = new Date(s.data_conclusao);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;
});

const tempoMedioServico = computed(() => {
  const entregues = servicos.value.filter(
    (s) => s.status === "Entregue" && s.data_entrada && s.data_conclusao,
  );
  if (entregues.length === 0) return 0;

  const totalDias = entregues.reduce((acc, s) => {
    const inicio = new Date(s.data_entrada);
    const fim = new Date(s.data_conclusao);
    const diffTime = Math.abs(fim - inicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return acc + diffDays;
  }, 0);

  return Math.round(totalDias / entregues.length);
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
    const d = new Date(t.data_pagamento);
    const index = meses.findIndex(
      (m) => m.mes === d.getMonth() && m.ano === d.getFullYear(),
    );
    if (index !== -1) {
      if (t.tipo === "Entrada") meses[index].entrada += Number(t.valor_bruto);
      if (t.tipo === "Saida") meses[index].saida += Number(t.valor_bruto);
    }
  });

  // Calcula a altura da barra para o CSS (percentagem)
  const maxValor = Math.max(
    ...meses.map((m) => Math.max(m.entrada, m.saida, 1)),
  ); // Evita dividir por zero
  return meses.map((m) => ({
    ...m,
    pctEntrada: Math.round((m.entrada / maxValor) * 100),
    pctSaida: Math.round((m.saida / maxValor) * 100),
  }));
});

onMounted(() => carregarDados());
</script>

<template>
  <div v-if="loading" class="text-muted text-center" style="padding: 40px">
    A calcular métricas...
  </div>

  <div v-else class="relatorios-container">
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-title">Faturamento (Mês)</span>
        <strong class="kpi-value text-primary"
          >R$ {{ faturamentoMes.toFixed(2) }}</strong
        >
      </div>
      <div class="kpi-card">
        <span class="kpi-title">Custos / Despesas (Mês)</span>
        <strong class="kpi-value text-danger"
          >R$ {{ despesasMes.toFixed(2) }}</strong
        >
      </div>
      <div class="kpi-card highlight">
        <span class="kpi-title" style="color: white">Lucro Líquido (Mês)</span>
        <strong class="kpi-value">R$ {{ lucroMes.toFixed(2) }}</strong>
      </div>
    </div>

    <div class="main-grid">
      <div class="card chart-card">
        <h3 class="title-section" style="margin-top: 0">
          Evolução Financeira (6 Meses)
        </h3>

        <div class="legenda-grafico">
          <span class="dot entrada"></span> Receitas
          <span class="dot saida" style="margin-left: 15px"></span> Custos
        </div>

        <div class="chart-wrapper">
          <div
            v-for="(mes, index) in ultimos6Meses"
            :key="index"
            class="chart-column"
          >
            <div class="bars-container">
              <div
                class="bar-wrapper"
                :title="'Custos: R$ ' + mes.saida.toFixed(2)"
              >
                <div
                  class="bar bg-danger"
                  :style="{ height: mes.pctSaida + '%' }"
                ></div>
              </div>
              <div
                class="bar-wrapper"
                :title="'Faturamento: R$ ' + mes.entrada.toFixed(2)"
              >
                <div
                  class="bar bg-success"
                  :style="{ height: mes.pctEntrada + '%' }"
                ></div>
              </div>
            </div>

            <span class="chart-label">{{ mes.label }}</span>
          </div>
        </div>
      </div>

      <div class="producao-grid">
        <div class="card kpi-prod">
          <div class="icon">⏳</div>
          <div class="info">
            <span class="kpi-title">Tempo Médio de Entrega</span><br />
            <strong class="kpi-value">{{ tempoMedioServico }} dias</strong>
          </div>
        </div>

        <div class="card kpi-prod">
          <div class="icon">🎸</div>
          <div class="info">
            <span class="kpi-title">Na Bancada (Ativas)</span><br />
            <strong class="kpi-value">{{ osEmAndamento }} O.S.</strong>
          </div>
        </div>

        <div class="card kpi-prod">
          <div class="icon">✅</div>
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
  font-size: 0.75rem;
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
  font-size: 2.5rem;
  background: var(--bg-body);
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

/* Gráfico de Barras em CSS */
.chart-card {
  display: flex;
  flex-direction: column;
}
.legenda-grafico {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  margin-bottom: 20px;
  color: var(--text-muted);
  font-weight: bold;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 5px;
}
.dot.entrada {
  background: var(--success);
}
.dot.saida {
  background: var(--danger);
}

.chart-wrapper {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 250px;
  padding-top: 20px;
  border-top: 1px dashed var(--border);
  border-bottom: 1px solid var(--primary);
  margin-bottom: 10px;
}
.chart-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 15%;
  justify-content: flex-end;
}
.bars-container {
  display: flex;
  gap: 5px;
  align-items: flex-end;
  height: 100%;
  width: 100%;
  justify-content: center;
}
.bar-wrapper {
  height: 100%;
  width: 30%;
  max-width: 30px;
  display: flex;
  align-items: flex-end;
  cursor: pointer;
  transition: 0.2s;
}
.bar-wrapper:hover {
  opacity: 0.8;
}
.bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  min-height: 2px;
  transition: height 0.5s ease-out;
}
.bg-success {
  background: var(--success);
}
.bg-danger {
  background: var(--danger);
}
.chart-label {
  margin-top: 10px;
  font-size: 0.5rem;
  font-weight: bold;
  color: var(--text-muted);
}
</style>
