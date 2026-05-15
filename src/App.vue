<script setup>
/**
 * ============================================================================
 * @file        App.vue
 * @description Orquestrador refatorado para usar a camada de Services.
 * ============================================================================
 */
import { ref, onMounted, watch, computed } from "vue";
import { supabase } from "./lib/supabaseClient";
import { useToast } from "./composables/useToast";
import { useOnboarding } from "./composables/useOnboarding";

// SERVIÇOS
import { clienteService } from "./services/clienteService";
import { adminService } from "./services/adminService";
import { authService } from "./services/authService";
import { useI18n } from "vue-i18n";

// COMPONENTES
import Auth from "./components/Auth.vue";
import ClienteForm from "./components/ClienteForm.vue";
import InstrumentoManager from "./components/InstrumentoManager.vue";
import ServicoManager from "./components/ServicoManager.vue";
import DashboardAtividades from "./components/DashboardAtividades.vue";
import ExecucaoServico from "./components/ExecucaoServico.vue";
import AdminArea from "./components/AdminArea.vue";
import HistoricoServicos from "./components/HistoricoServicos.vue";
import Ajuda from "./components/Ajuda.vue";
import Paywall from "./components/Paywall.vue";
import { SpeedInsights } from "@vercel/speed-insights/vue";
import { Analytics } from "@vercel/analytics/vue";
import ScannerQR from "./components/ScannerQR.vue";
import CalendarioEntregas from "./components/CalendarioEntregas.vue";
import ToastNotification from "./components/ToastNotification.vue";

const { triggerToast } = useToast();
const { locale, t } = useI18n();

// CONFIGURAÇÃO DE IDIOMAS
const showLangMenu = ref(false);
const supportedLocales = ["pt-BR", "en", "es", "fr", "it", "ja"];
const langConfig = {
  "pt-BR": { flag: "br", label: "PT" },
  en: { flag: "us", label: "EN" },
  es: { flag: "es", label: "ES" },
  fr: { flag: "fr", label: "FR" },
  it: { flag: "it", label: "IT" },
  ja: { flag: "jp", label: "JA" },
};

const currentFlag = computed(
  () => `https://flagcdn.com/w40/${langConfig[locale.value]?.flag || "br"}.png`,
);

function selecionarIdioma(lang) {
  locale.value = lang;
  showLangMenu.value = false;
}

// ESTADOS GLOBAIS
const session = ref(null);
const aVerificarAcesso = ref(true);
const isSuperAdmin = ref(false);
const assinatura = ref(null);
const diasTrialRestantes = ref(0);
const clientes = ref([]);
const clienteSelecionado = ref(null);
const instrumentoSelecionado = ref(null);
const clienteParaEditar = ref(null);
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
 * WATCHER DE IDIOMA
 * Salva a preferência do usuário no navegador
 */
watch(locale, (novoIdioma) => {
  localStorage.setItem("luthierapp_lang", novoIdioma);
});

/**
 * INICIALIZAÇÃO DO APP
 */
async function inicializarApp() {
  aVerificarAcesso.value = true;
  try {
    const idiomaSalvo = localStorage.getItem("luthierapp_lang");
    if (idiomaSalvo) {
      locale.value = idiomaSalvo;
    }

    const userEmail = session.value?.user?.email;

    const [superAdmin, dadosAssinatura] = await Promise.all([
      adminService.verificarSuperAdmin(userEmail),
      adminService.buscarAssinatura(),
    ]);

    isSuperAdmin.value = superAdmin;
    assinatura.value = dadosAssinatura;

    if (dadosAssinatura?.status === "trial") {
      const hoje = new Date();
      const fim = new Date(dadosAssinatura.data_fim_trial);
      diasTrialRestantes.value = Math.ceil(
        (fim - hoje) / (1000 * 60 * 60 * 24),
      );
      if (diasTrialRestantes.value <= 0) assinatura.value.status = "expirado";
    }

    const temAcesso =
      isSuperAdmin.value ||
      assinatura.value?.status === "ativo" ||
      (assinatura.value?.status === "trial" && diasTrialRestantes.value > 0);

    if (temAcesso) {
      await Promise.all([buscarClientes(), aplicarConfiguracoesVisuais()]);
    }
  } catch (err) {
    console.error("Erro ao inicializar:", err);
  } finally {
    aVerificarAcesso.value = false;
  }
}

async function buscarClientes() {
  try {
    clientes.value = await clienteService.buscarTodos();
  } catch (e) {
    triggerToast(t("app.erro_carregar_clientes"), "error");
  }
}

async function aplicarConfiguracoesVisuais() {
  try {
    const data = await adminService.buscarConfiguracoes();
    if (!data) return;

    configLuthieria.value.nome_luthieria =
      data.nome_luthieria || "Gestão Luthieria";
    configLuthieria.value.logo_url = data.logo_url || "";

    const root = document.documentElement;

    const sanearCor = (val) => {
      if (!val) return null;
      return /^[a-zA-Z0-9#(),.\s%-]+$/.test(val) &&
        !val.toLowerCase().includes("url")
        ? val
        : null;
    };

    const sanearFonte = (val) => {
      if (!val) return null;
      return /^[a-zA-Z0-9\s,'"-]+$/.test(val) ? val : null;
    };

    const vars = {
      "--primary": sanearCor(data.cor_primaria),
      "--accent": sanearCor(data.cor_secundaria),
      "--bg-body": sanearCor(data.cor_fundo),
      "--text-main": sanearCor(data.text_color),
      "--btn-primary-bg": sanearCor(data.btn_primary_bg),
      "--btn-primary-text": sanearCor(data.btn_primary_text),
      "--btn-accent-bg": sanearCor(data.btn_accent_bg),
      "--btn-accent-text": sanearCor(data.btn_accent_text),
      "--icon-family":
        data.estilo_icones && sanearFonte(data.estilo_icones)
          ? `"${data.estilo_icones}"`
          : null,
    };

    Object.entries(vars).forEach(([key, val]) => {
      if (val) root.style.setProperty(key, val);
    });

    const fonteSegura = sanearFonte(data.fonte_principal);
    if (fonteSegura) document.body.style.fontFamily = fonteSegura;

    if (data.radius_perc !== null) {
      const radiusSeguro = Math.max(
        0,
        Math.min(50, Number(data.radius_perc) || 0),
      );
      root.style.setProperty("--radius", `${radiusSeguro}px`);
      root.style.setProperty(
        "--radius-sm",
        `${Math.max(4, radiusSeguro - 4)}px`,
      );
    }
  } catch (e) {
    console.error("Erro nas configurações visuais", e);
  }
}

async function fazerLogout() {
  aVerificarAcesso.value = true;
  try {
    await authService.logout();
    session.value = null;
    assinatura.value = null;
    isSuperAdmin.value = false;

    modoAtual.value = "bancada";
    servicoDireto.value = null;
    clienteSelecionado.value = null;
    instrumentoSelecionado.value = null;
    clienteParaEditar.value = null;
    mostrarClientes.value = false;
  } catch (e) {
    triggerToast(t("app.erro_sair"), "error");
  } finally {
    aVerificarAcesso.value = false;
  }
}

function irParaInicio() {
  if (modoAtual.value === "bancada") {
    servicoDireto.value = null;
    clienteSelecionado.value = null;
    instrumentoSelecionado.value = null;
    clienteParaEditar.value = null;
    mostrarClientes.value = false;
  } else {
    modoAtual.value = "bancada";
  }
}

function abrirServicoPeloDashboard(os) {
  servicoDireto.value = os;
  modoAtual.value = "bancada";
}

function editarCliente(cliente) {
  clienteParaEditar.value = cliente;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatarLinkZap(t) {
  const n = t?.replace(/\D/g, "");
  return n?.length <= 11 ? `55${n}` : n;
}

onMounted(() => {
  supabase.auth.onAuthStateChange((_event, _session) => {
    session.value = _session;

    if (_event === "INITIAL_SESSION" || _event === "SIGNED_IN") {
      if (_session) {
        inicializarApp().then(() => {
          const resumeStep = localStorage.getItem(
            "luthierapp_resume_tour_after_demo",
          );
          if (resumeStep) {
            localStorage.removeItem("luthierapp_resume_tour_after_demo");
            setTimeout(() => {
              iniciarTour(parseInt(resumeStep));
            }, 1500);
          } else if (
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
    } else if (_event === "SIGNED_OUT") {
      aVerificarAcesso.value = false;
    }
  });
});
</script>

<template>
  <div class="app-container">
    <SpeedInsights /><Analytics /><ToastNotification />

    <div v-if="aVerificarAcesso" class="full-center">
      <div class="loader-simple"></div>
      <p class="mt-1 text-muted">{{ $t("app.preparando") }}</p>
    </div>

    <Auth v-else-if="!session" />

    <div v-else-if="!assinatura && !isSuperAdmin" class="full-center">
      <div class="card amigavel-card">
        <span
          class="icon-dinamico"
          style="
            font-size: 3rem;
            display: block;
            margin-bottom: 15px;
            color: var(--primary);
          "
          >waving_hand</span
        >
        <h3>{{ $t("app.quase_la") }}</h3>
        <p>{{ $t("app.sem_dados") }}</p>
        <button
          type="button"
          @click="fazerLogout"
          class="btn-primary"
          style="
            margin-top: 25px;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">logout</span> {{ $t("app.ir_login") }}
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
        <span
          class="icon-dinamico"
          style="vertical-align: middle; margin-right: 6px"
          >warning</span
        >
        {{ $t("app.modo_teste", { dias: diasTrialRestantes }) }}
        <button
          type="button"
          class="btn-trial"
          @click="assinatura.status = 'expirado'"
        >
          {{ $t("app.ver_planos") }}
        </button>
      </div>

      <div class="main-header card global-header">
        <div class="brand-area" @click="irParaInicio">
          <img
            v-if="configLuthieria.logo_url"
            :src="configLuthieria.logo_url"
            class="logo-img"
          />
          <span
            v-else
            class="icon-dinamico"
            style="font-size: 2.2rem; color: var(--primary)"
            >music_note</span
          >
          <h4 class="logo-title">
            {{ configLuthieria.nome_luthieria }}
            <span v-if="isSuperAdmin" class="badge-master">MASTER</span>
          </h4>
        </div>

        <div class="header-buttons">
          <button
            type="button"
            id="tour-home"
            @click="irParaInicio"
            class="btn-menu"
            :class="{ active: modoAtual === 'bancada' && !servicoDireto }"
          >
            <span class="icon-dinamico">home</span
            ><span class="lbl">{{ $t("menu.inicio") }}</span>
          </button>
          <button
            type="button"
            @click="modoAtual = 'calendario'"
            class="btn-menu"
            :class="{ active: modoAtual === 'calendario' }"
          >
            <span class="icon-dinamico">calendar_month</span
            ><span class="lbl">{{ $t("menu.agenda") }}</span>
          </button>
          <button
            type="button"
            @click="mostrarScanner = true"
            class="btn-menu scan-btn"
          >
            <span class="icon-dinamico">qr_code_scanner</span
            ><span class="lbl">{{ $t("menu.qr_scan") }}</span>
          </button>
          <button
            type="button"
            @click="modoAtual = 'historico'"
            class="btn-menu"
            :class="{ active: modoAtual === 'historico' }"
          >
            <span class="icon-dinamico">inventory_2</span
            ><span class="lbl">{{ $t("menu.arquivo") }}</span>
          </button>
          <button
            type="button"
            id="tour-admin"
            @click="modoAtual = 'admin'"
            class="btn-menu"
            :class="{ active: modoAtual === 'admin' }"
          >
            <span class="icon-dinamico">settings</span
            ><span class="lbl">{{ $t("menu.admin") }}</span>
          </button>

          <!-- MENU DE IDIOMA CUSTOMIZADO COM BANDEIRAS REAIS -->
          <div class="lang-selector-wrapper">
            <!-- Overlay invisível para fechar o menu ao clicar fora -->
            <div
              v-if="showLangMenu"
              class="lang-overlay"
              @click="showLangMenu = false"
            ></div>

            <button
              type="button"
              class="btn-menu lang-btn"
              @click="showLangMenu = !showLangMenu"
              title="Mudar Idioma"
            >
              <img :src="currentFlag" alt="Idioma" class="lang-flag" />
            </button>

            <div v-if="showLangMenu" class="lang-dropdown">
              <button
                v-for="l in supportedLocales"
                :key="l"
                type="button"
                class="lang-option"
                :class="{ active: locale === l }"
                @click="selecionarIdioma(l)"
              >
                <img
                  :src="`https://flagcdn.com/w40/${langConfig[l].flag}.png`"
                  class="lang-flag-small"
                />
                <span>{{ langConfig[l].label }}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            @click="fazerLogout"
            class="btn-menu text-danger btn-sair-mobile"
          >
            <span class="icon-dinamico">logout</span>
          </button>
        </div>
      </div>

      <ScannerQR
        v-if="mostrarScanner"
        @fechar="mostrarScanner = false"
        @osLida="
          (os) => {
            mostrarScanner = false;
            abrirServicoPeloDashboard(os);
          }
        "
      />

      <div class="conteudo-principal">
        <KeepAlive>
          <AdminArea v-if="modoAtual === 'admin'" @voltar="irParaInicio" />
          <CalendarioEntregas
            v-else-if="modoAtual === 'calendario'"
            @abrirOS="abrirServicoPeloDashboard"
            @voltar="irParaInicio"
          />
          <HistoricoServicos
            v-else-if="modoAtual === 'historico'"
            @abrirOS="abrirServicoPeloDashboard"
            @voltar="irParaInicio"
          />
          <Ajuda v-else-if="modoAtual === 'ajuda'" />
        </KeepAlive>

        <div v-show="modoAtual === 'bancada'">
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
            <button
              type="button"
              @click="clienteSelecionado = null"
              class="btn-outline mb-1"
              style="display: inline-flex; align-items: center; gap: 6px"
            >
              <span class="icon-dinamico" style="font-size: 1.1rem"
                >arrow_back</span
              >
              {{ $t("app.bancada") }}
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
                type="button"
                id="tour-clientes"
                class="btn-toggle-clientes"
                @click="mostrarClientes = !mostrarClientes"
              >
                <span class="icon-dinamico">{{
                  mostrarClientes ? "expand_less" : "group"
                }}</span>
                {{
                  mostrarClientes
                    ? $t("app.ocultar_clientes")
                    : $t("app.gerenciar_clientes")
                }}
              </button>
            </div>
            <div v-show="mostrarClientes" class="clientes-grid">
              <div class="col-form card">
                <ClienteForm
                  :clienteEdit="clienteParaEditar"
                  @clienteSalvo="
                    () => {
                      buscarClientes();
                      clienteParaEditar = null;
                    }
                  "
                  @cancelarEdicao="clienteParaEditar = null"
                />
              </div>
              <div class="col-lista card">
                <h3 class="title-section">
                  <span class="icon-dinamico" style="vertical-align: middle"
                    >folder_open</span
                  >
                  {{ $t("app.lista_clientes") }}
                </h3>
                <div class="tabela-responsiva">
                  <table class="tabela-padrao">
                    <thead>
                      <tr>
                        <th>{{ $t("os.cliente") }}</th>
                        <th>{{ $t("os.contato") }}</th>
                        <th align="center">{{ $t("admin.acoes") }}</th>
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
                          >
                            <span class="icon-dinamico" style="font-size: 1rem"
                              >chat</span
                            >
                            WhatsApp
                          </a>
                        </td>
                        <td align="center">
                          <div
                            style="
                              display: flex;
                              gap: 8px;
                              justify-content: center;
                              align-items: center;
                            "
                          >
                            <button
                              type="button"
                              class="btn-icon"
                              @click="editarCliente(c)"
                              title="Editar Cliente"
                            >
                              <span class="icon-dinamico">edit</span>
                            </button>
                            <button
                              type="button"
                              class="btn-icon"
                              @click="clienteSelecionado = c"
                              title="Ver Instrumentos"
                            >
                              <span class="icon-dinamico">list</span>
                            </button>
                          </div>
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
    transform: rotate(360deg);
  }
}
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
  background: white;
}
.brand-area {
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: pointer;
}
.logo-img {
  max-height: 60px;
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

/* =========================================
   CUSTOM LANGUAGE DROPDOWN CSS 
========================================= */
.lang-selector-wrapper {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}
.lang-btn {
  padding: 6px 14px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}
.lang-flag {
  width: 24px;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.lang-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 998;
}
.lang-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  z-index: 999;
  display: flex;
  flex-direction: column;
  min-width: 140px;
  padding: 8px 0;
  overflow: hidden;
}
.lang-option {
  background: transparent;
  border: none;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  font-weight: bold;
  color: var(--text-main);
  width: 100%;
  font-size: 0.95rem;
  transition: background 0.2s;
}
.lang-option:hover {
  background: #f5f5f5;
}
.lang-option.active {
  color: var(--primary);
  background: #f0f7ff;
}
.lang-flag-small {
  width: 20px;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
/* ========================================= */

.scan-btn {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  color: white !important;
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
  display: flex;
  align-items: center;
  gap: 4px;
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
  .header-buttons {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: #ffffff;
    padding: 12px 5px 25px;
    justify-content: space-around;
    border-top: 1px solid #e0e0e0;
    z-index: 1000;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06);
    gap: 0;
  }
  .header-buttons .btn-menu {
    flex-direction: column;
    border: none !important;
    flex: 1;
    padding: 5px 0;
    min-height: 60px;
    color: var(--text-muted);
  }
  .header-buttons .btn-menu .lbl {
    display: block !important;
    font-size: 0.7rem;
  }

  .lang-selector-wrapper {
    position: static; /* Permite que o dropdown se alinhe à barra no mobile */
    flex: 1;
  }
  .lang-btn {
    border-radius: 0 !important;
    padding: 0;
  }
  .lang-dropdown {
    /* No celular, faz o menu abrir para CIMA e ficar centralizado */
    top: auto;
    bottom: calc(100% + 10px);
    right: 5px;
    box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.1);
  }

  .header-buttons .scan-btn {
    position: relative;
    top: -20px;
    border-radius: 50% !important;
    width: 65px;
    height: 65px;
    flex: 0 0 65px !important;
    box-shadow: 0 6px 15px rgba(211, 84, 0, 0.4) !important;
  }
  .header-buttons .scan-btn .lbl {
    display: none !important;
  }
  .btn-sair-mobile {
    display: none !important;
  }
  .app-container {
    padding-bottom: 110px;
  }
  .clientes-grid {
    flex-direction: column;
  }
}
</style>
