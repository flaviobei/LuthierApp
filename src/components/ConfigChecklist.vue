<script setup>
/**
 * ============================================================================
 * @file        ConfigChecklist.vue
 * @description Gestor de configurações de inspeção. Permite personalizar os
 * itens que aparecerão nos checklists de Chegada e Saída de todas as novas O.S.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const { triggerToast } = useToast();

const itens = ref([]);

// O formulário agora tem os campos de texto livres!
const novoItem = ref({
  tipo: "Chegada",
  item_nome: "",
  opcao_positiva: "✅ Sim", // Valores padrão sugeridos
  opcao_negativa: "❌ Não",
});
const carregando = ref(true);

async function carregarItens() {
  carregando.value = true;
  const { data } = await supabase
    .from("checklist_padrao")
    .select("*")
    .order("id");
  if (data) itens.value = data;
  carregando.value = false;
}

async function adicionarItem() {
  if (!novoItem.value.item_nome) {
    return triggerToast(
      "Por favor, digite o nome do item a inspecionar.",
      "error",
    );
  }

  // Impede que as opções fiquem vazias
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
    // Reseta o nome, mas mantém os botões para facilitar digitações em massa
    novoItem.value.item_nome = "";
    triggerToast("Regra de inspeção adicionada com sucesso!", "success");
  } else {
    triggerToast("Erro ao gravar item: " + error.message, "error");
  }
}

async function removerItem(id) {
  if (!confirm("Remover este item do padrão? (Isso não afeta O.S. antigas)"))
    return;
  await supabase.from("checklist_padrao").delete().eq("id", id);
  itens.value = itens.value.filter((i) => i.id !== id);
  triggerToast("Item removido com sucesso.", "info");
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
    <h3 style="margin-top: 0; color: var(--primary)">
      📋 Configurar Checklist Padrão
    </h3>
    <p class="text-muted">
      Estes itens e os seus respetivos botões serão adicionados a todas as novas
      Ordens de Serviço.
    </p>

    <div
      style="
        background: #f8fafc;
        padding: 20px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        margin-bottom: 25px;
      "
    >
      <div
        style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px"
      >
        <div style="flex: 1; min-width: 150px">
          <label>Fase de Inspeção</label>
          <select v-model="novoItem.tipo" style="padding: 10px">
            <option value="Chegada">📥 Inspeção de Chegada</option>
            <option value="Saída">📤 Qualidade de Saída</option>
          </select>
        </div>

        <div style="flex: 3; min-width: 200px">
          <label>O que vai inspecionar? *</label>
          <input
            v-model="novoItem.item_nome"
            placeholder="Ex: Altura das Cordas, Limpeza da Escala..."
            style="padding: 10px"
          />
        </div>
      </div>

      <div
        style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-end"
      >
        <div style="flex: 1; min-width: 150px">
          <label style="color: #10b981">Opção Positiva (Botão Verde)</label>
          <input
            v-model="novoItem.opcao_positiva"
            placeholder="Ex: ✅ OK, 👍 Boa..."
            style="padding: 10px; border-color: #a7f3d0"
          />
        </div>

        <div style="flex: 1; min-width: 150px">
          <label style="color: #f59e0b">Opção Negativa (Botão Amarelo)</label>
          <input
            v-model="novoItem.opcao_negativa"
            placeholder="Ex: ❌ Refazer, ⚠️ Ruim..."
            style="padding: 10px; border-color: #fde68a"
            @keyup.enter="adicionarItem"
          />
        </div>

        <button
          class="btn-primary"
          @click="adicionarItem"
          style="padding: 10px 20px; height: 42px"
        >
          ➕ Adicionar Regra
        </button>
      </div>
    </div>

    <div v-if="carregando" class="text-muted">A carregar itens...</div>
    <div
      v-else
      style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px"
    >
      <div
        style="
          border: 1px solid #fde68a;
          border-radius: 8px;
          padding: 15px;
          background: #fffbeb;
        "
      >
        <h4 style="margin-top: 0; color: #d97706">📥 Itens de Chegada</h4>
        <div
          v-for="item in itensChegada"
          :key="item.id"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 8px;
            border: 1px solid #fde68a;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          "
        >
          <div>
            <strong style="display: block; color: var(--primary)">{{
              item.item_nome
            }}</strong>
            <small class="text-muted"
              >Botões: [ {{ item.opcao_positiva }} ] ou [
              {{ item.opcao_negativa }} ]</small
            >
          </div>
          <button
            @click="removerItem(item.id)"
            class="btn-icon text-danger"
            title="Apagar regra"
          >
            ❌
          </button>
        </div>
        <p
          v-if="itensChegada.length === 0"
          class="text-muted"
          style="font-size: 0.85em"
        >
          Nenhuma regra configurada.
        </p>
      </div>

      <div
        style="
          border: 1px solid #a7f3d0;
          border-radius: 8px;
          padding: 15px;
          background: #ecfdf5;
        "
      >
        <h4 style="margin-top: 0; color: #059669">📤 Itens de Saída</h4>
        <div
          v-for="item in itensSaida"
          :key="item.id"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 8px;
            border: 1px solid #a7f3d0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          "
        >
          <div>
            <strong style="display: block; color: var(--primary)">{{
              item.item_nome
            }}</strong>
            <small class="text-muted"
              >Botões: [ {{ item.opcao_positiva }} ] ou [
              {{ item.opcao_negativa }} ]</small
            >
          </div>
          <button
            @click="removerItem(item.id)"
            class="btn-icon text-danger"
            title="Apagar regra"
          >
            ❌
          </button>
        </div>
        <p
          v-if="itensSaida.length === 0"
          class="text-muted"
          style="font-size: 0.85em"
        >
          Nenhuma regra configurada.
        </p>
      </div>
    </div>
  </div>
</template>
