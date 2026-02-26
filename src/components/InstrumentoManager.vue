<script setup>
/**
 * ============================================================================
 * @file        InstrumentoManager.vue
 * @description Gestor de instrumentos técnicos. Permite cadastrar marcas,
 * modelos e números de série, vinculando cada instrumento a um cliente.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast"; // <-- 1. Importa o Toast

const props = defineProps(["clienteId", "clienteNome"]);
const emit = defineEmits(["fechar", "selecionarInstrumento"]);

const { triggerToast } = useToast(); // <-- 2. Inicializa o Toast

const instrumentos = ref([]);
const form = ref({
  tipo: "Guitarra",
  marca: "",
  modelo: "",
  numero_serie: "",
  afinacao: "E Standard",
});
const loading = ref(false);

async function buscarInstrumentos() {
  const { data } = await supabase
    .from("instrumentos")
    .select("*")
    .eq("cliente_id", props.clienteId);
  if (data) instrumentos.value = data;
}

async function adicionarInstrumento() {
  if (!form.value.marca || !form.value.modelo) {
    // SUBSTITUÍDO: alert() por triggerToast()
    triggerToast("Preencha a marca e o modelo do instrumento.", "error");
    return;
  }
    
  loading.value = true;
  
  const { error } = await supabase.from("instrumentos").insert([
    {
      cliente_id: props.clienteId,
      tipo: form.value.tipo,
      marca: form.value.marca,
      modelo: form.value.modelo,
      numero_serie: form.value.numero_serie,
      afinacao_padrao: form.value.afinacao,
    },
  ]);
  
  loading.value = false;
  
  if (!error) {
    form.value.marca = "";
    form.value.modelo = "";
    form.value.numero_serie = "";
    triggerToast("Instrumento registado com sucesso!", "success"); // <-- MENSAGEM DE SUCESSO
    buscarInstrumentos();
  } else {
    // SUBSTITUÍDO: alert() por triggerToast()
    triggerToast("Erro ao guardar instrumento: " + error.message, "error");
  }
}

onMounted(() => buscarInstrumentos());
</script>

<template>
  <div class="card">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      "
    >
      <h3 class="title-section" style="margin: 0; border: none">
        🎸 Instrumentos de: {{ clienteNome }}
      </h3>
      <button class="btn-outline" @click="$emit('fechar')">Voltar</button>
    </div>

    <div v-if="instrumentos.length > 0" style="margin-bottom: 30px">
      <div
        v-for="inst in instrumentos"
        :key="inst.id"
        class="box mb-1"
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <div>
          <strong style="font-size: 1.1rem; color: var(--primary)"
            >{{ inst.tipo }} {{ inst.marca }} {{ inst.modelo }}</strong
          ><br />
          <small class="text-muted"
            >Série: {{ inst.numero_serie || "--" }}</small
          >
        </div>
        <button
          class="btn-accent"
          @click="$emit('selecionarInstrumento', inst)"
        >
          🛠️ Abrir Serviço (O.S.)
        </button>
      </div>
    </div>
    <p v-else class="text-muted">Nenhum instrumento cadastrado.</p>

    <div class="box" style="background: var(--bg-body)">
      <h4 style="margin-top: 0; color: var(--primary)">➕ Novo Instrumento</h4>
      <div
        style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap"
      >
        <select v-model="form.tipo" style="flex: 1; min-width: 100px">
          <option>Guitarra</option>
          <option>Baixo</option>
          <option>Violão</option>
        </select>
        <input
          v-model="form.marca"
          placeholder="Marca"
          style="flex: 2; min-width: 150px"
        />
        <input
          v-model="form.modelo"
          placeholder="Modelo"
          style="flex: 2; min-width: 150px"
        />
      </div>
      <div style="display: flex; gap: 10px; align-items: center">
        <input
          v-model="form.numero_serie"
          placeholder="Nº de Série (Opcional)"
          style="flex: 2"
        />
        <button
          class="btn-primary"
          @click="adicionarInstrumento"
          :disabled="loading"
          style="flex: 1"
        >
          {{ loading ? "⏳" : "Salvar" }}
        </button>
      </div>
    </div>
  </div>
</template>