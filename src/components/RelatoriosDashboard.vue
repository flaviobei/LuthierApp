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
const periodoGlobal = ref(6);
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

// --- FILTROS GERAIS ---
const transacoesFiltradas = computed(() => {
  if (periodoGlobal.value === 9999) return transacoes.value;
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - periodoGlobal.value);
  const dataCorteTime = dataCorte.getTime();
  
  return transacoes.value.filter((t) => {
    const d = new Date(t.data_pagamento + (t.data_pagamento.includes("T") ? "" : "T12:00:00")).getTime();
    return d >= dataCorteTime;
  });
});

const servicosFiltrados = computed(() => {
  if (periodoGlobal.value === 9999) return servicos.value;
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - periodoGlobal.value);
  const dataCorteTime = dataCorte.getTime();

  return servicos.value.filter((s) => {
    if (s.status !== "Entregue" && s.status !== "Finalizado") return true;
    if (!s.data_conclusao) return true;
    const d = new Date(s.data_conclusao + (s.data_conclusao.includes("T") ? "" : "T12:00:00")).getTime();
    return d >= dataCorteTime;
  });
});

// --- KPIs FINANCEIROS ---
const faturamentoPeriodo = computed(() =>
  transacoesFiltradas.value
    .filter((t) => t.tipo === "Entrada")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);

const despesasPeriodo = computed(() =>
  transacoesFiltradas.value
    .filter((t) => t.tipo === "Saida" || t.tipo === "Saída")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);

const taxasPeriodo = computed(() =>
  transacoesFiltradas.value
    .filter((t) => t.tipo === "Entrada")
    .reduce((acc, t) => acc + (Number(t.taxa_taxa) || 0), 0),
);

const lucroPeriodo = computed(() => (faturamentoPeriodo.value - taxasPeriodo.value) - despesasPeriodo.value);

const totalFaturamentoParado = computed(() => {
  return faturamentoParado.value.reduce((acc, os) => acc + os.saldoDevedor, 0);
});

const totalReceberGlobal = computed(() => {
  return totalFaturamentoParado.value + (recebiveisBancada.value?.totalRecebivel || 0);
});

// --- KPIs DE PRODUÇÃO ---
const osEmAndamento = computed(
  () =>
    servicosFiltrados.value.filter(
      (s) => s.status !== "Entregue" && s.status !== "Finalizado",
    ).length,
);

// Tempo Médio GERAL
const tempoMedioServico = computed(() => {
  const concluidos = servicosFiltrados.value.filter(
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
  const concluidos = servicosFiltrados.value.filter(
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
  transacoesFiltradas.value.forEach((t) => {
    if (t.tipo === "Entrada") {
      const svc = servicosFiltrados.value.find((s) => s.id === t.servico_id);
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
  servicosFiltrados.value.forEach((s) => {
    if (s.tipo_os === "Retrabalho") retrabalho++;
    else normal++;
  });
  return [normal, retrabalho];
});

// Evolução Mensal (Bar Chart)
const evolucaoMensal = computed(() => {
  const numMeses = periodoGlobal.value === 9999 ? 12 : periodoGlobal.value;
  const meses = [];
  for (let i = numMeses - 1; i >= 0; i--) {
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
  const diasParaReduzir = periodoGlobal.value === 3 ? 90 : (periodoGlobal.value === 6 ? 180 : 9999);
  
  if (diasParaReduzir === 9999) {
    trintaDiasAtras.setFullYear(trintaDiasAtras.getFullYear() - 20);
  } else {
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - diasParaReduzir);
  }
  trintaDiasAtras.setHours(0, 0, 0, 0);

  const diasAgrupados = {};
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
