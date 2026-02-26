<script setup>
/**
 * ============================================================================
 * @file        App.vue
 * @description Componente raiz e orquestrador principal do LuthierApp.
 * Gerencia autenticação, estado global (clientes, assinaturas),
 * aplicação de temas (UI) e a navegação principal baseada em
 * estado (bancada, admin, histórico, etc).
 * @project     LuthierApp
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
import ToastNotification from "./components/ToastNotification.vue";
import { useToast } from "./composables/useToast";

const { triggerToast } = useToast();

const session = ref(null);
const aVerificarAcesso = ref(true);
const clientes = ref([]);
const clienteSelecionado = ref(null);
const instrumentoSelecionado = ref(null);
const mostrarClientes = ref(false);
const modoAtual = ref("bancada");
const clienteEditandoId = ref(null);
const clienteEditado = ref({});
const servicoDireto = ref(null);
const mostrarScanner = ref(false);

const configLuthieria = ref({
  nome_luthieria: "Gestão Luthieria",
  logo_url: "",
});

const assinatura = ref(null);
const diasTrialRestantes = ref(0);

async function processarLeituraQR(textoLido) {
  mostrarScanner.value = false;
  try {
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
        triggerToast("Ordem de Serviço carregada!", "success");
      } else {
        triggerToast("O.S. não encontrada ou acesso negado.", "error");
      }
      aVerificarAcesso.value = false;
    }
  } catch (e) {
    triggerToast(
      "QR Code inválido. Certifique-se de escanear uma etiqueta gerada pelo sistema.",
      "error",
    );
  }
}

async function carregarAssinatura() {
  const { data } = await supabase.from("assinaturas").select("*").maybeSingle();
  if (data) {
    assinatura.value = data;
    if (data.status === "trial") {
      const hoje = new Date();
      const fim = new Date(data.data_fim_trial);
      const diffTime = fim - hoje;
      diasTrialRestantes.value = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diasTrialRestantes.value <= 0) assinatura.value.status = "expirado";
    }
  }
}

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

async function fazerLogout() {
  await supabase.auth.signOut();
  clientes.value = [];
  configLuthieria.value = { nome_luthieria: "Gestão Luthieria", logo_url: "" };
  assinatura.value = null;
  session.value = null;
  document.documentElement.style.setProperty("--primary", "#2c3e50");
  document.documentElement.style.setProperty("--accent", "#d35400");
  triggerToast("Sessão encerrada com sucesso.", "info");
}

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

async function buscarClientes() {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });
  clientes.value = data || [];
}

onMounted(async () => {
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
      window.history.replaceState({}, document.title, "/");
    }
  }
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

function irParaInicio() {
  modoAtual.value = "bancada";
  servicoDireto.value = null;
  clienteSelecionado.value = null;
  instrumentoSelecionado.value = null;
  mostrarClientes.value = false;
  carregarConfiguracoes();
}

function fecharTelasSecundarias() {
  irParaInicio();
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
    return triggerToast("O nome do cliente não pode ficar em branco.", "error");
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
    triggerToast("Dados do cliente atualizados!", "success");
  } else {
    triggerToast("Erro ao guardar cliente: " + error.message, "error");
  }
}

function formatarLinkZap(telefone) {
  if (!telefone) return "";
  const apenasNumeros = telefone.replace(/\D/g, "");
  return apenasNumeros.length <= 11 ? `55${apenasNumeros}` : apenasNumeros;
}
</script>

<template>
  <div class="app-container">
    <SpeedInsights />
    <Analytics />
    <ToastNotification />

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

      <div class="main-header card global-header">
        <div class="brand-area" @click="irParaInicio" title="Voltar ao Início">
          <img
            v-if="configLuthieria.logo_url"
            :src="configLuthieria.logo_url"
            class="logo-img"
          />
          <span v-else style="font-size: 2.2rem">🎸</span>
          <h1 class="logo-title">{{ configLuthieria.nome_luthieria }}</h1>
        </div>

        <div class="header-buttons">
          <button
            @click="irParaInicio"
            class="btn-menu"
            :class="{
              active:
                modoAtual === 'bancada' &&
                !servicoDireto &&
                !clienteSelecionado,
            }"
          >
            <span class="icon">🏠</span> <span class="lbl">Início</span>
          </button>

          <button
            @click="
              modoAtual = 'calendario';
              servicoDireto = null;
              clienteSelecionado = null;
            "
            class="btn-menu"
            :class="{ active: modoAtual === 'calendario' }"
          >
            <span class="icon">📅</span> <span class="lbl">Agenda</span>
          </button>

          <button @click="mostrarScanner = true" class="btn-menu scan-btn">
            <span class="icon">📷</span>
          </button>

          <button
            @click="
              modoAtual = 'historico';
              servicoDireto = null;
              clienteSelecionado = null;
            "
            class="btn-menu"
            :class="{ active: modoAtual === 'historico' }"
          >
            <span class="icon">📦</span> <span class="lbl">Arquivo</span>
          </button>

          <button
            @click="
              modoAtual = 'admin';
              servicoDireto = null;
              clienteSelecionado = null;
            "
            class="btn-menu"
            :class="{ active: modoAtual === 'admin' }"
          >
            <span class="icon">⚙️</span> <span class="lbl">Admin</span>
          </button>

          <button
            @click="fazerLogout"
            class="btn-menu text-danger btn-sair-mobile"
          >
            <span class="icon">🚪</span> <span class="lbl">Sair</span>
          </button>
        </div>
      </div>

      <ScannerQR
        v-if="mostrarScanner"
        @detectado="processarLeituraQR"
        @fechar="mostrarScanner = false"
      />

      <div class="conteudo-principal">
        <div v-if="modoAtual === 'admin'">
          <AdminArea @voltar="fecharTelasSecundarias" />
        </div>
        <div v-else-if="modoAtual === 'calendario'">
          <ExecucaoServico
            v-if="servicoDireto"
            :servico="servicoDireto"
            @voltar="fecharServicoDireto"
          />
          <CalendarioEntregas
            v-else
            @voltar="fecharTelasSecundarias"
            @abrirOS="abrirServicoPeloDashboard"
          />
        </div>
        <div v-else-if="modoAtual === 'historico'">
          <ExecucaoServico
            v-if="servicoDireto"
            :servico="servicoDireto"
            @voltar="fecharServicoDireto"
          />
          <HistoricoServicos
            v-else
            @voltar="fecharTelasSecundarias"
            @abrirOS="abrirServicoPeloDashboard"
          />
        </div>
        <div v-else>
          <div v-if="servicoDireto">
            <ExecucaoServico
              :servico="servicoDireto"
              @voltar="fecharServicoDireto"
            />
          </div>
          <div v-else-if="instrumentoSelecionado">
            <ServicoManager
              :instrumento="instrumentoSelecionado"
              @voltar="instrumentoSelecionado = null"
            />
          </div>
          <div v-else-if="clienteSelecionado">
            <button @click="clienteSelecionado = null" class="btn-outline mb-1">
              &larr; Voltar para Bancada
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
                          <td data-label="Nome">
                            <input
                              v-model="clienteEditado.nome"
                              class="mb-1"
                            /><input
                              v-model="clienteEditado.cpf_cnpj"
                              placeholder="CPF/CNPJ"
                            />
                          </td>
                          <td data-label="Contato">
                            <input
                              v-model="clienteEditado.telefone"
                              class="mb-1"
                            /><input
                              v-model="clienteEditado.email"
                              placeholder="E-mail"
                            />
                          </td>
                          <td data-label="Ações" align="center">
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
                          <td data-label="Nome">
                            <strong>{{ cliente.nome }}</strong>
                          </td>
                          <td data-label="Contato">
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
                          <td data-label="Ações" align="center">
                            <button
                              class="btn-icon"
                              @click="selecionarCliente(cliente)"
                            >
                              🎸</button
                            ><button
                              class="btn-icon"
                              @click="iniciarEdicaoCliente(cliente)"
                            >
                              ✏️
                            </button>
                          </td>
                        </template>
                      </tr>
                      <tr v-if="clientes.length === 0">
                        <td colspan="3" class="text-muted text-center">
                          Nenhum cliente cadastrado.
                        </td>
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

<style scoped>
.app-container {
  padding: 20px;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
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

/* CABEÇALHO GLOBAL ESTILOS DESKTOP */
.global-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding: 15px 20px;
  border-bottom: 4px solid var(--accent);
  background: var(--bg-card);
  position: sticky;
  top: 10px;
  z-index: 100;
}
.brand-area {
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.brand-area:hover {
  opacity: 0.8;
}
.logo-img {
  max-height: 45px;
  border-radius: 4px;
  object-fit: contain;
}
.logo-title {
  margin: 0;
  font-size: 1.3rem;
  color: var(--primary);
  white-space: nowrap;
}

.header-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn-menu {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-menu:hover,
.btn-menu.active {
  background: var(--primary);
  color: #fff;
}
.btn-menu.scan-btn {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
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

/* ========================================================= */
/* 📱 MODO MOBILE: BOTTOM TAB BAR */
/* ========================================================= */
@media (max-width: 850px) {
  .global-header {
    margin-bottom: 15px;
    padding: 10px 15px;
    border-bottom: none;
    top: 0;
  }
  .btn-sair-mobile {
    display: none !important;
  }

  /* A Barra vai para o fundo */
  .header-buttons {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: #ffffff;
    box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.08);
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 5px 5px 20px 5px; /* Safebox iPhone */
    gap: 0;
    z-index: 999;
    border-top: 1px solid var(--border);
  }

  /* Os botões viram ícones com texto abaixo */
  .header-buttons .btn-menu {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: transparent !important;
    border: none !important;
    color: var(--text-muted) !important;
    font-size: 0.7rem;
    padding: 8px 0;
    min-height: 55px;
    border-radius: 8px;
    box-shadow: none !important;
  }
  .header-buttons .btn-menu .icon {
    font-size: 1.3rem;
  }

  /* Botão QR Flutuante (Floating Action Button) */
  .header-buttons .scan-btn {
    position: relative;
    top: -15px;
    background: var(--accent) !important;
    color: white !important;
    border-radius: 50% !important;
    min-height: 55px !important;
    max-width: 55px !important;
    flex: 0 0 55px !important;
    box-shadow: 0 4px 10px rgba(211, 84, 0, 0.4) !important;
  }
  .header-buttons .scan-btn .lbl {
    display: none;
  }
  .header-buttons .scan-btn .icon {
    font-size: 1.5rem;
    margin-top: 2px;
  }

  /* Cor do menu ativo */
  .header-buttons .btn-menu.active {
    color: var(--primary) !important;
  }
  .header-buttons .btn-menu.active .icon {
    transform: scale(1.15);
    transition: 0.2s;
  }

  .app-container {
    padding-bottom: 90px;
  }
  .clientes-grid {
    flex-direction: column;
  }
  .col-form {
    max-width: 100%;
  }
}
</style>
