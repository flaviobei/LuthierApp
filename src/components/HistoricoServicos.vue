<script setup>
import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";

/**
 * ============================================================================
 * @file        HistoricoServicos.vue
 * @description Módulo de arquivo e CRM. Gerencia o histórico de todas as O.S.
 * e fornece um relatório consolidado de clientes com o total investido,
 * permitindo a geração de PDFs profissionais com a marca da luthieria.
 * @project     LuthierApp
 * ============================================================================
 */

const emit = defineEmits(["voltar", "abrirOS"]);

const listaServicos = ref([]);
const carregando = ref(true);
const abaHistorico = ref("relatorio");
const filtroBusca = ref("");

const ordenarPor = ref("totalGasto");
const direcaoOrdem = ref("asc");

// --- ESTADO DA LUTHIERIA (PARA O RELATÓRIO) ---
const configLuthieria = ref({
  nome_luthieria: "Minha Luthieria",
  telefone: "",
  endereco: "",
  logo_url: "",
});

async function carregarTudo() {
  carregando.value = true;
  await Promise.all([carregarHistorico(), carregarConfig()]);
  carregando.value = false;
}

async function carregarConfig() {
  const { data } = await supabase
    .from("configuracoes")
    .select("*")
    .maybeSingle();
  if (data) configLuthieria.value = data;
}

async function carregarHistorico() {
  const { data } = await supabase
    .from("servicos")
    .select(
      `*, instrumentos (*, cliente:clientes (*)), transacoes (valor_bruto, tipo)`,
    )
    .order("data_entrada", { ascending: false });

  if (data) listaServicos.value = data;
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

// ==========================================
// GERAÇÃO DO PDF FORMATADO (DINÂMICO)
// ==========================================
function gerarRelatorioPDF() {
  const janela = window.open("", "", "width=1000,height=700");
  const config = configLuthieria.value;
  const isCRM = abaHistorico.value === "relatorio";

  const tituloDocumento = isCRM
    ? "Relatório Consolidado de Clientes (CRM)"
    : "Histórico Geral de Ordens de Serviço";

  let cabecalhoTabela = "";
  let corpoTabela = "";

  if (isCRM) {
    cabecalhoTabela = `<tr><th>Cliente</th><th>Contato</th><th style="text-align: center;">Serviços</th><th style="text-align: right;">Total Investido</th><th style="text-align: right;">Última Visita</th></tr>`;
    corpoTabela = relatorioClientes.value
      .map(
        (c) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${c.nome}</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${c.telefone}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${c.totalOS}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">R$ ${c.totalGasto.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${new Date(c.ultimaData + "T12:00:00").toLocaleDateString("pt-BR")}</td>
      </tr>
    `,
      )
      .join("");
  } else {
    cabecalhoTabela = `<tr><th>O.S.</th><th>Cliente</th><th>Instrumento</th><th>Data Entrada</th><th>Status Atual</th></tr>`;
    corpoTabela = listaServicos.value
      .map(
        (os) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>#${os.numero_os}</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${os.instrumentos?.cliente?.nome || "--"}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${os.instrumentos?.marca} ${os.instrumentos?.modelo}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(os.data_entrada + "T12:00:00").toLocaleDateString("pt-BR")}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${os.status}</td>
      </tr>
    `,
      )
      .join("");
  }

  const logoHTML = config.logo_url
    ? `<img src="${config.logo_url}" style="max-height: 70px; object-fit: contain;" />`
    : `<h2 style="margin:0; color: #2c3e50;">${config.nome_luthieria}</h2>`;

  janela.document.write(`
    <html>
      <head>
        <title>${tituloDocumento}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px; }
          .dados-oficina { text-align: right; font-size: 0.9em; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f0f4f8; padding: 12px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 0.75em; color: #475569; text-align: left; }
          .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>${logoHTML}</div>
          <div class="dados-oficina">
            <strong style="font-size: 1.1em; color: #2c3e50;">${config.nome_luthieria}</strong><br>
            ${config.telefone ? "Tel/WhatsApp: " + config.telefone + "<br>" : ""}
            ${config.endereco ? config.endereco : ""}
          </div>
        </div>
        <h3 style="margin-top: 0; color: #2c3e50;">${tituloDocumento}</h3>
        <p style="font-size: 0.9em; color: #666;">Documento gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
        <table>
          <thead>${cabecalhoTabela}</thead>
          <tbody>${corpoTabela}</tbody>
        </table>
        <div class="footer"><p>Relatório gerado automaticamente pelo LuthierApp.</p></div>
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

onMounted(carregarTudo);
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
        Arquivo /
        <span style="font-weight: 700">{{
          abaHistorico === "relatorio" ? "CRM" : "Histórico"
        }}</span>
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
              <td>
                {{
                  new Date(os.data_entrada + "T12:00:00").toLocaleDateString()
                }}
              </td>
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
/* O CSS permanece idêntico ao original para manter a consistência visual da tela */
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
