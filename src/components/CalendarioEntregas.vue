<script setup>
/**
 * ============================================================================
 * @file        CalendarioEntregas.vue
 * @description Módulo de agendamento e prazos.
 * ATUALIZAÇÃO: Destaque visual inteligente para o dia atual (Hoje).
 * ============================================================================
 */

import { ref, computed, onMounted } from "vue";
import { osService } from "../services/osService";
import { useToast } from "../composables/useToast";

const emit = defineEmits(["abrirOS", "voltar"]);
const { triggerToast } = useToast();

const dataAtual = ref(new Date());
const servicos = ref([]);
const carregando = ref(true);

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

// Gera a data de HOJE no formato ISO (YYYY-MM-DD) baseado no fuso local do navegador
const hojeIso = computed(() => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
});

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
    listaDias.push({
      dia: d,
      dataIso: dataIso,
      isHoje: dataIso === hojeIso.value, // MÁGICA: Flag para saber se é hoje
    });
  }
  return listaDias;
});

/**
 * CARREGAMENTO VIA SERVICE
 */
async function carregarServicos() {
  carregando.value = true;
  try {
    servicos.value = await osService.buscarParaCalendario();
  } catch (error) {
    triggerToast("Erro ao carregar a agenda: " + error.message, "error");
  } finally {
    carregando.value = false;
  }
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
  if (os.data_previsao_entrega < hojeIso.value) return "bg-danger"; // Atrasado
  if (os.data_previsao_entrega === hojeIso.value) return "bg-warning"; // Hoje
  return "bg-primary"; // No prazo
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
        <h2 style="margin: 0; display: flex; align-items: center; gap: 8px">
          <span class="icon-dinamico" style="font-size: 1.8rem"
            >calendar_month</span
          >
          Agenda de
          <span style="color: var(--primary)">{{ mesAtualNome }}</span>
          {{ anoAtual }}
        </h2>

        <div style="display: flex; gap: 15px; align-items: center">
          <div class="btn-group" style="display: flex; gap: 5px">
            <button type="button" class="btn-outline" @click="mudarMes(-1)">◀</button>
            <button type="button" class="btn-outline" @click="dataAtual = new Date()">
              Mês Atual
            </button>
            <button type="button" class="btn-outline" @click="mudarMes(1)">▶</button>
          </div>
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

    <div v-else>
      <div class="aviso-mobile card">
        <h3
          style="
            color: var(--accent);
            margin-top: 0;
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico" style="font-size: 1.5rem"
            >event_busy</span
          >
          Vista Indisponível
        </h3>
        <p class="text-muted">
          A agenda em formato de calendário necessita de um ecrã mais largo para
          ser legível. Por favor, aceda a esta funcionalidade através de um
          Tablet ou Computador.
        </p>
        <button type="button"
          class="btn-primary"
          @click="$emit('voltar')"
          style="
            margin-top: 15px;
            width: 100%;
            padding: 12px;
            font-size: 1.1rem;
          "
        >
          &larr; Voltar à Bancada
        </button>
      </div>

      <div class="calendario-grid">
        <div v-for="d in diasDaSemana" :key="d" class="dia-semana-label">
          {{ d }}
        </div>

        <div
          v-for="(item, index) in diasNoMes"
          :key="index"
          class="dia-celula"
          :class="{
            vazio: !item.dia,
            'celula-hoje': item.isHoje,
          }"
        >
          <div
            v-if="item.dia"
            class="dia-numero"
            :class="{ 'numero-hoje': item.isHoje }"
          >
            {{ item.dia }}
          </div>

          <div class="lista-servicos-dia">
            <div
              v-for="os in getServicosNoDia(item.dataIso)"
              :key="os.id"
              class="badge-os"
              :class="getStatusCor(os)"
              @click="$emit('abrirOS', os)"
              title="Clique para abrir esta O.S."
            >
              <strong>#{{ os.numero_os }}</strong> -
              {{ os.instrumentos?.modelo }}
              <div class="os-cliente">{{ os.instrumentos?.cliente?.nome }}</div>
            </div>
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

/* Esconde o aviso por padrão no computador */
.aviso-mobile {
  display: none;
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
  position: relative; /* Para garantir sobreposições se necessário */
}
.dia-celula:hover:not(.vazio) {
  background: #f1f5f9;
}
.dia-celula.vazio {
  background: #f8fafc;
}

/* ========================================= */
/* DESTAQUE DO DIA DE HOJE                   */
/* ========================================= */
.celula-hoje {
  /* Usa a cor primária (Azul Marinho/Escuro) com 5% de opacidade */
  background-color: color-mix(
    in srgb,
    var(--primary) 5%,
    transparent
  ) !important;
  /* Uma borda suave interna para enquadrar o dia atual */
  box-shadow: inset 0 0 0 2px
    color-mix(in srgb, var(--primary) 30%, transparent);
}

.dia-numero {
  font-weight: bold;
  color: #94a3b8;
  margin-bottom: 5px;
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
}

.numero-hoje {
  background-color: var(--primary);
  color: white;
}

/* ========================================= */

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

/* ========================================= */
/* 📱 MODO MOBILE (Esconde o calendário!)   */
/* ========================================= */
@media (max-width: 900px) {
  .calendario-grid {
    display: none !important;
  }

  .calendario-header {
    display: none !important;
  }

  .aviso-mobile {
    display: block !important;
    text-align: center;
    padding: 40px 20px;
    margin-top: 20px;
  }
}
</style>
