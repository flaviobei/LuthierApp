<script setup>
import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";

const itens = ref([]);
const novoItem = ref({ tipo: "Chegada", item_nome: "" });
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
  if (!novoItem.value.item_nome) return alert("Digite o nome do item.");
  const { data, error } = await supabase
    .from("checklist_padrao")
    .insert([novoItem.value])
    .select();
  if (!error && data) {
    itens.value.push(data[0]);
    novoItem.value.item_nome = "";
  }
}

async function removerItem(id) {
  if (!confirm("Remover este item do padrão? (Isso não afeta O.S. antigas)"))
    return;
  await supabase.from("checklist_padrao").delete().eq("id", id);
  itens.value = itens.value.filter((i) => i.id !== id);
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
      Estes itens serão adicionados automaticamente a todas as novas Ordens de
      Serviço.
    </p>

    <div
      style="
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        align-items: center;
        background: #f9f9f9;
        padding: 15px;
        border-radius: 8px;
      "
    >
      <select v-model="novoItem.tipo" style="flex: 1; padding: 10px">
        <option value="Chegada">Inspeção de Chegada</option>
        <option value="Saída">Qualidade de Saída</option>
      </select>
      <input
        v-model="novoItem.item_nome"
        placeholder="Novo item a inspecionar..."
        style="flex: 3; padding: 10px"
        @keyup.enter="adicionarItem"
      />
      <button class="btn-primary" @click="adicionarItem">➕ Adicionar</button>
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
            background: white;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 5px;
            border: 1px solid #fde68a;
          "
        >
          <span>{{ item.item_nome }}</span>
          <button
            @click="removerItem(item.id)"
            style="background: none; border: none; color: red; cursor: pointer"
          >
            ❌
          </button>
        </div>
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
            background: white;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 5px;
            border: 1px solid #a7f3d0;
          "
        >
          <span>{{ item.item_nome }}</span>
          <button
            @click="removerItem(item.id)"
            style="background: none; border: none; color: red; cursor: pointer"
          >
            ❌
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
