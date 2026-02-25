<script setup>
import { ref, computed, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";

const emit = defineEmits(["abrirOS", "voltar"]);
const historico = ref([]);
const loading = ref(true);
const termoBusca = ref("");

async function carregarHistorico() {
  loading.value = true;
  const { data, error } = await supabase
    .from("servicos")
    .select(
      `
      *,
      instrumentos ( marca, modelo, cliente:clientes (nome) )
    `,
    )
    .eq("status", "Entregue")
    .order("data_conclusao", { ascending: false });

  if (!error && data) {
    historico.value = data;
  }
  loading.value = false;
}

// Filtro de pesquisa em tempo real
const historicoFiltrado = computed(() => {
  if (!termoBusca.value) return historico.value;
  const termo = termoBusca.value.toLowerCase();

  return historico.value.filter((os) => {
    const numOS = String(os.numero_os).toLowerCase();
    const nomeCliente = os.instrumentos?.cliente?.nome?.toLowerCase() || "";
    const modeloInst = os.instrumentos?.modelo?.toLowerCase() || "";
    const marcaInst = os.instrumentos?.marca?.toLowerCase() || "";

    return (
      numOS.includes(termo) ||
      nomeCliente.includes(termo) ||
      modeloInst.includes(termo) ||
      marcaInst.includes(termo)
    );
  });
});

function formatarData(dataIso) {
  if (!dataIso) return "--/--";
  const dataSegura = dataIso.includes("T") ? dataIso : dataIso + "T12:00:00";
  return new Date(dataSegura).toLocaleDateString("pt-BR");
}

onMounted(() => carregarHistorico());
</script>

<template>
  <div class="card">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 10px;
      "
    >
      <h2 class="title-section" style="margin: 0; border: none">
        📦 Arquivo de Serviços Entregues
      </h2>
      <button class="btn-outline" @click="$emit('voltar')">
        &larr; Voltar à Bancada
      </button>
    </div>

    <div class="box mb-1" style="background: var(--bg-body)">
      <input
        v-model="termoBusca"
        placeholder="🔍 Buscar por Nº da O.S., Cliente, Marca ou Modelo..."
        style="width: 100%; font-size: 1.1rem; padding: 12px"
      />
    </div>

    <div v-if="loading" class="text-muted text-center" style="padding: 40px">
      A carregar arquivo da oficina...
    </div>

    <div
      v-else-if="historico.length === 0"
      class="text-muted text-center"
      style="padding: 40px"
    >
      Nenhum serviço entregue ainda. O seu histórico aparecerá aqui!
    </div>

    <div v-else class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th>O.S.</th>
            <th>Data de Entrega</th>
            <th>Cliente</th>
            <th>Instrumento</th>
            <th style="text-align: center">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="historicoFiltrado.length === 0">
            <td colspan="5" class="text-center text-muted">
              Nenhum resultado encontrado para a busca.
            </td>
          </tr>
          <tr v-for="os in historicoFiltrado" :key="os.id">
            <td>
              <strong style="color: var(--primary)">#{{ os.numero_os }}</strong>
            </td>
            <td>{{ formatarData(os.data_conclusao) }}</td>
            <td>{{ os.instrumentos?.cliente?.nome }}</td>
            <td>{{ os.instrumentos?.marca }} {{ os.instrumentos?.modelo }}</td>
            <td align="center">
              <button
                class="btn-icon bg-light"
                @click="$emit('abrirOS', os)"
                title="Abrir Histórico da O.S."
              >
                📂 Ver Ficha
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.text-center {
  text-align: center;
}
</style>
