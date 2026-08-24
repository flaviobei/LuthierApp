<script setup>
import { ref, watch } from 'vue';
import { supabase } from '../lib/supabaseClient';
import { useI18n } from 'vue-i18n';

const props = defineProps(['show']);
const emit = defineEmits(['close', 'selecionar']);
const { t } = useI18n();

const busca = ref("");
const resultados = ref([]);
const loading = ref(false);

watch(busca, async (newVal) => {
  if (newVal.length < 2) {
    resultados.value = [];
    return;
  }
  loading.value = true;
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, celular")
    .ilike("nome", `%${newVal}%`)
    .limit(10);
  
  if (!error && data) {
    resultados.value = data;
  }
  loading.value = false;
});

function selecionar(cliente) {
  emit('selecionar', cliente);
  busca.value = "";
  resultados.value = [];
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content" style="max-width: 500px; padding: 25px;">
      <h3 style="margin-top: 0; color: var(--primary); display: flex; align-items: center; gap: 8px;">
        <span class="icon-dinamico">search</span> {{ $t('dashboard.buscar_cliente_nova_os') || 'Buscar Cliente para Nova O.S.' }}
      </h3>
      
      <div style="position: relative; margin-bottom: 20px;">
        <span class="icon-dinamico" style="position: absolute; left: 12px; top: 12px; color: var(--text-muted);">person_search</span>
        <input 
          v-model="busca" 
          type="text" 
          class="input-padrao" 
          :placeholder="$t('dashboard.buscar_cliente_placeholder') || 'Digite o nome do cliente...'"
          style="padding-left: 40px; font-size: 1.05rem;"
          autofocus
        />
      </div>

      <div v-if="loading" style="text-align: center; color: var(--text-muted); padding: 15px;">
        {{ $t('dashboard.buscando') || 'Buscando...' }}
      </div>

      <div v-else-if="resultados.length > 0" class="lista-resultados">
        <div 
          v-for="cli in resultados" 
          :key="cli.id"
          class="resultado-item"
          @click="selecionar(cli)"
        >
          <strong>{{ cli.nome }}</strong>
          <span style="color: var(--text-muted); font-size: 0.85rem;">{{ cli.celular || 'Sem número' }}</span>
        </div>
      </div>
      
      <div v-else-if="busca.length >= 2" style="text-align: center; color: var(--text-muted); padding: 15px;">
        {{ $t('dashboard.nenhum_cliente_encontrado') || 'Nenhum cliente encontrado.' }}
      </div>
      <div v-else style="text-align: center; color: var(--text-muted); padding: 15px; font-size: 0.9rem;">
        {{ $t('dashboard.digite_2_letras') || 'Digite pelo menos 2 letras para buscar.' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.lista-resultados {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
.resultado-item {
  padding: 12px 15px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}
.resultado-item:last-child {
  border-bottom: none;
}
.resultado-item:hover {
  background: var(--bg-body);
}
</style>
