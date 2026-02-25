<script setup>
import { ref, computed, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";

const emit = defineEmits(["fechar"]);

// Abas internas do Financeiro
const abaAtual = ref("caixa"); // 'caixa' ou 'relatorio'

// --- ESTADO: VISÃO GERAL (CAIXA) ---
const transacoes = ref([]);
const loading = ref(false);
const novaDespesa = ref({
  descricao: "",
  valor: "",
  categoria: "Compra de Material",
});

const totalEntradas = computed(() =>
  transacoes.value
    .filter((t) => t.tipo === "Entrada")
    .reduce((acc, t) => acc + Number(t.valor_liquido || t.valor_bruto), 0),
);
const totalSaidas = computed(() =>
  transacoes.value
    .filter((t) => t.tipo === "Saida")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);
const saldo = computed(() => totalEntradas.value - totalSaidas.value);

async function carregarCaixa() {
  loading.value = true;
  const { data } = await supabase
    .from("transacoes")
    .select("*")
    .order("data_pagamento", { ascending: false })
    .limit(50);
  if (data) transacoes.value = data;
  loading.value = false;
}

async function registrarSaida() {
  if (!novaDespesa.value.descricao || !novaDespesa.value.valor)
    return alert("Preencha os dados");
  const { error } = await supabase.from("transacoes").insert([
    {
      tipo: "Saida",
      descricao: novaDespesa.value.descricao,
      valor_bruto: novaDespesa.value.valor,
      categoria: novaDespesa.value.categoria,
      data_pagamento: new Date(),
      forma_pagamento: "Dinheiro/Pix",
    },
  ]);
  if (!error) {
    novaDespesa.value = {
      descricao: "",
      valor: "",
      categoria: "Compra de Material",
    };
    carregarCaixa();
  } else {
    alert(error.message);
  }
}

// --- ESTADO: RELATÓRIOS ---
const dataAtual = new Date();
const primeiroDiaMes = new Date(
  dataAtual.getFullYear(),
  dataAtual.getMonth(),
  1,
)
  .toISOString()
  .split("T")[0];
const ultimoDiaMes = new Date(
  dataAtual.getFullYear(),
  dataAtual.getMonth() + 1,
  0,
)
  .toISOString()
  .split("T")[0];

const filtro = ref({
  inicio: primeiroDiaMes,
  fim: ultimoDiaMes,
  formato: "detalhado", // 'detalhado' ou 'resumido'
});

const relatorioDados = ref([]);
const loadingRelatorio = ref(false);

async function gerarRelatorio() {
  loadingRelatorio.value = true;

  // Ajusta as datas para cobrir o dia inteiro (de 00:00:00 até 23:59:59)
  const dataInicio = filtro.value.inicio + " 00:00:00";
  const dataFim = filtro.value.fim + " 23:59:59";

  const { data, error } = await supabase
    .from("transacoes")
    .select("*")
    .gte("data_pagamento", dataInicio)
    .lte("data_pagamento", dataFim)
    .order("data_pagamento", { ascending: false });

  if (data) relatorioDados.value = data;
  if (error) alert("Erro ao gerar relatório: " + error.message);

  loadingRelatorio.value = false;
}

// Cálculos do Relatório
const relTotalEntradas = computed(() =>
  relatorioDados.value
    .filter((t) => t.tipo === "Entrada")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);
const relTotalSaidas = computed(() =>
  relatorioDados.value
    .filter((t) => t.tipo === "Saida")
    .reduce((acc, t) => acc + Number(t.valor_bruto), 0),
);
const relSaldo = computed(() => relTotalEntradas.value - relTotalSaidas.value);

// Agrupamento para o modo "Resumido"
const relatorioResumido = computed(() => {
  const resumo = {};
  relatorioDados.value.forEach((t) => {
    const chave = t.tipo + "|" + t.categoria;
    if (!resumo[chave]) {
      resumo[chave] = { tipo: t.tipo, categoria: t.categoria, total: 0 };
    }
    resumo[chave].total += Number(t.valor_bruto);
  });

  return Object.values(resumo).sort((a, b) => {
    if (a.tipo === b.tipo) return a.categoria.localeCompare(b.categoria);
    return a.tipo === "Entrada" ? -1 : 1;
  });
});

function imprimirRelatorio() {
  window.print();
}

// === CORREÇÃO DO BUG DO FUSO HORÁRIO ===
function formatarData(dataString) {
  if (!dataString) return "";
  // Se a data vier apenas como "YYYY-MM-DD", adicionamos o horário T12:00:00 para evitar que o fuso horário subtraia horas e mude o dia
  const dataSegura = dataString.includes("T")
    ? dataString
    : dataString + "T12:00:00";
  return new Date(dataSegura).toLocaleDateString("pt-BR");
}

onMounted(() => {
  carregarCaixa();
  gerarRelatorio();
});
</script>

<template>
  <div class="card area-impressao">
    <div
      class="nao-imprimir"
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      "
    >
      <h2 class="title-section" style="margin: 0; border: none">
        💸 Gestão Financeira
      </h2>
      <button class="btn-outline" @click="$emit('fechar')">
        Fechar Painel
      </button>
    </div>

    <div
      class="nao-imprimir"
      style="display: flex; gap: 10px; margin-bottom: 20px"
    >
      <button
        class="btn-tab"
        :class="{ active: abaAtual === 'caixa' }"
        @click="abaAtual = 'caixa'"
      >
        📉 Fluxo de Caixa (Lançamentos)
      </button>
      <button
        class="btn-tab"
        :class="{ active: abaAtual === 'relatorio' }"
        @click="abaAtual = 'relatorio'"
      >
        📊 Relatório de Entradas e Saídas
      </button>
    </div>

    <div v-if="abaAtual === 'caixa'" class="nao-imprimir">
      <div class="cards-resumo">
        <div class="box text-center bg-verde">
          <span>Entradas (Recentes)</span><br /><strong
            >R$ {{ totalEntradas.toFixed(2) }}</strong
          >
        </div>
        <div class="box text-center bg-vermelho">
          <span>Saídas (Recentes)</span><br /><strong
            >R$ {{ totalSaidas.toFixed(2) }}</strong
          >
        </div>
        <div
          class="box text-center"
          :class="saldo >= 0 ? 'bg-azul' : 'bg-vermelho'"
        >
          <span>Saldo Apurado</span><br /><strong
            >R$ {{ saldo.toFixed(2) }}</strong
          >
        </div>
      </div>

      <div class="box" style="margin-bottom: 30px; background: var(--bg-body)">
        <h4 style="margin-top: 0">Registrar Saída / Despesa</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap">
          <input
            v-model="novaDespesa.descricao"
            placeholder="Ex: Compra de cordas, Conta de Luz..."
            style="flex: 2"
          />
          <select v-model="novaDespesa.categoria" style="flex: 1">
            <option>Compra de Material</option>
            <option>Ferramentas</option>
            <option>Custos Fixos</option>
            <option>Marketing</option>
            <option>Outros</option>
          </select>
          <input
            v-model="novaDespesa.valor"
            type="number"
            step="0.01"
            placeholder="Valor R$"
            style="width: 120px"
          />
          <button class="btn-accent" @click="registrarSaida">
            Lançar Saída
          </button>
        </div>
      </div>

      <h4 class="title-section">Últimos Movimentos (50 registros)</h4>
      <div class="tabela-responsiva">
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in transacoes" :key="t.id">
              <td>{{ formatarData(t.data_pagamento) }}</td>
              <td>{{ t.descricao }}</td>
              <td>
                <span class="text-muted"
                  ><small>{{ t.categoria }}</small></span
                >
              </td>
              <td
                :class="t.tipo === 'Entrada' ? 'text-success' : 'text-danger'"
              >
                <strong
                  >{{ t.tipo === "Entrada" ? "+" : "-" }} R$
                  {{ Number(t.valor_bruto).toFixed(2) }}</strong
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="abaAtual === 'relatorio'">
      <div
        class="box nao-imprimir"
        style="
          background: #fdfdfd;
          border: 1px dashed var(--border);
          margin-bottom: 20px;
        "
      >
        <div
          style="
            display: flex;
            gap: 15px;
            align-items: flex-end;
            flex-wrap: wrap;
          "
        >
          <div style="flex: 1; min-width: 130px">
            <label>Data Inicial:</label>
            <input type="date" v-model="filtro.inicio" />
          </div>
          <div style="flex: 1; min-width: 130px">
            <label>Data Final:</label>
            <input type="date" v-model="filtro.fim" />
          </div>
          <div style="flex: 1.5; min-width: 150px">
            <label>Formato do Relatório:</label>
            <select v-model="filtro.formato">
              <option value="detalhado">Detalhado (Linha a linha)</option>
              <option value="resumido">Resumido (Por Categoria)</option>
            </select>
          </div>
          <div>
            <button
              class="btn-primary"
              @click="gerarRelatorio"
              :disabled="loadingRelatorio"
              style="height: 42px; margin-right: 10px"
            >
              {{ loadingRelatorio ? "⏳ Gerando..." : "🔍 Filtrar" }}
            </button>
            <button
              class="btn-outline"
              @click="imprimirRelatorio"
              style="height: 42px"
              title="Imprimir ou Salvar PDF"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 20px">
        <h2 style="margin: 0; color: var(--primary)">Relatório Financeiro</h2>
        <p style="margin: 5px 0; color: var(--text-muted)">
          Período: {{ formatarData(filtro.inicio) }} a
          {{ formatarData(filtro.fim) }}
        </p>
      </div>

      <div class="cards-resumo" style="margin-bottom: 20px">
        <div class="box text-center bg-verde">
          <span>Total Entradas</span><br /><strong
            >R$ {{ relTotalEntradas.toFixed(2) }}</strong
          >
        </div>
        <div class="box text-center bg-vermelho">
          <span>Total Saídas</span><br /><strong
            >R$ {{ relTotalSaidas.toFixed(2) }}</strong
          >
        </div>
        <div
          class="box text-center"
          :class="relSaldo >= 0 ? 'bg-azul' : 'bg-vermelho'"
        >
          <span>Resultado do Período</span><br /><strong
            >R$ {{ relSaldo.toFixed(2) }}</strong
          >
        </div>
      </div>

      <div v-if="filtro.formato === 'resumido'" class="tabela-responsiva">
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th>Tipo de Movimento</th>
              <th>Categoria</th>
              <th style="text-align: right">Total Acumulado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="relatorioResumido.length === 0">
              <td colspan="3" class="text-center text-muted">
                Sem movimentos no período.
              </td>
            </tr>
            <tr v-for="(linha, index) in relatorioResumido" :key="index">
              <td>
                <span
                  class="badge"
                  :class="linha.tipo === 'Entrada' ? 'bg-success' : 'bg-danger'"
                  >{{ linha.tipo }}</span
                >
              </td>
              <td>
                <strong>{{ linha.categoria }}</strong>
              </td>
              <td
                align="right"
                :class="
                  linha.tipo === 'Entrada' ? 'text-success' : 'text-danger'
                "
                style="font-weight: bold"
              >
                R$ {{ linha.total.toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filtro.formato === 'detalhado'" class="tabela-responsiva">
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th style="text-align: right">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="relatorioDados.length === 0">
              <td colspan="4" class="text-center text-muted">
                Sem movimentos no período.
              </td>
            </tr>
            <tr v-for="t in relatorioDados" :key="t.id">
              <td>{{ formatarData(t.data_pagamento) }}</td>
              <td>{{ t.descricao }}</td>
              <td>
                <span class="text-muted"
                  ><small>{{ t.categoria }}</small></span
                >
              </td>
              <td
                align="right"
                :class="t.tipo === 'Entrada' ? 'text-success' : 'text-danger'"
              >
                <strong
                  >{{ t.tipo === "Entrada" ? "+" : "-" }} R$
                  {{ Number(t.valor_bruto).toFixed(2) }}</strong
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: var(--bg-body);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.btn-tab.active {
  background: var(--primary);
  color: white;
}

.cards-resumo {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.cards-resumo .box {
  flex: 1;
  color: white;
  min-width: 140px;
  padding: 15px;
}
.cards-resumo span {
  font-size: 0.85rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cards-resumo strong {
  font-size: 1.6rem;
  display: block;
  margin-top: 5px;
}
.text-center {
  text-align: center;
}

.bg-verde {
  background: var(--success) !important;
  border: none;
}
.bg-vermelho {
  background: var(--danger) !important;
  border: none;
}
.bg-azul {
  background: var(--primary) !important;
  border: none;
}

.badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: white;
  white-space: nowrap;
}
.badge.bg-success {
  background: var(--success);
}
.badge.bg-danger {
  background: var(--danger);
}

@media print {
  .nao-imprimir {
    display: none !important;
  }
  .area-impressao {
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
  }
  body {
    background: white;
  }
}
</style>
