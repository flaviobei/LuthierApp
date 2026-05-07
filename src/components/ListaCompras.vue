<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const { triggerToast } = useToast();

const itens = ref([]);
const loading = ref(false);
const showForm = ref(false);
const isEditing = ref(false);
const editId = ref(null);

// Controle de Ordenação
const ordenacaoNeeds = ref("urgencia_desc");
const ordenacaoWishes = ref("urgencia_desc");

const form = ref({
  nome: "",
  foto_url: "",
  valor: 0,
  link: "",
  tipo: "need",
  nivel_necessidade: 5,
  justificativa: "",
});

async function buscarItens() {
  loading.value = true;
  const { data, error } = await supabase
    .from("lista_compras")
    .select("*")
    .order("created_at", { ascending: false });

  if (!error && data) itens.value = data;
  loading.value = false;
}

// Funções de Ordenação
function ordenarArray(arr, criterio) {
  return [...arr].sort((a, b) => {
    if (criterio === "urgencia_desc")
      return b.nivel_necessidade - a.nivel_necessidade;
    if (criterio === "urgencia_asc")
      return a.nivel_necessidade - b.nivel_necessidade;
    if (criterio === "preco_asc") return a.valor - b.valor;
    if (criterio === "preco_desc") return b.valor - a.valor;
    return 0;
  });
}

const needs = computed(() => {
  const filtrados = itens.value.filter((i) => i.tipo === "need");
  return ordenarArray(filtrados, ordenacaoNeeds.value);
});

const wishes = computed(() => {
  const filtrados = itens.value.filter((i) => i.tipo === "wish");
  return ordenarArray(filtrados, ordenacaoWishes.value);
});

function getCorNecessidade(nivel) {
  if (nivel >= 8) return "#ef4444"; // Vermelho (Urgente)
  if (nivel >= 5) return "#f59e0b"; // Amarelo (Moderado)
  return "#3b82f6"; // Azul (Desejo/Baixo)
}

function iniciarNovo() {
  isEditing.value = false;
  editId.value = null;
  form.value = {
    nome: "",
    foto_url: "",
    valor: 0,
    link: "",
    tipo: "need",
    nivel_necessidade: 5,
    justificativa: "",
  };
  showForm.value = true;
}

function iniciarEdicao(item) {
  isEditing.value = true;
  editId.value = item.id;
  form.value = { ...item };
  showForm.value = true;
}

async function salvarItem() {
  if (!form.value.nome) return triggerToast("O nome é obrigatório.", "warning");

  loading.value = true;
  const payload = { ...form.value };

  let errorObj = null;
  if (isEditing.value) {
    const { error } = await supabase
      .from("lista_compras")
      .update(payload)
      .eq("id", editId.value);
    errorObj = error;
  } else {
    const { error } = await supabase.from("lista_compras").insert([payload]);
    errorObj = error;
  }

  loading.value = false;

  if (errorObj) {
    triggerToast("Erro ao salvar: " + errorObj.message, "error");
  } else {
    triggerToast(
      isEditing.value ? "Item atualizado!" : "Item adicionado!",
      "success",
    );
    showForm.value = false;
    buscarItens();
  }
}

async function excluirItem(id) {
  if (!confirm("Tem a certeza que deseja excluir este item?")) return;
  const { error } = await supabase.from("lista_compras").delete().eq("id", id);
  if (!error) {
    triggerToast("Item excluído.", "success");
    buscarItens();
  }
}

function abrirLink(url) {
  if (!url) return;
  window.open(url.startsWith("http") ? url : `https://${url}`, "_blank");
}

onMounted(() => buscarItens());
</script>

<template>
  <div class="card">
    <div class="flex-between mb-2">
      <h2
        style="
          margin: 0;
          color: var(--primary);
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">shopping_cart</span> Compras & Desejos
      </h2>
      <button type="button" class="btn-primary" @click="iniciarNovo">
        <span class="icon-dinamico">add</span> Novo Item
      </button>
    </div>

    <div
      v-if="showForm"
      class="box mb-2"
      style="border: 2px solid var(--accent); background: #f8fafc"
    >
      <div class="flex-between mb-1">
        <h3 style="margin: 0; color: var(--accent)">
          {{ isEditing ? "Editar Item" : "Novo Item" }}
        </h3>
        <button type="button" class="btn-icon text-danger" @click="showForm = false">
          <span class="icon-dinamico">close</span>
        </button>
      </div>

      <div class="form-grid">
        <div class="form-group" style="flex: 2">
          <label>Nome do Item</label>
          <input v-model="form.nome" placeholder="Ex: Tripé para gravações" />
        </div>
        <div class="form-group" style="flex: 1">
          <label>Valor Estimado (R$)</label>
          <input v-model="form.valor" type="number" step="0.01" />
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group" style="flex: 1">
          <label>Categoria</label>
          <select v-model="form.tipo">
            <option value="need">Necessidade (Need List)</option>
            <option value="wish">Desejo (Wish List)</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1">
          <label>Nível de Necessidade: {{ form.nivel_necessidade }} / 10</label>
          <input
            v-model="form.nivel_necessidade"
            type="range"
            min="0"
            max="10"
            style="width: 100%; margin-top: 10px"
          />
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group" style="flex: 1">
          <label>Link de Compra (URL)</label>
          <input
            v-model="form.link"
            placeholder="https://mercadolivre.com.br/..."
          />
        </div>
        <div class="form-group" style="flex: 1">
          <label>Link da Imagem (URL Opcional)</label>
          <input
            v-model="form.foto_url"
            placeholder="https://site.com/foto.jpg"
          />
        </div>
      </div>

      <div class="form-group mb-2">
        <label>Justificativa / Observações</label>
        <textarea
          v-model="form.justificativa"
          rows="2"
          placeholder="Por que preciso disto?"
        ></textarea>
      </div>

      <button type="button"
        class="btn-primary w-full"
        @click="salvarItem"
        :disabled="loading"
      >
        <span class="icon-dinamico">{{ loading ? "sync" : "save" }}</span>
        Salvar Item
      </button>
    </div>

    <div class="mural-grid">
      <div class="mural-coluna need-list">
        <div class="coluna-header">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px">
            <span class="icon-dinamico" style="color: #ef4444"
              >priority_high</span
            >
            Need List
          </h3>
          <select v-model="ordenacaoNeeds" class="select-sort">
            <option value="urgencia_desc">+ Urgentes</option>
            <option value="preco_asc">+ Baratos</option>
            <option value="preco_desc">+ Caros</option>
          </select>
        </div>

        <div v-if="needs.length === 0" class="empty-state">
          Nenhuma urgência registada.
        </div>

        <div v-for="item in needs" :key="item.id" class="item-card">
          <div
            class="item-badge"
            :style="{
              backgroundColor: getCorNecessidade(item.nivel_necessidade),
            }"
          >
            {{ item.nivel_necessidade }}/10
          </div>
          <div v-if="item.foto_url" class="item-foto">
            <img :src="item.foto_url" alt="Foto do item" />
          </div>
          <div class="item-content">
            <h4>{{ item.nome }}</h4>
            <span class="item-preco"
              >R$ {{ Number(item.valor).toFixed(2) }}</span
            >
            <p v-if="item.justificativa">{{ item.justificativa }}</p>

            <div class="item-actions">
              <button type="button"
                v-if="item.link"
                class="btn-outline btn-sm"
                @click="abrirLink(item.link)"
              >
                <span class="icon-dinamico">shopping_bag</span> Ver na Loja
              </button>
              <div style="display: flex; gap: 5px">
                <button type="button" class="btn-icon" @click="iniciarEdicao(item)">
                  <span class="icon-dinamico">edit</span>
                </button>
                <button type="button"
                  class="btn-icon text-danger"
                  @click="excluirItem(item.id)"
                >
                  <span class="icon-dinamico">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mural-coluna wish-list">
        <div class="coluna-header">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px">
            <span class="icon-dinamico" style="color: #3b82f6">favorite</span>
            Wish List
          </h3>
          <select v-model="ordenacaoWishes" class="select-sort">
            <option value="urgencia_desc">+ Desejados</option>
            <option value="preco_asc">+ Baratos</option>
            <option value="preco_desc">+ Caros</option>
          </select>
        </div>

        <div v-if="wishes.length === 0" class="empty-state">
          Nenhum desejo registado.
        </div>

        <div v-for="item in wishes" :key="item.id" class="item-card">
          <div
            class="item-badge"
            :style="{
              backgroundColor: getCorNecessidade(item.nivel_necessidade),
            }"
          >
            {{ item.nivel_necessidade }}/10
          </div>
          <div v-if="item.foto_url" class="item-foto">
            <img :src="item.foto_url" alt="Foto do item" />
          </div>
          <div class="item-content">
            <h4>{{ item.nome }}</h4>
            <span class="item-preco"
              >R$ {{ Number(item.valor).toFixed(2) }}</span
            >
            <p v-if="item.justificativa">{{ item.justificativa }}</p>

            <div class="item-actions">
              <button type="button"
                v-if="item.link"
                class="btn-outline btn-sm"
                @click="abrirLink(item.link)"
              >
                <span class="icon-dinamico">shopping_bag</span> Ver na Loja
              </button>
              <div style="display: flex; gap: 5px">
                <button type="button" class="btn-icon" @click="iniciarEdicao(item)">
                  <span class="icon-dinamico">edit</span>
                </button>
                <button type="button"
                  class="btn-icon text-danger"
                  @click="excluirItem(item.id)"
                >
                  <span class="icon-dinamico">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.form-grid > .form-group {
  min-width: 200px;
}

/* Grid do Mural */
.mural-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 768px) {
  .mural-grid {
    grid-template-columns: 1fr;
  }
}

.mural-coluna {
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.need-list {
  border-top: 4px solid #ef4444;
}
.wish-list {
  border-top: 4px solid #3b82f6;
}

.coluna-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.select-sort {
  padding: 4px 8px;
  font-size: 0.85rem;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #94a3b8;
  font-style: italic;
}

/* Cartão do Item */
.item-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.2s;
}
.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.item-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  color: white;
  font-weight: bold;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.item-foto {
  width: 100%;
  height: 120px;
  border-radius: 6px;
  overflow: hidden;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-foto img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-content h4 {
  margin: 0 0 5px 0;
  font-size: 1.1rem;
  color: var(--text-main);
}
.item-preco {
  font-weight: bold;
  color: var(--success);
  font-size: 1.1rem;
}
.item-content p {
  margin: 8px 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.item-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 0.8rem;
}
</style>
