<script setup>
/**
 * ============================================================================
 * @file        App.vue
 * @description Componente raiz e orquestrador principal do LuthierApp.
 * Gerencia autenticação, estado global (clientes, assinaturas),
 * aplicação de temas (UI) e a navegação principal baseada em
 * estado (bancada, admin, histórico, etc).
 * @author      Flávio Bei
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - vue: Controle de reatividade e ciclo de vida (ref, onMounted).
 * - supabaseClient: Gerenciamento de banco de dados e autenticação.
 * - @vercel/... : Métricas e analytics de performance.
 * - Componentes Internos: Auth, ClienteForm, InstrumentoManager, ServicoManager, etc.
 * * @functions
 * - processarLeituraQR(): Lê o link do QR Code e carrega a OS correspondente.
 * - carregarAssinatura(): Verifica o status do SaaS (ativo, trial, expirado).
 * - inicializarApp(): Bootstrapper principal acionado após verificação de login.
 * - fazerLogout(): Limpa todos os estados locais e encerra a sessão no Supabase.
 * - carregarConfiguracoes(): Aplica cores e logotipo personalizados no CSS global.
 * - buscarClientes(): Carrega a lista de clientes vinculada ao usuário logado.
 * * @notes
 * - O app não utiliza Vue Router tradicional para as telas internas,
 * dependendo da variável reativa `modoAtual` para alternar os painéis.
 * - O controle de acesso e Paywall bloqueia o uso caso o SaaS expire.
 * ============================================================================
 */

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
import Paywall from "./components/Paywall.vue";
import { SpeedInsights } from "@vercel/speed-insights/vue";
import { Analytics } from "@vercel/analytics/vue";
import ScannerQR from "./components/ScannerQR.vue";
import CalendarioEntregas from "./components/CalendarioEntregas.vue";

// --- ESTADOS GERAIS ---
const session = ref(null);
const aVerificarAcesso = ref(true);
const clientes = ref([]);
const clienteSelecionado = ref(null);
const instrumentoSelecionado = ref(null);
const mostrarClientes = ref(false);
const modoAtual = ref("bancada");
const clienteEditandoId = ref(null);
const clienteEditado = ref({});
const servicoDireto = ref(null); // Controla a abertura direta da O.S. (ex: via QR Code)
const mostrarScanner = ref(false);

const configLuthieria = ref({
  nome_luthieria: "Gestão Luthieria",
  logo_url: "",
});

// --- ESTADO DA ASSINATURA (SAAS) ---
const assinatura = ref(null);
const diasTrialRestantes = ref(0);

// --- FUNÇÕES DE LÓGICA ---

/**
 * Processa a URL lida pelo Scanner QR Code.
 * @param {string} textoLido - A URL completa obtida da câmera.
 */
async function processarLeituraQR(textoLido) {
  mostrarScanner.value = false;

  try {
    // Extrai o parâmetro "os" da URL gerada na etiqueta
    const url = new URL(textoLido);
    const osId = url.searchParams.get("os");

    if (osId) {
      aVerificarAcesso.value = true;
      const { data, error } = await supabase
        .from("servicos")
        .select(`*, instrumentos (*, cliente:clientes (*))`)
        .eq("id", osId)
        .single();

      if (data && !error) {
        servicoDireto.value = data;
      } else {
        alert("O.S. não encontrada ou acesso negado.");
      }
      aVerificarAcesso.value = false;
    }
  } catch (e) {
    alert(
      "QR Code inválido. Certifique-se de escanear uma etiqueta gerada pelo sistema.",
    );
  }
}

/**
 * Verifica o plano atual do usuário no banco de dados.
 * Calcula dias restantes caso esteja em período de Trial.
 */
async function carregarAssinatura() {
  const { data } = await supabase.from("assinaturas").select("*").maybeSingle();
  if (data) {
    assinatura.value = data;
    if (data.status === "trial") {
      const hoje = new Date();
      const fim = new Date(data.data_fim_trial);
      const diffTime = fim - hoje;
      diasTrialRestantes.value = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diasTrialRestantes.value <= 0) {
        assinatura.value.status = "expirado";
      }
    }
  }
}

/**
 * Bootstrapper disparado após confirmação de login.
 * Só carrega os dados (clientes e config) se a assinatura for válida.
 */
async function inicializarApp() {
  aVerificarAcesso.value = true;
  await carregarAssinatura();
  if (
    assinatura.value?.status === "ativo" ||
    (assinatura.value?.status === "trial" && diasTrialRestantes.value > 0)
  ) {
    buscarClientes();
    carregarConfiguracoes();
  }
  aVerificarAcesso.value = false;
}

/**
 * Encerra a sessão atual e limpa variáveis de estado para evitar vazamento
 * visual caso um novo usuário faça login no mesmo dispositivo.
 */
async function fazerLogout() {
  await supabase.auth.signOut();
  clientes.value = [];
  configLuthieria.value = { nome_luthieria: "Gestão Luthieria", logo_url: "" };
  assinatura.value = null;
  session.value = null;

  // Reset de estilos CSS globais para o padrão
  document.documentElement.style.setProperty("--primary", "#2c3e50");
  document.documentElement.style.setProperty("--accent", "#d35400");
}

/**
 * Busca e aplica as customizações visuais (Whitelabel) do Luthier logado.
 */
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

/**
 * Busca a lista inicial de clientes vinculados à conta.
 */
async function buscarClientes() {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });
  clientes.value = data || [];
}

// --- CICLO DE VIDA (onMounted) ---
onMounted(async () => {
  // 1. Verifica se existe requisição externa (QR Code ou Link) antes do Login
  const urlParams = new URLSearchParams(window.location.search);
  const osIdDoQrCode = urlParams.get("os");

  if (osIdDoQrCode) {
    const { data, error } = await supabase
      .from("servicos")
      .select(`*, instrumentos (*, cliente:clientes (*))`)
      .eq("id", osIdDoQrCode)
      .single();

    if (data && !error) {
      servicoDireto.value = data;
      // Limpa a URL para evitar reabertura acidental no reload
      window.history.replaceState({}, document.title, "/");
    }
  }

  // 2. Controle de Sessão no Supabase
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

// --- FUNÇÕES AUXILIARES PARA O TEMPLATE ---

function fecharTelasSecundarias() {
  modoAtual.value = "bancada";
  carregarConfiguracoes();
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

/**
 * Salva a alteração inline (na tabela) dos dados cadastrais do cliente.
 */
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

/**
 * Normaliza o telefone do cliente para o formato exigido pela API do WhatsApp (wa.me)
 * @param {string} telefone
 */
function formatarLinkZap(telefone) {
  if (!telefone) return "";
  const apenasNumeros = telefone.replace(/\D/g, "");
  // Adiciona o DDI do Brasil caso o usuário tenha esquecido de inserir
  return apenasNumeros.length <= 11 ? `55${apenasNumeros}` : apenasNumeros;
}
</script>

<template>
  <div class="app-container">
    <SpeedInsights />
    <Analytics />

    <div v-if="aVerificarAcesso" class="loader-container">
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
        ⚠️ <strong>Modo de Teste:</strong> Faltam {{ diasTrialRestantes }} dias.
        <button class="btn-trial" @click="assinatura.status = 'expirado'">
          Ver Planos
        </button>
      </div>

      <div class="main-header card" v-if="modoAtual === 'bancada'">
        <div style="display: flex; align-items: center; gap: 15px">
          <img
            v-if="configLuthieria.logo_url"
            :src="configLuthieria.logo_url"
            style="max-height: 55px; border-radius: 4px; object-fit: contain"
          />
          <span v-else style="font-size: 2.5rem">🎸</span>
          <h1 class="logo-title">{{ configLuthieria.nome_luthieria }}</h1>
        </div>

        <button
          @click="mostrarScanner = true"
          class="btn-primary"
          style="background: var(--accent); border: none"
        >
          📷 Escanear
        </button>

        <ScannerQR
          v-if="mostrarScanner"
          @detectado="processarLeituraQR"
          @fechar="mostrarScanner = false"
        />

        <div class="header-buttons">
          <button @click="modoAtual = 'historico'" class="btn-outline">
            📦 Arquivo / Histórico
          </button>
          <button @click="modoAtual = 'admin'" class="btn-primary">
            ⚙️ Administração
          </button>
          <button @click="fazerLogout" class="btn-outline text-danger">
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
              &larr; Voltar
            </button>
            <InstrumentoManager
              :clienteId="clienteSelecionado.id"
              :clienteNome="clienteSelecionado.nome"
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
                    ? "⬆️ Ocultar Clientes"
                    : "👥 Gerenciar Clientes"
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
                        <th>Nome</th>
                        <th>Contato</th>
                        <th style="text-align: center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="cliente in clientes" :key="cliente.id">
                        <template v-if="clienteEditandoId === cliente.id">
                          <td>
                            <input
                              v-model="clienteEditado.nome"
                              class="mb-1"
                            /><input
                              v-model="clienteEditado.cpf_cnpj"
                              placeholder="CPF/CNPJ"
                            />
                          </td>
                          <td>
                            <input
                              v-model="clienteEditado.telefone"
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
                              💾
                            </button>
                            <button
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
                              >📱 WhatsApp</a
                            >
                          </td>
                          <td align="center">
                            <button
                              class="btn-icon"
                              @click="selecionarCliente(cliente)"
                            >
                              🎸
                            </button>
                            <button
                              class="btn-icon"
                              @click="iniciarEdicaoCliente(cliente)"
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
