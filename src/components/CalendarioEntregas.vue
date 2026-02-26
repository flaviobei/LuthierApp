<script setup>
/**
 * ============================================================================
 * @file        CalendarioEntregas.vue
 * @description Módulo de agendamento e prazos. Oferece uma visão mensal
 * das entregas previstas, permitindo ao luthier gerir o fluxo de saída
 * dos instrumentos e evitar atrasos. Apenas mostra O.S. ativas.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, computed, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast"; // <-- Adicionado

const emit = defineEmits(["abrirOS", "voltar"]);
const { triggerToast } = useToast(); // <-- Inicializado

const dataAtual = ref(new Date());
const servicos = ref([]);
const carregando = ref(true);

// --- LÓGICA DO CALENDÁRIO ---
const diasDaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const meses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const mesAtualNome = computed(() => meses[dataAtual.value.getMonth()]);
const anoAtual = computed(() => dataAtual.value.getFullYear());

const diasNoMes = computed(() => {
  const ano = dataAtual.value.getFullYear();
  const mes = dataAtual.value.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();

  const listaDias = [];
  for (let i = 0; i < primeiroDia; i++) {
    listaDias.push({ dia: null, dataIso: null });
  }
  for (let d = 1; d <= ultimoDia; d++) {
    const dataIso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    listaDias.push({ dia: d, dataIso });
  }
  return listaDias;
});

async function carregarServicos() {
  carregando.value = true;

  const { data, error } = await supabase
    .from("servicos")
    .select(`*, instrumentos (marca, modelo, cliente:clientes (nome))`)
    .neq("status", "Entregue") // <-- FILTRO 1: Ignora Entregues
    .neq("status", "Finalizado") // <-- FILTRO 2: Ignora Finalizados
    .not("data_previsao_entrega", "is", null);

  if (error) {
    triggerToast("Erro ao carregar a agenda: " + error.message, "error");
  } else if (data) {
    servicos.value = data;
  }

  carregando.value = false;
}

function getServicosNoDia(dataIso) {
  return servicos.value.filter((s) => s.data_previsao_entrega === dataIso);
}

function mudarMes(delta) {
  dataAtual.value = new Date(
    dataAtual.value.getFullYear(),
    dataAtual.value.getMonth() + delta,
    1,
  );
}

function getStatusCor(os) {
  const hoje = new Date().toISOString().substring(0, 10);
  if (os.data_previsao_entrega < hoje) return "bg-danger"; // Atrasado
  if (os.data_previsao_entrega === hoje) return "bg-warning"; // É Hoje
  return "bg-primary"; // Futuro
}

onMounted(carregarServicos);
</script>

<template>
  <div class="calendario-container">
    <div class="calendario-header card">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        "
      >
        <h2 style="margin: 0">
          📅 Agenda de
          <span style="color: var(--primary)">{{ mesAtualNome }}</span>
          {{ anoAtual }}
        </h2>

        <div style="display: flex; gap: 15px; align-items: center">
          <div class="btn-group" style="display: flex; gap: 5px">
            <button class="btn-outline" @click="mudarMes(-1)">◀</button>
            <button class="btn-outline" @click="dataAtual = new Date()">
              Mês Atual
            </button>
            <button class="btn-outline" @click="mudarMes(1)">▶</button>
          </div>
          <button class="btn-primary" @click="$emit('voltar')">
            Voltar à Bancada
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="carregando"
      class="card"
      style="text-align: center; padding: 40px"
    >
      A carregar compromissos...
    </div>

    <div v-else class="calendario-grid">
      <div v-for="d in diasDaSemana" :key="d" class="dia-semana-label">
        {{ d }}
      </div>

      <div
        v-for="(item, index) in diasNoMes"
        :key="index"
        class="dia-celula"
        :class="{ vazio: !item.dia }"
      >
        <div v-if="item.dia" class="dia-numero">{{ item.dia }}</div>

        <div class="lista-servicos-dia">
          <div
            v-for="os in getServicosNoDia(item.dataIso)"
            :key="os.id"
            class="badge-os"
            :class="getStatusCor(os)"
            @click="$emit('abrirOS', os)"
            title="Clique para abrir esta O.S."
          >
            <strong>#{{ os.numero_os }}</strong> - {{ os.instrumentos?.modelo }}
            <div class="os-cliente">{{ os.instrumentos?.cliente?.nome }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendario-container {
  text-align: left;
}
.calendario-header {
  margin-bottom: 15px;
}

.calendario-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #e2e8f0;
  gap: 1px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
}

.dia-semana-label {
  background: #f8fafc;
  padding: 10px;
  text-align: center;
  font-weight: bold;
  color: #64748b;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.dia-celula {
  background: white;
  min-height: 120px;
  padding: 8px;
  transition: 0.2s;
}

.dia-celula:hover:not(.vazio) {
  background: #f1f5f9;
}
.dia-celula.vazio {
  background: #f8fafc;
}

.dia-numero {
  font-weight: bold;
  color: #94a3b8;
  margin-bottom: 5px;
}
.lista-servicos-dia {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.badge-os {
  font-size: 0.75rem;
  padding: 4px 6px;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  line-height: 1.2;
}

.os-cliente {
  font-size: 0.65rem;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* CORES DOS STATUS */
.bg-primary {
  background-color: #3b82f6;
}
.bg-success {
  background-color: #10b981;
}
.bg-danger {
  background-color: #ef4444;
}
.bg-warning {
  background-color: #f59e0b;
  color: #000;
}

.badge-os:hover {
  filter: brightness(1.1);
  transform: scale(1.02);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@media (max-width: 900px) {
  .calendario-grid {
    grid-template-columns: repeat(1, 1fr);
  }
  .dia-celula {
    min-height: auto;
    border-bottom: 1px solid #eee;
  }
  .dia-celula.vazio {
    display: none;
  }
}
</style>
