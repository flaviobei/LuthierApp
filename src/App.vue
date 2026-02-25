<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "./lib/supabaseClient";
import Auth from "./components/Auth.vue";
import ClienteForm from "./components/ClienteForm.vue";
import InstrumentoManager from "./components/InstrumentoManager.vue";
import ServicoManager from "./components/ServicoManager.vue";
import DashboardAtividades from "./components/DashboardAtividades.vue";
import ExecucaoServico from "./components/ExecucaoServico.vue";
import AdminArea from "./components/AdminArea.vue";
import HistoricoServicos from "./components/HistoricoServicos.vue";
import Paywall from "./components/Paywall.vue"; // NOVO IMPORT
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const session = ref(null);

// --- ESTADO DA ASSINATURA (SAAS) ---
const assinatura = ref(null);
const diasTrialRestantes = ref(0);
const aVerificarAcesso = ref(true);

onMounted(() => {
  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session;
    if (session.value) inicializarApp();
    else aVerificarAcesso.value = false;
  });

  supabase.auth.onAuthStateChange((_event, _session) => {
    session.value = _session;
    if (_session) inicializarApp();
    else aVerificarAcesso.value = false;
  });
});

async function inicializarApp() {
  aVerificarAcesso.value = true;
  await carregarAssinatura(); // Verifica se pode entrar primeiro!

  if (
    assinatura.value?.status === "ativo" ||
    (assinatura.value?.status === "trial" && diasTrialRestantes.value > 0)
  ) {
    buscarClientes();
    carregarConfiguracoes();
  }
  aVerificarAcesso.value = false;
}

// Lógica de verificação do plano do Luthier
async function carregarAssinatura() {
  const { data } = await supabase.from("assinaturas").select("*").maybeSingle();
  if (data) {
    assinatura.value = data;

    // Se estiver em modo teste, calcula os dias que faltam
    if (data.status === "trial") {
      const hoje = new Date();
      const fim = new Date(data.data_fim_trial);
      const diffTime = fim - hoje;
      diasTrialRestantes.value = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Se passou da data, força o status para expirado no frontend para bloquear o ecrã
      if (diasTrialRestantes.value <= 0) {
        assinatura.value.status = "expirado";
      }
    }
  }
}

async function fazerLogout() {
  await supabase.auth.signOut();
  clientes.value = [];
  configLuthieria.value = { nome_luthieria: "Gestão Luthieria", logo_url: "" };
  assinatura.value = null;
  document.documentElement.style.setProperty("--primary", "#2c3e50");
  document.documentElement.style.setProperty("--accent", "#d35400");
  document.documentElement.style.setProperty("--bg-body", "#f4f6f8");
  document.body.style.fontFamily = "'Inter', sans-serif";
}

// -------------------------------------
// ESTADO DA BANCADA E NAVEGAÇÃO
// -------------------------------------
const clientes = ref([]);
const clienteSelecionado = ref(null);
const instrumentoSelecionado = ref(null);
const mostrarClientes = ref(false);
const modoAtual = ref("bancada");
const clienteEditandoId = ref(null);
const clienteEditado = ref({});
const servicoDireto = ref(null);

const configLuthieria = ref({
  nome_luthieria: "Gestão Luthieria",
  logo_url: "",
});

async function carregarConfiguracoes() {
  const { data } = await supabase
    .from("configuracoes")
    .select("*")
    .maybeSingle();
  if (data) {
    configLuthieria.value.nome_luthieria =
      data.nome_luthieria || "Gestão Luthieria";
    configLuthieria.value.logo_url = data.logo_url || "";

    if (data.cor_primaria)
      document.documentElement.style.setProperty(
        "--primary",
        data.cor_primaria,
      );
    if (data.cor_secundaria)
      document.documentElement.style.setProperty(
        "--accent",
        data.cor_secundaria,
      );
    if (data.cor_fundo)
      document.documentElement.style.setProperty("--bg-body", data.cor_fundo);
    if (data.fonte_principal)
      document.body.style.fontFamily = data.fonte_principal;
  }
}

function fecharTelasSecundarias() {
  modoAtual.value = "bancada";
  carregarConfiguracoes();
}
async function buscarClientes() {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });
  clientes.value = data || [];
}
function selecionarCliente(c) {
  clienteSelecionado.value = c;
}
function selecionarInstrumento(i) {
  instrumentoSelecionado.value = i;
}
function abrirServicoPeloDashboard(osCompleta) {
  servicoDireto.value = osCompleta;
}
function fecharServicoDireto() {
  servicoDireto.value = null;
  buscarClientes();
}
function iniciarEdicaoCliente(cliente) {
  clienteEditandoId.value = cliente.id;
  clienteEditado.value = { ...cliente };
}
function cancelarEdicaoCliente() {
  clienteEditandoId.value = null;
  clienteEditado.value = {};
}
async function salvarEdicaoCliente() {
  if (!clienteEditado.value.nome)
    return alert("O nome não pode ficar em branco.");
  const { error } = await supabase
    .from("clientes")
    .update({
      nome: clienteEditado.value.nome,
      telefone: clienteEditado.value.telefone,
      email: clienteEditado.value.email,
      cpf_cnpj: clienteEditado.value.cpf_cnpj,
    })
    .eq("id", clienteEditandoId.value);
  if (!error) {
    buscarClientes();
    cancelarEdicaoCliente();
  } else alert("Erro: " + error.message);
}
function formatarLinkZap(telefone) {
  if (!telefone) return "";
  const apenasNumeros = telefone.replace(/\D/g, "");
  return apenasNumeros.length <= 11 ? `55${apenasNumeros}` : apenasNumeros;
}
</script>

<template>
  <div class="app-container">
    <div
      v-if="aVerificarAcesso"
      style="
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
      "
    >
      <h2>A preparar a sua oficina...</h2>
    </div>

    <Auth v-else-if="!session" />

    <Paywall
      v-else-if="
        assinatura?.status === 'expirado' ||
        assinatura?.status === 'inadimplente'
      "
      @sair="fazerLogout"
    />

    <div v-else>
      <div v-if="assinatura?.status === 'trial'" class="banner-trial">
        ⚠️ <strong>Modo de Teste:</strong> Faltam {{ diasTrialRestantes }} dias
        para o fim do seu teste grátis.
        <button class="btn-trial" @click="assinatura.status = 'expirado'">
          Ver Planos
        </button>
      </div>

      <div class="main-header card" v-if="modoAtual === 'bancada'">
        <div style="display: flex; align-items: center; gap: 15px">
          <img
            v-if="configLuthieria.logo_url"
            :src="configLuthieria.logo_url"
            alt="Logo"
            style="max-height: 55px; border-radius: 4px; object-fit: contain"
          />
          <span v-else style="font-size: 2.5rem">🎸</span>
          <h1 class="logo-title" style="margin: 0; font-size: 1.6rem">
            {{ configLuthieria.nome_luthieria }}
          </h1>
        </div>

        <div class="header-buttons">
          <button
            @click="modoAtual = 'historico'"
            class="btn-outline"
            style="border-color: var(--primary)"
          >
            📦 Arquivo / Histórico
          </button>
          <button
            @click="modoAtual = 'admin'"
            class="btn-primary"
            style="background: var(--primary)"
          >
            ⚙️ Administração
          </button>
          <button
            @click="fazerLogout"
            class="btn-outline text-danger"
            style="border-color: var(--danger)"
          >
            🚪 Sair
          </button>
        </div>
      </div>

      <div v-if="modoAtual === 'admin'">
        <AdminArea @voltar="fecharTelasSecundarias" />
      </div>
      <div v-else-if="modoAtual === 'historico'">
        <div v-if="servicoDireto">
          <ExecucaoServico
            :servico="servicoDireto"
            @voltar="fecharServicoDireto"
          />
        </div>
        <div v-else>
          <HistoricoServicos
            @voltar="fecharTelasSecundarias"
            @abrirOS="abrirServicoPeloDashboard"
          />
        </div>
      </div>

      <div v-else>
        <div v-if="servicoDireto">
          <ExecucaoServico
            :servico="servicoDireto"
            @voltar="fecharServicoDireto"
          />
        </div>
        <div v-else>
          <div v-if="instrumentoSelecionado">
            <ServicoManager
              :instrumento="instrumentoSelecionado"
              @voltar="instrumentoSelecionado = null"
            />
          </div>
          <div v-else-if="clienteSelecionado">
            <button
              @click="clienteSelecionado = null"
              class="btn-outline"
              style="margin-bottom: 15px"
            >
              &larr; Voltar ao Início
            </button>
            <InstrumentoManager
              :clienteId="clienteSelecionado.id"
              :clienteNome="clienteSelecionado.nome"
              @fechar="clienteSelecionado = null"
              @selecionarInstrumento="selecionarInstrumento"
            />
          </div>

          <div v-else>
            <DashboardAtividades @abrirOS="abrirServicoPeloDashboard" />
            <div class="controle-clientes">
              <button
                class="btn-toggle-clientes"
                @click="mostrarClientes = !mostrarClientes"
              >
                {{
                  mostrarClientes
                    ? "⬆️ Ocultar Área de Clientes"
                    : "👥 Gerenciar Base de Clientes"
                }}
              </button>
            </div>
            <div v-show="mostrarClientes" class="clientes-grid">
              <div class="col-form">
                <ClienteForm @clienteSalvo="buscarClientes" />
              </div>
              <div class="col-lista card">
                <h3 class="title-section">📂 Lista de Clientes</h3>
                <div class="tabela-responsiva">
                  <table class="tabela-padrao">
                    <thead>
                      <tr>
                        <th>Nome do Cliente</th>
                        <th>Contato</th>
                        <th style="text-align: center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="clientes.length === 0">
                        <td colspan="3" align="center" class="text-muted">
                          Nenhum cliente cadastrado.
                        </td>
                      </tr>
                      <tr v-for="cliente in clientes" :key="cliente.id">
                        <template v-if="clienteEditandoId === cliente.id">
                          <td>
                            <input
                              v-model="clienteEditado.nome"
                              placeholder="Nome"
                              class="mb-1"
                            /><input
                              v-model="clienteEditado.cpf_cnpj"
                              placeholder="CPF/CNPJ"
                            />
                          </td>
                          <td>
                            <input
                              v-model="clienteEditado.telefone"
                              placeholder="WhatsApp"
                              class="mb-1"
                            /><input
                              v-model="clienteEditado.email"
                              placeholder="E-mail"
                            />
                          </td>
                          <td align="center">
                            <button
                              @click="salvarEdicaoCliente"
                              class="btn-icon text-success"
                            >
                              💾</button
                            ><button
                              @click="cancelarEdicaoCliente"
                              class="btn-icon text-danger"
                            >
                              ❌
                            </button>
                          </td>
                        </template>
                        <template v-else>
                          <td>
                            <strong>{{ cliente.nome }}</strong>
                            <div v-if="cliente.cpf_cnpj" class="text-muted">
                              <small>Doc: {{ cliente.cpf_cnpj }}</small>
                            </div>
                          </td>
                          <td>
                            <a
                              v-if="cliente.telefone"
                              :href="
                                'https://wa.me/' +
                                formatarLinkZap(cliente.telefone)
                              "
                              target="_blank"
                              class="badge-zap"
                              >📱 {{ cliente.telefone }}</a
                            >
                            <span v-else class="text-muted"
                              ><small>S/ Telefone</small></span
                            >
                            <div
                              v-if="cliente.email"
                              class="text-muted"
                              style="margin-top: 4px"
                            >
                              <small>✉️ {{ cliente.email }}</small>
                            </div>
                          </td>
                          <td align="center" style="white-space: nowrap">
                            <button
                              class="btn-icon bg-light"
                              @click="selecionarCliente(cliente)"
                              title="Ver Instrumentos"
                            >
                              🎸</button
                            ><button
                              class="btn-icon bg-light"
                              @click="iniciarEdicaoCliente(cliente)"
                              title="Editar Cliente"
                            >
                              ✏️
                            </button>
                          </td>
                        </template>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* CSS GLOBAL MANTIDO DO ANTERIOR */
:root {
  --primary: #2c3e50;
  --accent: #d35400;
  --accent-hover: #e67e22;
  --bg-body: #f4f6f8;
  --bg-card: #ffffff;
  --text-main: #333333;
  --text-muted: #6c757d;
  --border: #e1e4e8;
  --radius: 8px;
  --radius-sm: 4px;
  --shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  --success: #27ae60;
  --danger: #c0392b;
  --warning: #f39c12;
}
body {
  margin: 0;
  background-color: var(--bg-body);
  color: var(--text-main);
  font-family: "Inter", "Segoe UI", sans-serif;
}
.app-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* BANNER DE AVISO DE TESTE */
.banner-trial {
  background: #fff3cd;
  color: #856404;
  text-align: center;
  padding: 10px;
  border-radius: var(--radius);
  margin-bottom: 20px;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  border: 1px solid #ffeeba;
}
.btn-trial {
  background: #856404;
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
.btn-trial:hover {
  background: #664d03;
}

.card,
.box,
.servico-box,
.execucao-container,
.catalogo-container {
  background: var(--bg-card);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  padding: 20px;
  box-sizing: border-box;
}
.title-section {
  margin-top: 0;
  color: var(--primary);
  border-bottom: 2px solid var(--border);
  padding-bottom: 10px;
}
input,
select,
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--text-main);
  background-color: #fff;
  transition: all 0.2s ease-in-out;
  box-sizing: border-box;
}
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(211, 84, 0, 0.15);
}
label {
  display: block;
  font-size: 0.85rem;
  font-weight: bold;
  color: var(--text-muted);
  margin-bottom: 5px;
}
.form-group {
  margin-bottom: 15px;
}
button {
  font-family: inherit;
  border-radius: var(--radius-sm);
  transition: 0.2s;
  box-sizing: border-box;
}
.btn-primary {
  background: var(--primary);
  color: #fff;
  border: none;
  padding: 10px 16px;
  font-weight: bold;
  cursor: pointer;
}
.btn-primary:hover {
  background: #1a252f;
  opacity: 0.9;
}
.btn-accent {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 10px 16px;
  font-weight: bold;
  cursor: pointer;
}
.btn-accent:hover {
  filter: brightness(1.1);
}
.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
}
.btn-outline:hover {
  background: var(--primary);
  color: #fff;
}
.btn-icon {
  background: transparent;
  border: none;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.1rem;
}
.btn-icon:hover {
  background: #eee;
}
.tabela-responsiva {
  overflow-x: auto;
}
.tabela-padrao {
  width: 100%;
  border-collapse: collapse;
  min-width: 500px;
}
.tabela-padrao th {
  background: var(--bg-body);
  color: var(--text-muted);
  padding: 12px 10px;
  text-align: left;
  font-size: 0.85rem;
  text-transform: uppercase;
  border-bottom: 2px solid var(--border);
}
.tabela-padrao td {
  padding: 12px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.text-muted {
  color: var(--text-muted);
}
.text-success {
  color: var(--success);
}
.text-danger {
  color: var(--danger);
}
.mb-1 {
  margin-bottom: 5px;
}
.bg-light {
  background: #f8f9fa;
}
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  flex-wrap: wrap;
  gap: 15px;
  border-bottom: 4px solid var(--accent);
  padding: 20px;
}
.header-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.logo-title {
  margin: 0;
  font-size: 1.5rem;
  color: var(--primary);
}
.controle-clientes {
  text-align: center;
  margin: 40px 0 20px 0;
  border-top: 2px dashed var(--border);
  padding-top: 20px;
}
.btn-toggle-clientes {
  background: transparent;
  color: var(--text-muted);
  border: 2px solid var(--border);
  padding: 10px 20px;
  font-weight: bold;
  border-radius: 20px;
  cursor: pointer;
}
.btn-toggle-clientes:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.clientes-grid {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.col-form {
  flex: 1;
  min-width: 280px;
  max-width: 350px;
}
.col-lista {
  flex: 2;
  min-width: 300px;
}
.badge-zap {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 0.85rem;
}
.badge-zap:hover {
  background: #c8e6c9;
}
@media (max-width: 768px) {
  .clientes-grid {
    flex-direction: column;
  }
  .col-form {
    max-width: 100%;
  }
  .main-header {
    flex-direction: column;
    text-align: center;
  }
  .header-buttons {
    width: 100%;
    flex-direction: column;
    justify-content: center;
  }
  .header-buttons button {
    width: 100%;
  }
}
</style>
