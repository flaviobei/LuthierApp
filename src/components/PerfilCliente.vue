<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { osService } from '../services/osService';
import { clienteService } from '../services/clienteService';
import { useToast } from '../composables/useToast';
import InstrumentoManager from './InstrumentoManager.vue';
import ClienteForm from './ClienteForm.vue';

const props = defineProps({
  cliente: {
    type: Object,
    required: true
  }
});
const emit = defineEmits(['voltar', 'selecionarInstrumento', 'clienteAtualizado']);

const { triggerToast } = useToast();
const servicos = ref([]);
const loading = ref(true);
const observacoes = ref('');
const salvandoObs = ref(false);
const mostrarModalCliente = ref(false);

onMounted(async () => {
  observacoes.value = props.cliente.observacoes || '';
  await carregarServicos();
});

watch(() => props.cliente, async (novoCliente) => {
  if (novoCliente) {
    observacoes.value = novoCliente.observacoes || '';
    await carregarServicos();
  }
});

async function carregarServicos() {
  loading.value = true;
  try {
    servicos.value = await osService.buscarServicosPorCliente(props.cliente.id);
  } catch (e) {
    triggerToast('Erro ao carregar serviços do cliente: ' + e.message, 'error');
  } finally {
    loading.value = false;
  }
}

async function salvarObservacoes() {
  salvandoObs.value = true;
  try {
    await clienteService.atualizar(props.cliente.id, { observacoes: observacoes.value });
    props.cliente.observacoes = observacoes.value; // Atualiza a prop local
    triggerToast('Anotações salvas com sucesso!', 'success');
  } catch (e) {
    triggerToast('Erro ao salvar anotações. Verifique se a coluna "observacoes" existe no Supabase. ' + e.message, 'error');
  } finally {
    salvandoObs.value = false;
  }
}

// KPIs
const totalGasto = computed(() => {
  return servicos.value.reduce((acc, os) => acc + os.totalPago, 0);
});
const osAtivas = computed(() => {
  return servicos.value.filter(os => os.status !== 'Entregue' && os.status !== 'Finalizado').length;
});
const totalOs = computed(() => servicos.value.length);

function formatarLinkZap(t) {
  const n = t?.replace(/\D/g, "");
  return n?.length <= 11 ? `55${n}` : n;
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}
</script>

<template>
  <div class="perfil-cliente-container fade-in">
    <!-- CABEÇALHO COMPACTO -->
    <div class="header-perfil card" style="padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <button type="button" class="btn-icon" @click="emit('voltar')" :title="$t('perfil.voltar_clientes')" style="background: var(--bg-body); border-radius: 50%;">
          <span class="icon-dinamico">arrow_back</span>
        </button>
        <h2 style="color: var(--text-main); margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 6px;">
          <span class="icon-dinamico" style="color: var(--primary);">account_circle</span>
          {{ cliente.nome }}
        </h2>
        
        <a v-if="cliente.telefone" :href="'https://wa.me/' + formatarLinkZap(cliente.telefone)" target="_blank" class="badge-zap">
          <span class="icon-dinamico" style="font-size: 0.9rem">chat</span> {{ cliente.telefone }}
        </a>
      </div>

      <button type="button" class="btn-outline" @click="mostrarModalCliente = true" style="padding: 4px 10px; font-size: 0.85rem;">
        <span class="icon-dinamico" style="font-size: 1rem;">edit</span> {{ $t('geral.editar') }}
      </button>
    </div>

    <!-- MODAL DE EDIÇÃO DE CLIENTE -->
    <div v-if="mostrarModalCliente" class="modal-overlay" @click.self="mostrarModalCliente = false">
      <div class="modal-content card fade-in" style="max-width: 500px; width: 100%; position: relative;">
        <ClienteForm
          :clienteEdit="cliente"
          @clienteSalvo="() => { mostrarModalCliente = false; emit('clienteAtualizado'); }"
          @cancelarEdicao="mostrarModalCliente = false"
        />
      </div>
    </div>

    <div class="layout-grid">
      <!-- COLUNA ESQUERDA: KPIs e Anotações -->
      <div class="col-kpis">
        <div class="kpi-box card">
          <span class="icon-dinamico kpi-icon text-success">payments</span>
          <div class="kpi-text">
            <span class="kpi-label">{{ $t('perfil.total_gasto') }}</span>
            <span class="kpi-value text-success">{{ formatarMoeda(totalGasto) }}</span>
          </div>
        </div>
        
        <div class="kpi-box card">
          <span class="icon-dinamico kpi-icon text-warning">build</span>
          <div class="kpi-text">
            <span class="kpi-label">{{ $t('perfil.os_ativas') }}</span>
            <span class="kpi-value">{{ osAtivas }}</span>
          </div>
        </div>
        
        <div class="kpi-box card">
          <span class="icon-dinamico kpi-icon text-primary">history</span>
          <div class="kpi-text">
            <span class="kpi-label">{{ $t('perfil.total_os') }}</span>
            <span class="kpi-value">{{ totalOs }}</span>
          </div>
        </div>

        <div class="anotacoes-box card">
          <h3 style="margin-top:0; color: var(--text-main); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <span class="icon-dinamico">notes</span> {{ $t('perfil.anotacoes_internas') }}
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">
            {{ $t('perfil.salvar_preferencias') }}
          </p>
          <textarea 
            v-model="observacoes" 
            class="input-padrao" 
            rows="5" 
            placeholder="Ex: Cliente prefere encordoamento Elixir 0.10..."
            style="resize: vertical; margin-bottom: 10px; width: 100%; box-sizing: border-box;"
          ></textarea>
          <button type="button" class="btn-primary" @click="salvarObservacoes" :disabled="salvandoObs" style="width: 100%; justify-content: center;">
            <span class="icon-dinamico" v-if="!salvandoObs">save</span>
            <span class="icon-dinamico spinning" v-else>sync</span>
            {{ salvandoObs ? $t('perfil.salvando') : $t('perfil.salvar_anotacoes') }}
          </button>
        </div>
      </div>

      <!-- COLUNA DIREITA: Instrumentos e Histórico -->
      <div class="col-detalhes">
        <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 20px;">
          <div style="padding: 20px;">
             <h3 style="margin-top:0; color: var(--text-main); font-size: 1.2rem; display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
              {{ $t('perfil.instrumentos') }}
            </h3>
            <InstrumentoManager 
              :clienteId="cliente.id"
              :clienteNome="cliente.nome"
              @selecionarInstrumento="inst => emit('selecionarInstrumento', inst)"
            />
          </div>
        </div>

        <div class="card" style="padding: 20px;">
           <h3 style="margin-top:0; color: var(--text-main); font-size: 1.2rem; display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
            <span class="icon-dinamico">work_history</span> {{ $t('perfil.historico_os') }}
          </h3>
          <div v-if="loading" class="full-center" style="padding: 20px;">
             <span class="icon-dinamico spinning" style="font-size: 2rem; color: var(--primary);">sync</span>
          </div>
          <div v-else-if="servicos.length === 0" class="full-center" style="padding: 30px; color: var(--text-muted); flex-direction: column;">
            <span class="icon-dinamico" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.5;">inbox</span>
            <p>{{ $t('perfil.nenhuma_os_registrada') }}</p>
          </div>
          <div v-else class="tabela-responsiva">
            <table class="tabela-padrao">
              <thead>
                <tr>
                  <th>{{ $t('perfil.coluna_os') }}</th>
                  <th>{{ $t('perfil.coluna_instrumento') }}</th>
                  <th>{{ $t('perfil.coluna_entrada') }}</th>
                  <th>{{ $t('perfil.coluna_status') }}</th>
                  <th>{{ $t('perfil.coluna_total') }}</th>
                  <th>{{ $t('perfil.coluna_pago') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="os in servicos" :key="os.id">
                  <td><strong>#{{ os.numero_os || os.id }}</strong></td>
                  <td>{{ os.instrumentos?.marca }} {{ os.instrumentos?.modelo }}</td>
                  <td>{{ formatarData(os.created_at) }}</td>
                  <td>
                    <span class="badge" :class="os.status === 'Entregue' ? 'bg-success' : 'bg-primary'">
                      {{ os.status }}
                    </span>
                  </td>
                  <td>{{ formatarMoeda(os.totalOrcamento) }}</td>
                  <td>
                    <span :class="os.totalPago >= os.totalOrcamento && os.totalOrcamento > 0 ? 'text-success' : 'text-danger'" style="font-weight: bold;">
                      {{ formatarMoeda(os.totalPago) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.perfil-cliente-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.header-perfil {
  position: relative;
}
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 15px;
}
.modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  max-height: 90vh;
  overflow-y: auto;
}
.contatos-cliente {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 15px;
}
.badge-zap {
  background: #25d366;
  color: #fff;
  padding: 6px 12px;
  border-radius: 12px;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.2s;
}
.badge-zap:hover {
  opacity: 0.9;
}
.badge-info {
  background: var(--bg-body);
  border: 1px solid var(--border);
  color: var(--text-main);
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.layout-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  align-items: flex-start;
}
.col-kpis {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.kpi-box {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
}
.kpi-icon {
  font-size: 2.5rem;
}
.kpi-text {
  display: flex;
  flex-direction: column;
}
.kpi-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: bold;
}
.kpi-value {
  font-size: 1.5rem;
  font-weight: bold;
}
.anotacoes-box {
  padding: 20px;
}

@media (max-width: 900px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }
}
</style>
