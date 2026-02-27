<script setup>
/**
 * ============================================================================
 * @file        App.vue
 * @description Componente raiz orquestrador. Atualizado com aviso amigável
 * para usuários sem cadastro e bypass para Super Admins.
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
import { useOnboarding } from "./composables/useOnboarding";

const { triggerToast } = useToast();

const session = ref(null);
const aVerificarAcesso = ref(true);
const isSuperAdmin = ref(false);
const assinatura = ref(null);
const diasTrialRestantes = ref(0);

const clientes = ref([]);
const clienteSelecionado = ref(null);
const instrumentoSelecionado = ref(null);
const mostrarClientes = ref(false);
const modoAtual = ref("bancada");
const servicoDireto = ref(null);
const mostrarScanner = ref(false);

const configLuthieria = ref({
  nome_luthieria: "Gestão Luthieria",
  logo_url: "",
});

const { iniciarTour } = useOnboarding(modoAtual, mostrarClientes);

/**
 * Verifica privilégios de Super Admin
 */
async function verificarSuperAdmin(email) {
  if (!email) return;
  const { data } = await supabase
    .from("super_admins")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (data) {
    isSuperAdmin.value = true;
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
  } else {
    assinatura.value = null;
  }
}

async function inicializarApp() {
  aVerificarAcesso.value = true;
  await verificarSuperAdmin(session.value?.user?.email);
  await carregarAssinatura();

  if (
    isSuperAdmin.value ||
    (assinatura.value &&
      (assinatura.value.status === "ativo" ||
        (assinatura.value.status === "trial" && diasTrialRestantes.value > 0)))
  ) {
    await Promise.all([buscarClientes(), carregarConfiguracoes()]);
  }

  aVerificarAcesso.value = false;
}

async function fazerLogout() {
  aVerificarAcesso.value = true;
  await supabase.auth.signOut();
  session.value = null;
  assinatura.value = null;
  isSuperAdmin.value = false;
  irParaInicio();
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

onMounted(() => {
  supabase.auth.onAuthStateChange((_event, _session) => {
    session.value = _session;
    if (_session) {
      inicializarApp().then(() => {
        if (
          (isSuperAdmin.value || assinatura.value) &&
          !localStorage.getItem("luthierapp_onboarding_v1")
        ) {
          setTimeout(() => {
            iniciarTour();
            localStorage.setItem("luthierapp_onboarding_v1", "true");
          }, 1500);
        }
      });
    } else {
      aVerificarAcesso.value = false;
    }
  });
});

function irParaInicio() {
  modoAtual.value = "bancada";
  servicoDireto.value = null;
  clienteSelecionado.value = null;
  instrumentoSelecionado.value = null;
  mostrarClientes.value = false;
}

function selecionarCliente(c) {
  clienteSelecionado.value = c;
}
function abrirServicoPeloDashboard(os) {
  servicoDireto.value = os;
}
function formatarLinkZap(t) {
  const n = t?.replace(/\D/g, "");
  return n?.length <= 11 ? `55${n}` : n;
}
</script>

<template>
  <div class="app-container">
    <SpeedInsights /><Analytics /><ToastNotification />

    <div v-if="aVerificarAcesso" class="full-center">
      <div class="loader-simple"></div>
      <p class="mt-1 text-muted">A preparar sua oficina...</p>
    </div>

    <Auth v-else-if="!session" />

    <div v-else-if="!assinatura && !isSuperAdmin" class="full-center">
      <div class="card amigavel-card">
        <span style="font-size: 3rem; display: block; margin-bottom: 15px"
          >👋</span
        >
        <h3>Quase lá!</h3>
        <p>Ainda não encontramos os dados da sua oficina em nossa base.</p>
        <p class="text-muted small">
          Por favor, verifique se seu cadastro foi concluído ou retorne à tela
          inicial.
        </p>

        <button
          @click="fazerLogout"
          class="btn-primary"
          style="margin-top: 25px; width: 100%"
        >
          Ir para o Login
        </button>
      </div>
    </div>

    <Paywall
      v-else-if="
        !isSuperAdmin &&
        (assinatura.status === 'expirado' ||
          assinatura.status === 'inadimplente')
      "
      @sair="fazerLogout"
    />

    <div v-else>
      <div
        v-if="!isSuperAdmin && assinatura?.status === 'trial'"
        class="banner-trial"
      >
        ⚠️ Modo de Teste: Faltam {{ diasTrialRestantes }} dias.
        <button class="btn-trial" @click="assinatura.status = 'expirado'">
          Ver Planos
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
          <h1 class="logo-title">
            {{ configLuthieria.nome_luthieria }}
            <span v-if="isSuperAdmin" class="badge-master">MASTER</span>
          </h1>
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

      <ScannerQR v-if="mostrarScanner" @fechar="mostrarScanner = false" />

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
                        <th align="center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="c in clientes" :key="c.id">
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
                            🎸
                          </button>
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
/* Estilos para centralização absoluta */
.full-center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  text-align: center;
  padding: 20px;
}

.amigavel-card {
  max-width: 450px;
  padding: 40px;
  border-top: 5px solid var(--accent);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.badge-master {
  font-size: 0.6rem;
  background: var(--accent);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
  margin-left: 10px;
}

.loader-simple {
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: scale(360deg);
  }
}

/* Estilos PWA e Mobile (Mantidos) */
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

/* ========================================================= */
/* 📱 MODO MOBILE: BOTTOM TAB BAR (CORRIGIDO PARA PWA) */
/* ========================================================= */
@media (max-width: 850px) {
  .global-header {
    top: 0;
    padding: 10px;
  }

  /* Aumentar a altura geral da barra inferior */
  .header-buttons {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: #ffffff;
    padding: 12px 5px 25px; /* O 25px em baixo garante espaço para a barra de navegação do iOS/Android */
    justify-content: space-around;
    align-items: center;
    border-top: 1px solid #e0e0e0;
    z-index: 1000;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06); /* Sombra elegante */
    gap: 0;
  }

  /* Área de toque maior e alinhamento do texto */
  .header-buttons .btn-menu {
    flex-direction: column;
    border: none !important;
    background: transparent !important;
    flex: 1;
    padding: 5px 0;
    gap: 4px; /* Espaço entre ícone e texto */
    min-height: 60px;
    color: var(--text-muted);
  }

  /* Ícones maiores e mais fáceis de tocar */
  .header-buttons .btn-menu .icon {
    font-size: 1.6rem;
  }

  /* Trazer o texto de volta, legível e proporcional */
  .header-buttons .btn-menu .lbl {
    display: block !important;
    font-size: 0.7rem;
    font-weight: 600;
  }

  /* Animação e cor no botão ativo */
  .header-buttons .btn-menu.active {
    color: var(--primary) !important;
  }
  .header-buttons .btn-menu.active .icon {
    transform: scale(1.15);
    transition: transform 0.2s ease-out;
  }

  /* Botão central (Scanner) mais destacado */
  .header-buttons .scan-btn {
    position: relative;
    top: -20px;
    border-radius: 50% !important;
    width: 65px;
    height: 65px;
    flex: 0 0 65px !important;
    background: var(--accent) !important;
    box-shadow: 0 6px 15px rgba(211, 84, 0, 0.4) !important;
    justify-content: center;
  }

  .header-buttons .scan-btn .icon {
    font-size: 1.8rem;
    color: white;
  }

  .header-buttons .scan-btn .lbl {
    display: none !important; /* Ocultar texto só no botão central */
  }

  /* Esconder o botão de sair no bottom menu (deve ficar só na área "Minha Conta" ou "Admin") */
  .btn-sair-mobile {
    display: none !important;
  }

  /* Aumentar o espaçamento do fim da página para nada ficar escondido atrás da nova barra */
  .app-container {
    padding-bottom: 110px;
  }

  /* Ajustes gerais de grelha para telemóvel */
  .clientes-grid {
    flex-direction: column;
  }
}

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
