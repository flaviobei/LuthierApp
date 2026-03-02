<script setup>
/**
 * ============================================================================
 * @file        ConfigChecklist.vue
 * @description Gestor de configurações de inspeção. Agora com confirmação
 * inteligente de exclusão (sem alerts do navegador).
 * ATUALIZAÇÃO: Padronização de botões e ícones dinâmicos.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const { triggerToast } = useToast();

const itens = ref([]);
const carregando = ref(true);
const idParaRemover = ref(null); // Estado para controlar a confirmação de remoção

const novoItem = ref({
  tipo: "Chegada",
  item_nome: "",
  opcao_positiva: "✅ Sim",
  opcao_negativa: "❌ Não",
});

async function carregarItens() {
  carregando.value = true;
  const { data, error } = await supabase
    .from("checklist_padrao")
    .select("*")
    .order("id");

  if (error) {
    triggerToast("Erro ao carregar checklist: " + error.message, "error");
  } else if (data) {
    itens.value = data;
  }
  carregando.value = false;
}

async function adicionarItem() {
  if (!novoItem.value.item_nome) {
    return triggerToast(
      "Por favor, digite o nome do item a inspecionar.",
      "error",
    );
  }

  if (!novoItem.value.opcao_positiva) novoItem.value.opcao_positiva = "✅ Sim";
  if (!novoItem.value.opcao_negativa) novoItem.value.opcao_negativa = "❌ Não";

  const payload = {
    tipo: novoItem.value.tipo,
    item_nome: novoItem.value.item_nome,
    opcao_positiva: novoItem.value.opcao_positiva,
    opcao_negativa: novoItem.value.opcao_negativa,
  };

  const { data, error } = await supabase
    .from("checklist_padrao")
    .insert([payload])
    .select();

  if (!error && data) {
    itens.value.push(data[0]);
    novoItem.value.item_nome = "";
    triggerToast("Regra de inspeção adicionada!", "success");
  } else {
    triggerToast("Erro ao gravar item: " + error.message, "error");
  }
}

/**
 * Lógica de remoção em dois passos para evitar o 'alert' do navegador
 */
async function confirmarRemocao(id) {
  if (idParaRemover.value === id) {
    // Segundo clique: Executa a remoção
    const { error } = await supabase
      .from("checklist_padrao")
      .delete()
      .eq("id", id);

    if (!error) {
      itens.value = itens.value.filter((i) => i.id !== id);
      triggerToast("Item removido do padrão.", "info");
    } else {
      triggerToast("Erro ao remover: " + error.message, "error");
    }
    idParaRemover.value = null;
  } else {
    // Primeiro clique: Ativa o modo de confirmação
    idParaRemover.value = id;
    // Cancela automaticamente após 3 segundos se não confirmar
    setTimeout(() => {
      if (idParaRemover.value === id) idParaRemover.value = null;
    }, 3000);
  }
}

const itensChegada = computed(() =>
  itens.value.filter((i) => i.tipo === "Chegada"),
);
const itensSaida = computed(() =>
  itens.value.filter((i) => i.tipo === "Saída"),
);

onMounted(carregarItens);
</script>

<template>
  <div class="card" style="text-align: left">
    <h3
      style="
        margin-top: 0;
        color: var(--primary);
        display: flex;
        align-items: center;
        gap: 8px;
      "
    >
      <span class="icon-dinamico">fact_check</span> Configurar Checklist Padrão
    </h3>
    <p class="text-muted">
      Estes itens serão adicionados a todas as novas Ordens de Serviço.
    </p>

    <div class="box-config-checklist">
      <div class="grid-inputs">
        <div class="field">
          <label>Fase de Inspeção</label>
          <select v-model="novoItem.tipo">
            <option value="Chegada">Inspeção de Chegada</option>
            <option value="Saída">Qualidade de Saída</option>
          </select>
        </div>

        <div class="field-grow">
          <label>O que vai inspecionar? *</label>
          <input
            v-model="novoItem.item_nome"
            placeholder="Ex: Altura das Cordas, Trastes..."
          />
        </div>
      </div>

      <div class="grid-buttons-config">
        <div class="field">
          <label class="text-success">Botão Positivo</label>
          <input v-model="novoItem.opcao_positiva" />
        </div>

        <div class="field">
          <label class="text-warning">Botão Negativo</label>
          <input
            v-model="novoItem.opcao_negativa"
            @keyup.enter="adicionarItem"
          />
        </div>

        <button class="btn-primary btn-add-regra" @click="adicionarItem">
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >add_circle</span
          >
          Adicionar
        </button>
      </div>
    </div>

    <div
      v-if="carregando"
      class="text-muted text-center"
      style="
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      "
    >
      <span
        class="icon-dinamico"
        style="font-size: 2rem; animation: spin 1s linear infinite"
        >sync</span
      >
      A carregar regras...
    </div>

    <div v-else class="checklist-columns">
      <div class="col-checklist chegada">
        <h4 style="display: flex; align-items: center; gap: 6px">
          <span class="icon-dinamico">login</span> Itens de Chegada
        </h4>
        <div v-for="item in itensChegada" :key="item.id" class="item-regra">
          <div class="regra-info">
            <strong>{{ item.item_nome }}</strong>
            <small
              >Botões: [{{ item.opcao_positiva }}] [{{
                item.opcao_negativa
              }}]</small
            >
          </div>
          <button
            @click="confirmarRemocao(item.id)"
            class="btn-delete-confirm"
            :class="{ confirming: idParaRemover === item.id }"
          >
            <span class="icon-dinamico" style="font-size: 1.1rem">
              {{ idParaRemover === item.id ? "check" : "delete" }}
            </span>
            <span v-if="idParaRemover === item.id">Confirmar?</span>
          </button>
        </div>
        <p v-if="itensChegada.length === 0" class="text-muted small">
          Nenhuma regra configurada.
        </p>
      </div>

      <div class="col-checklist saida">
        <h4 style="display: flex; align-items: center; gap: 6px">
          <span class="icon-dinamico">logout</span> Itens de Saída
        </h4>
        <div v-for="item in itensSaida" :key="item.id" class="item-regra">
          <div class="regra-info">
            <strong>{{ item.item_nome }}</strong>
            <small
              >Botões: [{{ item.opcao_positiva }}] [{{
                item.opcao_negativa
              }}]</small
            >
          </div>
          <button
            @click="confirmarRemocao(item.id)"
            class="btn-delete-confirm"
            :class="{ confirming: idParaRemover === item.id }"
          >
            <span class="icon-dinamico" style="font-size: 1.1rem">
              {{ idParaRemover === item.id ? "check" : "delete" }}
            </span>
            <span v-if="idParaRemover === item.id">Confirmar?</span>
          </button>
        </div>
        <p v-if="itensSaida.length === 0" class="text-muted small">
          Nenhuma regra configurada.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.box-config-checklist {
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 25px;
}

.grid-inputs,
.grid-buttons-config {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.field {
  flex: 1;
  min-width: 140px;
}
.field-grow {
  flex: 3;
  min-width: 200px;
}

.btn-add-regra {
  height: 42px;
  align-self: flex-end;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.checklist-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.col-checklist {
  border-radius: 8px;
  padding: 15px;
}

.chegada {
  background: #fffbeb;
  border: 1px solid #fde68a;
}
.chegada h4 {
  color: #d97706;
  margin-top: 0;
}

.saida {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}
.saida h4 {
  color: #059669;
  margin-top: 0;
}

.item-regra {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.regra-info {
  display: flex;
  flex-direction: column;
}
.regra-info strong {
  color: var(--primary);
  font-size: 0.95rem;
}
.regra-info small {
  color: var(--text-muted);
  font-size: 0.75rem;
}

/* Botão de remoção com dois estados */
.btn-delete-confirm {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  min-width: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.btn-delete-confirm.confirming {
  background: #dc2626;
  color: white;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 700px) {
  .checklist-columns {
    grid-template-columns: 1fr;
  }
}
</style>
