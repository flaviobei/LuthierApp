<script setup>
import { ref, computed } from "vue";
import { osService } from "../services/osService";

const props = defineProps({
  clientes: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['selecionarCliente', 'abrirOS', 'novoCliente']);

const busca = ref("");
const filtroAtividade = ref("todos"); // todos, ativos, sem_atividade

const clientesFiltrados = computed(() => {
  let filtrados = props.clientes;
  
  if (filtroAtividade.value === 'ativos') {
    filtrados = filtrados.filter(c => c.atividades && c.atividades.length > 0);
  } else if (filtroAtividade.value === 'sem_atividade') {
    filtrados = filtrados.filter(c => !c.atividades || c.atividades.length === 0);
  }

  if (busca.value.length >= 2) {
    const term = busca.value.toLowerCase();
    filtrados = filtrados.filter(c => 
      (c.nome && c.nome.toLowerCase().includes(term)) || 
      (c.celular && c.celular.includes(term))
    );
  }

  return filtrados;
});

function formatarLinkZap(t) {
  const n = t?.replace(/\D/g, "");
  return n?.length <= 11 ? `55${n}` : n;
}

function corFase(fase) {
  return osService.corFase(fase);
}
</script>

<template>
  <div class="clientes-lista-full card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
      <h3 class="title-section" style="margin: 0; border: none; padding: 0; min-width: max-content;">
        <span class="icon-dinamico" style="vertical-align: middle">folder_open</span>
        {{ $t("app.lista_clientes") }}
      </h3>
      
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <!-- Busca -->
        <div style="position: relative;">
          <span class="icon-dinamico" style="position: absolute; left: 10px; top: 6px; color: var(--text-muted); font-size: 1.1rem;">search</span>
          <input 
            v-model="busca" 
            type="text" 
            class="input-padrao" 
            :placeholder="$t('dashboard.buscar_cliente_placeholder') || 'Buscar cliente...'" 
            style="padding-left: 32px; width: 220px;"
          />
        </div>
        
        <!-- Filtro Atividade -->
        <select v-model="filtroAtividade" class="input-padrao" style="width: auto;">
          <option value="todos">Todos os Clientes</option>
          <option value="ativos">Com Serviços Ativos</option>
          <option value="sem_atividade">Sem Serviços Ativos</option>
        </select>
        
        <button type="button" class="btn-primary" @click="emit('novoCliente')">
          <span class="icon-dinamico">add</span> {{ $t('clientes.novo') }}
        </button>
      </div>
    </div>
    
    <div class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th>{{ $t("os.cliente") }}</th>
            <th>{{ $t('clientes.atividades_ativas') }}</th>
            <th>{{ $t("os.contato") }}</th>
            <th align="center">{{ $t('clientes.acoes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in clientesFiltrados" :key="c.id">
            <td>
              <strong>{{ c.nome }}</strong>
            </td>
            <td>
              <div v-if="c.atividades && c.atividades.length > 0" style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button
                  v-for="ativ in c.atividades"
                  :key="ativ.os_id"
                  @click="emit('abrirOS', { id: ativ.os_id })"
                  class="btn-outline tag-os"
                  :title="ativ.fase"
                  :style="{ borderLeft: `4px solid ${corFase(ativ.fase)}`, color: 'var(--text-main)' }"
                >
                  <span class="icon-dinamico" :style="{ color: corFase(ativ.fase), fontSize: '1.1rem' }">build_circle</span>
                  {{ ativ.marca }} {{ ativ.modelo }} - #{{ ativ.numero_os || ativ.os_id }}
                </button>
              </div>
              <span v-else style="color: var(--text-muted); font-size: 0.85rem;">{{ $t('clientes.nenhuma_atividade') }}</span>
            </td>
            <td>
              <a
                v-if="c.telefone"
                :href="'https://wa.me/' + formatarLinkZap(c.telefone)"
                target="_blank"
                class="badge-zap"
              >
                <span class="icon-dinamico" style="font-size: 1rem">chat</span>
                {{ $t('clientes.whatsapp') }}
              </a>
            </td>
            <td align="center">
              <button type="button" class="btn-outline" @click="emit('selecionarCliente', c)" :title="$t('clientes.ver_perfil')" style="padding: 6px 12px; font-size: 0.85rem;">
                <span class="icon-dinamico" style="font-size: 1rem;">account_circle</span> {{ $t('clientes.perfil') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.clientes-lista-full {
  margin-top: 10px;
  padding: 20px;
}
.title-section {
  color: var(--primary);
  font-size: 1.3rem;
}
.badge-zap {
  background: #25d366;
  color: #fff;
  padding: 4px 8px;
  border-radius: 12px;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tag-os {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 0.8rem;
  border-radius: 12px;
  background-color: var(--bg-body);
}
.tag-os:hover {
  background-color: var(--primary);
  color: var(--btn-primary-text);
  border-color: var(--primary);
}
</style>
