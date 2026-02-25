<script setup>
/**
 * ============================================================================
 * @file        Financeiro.vue
 * @description Módulo de gestão financeira. Permite o acompanhamento de
 * entradas (serviços) e saídas (despesas), oferecendo uma visão analítica
 * através de gráficos e resumos de saldo líquido.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - chart.js: Utilizado para a renderização do gráfico de linha temporal.
 * - supabaseClient: Acede à tabela 'transacoes'.
 * * @functions
 * - carregarDados(): Procura todas as movimentações financeiras do utilizador.
 * - renderizarGrafico(): Constrói o gráfico comparativo de Entradas vs Saídas.
 * - salvarDespesa(): Regista saídas manuais (aluguer, luz, ferramentas) no banco.
 * * @notes
 * - Inclui filtros de data dinâmicos que atualizam os cálculos e o gráfico em tempo real.
 * - Possui suporte a impressão de relatórios formatados via CSS @media print.
 * ============================================================================
 */

import { ref, onMounted, computed, watch, nextTick } from "vue";
import { supabase } from "../lib/supabaseClient";
import Chart from "chart.js/auto";

const transacoes = ref([]);
const carregando = ref(true);
const graficoRef = ref(null);
let chartInstance = null;

// --- FILTROS DE RELATÓRIO ---
const hoje = new Date().toISOString().substring(0, 10);
const primeiroDiaMes = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
)
  .toISOString()
  .substring(0, 10);

const filtroDataInicio = ref(primeiroDiaMes);
const filtroDataFim = ref(hoje);
const filtroCategoria = ref("Todas");

// --- FORMULÁRIO DE DESPESA ---
const novaDespesa = ref({
  descricao: "",
  valor: 0,
  categoria: "Aluguel",
  data_pagamento: hoje,
});

async function carregarDados() {
  carregando.value = true;
  const { data } = await supabase
    .from("transacoes")
    .select("*")
    .order("data_pagamento", { ascending: true });
  if (data) transacoes.value = data;
  carregando.value = false;

  await nextTick();
  renderizarGrafico();
}

// FUNÇÃO DE IMPRESSÃO CORRIGIDA
function acionarImpressao() {
  window.print();
}

const transacoesFiltradas = computed(() => {
  return transacoes.value.filter((t) => {
    return (
      t.data_pagamento >= filtroDataInicio.value &&
      t.data_pagamento <= filtroDataFim.value &&
      (filtroCategoria.value === "Todas" ||
        t.categoria === filtroCategoria.value)
    );
  });
});

const totalEntradas = computed(() =>
  transacoesFiltradas.value
    .filter((t) => t.tipo === "Entrada")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);
const totalSaidas = computed(() =>
  transacoesFiltradas.value
    .filter((t) => t.tipo === "Saida")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);

function renderizarGrafico() {
  if (!graficoRef.value) return;
  if (chartInstance) chartInstance.destroy();

  const labels = [
    ...new Set(transacoesFiltradas.value.map((t) => t.data_pagamento)),
  ].sort();
  const dadosEntradas = labels.map((date) =>
    transacoesFiltradas.value
      .filter((t) => t.data_pagamento === date && t.tipo === "Entrada")
      .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
  );
  const dadosSaidas = labels.map((date) =>
    transacoesFiltradas.value
      .filter((t) => t.data_pagamento === date && t.tipo === "Saida")
      .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
  );

  chartInstance = new Chart(graficoRef.value, {
    type: "line",
    data: {
      labels: labels.map((l) =>
        new Date(l + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      ),
      datasets: [
        {
          label: "Entradas",
          data: dadosEntradas,
          borderColor: "#27ae60",
          backgroundColor: "#27ae6022",
          fill: true,
          tension: 0.4,
        },
        {
          label: "Saídas",
          data: dadosSaidas,
          borderColor: "#c0392b",
          backgroundColor: "#c0392b22",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

async function salvarDespesa() {
  if (!novaDespesa.value.descricao || novaDespesa.value.valor <= 0)
    return alert("Preencha a descrição e o valor.");
  const { error } = await supabase.from("transacoes").insert([
    {
      descricao: novaDespesa.value.descricao,
      valor_bruto: novaDespesa.value.valor,
      tipo: "Saida",
      categoria: novaDespesa.value.categoria,
      data_pagamento: novaDespesa.value.data_pagamento,
    },
  ]);
  if (!error) {
    novaDespesa.value = {
      descricao: "",
      valor: 0,
      categoria: "Aluguel",
      data_pagamento: hoje,
    };
    carregarDados();
  }
}

watch([filtroDataInicio, filtroDataFim, filtroCategoria, transacoes], () => {
  nextTick(() => renderizarGrafico());
});

onMounted(carregarDados);
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
        "
      >
        <h4 style="margin: 0">📊 Filtros de Relatório</h4>
        <button class="btn-outline" @click="acionarImpressao">
          🖨️ Imprimir PDF
        </button>
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
      </div>
    </div>

    <div class="card mb-2 chart-container" style="height: 300px">
      <canvas ref="graficoRef"></canvas>
    </div>

    <div class="resumo-grid mb-2">
      <div class="resumo-card verde">
        <small>Faturamento</small
        ><strong>R$ {{ totalEntradas.toFixed(2) }}</strong>
      </div>
      <div class="resumo-card vermelho">
        <small>Despesas</small><strong>R$ {{ totalSaidas.toFixed(2) }}</strong>
      </div>
      <div class="resumo-card azul">
        <small>Saldo Líquido</small
        ><strong>R$ {{ (totalEntradas - totalSaidas).toFixed(2) }}</strong>
      </div>
    </div>

    <div class="financeiro-layout">
      <div class="card col-form-fin tela-nao-imprimivel">
        <h4 class="title-section">💸 Lançar Despesa</h4>
        <div class="form-group">
          <label>Descrição</label
          ><input v-model="novaDespesa.descricao" placeholder="Ex: Aluguel" />
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 10px">
          <div style="flex: 1">
            <label>Valor (R$)</label
            ><input
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
          <label>Data</label
          ><input v-model="novaDespesa.data_pagamento" type="date" />
        </div>
        <button
          class="btn-primary"
          @click="salvarDespesa"
          style="width: 100%; background: var(--danger)"
        >
          Registar Saída
        </button>
      </div>

      <div class="card col-tabela-fin">
        <h4 class="title-section">📑 Movimentações Detalhadas</h4>
        <div class="tabela-responsiva">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th align="right">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in transacoesFiltradas" :key="t.id">
                <td>
                  {{
                    new Date(t.data_pagamento + "T12:00:00").toLocaleDateString(
                      "pt-BR",
                    )
                  }}
                </td>
                <td>{{ t.descricao }}</td>
                <td
                  align="right"
                  :class="t.tipo === 'Entrada' ? 'text-success' : 'text-danger'"
                  style="font-weight: bold"
                >
                  {{ t.tipo === "Entrada" ? "+" : "-" }} R$
                  {{ Number(t.valor_bruto).toFixed(2) }}
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
.preto {
  background: #333;
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

/* REGRAS PARA O PDF / IMPRESSÃO */
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
