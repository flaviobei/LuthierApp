<script setup>
/**
 * ============================================================================
 * @file        Financeiro.vue
 * @description Módulo de gestão financeira. Permite o acompanhamento de
 * entradas (serviços) e saídas (despesas), oferecendo uma visão analítica
 * através de gráficos e resumos de saldo líquido.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted, computed, watch, nextTick } from "vue";
import { supabase } from "../lib/supabaseClient";
import Chart from "chart.js/auto";
import { useToast } from "../composables/useToast";

const { triggerToast } = useToast();

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

  // CONSULTA ATUALIZADA: Puxa também os dados da O.S., do Instrumento e do Cliente!
  const { data } = await supabase
    .from("transacoes")
    .select(
      `
      *,
      servicos (
        numero_os,
        instrumentos (
          marca,
          modelo,
          cliente:clientes (nome)
        )
      )
    `,
    )
    .order("data_pagamento", { ascending: true });

  if (data) transacoes.value = data;
  carregando.value = false;

  await nextTick();
  renderizarGrafico();
}

function acionarImpressao() {
  window.print();
}

// --- FUNÇÃO DE EXPORTAÇÃO (AGORA USANDO AS COLUNAS REAIS DO BANCO) ---
function exportarParaCSV() {
  if (transacoesFiltradas.value.length === 0) {
    return triggerToast("Não há dados para exportar neste período.", "error");
  }

  // 1. Cabeçalho com Taxa em R$ e Líquido
  let csvContent =
    "Data Pagamento;Descricao;Categoria;Tipo Movimentacao;O.S.;Cliente;Instrumento;Taxa (R$);Valor Bruto (R$);Valor Liquido (R$)\n";

  // 2. Preencher com os dados filtrados
  transacoesFiltradas.value.forEach((t) => {
    // Datas e textos base
    const dataFormatada = new Date(
      t.data_pagamento + "T12:00:00",
    ).toLocaleDateString("pt-BR");
    const descLimpa = t.descricao
      ? t.descricao.replace(/;/g, ",").replace(/\n/g, " ")
      : "Sem descrição";

    // Extração de dados Relacionais
    const osNum = t.servicos?.numero_os ? `#${t.servicos.numero_os}` : "--";
    const clienteNome = t.servicos?.instrumentos?.cliente?.nome || "--";
    const instrumentoInfo = t.servicos?.instrumentos
      ? `${t.servicos.instrumentos.marca} ${t.servicos.instrumentos.modelo}`
      : "--";

    // CÁLCULO DE VALORES COM BASE NAS COLUNAS REAIS DA TABELA TRANSACOES
    let valorBrutoNum = Number(t.valor_bruto) || 0;
    let valorTaxaNum = Number(t.taxa_taxa) || 0;
    let valorLiquidoNum =
      t.valor_liquido !== null
        ? Number(t.valor_liquido)
        : valorBrutoNum - valorTaxaNum;

    // Formatação amigável para o Excel (R$)
    const vBrutoStr = valorBrutoNum.toFixed(2).replace(".", ",");
    const vTaxaStr = valorTaxaNum.toFixed(2).replace(".", ",");
    const vLiquidoStr = valorLiquidoNum.toFixed(2).replace(".", ",");

    // Concatena a linha
    csvContent += `${dataFormatada};${descLimpa};${t.categoria};${t.tipo};${osNum};${clienteNome};${instrumentoInfo};${vTaxaStr};${vBrutoStr};${vLiquidoStr}\n`;
  });

  // 3. Adicionar o BOM (Byte Order Mark) para o Excel reconhecer acentos
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  // 4. Criar um link invisível e clicar nele para baixar
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `Relatorio_Financeiro_${filtroDataInicio.value}_a_${filtroDataFim.value}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  triggerToast("Relatório completo gerado e baixado!", "success");
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

// SOMATÓRIA AGORA USA O VALOR LÍQUIDO
const totalEntradas = computed(() =>
  transacoesFiltradas.value
    .filter((t) => t.tipo === "Entrada")
    .reduce(
      (acc, t) =>
        acc +
        (t.valor_liquido !== null
          ? Number(t.valor_liquido)
          : Number(t.valor_bruto) - Number(t.taxa_taxa || 0)),
      0,
    ),
);
const totalSaidas = computed(
  () =>
    transacoesFiltradas.value
      .filter((t) => t.tipo === "Saida")
      .reduce((acc, t) => acc + Number(t.valor_bruto), 0), // Saídas costumam ser cheias
);

function renderizarGrafico() {
  if (!graficoRef.value) return;
  if (chartInstance) chartInstance.destroy();

  const labels = [
    ...new Set(transacoesFiltradas.value.map((t) => t.data_pagamento)),
  ].sort();

  // GRAFICO AGORA USA VALOR LÍQUIDO
  const dadosEntradas = labels.map((date) =>
    transacoesFiltradas.value
      .filter((t) => t.data_pagamento === date && t.tipo === "Entrada")
      .reduce(
        (acc, t) =>
          acc +
          (t.valor_liquido !== null
            ? Number(t.valor_liquido)
            : Number(t.valor_bruto) - Number(t.taxa_taxa || 0)),
        0,
      ),
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
          label: "Entradas (Líquidas)",
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
  if (!novaDespesa.value.descricao || novaDespesa.value.valor <= 0) {
    return triggerToast(
      "Preencha a descrição e indique um valor maior que zero.",
      "error",
    );
  }

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
    triggerToast("Despesa registada com sucesso!", "success");
    carregarDados();
  } else {
    triggerToast("Erro ao gravar despesa: " + error.message, "error");
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
          flex-wrap: wrap;
          gap: 10px;
        "
      >
        <h4 style="margin: 0; color: var(--primary)">
          📊 Filtros de Relatório
        </h4>
        <div style="display: flex; gap: 10px">
          <button
            class="btn-outline"
            style="border-color: #27ae60; color: #27ae60"
            @click="exportarParaCSV"
          >
            📥 Exportar Excel
          </button>
          <button class="btn-outline" @click="acionarImpressao">
            🖨️ Imprimir PDF
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
      </div>
    </div>

    <div class="card mb-2 chart-container" style="height: 300px">
      <canvas ref="graficoRef"></canvas>
    </div>

    <div class="resumo-grid mb-2">
      <div class="resumo-card verde">
        <small>Faturamento (Líquido)</small>
        <strong>R$ {{ totalEntradas.toFixed(2) }}</strong>
      </div>
      <div class="resumo-card vermelho">
        <small>Despesas</small><strong>R$ {{ totalSaidas.toFixed(2) }}</strong>
      </div>
      <div class="resumo-card azul">
        <small>Saldo Líquido</small>
        <strong>R$ {{ (totalEntradas - totalSaidas).toFixed(2) }}</strong>
      </div>
    </div>

    <div class="financeiro-layout">
      <div class="card col-form-fin tela-nao-imprimivel">
        <h4 class="title-section">💸 Lançar Despesa</h4>
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
          <input v-model="novaDespesa.data_pagamento" type="date" />
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
                  Nenhuma movimentação neste período.
                </td>
              </tr>
              <tr v-for="t in transacoesFiltradas" :key="t.id">
                <td>
                  {{
                    new Date(t.data_pagamento + "T12:00:00").toLocaleDateString(
                      "pt-BR",
                    )
                  }}
                </td>
                <td>
                  {{ t.descricao }}<br />
                  <small
                    v-if="t.servicos?.instrumentos"
                    class="text-muted"
                    style="display: block; margin-top: 3px"
                  >
                    👤 {{ t.servicos.instrumentos.cliente?.nome }} | 🎸
                    {{ t.servicos.instrumentos.marca }}
                  </small>
                </td>

                <td align="right" class="text-muted" style="font-size: 0.9em">
                  R$ {{ Number(t.valor_bruto).toFixed(2) }}
                </td>

                <td align="right" style="font-size: 0.9em; color: #e74c3c">
                  <span v-if="t.taxa_taxa > 0"
                    >- R$ {{ Number(t.taxa_taxa).toFixed(2) }}</span
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
                    Number(
                      t.valor_liquido !== null
                        ? t.valor_liquido
                        : t.valor_bruto - (t.taxa_taxa || 0),
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
