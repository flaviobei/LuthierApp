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
import Paywall from "./components/Paywall.vue";
import { SpeedInsights } from "@vercel/speed-insights/vue";
import { Analytics } from "@vercel/analytics/vue";
import ScannerQR from "./components/ScannerQR.vue";
import CalendarioEntregas from "./components/CalendarioEntregas.vue";
import ToastNotification from "./components/ToastNotification.vue";
import { useToast } from "./composables/useToast";
import { useOnboarding } from "./composables/useOnboarding";

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

const { iniciarTour } = useOnboarding(modoAtual, mostrarClientes);

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
        triggerToast("O.S. carregada!", "success");
      } else {
        triggerToast("O.S. não encontrada.", "error");
      }
      aVerificarAcesso.value = false;
    }
  } catch (e) {
    triggerToast("QR Code inválido.", "error");
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
    await Promise.all([buscarClientes(), carregarConfiguracoes()]);
  }
  aVerificarAcesso.value = false;
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
    if (_session) {
      inicializarApp().then(() => {
        const tourFeito = localStorage.getItem("luthierapp_onboarding_v1");
        if (!tourFeito) {
          setTimeout(() => {
            iniciarTour();
            localStorage.setItem("luthierapp_onboarding_v1", "true");
          }, 1500);
        }
      });
    } else aVerificarAcesso.value = false;
  });
});

function irParaInicio() {
  modoAtual.value = "bancada";
  servicoDireto.value = null;
  clienteSelecionado.value = null;
  instrumentoSelecionado.value = null;
  mostrarClientes.value = false;
}

async function fazerLogout() {
  await supabase.auth.signOut();
  clientes.value = [];
  configLuthieria.value = { nome_luthieria: "Gestão Luthieria", logo_url: "" };
  assinatura.value = null;
  session.value = null;
  document.documentElement.style.setProperty("--primary", "#2c3e50");
  document.documentElement.style.setProperty("--accent", "#d35400");
  irParaInicio();
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
    return triggerToast("Nome obrigatório.", "error");
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
    triggerToast("Cliente atualizado!", "success");
  }
}
function formatarLinkZap(t) {
  const n = t?.replace(/\D/g, "");
  return n?.length <= 11 ? `55${n}` : n;
}
</script>

<template>
  <div class="app-container">
    <SpeedInsights /><Analytics /><ToastNotification />
    <div v-if="aVerificarAcesso" class="loader-container">
      <h2>A preparar a oficina...</h2>
    </div>
    <Auth v-else-if="!session" />
    <Paywall
      v-else-if="assinatura?.status === 'expirado'"
      @sair="fazerLogout"
    />

    <div v-else>
      <div v-if="assinatura?.status === 'trial'" class="banner-trial">
        ⚠️ Modo de Teste: Faltam {{ diasTrialRestantes }} dias.
        <button class="btn-trial" @click="assinatura.status = 'expirado'">
          Planos
        </button>
      </div>

      <div class="main-header card global-header">
        <div class="brand-area" @click="irParaInicio">
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
            id="tour-home"
            @click="irParaInicio"
            class="btn-menu"
            :class="{ active: modoAtual === 'bancada' && !servicoDireto }"
          >
            <span class="icon">🏠</span> <span class="lbl">Início</span>
          </button>
          <button
            @click="modoAtual = 'calendario'"
            class="btn-menu"
            :class="{ active: modoAtual === 'calendario' }"
          >
            <span class="icon">📅</span> <span class="lbl">Agenda</span>
          </button>
          <button @click="mostrarScanner = true" class="btn-menu scan-btn">
            <span class="icon">📷</span>
          </button>
          <button
            @click="modoAtual = 'historico'"
            class="btn-menu"
            :class="{ active: modoAtual === 'historico' }"
          >
            <span class="icon">📦</span> <span class="lbl">Arquivo</span>
          </button>
          <button
            id="tour-admin"
            @click="modoAtual = 'admin'"
            class="btn-menu"
            :class="{ active: modoAtual === 'admin' }"
          >
            <span class="icon">⚙️</span> <span class="lbl">Admin</span>
          </button>
          <button
            @click="fazerLogout"
            class="btn-menu text-danger btn-sair-mobile"
          >
            <span class="icon">🚪</span>
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
          <AdminArea @voltar="irParaInicio" />
        </div>
        <div v-else-if="modoAtual === 'calendario'">
          <CalendarioEntregas
            @abrirOS="abrirServicoPeloDashboard"
            @voltar="irParaInicio"
          />
        </div>
        <div v-else-if="modoAtual === 'historico'">
          <HistoricoServicos
            @abrirOS="abrirServicoPeloDashboard"
            @voltar="irParaInicio"
          />
        </div>
        <div v-else>
          <div v-if="servicoDireto">
            <ExecucaoServico
              :servico="servicoDireto"
              @voltar="servicoDireto = null"
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
              &larr; Bancada
            </button>
            <InstrumentoManager
              :clienteId="clienteSelecionado.id"
              :clienteNome="clienteSelecionado.nome"
              @selecionarInstrumento="instrumentoSelecionado = $event"
            />
          </div>
          <div v-else>
            <DashboardAtividades @abrirOS="abrirServicoPeloDashboard" />
            <div class="controle-clientes">
              <button
                id="tour-clientes"
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
              <div class="col-form card">
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
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="c in clientes" :key="c.id">
                        <template v-if="clienteEditandoId === c.id">
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
                              class="btn-icon"
                            >
                              💾</button
                            ><button
                              @click="cancelarEdicaoCliente"
                              class="btn-icon"
                            >
                              ❌
                            </button>
                          </td>
                        </template>
                        <template v-else>
                          <td>
                            <strong>{{ c.nome }}</strong>
                          </td>
                          <td>
                            <a
                              v-if="c.telefone"
                              :href="
                                'https://wa.me/' + formatarLinkZap(c.telefone)
                              "
                              target="_blank"
                              class="badge-zap"
                              >📱 WhatsApp</a
                            >
                          </td>
                          <td align="center">
                            <button
                              class="btn-icon"
                              @click="clienteSelecionado = c"
                            >
                              🎸</button
                            ><button
                              class="btn-icon"
                              @click="iniciarEdicaoCliente(c)"
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

<style scoped>
/* SEUS ESTILOS ORIGINAIS MANTIDOS */
.app-container {
  padding: 20px;
  max-width: 1100px;
  margin: 0 auto;
}
.global-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding: 15px 20px;
  position: sticky;
  top: 10px;
  z-index: 100;
  border-bottom: 4px solid var(--accent);
}
.brand-area {
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: pointer;
}
.logo-img {
  max-height: 45px;
  object-fit: contain;
}
.header-buttons {
  display: flex;
  gap: 8px;
}
.btn-menu {
  background: transparent;
  border: 2px solid var(--primary);
  color: var(--primary);
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-menu.active {
  background: var(--primary);
  color: white;
}
.scan-btn {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  color: white !important;
}
.clientes-grid {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}
.col-form {
  flex: 1;
  min-width: 300px;
}
.col-lista {
  flex: 2;
}
.badge-zap {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: bold;
  text-decoration: none;
  font-size: 0.8rem;
}
.banner-trial {
  background: #fff3cd;
  color: #856404;
  padding: 10px;
  text-align: center;
  border-radius: 8px;
  margin-bottom: 20px;
}

@media (max-width: 850px) {
  .global-header {
    top: 0;
    padding: 10px;
  }
  .header-buttons {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: white;
    padding: 10px 5px 25px;
    justify-content: space-around;
    border-top: 1px solid #eee;
  }
  .btn-menu {
    flex-direction: column;
    border: none !important;
    font-size: 0.7rem;
  }
  .scan-btn {
    position: relative;
    top: -15px;
    border-radius: 50% !important;
    width: 60px;
    height: 60px;
  }
  .lbl {
    display: none;
  }
  .app-container {
    padding-bottom: 80px;
  }
  .clientes-grid {
    flex-direction: column;
  }
}
</style>
