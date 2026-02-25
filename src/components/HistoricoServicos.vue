<script setup>
import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";

const emit = defineEmits(["voltar", "abrirOS"]);

const listaServicos = ref([]);
const carregando = ref(true);
const abaHistorico = ref("relatorio");
const filtroBusca = ref("");

const ordenarPor = ref("totalGasto");
const direcaoOrdem = ref("desc");

async function carregarHistorico() {
  carregando.value = true;
  const { data } = await supabase
    .from("servicos")
    .select(
      `*, instrumentos (*, cliente:clientes (*)), transacoes (valor_bruto, tipo)`,
    )
    .order("data_entrada", { ascending: false });

  if (data) listaServicos.value = data;
  carregando.value = false;
}

const relatorioClientes = computed(() => {
  const mapa = {};
  listaServicos.value.forEach((os) => {
    const cliente = os.instrumentos?.cliente;
    if (!cliente) return;
    if (!mapa[cliente.id]) {
      mapa[cliente.id] = {
        nome: cliente.nome,
        telefone: cliente.telefone || "---",
        totalGasto: 0,
        ultimaData: os.data_entrada,
        ultimoStatus: os.status,
        totalOS: 0,
      };
    }
    const pagamentos =
      os.transacoes
        ?.filter((t) => t.tipo === "Entrada")
        .reduce((acc, t) => acc + Number(t.valor_bruto), 0) || 0;

    mapa[cliente.id].totalGasto += pagamentos;
    mapa[cliente.id].totalOS += 1;
    if (os.data_entrada >= mapa[cliente.id].ultimaData) {
      mapa[cliente.id].ultimaData = os.data_entrada;
      mapa[cliente.id].ultimoStatus = os.status;
    }
  });

  return Object.values(mapa)
    .filter((c) =>
      c.nome.toLowerCase().includes(filtroBusca.value.toLowerCase()),
    )
    .sort((a, b) => {
      let valA = a[ordenarPor.value];
      let valB = b[ordenarPor.value];
      return direcaoOrdem.value === "asc"
        ? valA > valB
          ? 1
          : -1
        : valA < valB
          ? 1
          : -1;
    });
});

function inverterOrdem(campo) {
  if (ordenarPor.value === campo)
    direcaoOrdem.value = direcaoOrdem.value === "asc" ? "desc" : "asc";
  else {
    ordenarPor.value = campo;
    direcaoOrdem.value = "desc";
  }
}

function gerarRelatorioPDF() {
  const janela = window.open("", "", "width=1000,height=700");
  const conteudoTabela = relatorioClientes.value
    .map(
      (c) => `
    <tr>
      <td style="text-align: left;">${c.nome}</td>
      <td style="text-align: left;">${c.telefone}</td>
      <td style="text-align: left;">R$ ${c.totalGasto.toFixed(2)}</td>
      <td style="text-align: left;">${new Date(c.ultimaData + "T12:00:00").toLocaleDateString("pt-BR")}</td>
      <td style="text-align: left;">${c.ultimoStatus}</td>
    </tr>
  `,
    )
    .join("");

  janela.document.write(`
    <html>
      <head>
        <title>Relatório CRM - Luthieria</title>
        <style>
          body { font-family: sans-serif; padding: 20px; text-align: left; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f4f4f4; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-size: 12px; }
          td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; text-align: left; }
          h2 { color: #2c3e50; margin: 0 0 10px 0; text-align: left; }
        </style>
      </head>
      <body>
        <h2>Relatório de Clientes</h2>
        <p>Extraído em: ${new Date().toLocaleDateString("pt-BR")}</p>
        <table>
          <thead>
            <tr><th>Cliente</th><th>Contato</th><th>Total Investido</th><th>Última Visita</th><th>Status</th></tr>
          </thead>
          <tbody>${conteudoTabela}</tbody>
        </table>
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
    </html>
  `);
  janela.document.close();
}

function formatarLinkZap(tel) {
  const num = tel.replace(/\D/g, "");
  return num.length <= 11 ? `55${num}` : num;
}

onMounted(carregarHistorico);
</script>

<template>
  <div class="historico-wrapper">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      "
    >
      <h2 style="margin: 0; font-weight: 300; text-align: left">
        Arquivo / <span style="font-weight: 700">CRM</span>
      </h2>
      <div style="display: flex; gap: 10px">
        <button class="btn-clean-outline" @click="gerarRelatorioPDF">
          🖨️ Gerar PDF
        </button>
        <button class="btn-clean-dark" @click="$emit('voltar')">Voltar</button>
      </div>
    </div>

    <div class="tabs-minimal">
      <button
        :class="{ active: abaHistorico === 'relatorio' }"
        @click="abaHistorico = 'relatorio'"
      >
        Relatório de Clientes
      </button>
      <button
        :class="{ active: abaHistorico === 'lista' }"
        @click="abaHistorico = 'lista'"
      >
        Histórico de O.S.
      </button>
    </div>

    <div class="card mb-2" style="padding: 15px">
      <input
        v-model="filtroBusca"
        placeholder="Pesquisar por nome ou instrumento..."
        class="input-minimal"
      />
    </div>

    <div v-if="abaHistorico === 'relatorio'" class="card p-0 overflow-hidden">
      <div class="tabela-responsiva">
        <table class="tabela-clean">
          <thead>
            <tr>
              <th @click="inverterOrdem('nome')">Cliente ↕️</th>
              <th>WhatsApp</th>
              <th @click="inverterOrdem('totalGasto')">Total Investido ↕️</th>
              <th @click="inverterOrdem('ultimaData')">Última Visita ↕️</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in relatorioClientes" :key="c.id">
              <td>
                <div class="nome-cliente">{{ c.nome }}</div>
                <small class="sub-info"
                  >{{ c.totalOS }} serviços realizados</small
                >
              </td>
              <td>
                <a
                  v-if="c.telefone !== '---'"
                  :href="'https://wa.me/' + formatarLinkZap(c.telefone)"
                  target="_blank"
                  class="link-zap"
                  >Abrir Chat</a
                >
                <span v-else class="text-muted">--</span>
              </td>
              <td class="valor-foco">R$ {{ c.totalGasto.toFixed(2) }}</td>
              <td>
                {{ new Date(c.ultimaData + "T12:00:00").toLocaleDateString() }}
              </td>
              <td>
                <span class="status-pill-info" :class="c.ultimoStatus">{{
                  c.ultimoStatus
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="card p-0">
      <div class="tabela-responsiva">
        <table class="tabela-clean">
          <thead>
            <tr>
              <th>O.S.</th>
              <th>Cliente</th>
              <th>Instrumento</th>
              <th>Data</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="os in listaServicos" :key="os.id">
              <td>
                <strong>#{{ os.numero_os }}</strong>
              </td>
              <td>{{ os.instrumentos?.cliente?.nome }}</td>
              <td>{{ os.instrumentos?.modelo }}</td>
              <td>{{ new Date(os.data_entrada).toLocaleDateString() }}</td>
              <td>
                <span class="status-pill-info" :class="os.status">{{
                  os.status
                }}</span>
              </td>
              <td>
                <button class="btn-icon" @click="$emit('abrirOS', os)">
                  📂
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ALINHAMENTO GLOBAL À ESQUERDA */
.historico-wrapper {
  text-align: left;
}

.tabs-minimal {
  display: flex;
  border-bottom: 2px solid #eee;
  margin-bottom: 15px;
  justify-content: flex-start;
}
.tabs-minimal button {
  background: none;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  color: #999;
  font-weight: bold;
  position: relative;
}
.tabs-minimal button.active {
  color: var(--primary);
}
.tabs-minimal button.active::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--accent);
}

.input-minimal {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
}

.tabela-clean {
  width: 100%;
  border-collapse: collapse;
}
.tabela-clean th {
  padding: 12px;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #777;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  text-align: left;
}
.tabela-clean td {
  padding: 12px;
  border-bottom: 1px solid #f9f9f9;
  font-size: 0.9rem;
  text-align: left;
}

.nome-cliente {
  font-weight: 600;
  color: var(--primary);
  text-align: left;
}
.sub-info {
  color: #aaa;
  font-size: 0.75rem;
  text-align: left;
}
.valor-foco {
  font-weight: 700;
  color: #2c3e50;
}

.link-zap {
  color: #25d366;
  text-decoration: none;
  font-weight: bold;
  font-size: 0.8rem;
  border: 1px solid #25d366;
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-block;
}
.link-zap:hover {
  background: #25d366;
  color: white;
}

.status-pill-info {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  background: #f0f0f0;
  color: #666;
  display: inline-block;
}
.status-pill-info.Entregue {
  background: #e8f5e9;
  color: #2e7d32;
}
.status-pill-info.Cancelado {
  background: #fff5f5;
  color: #c53030;
}
.status-pill-info.Bancada {
  background: #fff3cd;
  color: #856404;
}

.btn-clean-outline {
  background: white;
  border: 1px solid #ddd;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-clean-dark {
  background: var(--primary);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
