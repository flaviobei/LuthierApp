<script setup>
/**
 * ============================================================================
 * @file        DashboardAtividades.vue
 * @description Painel principal de indicadores (KPIs).
 * ATUALIZAÇÃO: Alerta Inteligente de Estoque.
 * ============================================================================
 */
import { ref, onMounted, computed, watch } from "vue";
import { abrirWhatsapp } from "../lib/whatsappUtils";
import { useToast } from "../composables/useToast";
import { osService } from "../services/osService";
import { catalogoService } from "../services/catalogoService"; // Novo Serviço
import { clienteService } from "../services/clienteService";
import { useI18n } from "vue-i18n";
import { supabase } from "../lib/supabaseClient";

const emit = defineEmits(["abrirOS", "mudarAba", "novaOSCliente"]); // Adicionado mudarAba para o botão do estoque
const { triggerToast } = useToast();
const { t } = useI18n();

const servicosAbertos = ref([]);
const oportunidadesPosVenda = ref([]);
const alertasEstoque = ref([]); // Nova variável
const faturamentoParado = ref([]);
const loading = ref(true);

const filtroStatus = ref('Todos');

const servicosAbertosFiltrados = computed(() => {
  let filtrado = servicosAbertos.value;
  if (filtroStatus.value !== 'Todos') {
    filtrado = filtrado.filter(os => (os.fase_projeto || os.status) === filtroStatus.value);
  }
  
  // Sort by priority: 1. Fila de Espera, 2. Others, 3. Pronto para Entrega
  return [...filtrado].sort((a, b) => {
    const faseA = a.fase_projeto || a.status;
    const faseB = b.fase_projeto || b.status;
    
    const getPeso = (fase) => {
      if (fase === 'Fila de Espera') return 1;
      if (fase === 'Pronto para Entrega') return 3;
      return 2;
    };
    
    return getPeso(faseA) - getPeso(faseB);
  });
});

const estadoAvisos = ref({
  estoque: 'aberto',
  posVenda: 'aberto',
  faturamento: 'aberto'
});
const isBuscandoCliente = ref(false);
const textoBuscaCliente = ref("");
const resultadosBuscaCliente = ref([]);
const loadingBuscaCliente = ref(false);
const todosClientesLocal = ref([]);

watch(isBuscandoCliente, async (val) => {
  if (val && todosClientesLocal.value.length === 0) {
    try {
      todosClientesLocal.value = await clienteService.buscarTodos();
    } catch (e) {
      console.error("Erro carregando clientes para busca", e);
    }
  }
});

watch(textoBuscaCliente, (newVal) => {
  if (newVal.length < 2) {
    resultadosBuscaCliente.value = [];
    return;
  }
  const term = newVal.toLowerCase();
  resultadosBuscaCliente.value = todosClientesLocal.value
    .filter(c => 
      (c.nome && c.nome.toLowerCase().includes(term)) || 
      (c.celular && c.celular.includes(term))
    )
    .slice(0, 10);
});

const avisosFechadosComItens = computed(() => {
  const fechados = [];
  if (estadoAvisos.value.estoque === 'fechado' && alertasEstoque.value.length > 0) fechados.push({ id: 'estoque', label: t('dashboard.alertas_estoque'), icon: 'running_with_errors', color: 'var(--danger)' });
  if (estadoAvisos.value.posVenda === 'fechado' && oportunidadesPosVenda.value.length > 0) fechados.push({ id: 'posVenda', label: t('dashboard.retencao_clientes'), icon: 'lightbulb', color: 'var(--primary)' });
  if (estadoAvisos.value.faturamento === 'fechado' && faturamentoParado.value.length > 0) fechados.push({ id: 'faturamento', label: t('dashboard.faturamento_parado'), icon: 'savings', color: 'var(--warning)' });
  return fechados;
});

function toggleMinimizar(id) {
  estadoAvisos.value[id] = estadoAvisos.value[id] === 'minimizado' ? 'aberto' : 'minimizado';
}
function fecharAviso(id) {
  estadoAvisos.value[id] = 'fechado';
}
function reabrirAviso(id) {
  estadoAvisos.value[id] = 'aberto';
}

watch(estadoAvisos, (novoEstado) => {
  localStorage.setItem('luthierapp_alertas_state', JSON.stringify(novoEstado));
}, { deep: true });


// --- CARREGAMENTO ---
async function carregarDadosIniciais() {
  loading.value = true;
  try {
    // Carrega tudo ao mesmo tempo
    const [pendencias, crm, catalogo, faturamentoPendentes] = await Promise.all([
      osService.buscarPendenciasDash(),
      osService.buscarOportunidadesPosVenda(),
      catalogoService.buscarTodos(),
      osService.buscarFaturamentoParado(),
    ]);

    servicosAbertos.value = pendencias;
    oportunidadesPosVenda.value = crm;
    faturamentoParado.value = faturamentoPendentes;

    // Filtra o catálogo para mostrar apenas os itens abaixo do mínimo!
    alertasEstoque.value = catalogo.filter(
      (c) => c.controla_estoque && c.quantidade_estoque <= c.estoque_minimo,
    );
  } catch (error) {
    triggerToast(t('dashboard.erro_carregar') + error.message, "error");
  } finally {
    loading.value = false;
  }
}

// --- AÇÕES DO CRM (PÓS-VENDA) ---
function chamarClientePosVenda(os) {
  const cli = os.instrumentos?.cliente;
  if (!cli || !cli.telefone)
    return triggerToast(t('dashboard.erro_telefone'), "error");

  const msg = t('dashboard.msg_pos_venda', {
    nome: cli.nome,
    marca: os.instrumentos.marca,
    modelo: os.instrumentos.modelo,
    os: os.numero_os
  });
  const ok = abrirWhatsapp(cli, msg);
  if (ok === false) triggerToast(t('dashboard.sem_telefone_registrado'), 'error');
}

async function marcarComoContatado(osId) {
  try {
    await osService.marcarPosVendaContatado(osId);
    oportunidadesPosVenda.value = oportunidadesPosVenda.value.filter(
      (o) => o.id !== osId,
    );
    triggerToast(t('dashboard.crm_removida'), "success");
  } catch (err) {
    triggerToast(t('dashboard.crm_erro_atualizar') + err.message, "error");
  }
}

async function adiarPosVenda(osId, dias) {
  try {
    await osService.adiarPosVenda(osId, dias);
    oportunidadesPosVenda.value = oportunidadesPosVenda.value.filter(
      (o) => o.id !== osId,
    );
    triggerToast(t('dashboard.crm_adiado', { dias }), "info");
  } catch (err) {
    triggerToast(t('dashboard.crm_erro_adiar') + err.message, "error");
  }
}

function chamarClienteCobranca(os) {
  const cli = os.instrumentos?.cliente;
  if (!cli || !cli.telefone)
    return triggerToast(t('dashboard.erro_telefone'), "error");

  const msg = t('dashboard.msg_cobranca', {
    nome: cli.nome,
    marca: os.instrumentos.marca,
    modelo: os.instrumentos.modelo,
    os: os.numero_os
  });
  const ok = abrirWhatsapp(cli, msg);
  if (ok === false) triggerToast(t('dashboard.sem_telefone_registrado'), 'error');
}

function abrirBuscaNovaOS() {
  isBuscandoCliente.value = true;
  // Foca o input na proxima renderizacao
  setTimeout(() => {
    const el = document.getElementById('inputBuscaOS');
    if (el) el.focus();
  }, 100);
}

function handleClienteSelecionado(cliente) {
  isBuscandoCliente.value = false;
  textoBuscaCliente.value = "";
  resultadosBuscaCliente.value = [];
  emit('novaOSCliente', cliente);
}

// --- AUXILIARES DE INTERFACE ---
function traduzirFase(fase) {
  if (!fase) return '';
  const mapa = {
    "Fila de Espera": t('dashboard.status_fila_espera'),
    "Aguardando Peças": t('dashboard.status_aguardando_pecas'),
    "Secagem / Cura": t('dashboard.status_secagem'),
    "Na Bancada": t('dashboard.status_na_bancada'),
    "Testes / Setup": t('dashboard.status_testes'),
    "Pronto para Entrega": t('dashboard.status_pronto_entrega')
  };
  return mapa[fase] || fase;
}

function corFase(fase) {
  return osService.corFase(fase);
}

function formatarData(dataIso) {
  if (!dataIso) return "--/--";
  const dataSegura = dataIso.includes("T") ? dataIso : dataIso + "T12:00:00";
  return new Date(dataSegura).toLocaleDateString("pt-BR");
}

function formatarDataCurta(dataIso) {
  if (!dataIso) return "";
  return new Date(dataIso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function diasAguardando(dataConclusao) {
  if (!dataConclusao) return 0;
  const dataRef = new Date(dataConclusao.includes("T") ? dataConclusao : dataConclusao + "T12:00:00");
  const hoje = new Date();
  const diffTime = hoje - dataRef;
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

function getAtrasoConfig(dataConclusao) {
  if (!dataConclusao) {
    return { bg: '#fff', borderLeft: '1px solid var(--border)', textColor: 'var(--text-muted)', icon: 'event_busy', fontWeight: 'normal', isCritical: false };
  }
  
  const dias = diasAguardando(dataConclusao);
  
  if (dias <= 30) {
    // 0 a 30 dias (Acesso leve/Amarelo suave)
    return { bg: '#fff', borderLeft: '4px solid #fcd34d', textColor: '#b45309', icon: 'schedule', fontWeight: 'normal', isCritical: false };
  } else if (dias <= 60) {
    // 31 a 60 dias (Atraso moderado/Laranja)
    return { bg: '#fff7ed', borderLeft: '4px solid #f97316', textColor: '#c2410c', icon: 'assignment_late', fontWeight: 'bold', isCritical: false };
  } else {
    // Mais de 60 dias (Crítico/Vermelho)
    return { bg: '#fef2f2', borderLeft: '4px solid var(--danger)', textColor: 'var(--danger)', icon: 'warning', fontWeight: 'bold', isCritical: true };
  }
}

const totalFaturamentoParado = computed(() => {
  return faturamentoParado.value.reduce((acc, os) => acc + os.saldoDevedor, 0);
});

onMounted(() => {
  const salvo = localStorage.getItem('luthierapp_alertas_state');
  if (salvo) {
    try {
      estadoAvisos.value = { ...estadoAvisos.value, ...JSON.parse(salvo) };
    } catch(e) {}
  }
  carregarDadosIniciais();
});
</script>

<template>
  <div class="dash-container">
    <div v-if="avisosFechadosComItens.length > 0" class="card" style="margin-bottom: 25px; padding: 10px 20px; display: flex; align-items: center; gap: 10px; background: #fdfdfd; border: 1px dashed var(--border);">
      <span class="icon-dinamico" style="color: var(--text-muted);">notifications_paused</span>
      <span style="font-weight: bold; color: var(--text-main); font-size: 0.95rem;">{{ $t('dashboard.avisos_ocultos') }}</span>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button v-for="aviso in avisosFechadosComItens" :key="aviso.id" @click="reabrirAviso(aviso.id)" class="btn-outline" style="padding: 4px 10px; font-size: 0.85rem; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
          <span class="icon-dinamico" :style="{color: aviso.color, fontSize: '1rem'}">{{ aviso.icon }}</span> {{ aviso.label }}
        </button>
      </div>
    </div>

    <div
      v-if="alertasEstoque.length > 0 && estadoAvisos.estoque !== 'fechado'"
      id="tour-alertas"
      class="crm-box card"
      style="border-color: var(--danger)"
    >
      <div class="crm-header" style="background: var(--danger)">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h3 style="margin: 0; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span class="icon-dinamico">running_with_errors</span> {{ $t('dashboard.alertas_estoque') }}
          </h3>
          <span class="badge-crm" style="color: var(--danger)">{{ $t('dashboard.itens_qtd', { qtd: alertasEstoque.length }) }}</span>
        </div>
        <div class="crm-header-actions" style="display: flex; gap: 5px;">
          <button type="button" class="btn-icon-header" @click="toggleMinimizar('estoque')" :title="estadoAvisos.estoque === 'minimizado' ? $t('dashboard.oculto_expandir') : $t('dashboard.oculto_minimizar')">
            <span class="icon-dinamico">{{ estadoAvisos.estoque === 'minimizado' ? 'expand_more' : 'expand_less' }}</span>
          </button>
          <button type="button" class="btn-icon-header" @click="fecharAviso('estoque')" :title="$t('dashboard.oculto_fechar')">
            <span class="icon-dinamico">close</span>
          </button>
        </div>
      </div>
      <div v-show="estadoAvisos.estoque === 'aberto'">
        <div class="crm-list" style="padding-top: 15px">
        <div
          v-for="item in alertasEstoque"
          :key="item.id"
          class="crm-item"
          style="border-left: 4px solid var(--danger)"
        >
          <div class="crm-info">
            <strong style="color: var(--danger); font-size: 1.1rem">{{
              item.nome
            }}</strong>
            <span style="color: var(--text-main); font-size: 0.9rem">
              {{ $t('dashboard.estoque_atual') }}
              <strong style="font-size: 1.1rem">{{
                item.quantidade_estoque
              }}</strong>
              <span class="text-muted">
                {{ $t('dashboard.estoque_minimo_rec', { min: item.estoque_minimo }) }}</span
              >
            </span>
          </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="oportunidadesPosVenda.length > 0 && estadoAvisos.posVenda !== 'fechado'" id="tour-pos-venda" class="crm-box card">
      <div class="crm-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h3 style="margin: 0; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span class="icon-dinamico">lightbulb</span> {{ $t('dashboard.retencao_clientes') }}
          </h3>
          <span class="badge-crm">{{ $t('dashboard.pendentes_qtd', { qtd: oportunidadesPosVenda.length }) }}</span>
        </div>
        <div class="crm-header-actions" style="display: flex; gap: 5px;">
          <button type="button" class="btn-icon-header" @click="toggleMinimizar('posVenda')" :title="estadoAvisos.posVenda === 'minimizado' ? $t('dashboard.oculto_expandir') : $t('dashboard.oculto_minimizar')">
            <span class="icon-dinamico">{{ estadoAvisos.posVenda === 'minimizado' ? 'expand_more' : 'expand_less' }}</span>
          </button>
          <button type="button" class="btn-icon-header" @click="fecharAviso('posVenda')" :title="$t('dashboard.oculto_fechar')">
            <span class="icon-dinamico">close</span>
          </button>
        </div>
      </div>
      <div v-show="estadoAvisos.posVenda === 'aberto'">
        <p style="margin: 10px 0 15px 0; font-size: 0.9rem; color: #555; padding: 0 20px;">
          {{ $t('dashboard.retencao_desc') }}
        </p>

        <div class="crm-list">
        <div
          v-for="opp in oportunidadesPosVenda"
          :key="opp.id"
          class="crm-item"
        >
          <div class="crm-info">
            <strong style="color: var(--primary); font-size: 1.1rem">{{
              opp.instrumentos?.cliente?.nome
            }}</strong>
            <span style="font-weight: bold; color: var(--text-muted)"
              >{{ opp.instrumentos?.marca }}
              {{ opp.instrumentos?.modelo }}</span
            >
            <small style="color: var(--danger)"
              >{{ $t('dashboard.entregue_em') }} {{ formatarData(opp.data_conclusao) }}</small
            >
          </div>

          <div class="crm-actions-container">
            <button type="button"
              class="btn-accent"
              @click="chamarClientePosVenda(opp)"
              style="width: 100%; margin-bottom: 8px;"
            >
              <span class="icon-dinamico">chat</span> {{ $t('dashboard.chamar_zap') }}
            </button>
            <div
              class="crm-actions-secundary"
              style="display: flex; gap: 8px; margin-top: 8px"
            >
              <button type="button"
                class="btn-icon bg-light"
                @click="adiarPosVenda(opp.id, 15)"
                :title="$t('dashboard.lembrar_15_dias_title')"
                style="
                  flex: 1;
                  font-size: 0.85rem;
                  border: 1px solid var(--border);
                  border-radius: 4px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 4px;
                "
              >
                <span class="icon-dinamico" style="font-size: 1rem"
                  >schedule</span>
                {{ $t('dashboard.adiar_15d') }}
              </button>
              <button type="button"
                class="btn-icon bg-light text-success"
                @click="marcarComoContatado(opp.id)"
                :title="$t('dashboard.marcar_concluido_title')"
                style="
                  flex: 1;
                  font-size: 0.85rem;
                  border: 1px solid var(--border);
                  border-radius: 4px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 4px;
                "
              >
                <span class="icon-dinamico" style="font-size: 1rem"
                  >check_circle</span
                >
                {{ $t('dashboard.ja_falei') }}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="faturamentoParado.length > 0 && estadoAvisos.faturamento !== 'fechado'" id="tour-faturamento-parado" class="crm-box card">
      <div class="crm-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h3 style="margin: 0; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span class="icon-dinamico">savings</span> {{ $t('dashboard.faturamento_parado') }}
          </h3>
          <span class="badge-crm">R$ {{ totalFaturamentoParado.toFixed(2) }}</span>
        </div>
        <div class="crm-header-actions" style="display: flex; gap: 5px;">
          <button type="button" class="btn-icon-header" @click="toggleMinimizar('faturamento')" :title="estadoAvisos.faturamento === 'minimizado' ? $t('dashboard.oculto_expandir') : $t('dashboard.oculto_minimizar')">
            <span class="icon-dinamico">{{ estadoAvisos.faturamento === 'minimizado' ? 'expand_more' : 'expand_less' }}</span>
          </button>
          <button type="button" class="btn-icon-header" @click="fecharAviso('faturamento')" :title="$t('dashboard.oculto_fechar')">
            <span class="icon-dinamico">close</span>
          </button>
        </div>
      </div>
      <div v-show="estadoAvisos.faturamento === 'aberto'">
        <p style="margin: 10px 0 15px 0; font-size: 0.9rem; color: #555; padding: 0 20px;">
          {{ $t('dashboard.faturamento_desc') }}
        </p>

        <div class="crm-list">
        <div
          v-for="os in faturamentoParado"
          :key="os.id"
          class="crm-item"
          :style="`border-left: ${getAtrasoConfig(os.data_conclusao).borderLeft}; background: ${getAtrasoConfig(os.data_conclusao).bg};`"
        >
          <div class="crm-info">
            <strong :style="{ color: getAtrasoConfig(os.data_conclusao).isCritical ? 'var(--danger)' : 'var(--primary)', fontSize: '1.1rem' }">{{
              os.instrumentos?.cliente?.nome
            }}</strong>
            <span style="font-weight: bold; color: var(--text-muted)"
              >{{ os.instrumentos?.marca }}
              {{ os.instrumentos?.modelo }} (O.S. #{{ os.numero_os }})</span
            >
            <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px;">
              <small style="color: var(--warning); font-weight: bold; font-size: 0.95rem"
                >{{ $t('dashboard.saldo_devedor_rs', { valor: os.saldoDevedor.toFixed(2) }) }}</small
              >
              <template v-if="os.data_conclusao">
                <small :style="{ color: getAtrasoConfig(os.data_conclusao).textColor, fontWeight: getAtrasoConfig(os.data_conclusao).fontWeight }">
                  <span class="icon-dinamico" style="font-size: 0.9rem; vertical-align: middle;">{{ getAtrasoConfig(os.data_conclusao).icon }}</span>
                  {{ $t('dashboard.pronto_em', { data: formatarData(os.data_conclusao), dias: diasAguardando(os.data_conclusao) }) }}
                </small>
                <small v-if="getAtrasoConfig(os.data_conclusao).isCritical" style="color: var(--danger); font-weight: bold; margin-top: 4px;">
                  {{ $t('dashboard.aviso_60_dias') }}
                </small>
              </template>
              <template v-else>
                <small style="color: var(--text-muted);">
                  <span class="icon-dinamico" style="font-size: 0.9rem; vertical-align: middle;">event_busy</span>
                  {{ $t('dashboard.pronto_sem_data') }}
                </small>
              </template>
            </div>
          </div>

          <div class="crm-actions-container">
            <button type="button"
              class="btn-primary"
              @click="$emit('abrirOS', os)"
              style="width: 100%; margin-bottom: 8px;"
            >
              <span class="icon-dinamico">visibility</span> {{ $t('dashboard.ver_os') }}
            </button>
            <button type="button"
              class="btn-accent"
              @click="chamarClienteCobranca(os)"
              style="width: 100%;"
            >
              <span class="icon-dinamico">chat</span> {{ $t('dashboard.avisar_retirada') }}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>

    <div
      style="
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      "
    >
      <h2
        style="
          color: var(--primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">handyman</span> {{ $t('dashboard.bancada_trabalho') }}
      </h2>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: nowrap;">
        <!-- Busca Inline -->
        <div v-if="isBuscandoCliente" style="position: relative; z-index: 10;">
          <div style="display: flex; align-items: center; gap: 5px; background: #fff; border: 1px solid var(--primary); border-radius: 6px; padding: 2px;">
            <span class="icon-dinamico" style="color: var(--primary); padding-left: 8px;">search</span>
            <input 
              id="inputBuscaOS"
              v-model="textoBuscaCliente" 
              type="text" 
              class="input-padrao" 
              :placeholder="$t('dashboard.buscar_cliente_placeholder') || 'Digite o nome ou número...'"
              style="border: none; outline: none; background: transparent; padding: 6px 8px; width: 220px;"
              @blur="setTimeout(() => { if (!textoBuscaCliente) isBuscandoCliente = false; }, 200)"
            />
            <button class="btn-icon" style="color: var(--danger)" @click="isBuscandoCliente = false; textoBuscaCliente = ''">
              <span class="icon-dinamico">close</span>
            </button>
          </div>
          
          <div v-if="textoBuscaCliente.length >= 2" style="position: absolute; top: 100%; left: 0; width: 100%; background: white; border: 1px solid var(--border); border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto;">
            <div v-if="loadingBuscaCliente" style="padding: 10px; text-align: center; color: var(--text-muted);">
              {{ $t('dashboard.buscando') || 'Buscando...' }}
            </div>
            <div v-else-if="resultadosBuscaCliente.length === 0" style="padding: 10px; text-align: center; color: var(--text-muted);">
              {{ $t('dashboard.nenhum_cliente_encontrado') || 'Nenhum encontrado.' }}
            </div>
            <div v-else>
              <div 
                v-for="cli in resultadosBuscaCliente" 
                :key="cli.id" 
                @click="handleClienteSelecionado(cli)"
                style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;"
                onmouseover="this.style.background='var(--bg-body)'"
                onmouseout="this.style.background='white'"
              >
                <strong>{{ cli.nome }}</strong>
                <span style="font-size: 0.8rem; color: var(--text-muted)">{{ cli.celular || 'Sem número' }}</span>
              </div>
            </div>
          </div>
        </div>
        <button 
          v-else
          type="button" 
          class="btn-primary" 
          @click="abrirBuscaNovaOS"
          style="display: flex; align-items: center; gap: 5px;"
        >
          <span class="icon-dinamico">add_circle</span> {{ $t('dashboard.nova_os') || 'Nova O.S.' }}
        </button>

        <select v-model="filtroStatus" class="input-padrao" style="padding: 6px 10px; height: auto; font-weight: bold;" :style="{ color: filtroStatus !== 'Todos' ? corFase(filtroStatus) : 'inherit' }">
          <option value="Todos" style="color: initial;">{{ $t('dashboard.todos_status') }}</option>
          <option value="Fila de Espera" :style="{ color: corFase('Fila de Espera'), fontWeight: 'bold' }">⚫ {{ $t('dashboard.status_fila_espera') }}</option>
          <option value="Na Bancada" :style="{ color: corFase('Na Bancada'), fontWeight: 'bold' }">🔵 {{ $t('dashboard.status_na_bancada') }}</option>
          <option value="Secagem / Cura" :style="{ color: corFase('Secagem / Cura'), fontWeight: 'bold' }">🟣 {{ $t('dashboard.status_secagem') }}</option>
          <option value="Testes / Setup" :style="{ color: corFase('Testes / Setup'), fontWeight: 'bold' }">🟦 {{ $t('dashboard.status_testes') }}</option>
          <option value="Aguardando Peças" :style="{ color: corFase('Aguardando Peças'), fontWeight: 'bold' }">🔴 {{ $t('dashboard.status_aguardando_pecas') }}</option>
          <option value="Pronto para Entrega" :style="{ color: corFase('Pronto para Entrega'), fontWeight: 'bold' }">🟢 {{ $t('dashboard.status_pronto_entrega') }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="text-muted text-center" style="padding: 40px">
      {{ $t('dashboard.preparar_bancada') }}
    </div>

    <div v-else-if="servicosAbertosFiltrados.length === 0" class="card empty-state">
      <p
        style="
          font-size: 1.1rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        "
      >
        <span
          class="icon-dinamico"
          style="color: var(--success); font-size: 1.5rem"
          >celebration</span
        >
        {{ $t('dashboard.bancada_vazia') }}
      </p>
    </div>

    <div v-else id="tour-bancada" class="grid-cards">
      <div
        v-for="os in servicosAbertosFiltrados"
        :key="os.id"
        class="card card-os"
        @click="$emit('abrirOS', os)"
      >
        <div
          class="status-badge"
          :style="{ backgroundColor: corFase(os.fase_projeto) }"
        >
          <span style="font-weight: bold"
            >#{{ os.numero_os }} - {{ traduzirFase(os.fase_projeto) || traduzirFase(os.status) }}</span
          >
        </div>

        <h3 class="modelo">{{ os.instrumentos?.modelo }}</h3>
        <span class="marca">{{ os.instrumentos?.marca }}</span>
        <div
          class="cliente"
          style="display: flex; align-items: center; gap: 6px"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; color: var(--text-muted)"
            >person</span
          >
          {{ os.instrumentos?.cliente?.nome }}
        </div>

        <p class="desc">
          {{
            os.descricao_cliente?.length > 50
              ? os.descricao_cliente.slice(0, 50) + "..."
              : os.descricao_cliente
          }}
        </p>

        <div v-if="os.ultima_atualizacao" class="ultima-atualizacao">
          <div class="atualizacao-header">
            <small
              >{{ $t('dashboard.ultima_anotacao', { data: formatarDataCurta(os.ultima_atualizacao.data_registro) }) }}</small
            >
          </div>
          <div class="atualizacao-body">
            <img
              v-if="os.ultima_atualizacao.foto_url"
              :src="os.ultima_atualizacao.foto_url"
              class="miniatura-diario"
            />
            <p class="texto-diario">
              {{
                os.ultima_atualizacao.descricao.length > 55
                  ? os.ultima_atualizacao.descricao.slice(0, 55) + "..."
                  : os.ultima_atualizacao.descricao
              }}
            </p>
          </div>
        </div>
        <div v-else style="flex-grow: 1"></div>

        <div class="footer-card">
          <small>{{ $t('dashboard.entrada') }} {{ formatarData(os.data_entrada) }}</small>
          <small
            v-if="os.data_previsao_entrega"
            style="color: var(--danger); font-weight: bold"
          >
            {{ $t('dashboard.prazo') }} {{ formatarData(os.data_previsao_entrega) }}
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash-container {
  margin-bottom: 30px;
}

/* CRM ESTILOS */
.crm-box {
  border: 2px solid var(--accent);
  background: #fffdfa;
  margin-bottom: 30px;
  padding: 0;
  overflow: hidden;
}
.crm-header {
  background: var(--accent);
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.badge-crm {
  background: #fff;
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 0.85rem;
}
.btn-icon-header {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: background 0.2s;
}
.btn-icon-header:hover {
  background: rgba(255, 255, 255, 0.4);
}
.crm-list {
  padding: 0 20px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.crm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border: 1px solid var(--border);
  padding: 15px;
  border-radius: 6px;
  flex-wrap: wrap;
  gap: 15px;
}
.crm-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.crm-actions-container {
  display: flex;
  flex-direction: column;
  min-width: 180px;
}

/* GRID DE CARDS DA BANCADA */
.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.card-os {
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.card-os:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
  border-color: var(--accent);
}
.status-badge {
  position: absolute;
  top: 0;
  right: 0;
  padding: 5px 12px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: bold;
  border-bottom-left-radius: 8px;
  box-shadow: -2px 2px 5px rgba(0, 0, 0, 0.1);
}
.modelo {
  margin: 15px 0 2px 0;
  font-size: 1.2rem;
  color: var(--primary);
}
.marca {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.cliente {
  margin: 12px 0;
  font-size: 0.95rem;
  color: var(--text-main);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  font-weight: 500;
}
.desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
  margin-bottom: 10px;
}

/* MINIATURA DO DIÁRIO */
.ultima-atualizacao {
  background: #fdfdfd;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 15px;
  flex-grow: 1;
}
.atualizacao-header {
  margin-bottom: 5px;
  color: var(--accent);
  font-weight: bold;
}
.atualizacao-body {
  display: flex;
  gap: 10px;
  align-items: center;
}
.miniatura-diario {
  width: 45px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.texto-diario {
  font-size: 0.8rem;
  color: var(--text-main);
  margin: 0;
  line-height: 1.3;
}

.footer-card {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: auto;
  background: var(--bg-body);
  padding: 8px;
  border-radius: 4px;
}
.empty-state {
  text-align: center;
  padding: 40px;
}

@media (max-width: 600px) {
  .crm-item {
    flex-direction: column;
    align-items: flex-start;
  }
  .crm-actions-container {
    width: 100%;
  }
}
</style>
