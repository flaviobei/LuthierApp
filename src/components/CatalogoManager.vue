<script setup>
/**
 * ============================================================================
 * @file        CatalogoManager.vue
 * @description Gestor global de itens da oficina. Centraliza o cadastro de
 * serviços (mão de obra), peças e insumos, permitindo o controle de estoque
 * e definição de preços padrão para o orçamento.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - vue: ref, onMounted, computed.
 * - supabaseClient: Acesso à tabela 'catalogo'.
 * * @functions
 * - carregarCatalogo(): Procura todos os itens cadastrados no banco de dados.
 * - salvarItem(): Executa o Insert ou Update do produto/serviço no catálogo.
 * - excluirItem(): Remove permanentemente um item do catálogo após confirmação.
 * - iniciarEdicao(): Preenche o formulário com os dados de um item existente.
 * * @notes
 * - Implementa lógica condicional para controle de estoque (apenas para peças/insumos).
 * - Utiliza filtros reativos (computed) para separar visualmente as categorias.
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";

const emit = defineEmits(["voltar"]);

const catalogo = ref([]);
const loading = ref(false);
const editandoId = ref(null);

// Formato do formulário com Estoque
const form = ref({
  nome: "",
  tipo: "Peca", // 'MaoDeObra', 'Peca' ou 'Insumo'
  custo_padrao: 0,
  preco_padrao: 0,
  controla_estoque: false,
  quantidade_estoque: 0,
  estoque_minimo: 0,
});

const filtroTipo = ref("Todos");

const catalogoFiltrado = computed(() => {
  if (filtroTipo.value === "Todos") return catalogo.value;
  return catalogo.value.filter((item) => item.tipo === filtroTipo.value);
});

async function carregarCatalogo() {
  loading.value = true;
  const { data } = await supabase.from("catalogo").select("*").order("nome");
  if (data) catalogo.value = data;
  loading.value = false;
}

async function salvarItem() {
  if (!form.value.nome) return alert("O nome do item é obrigatório.");

  loading.value = true;
  const dadosParaSalvar = { ...form.value };

  // Se não controla estoque, garante que os valores ficam a zero
  if (!dadosParaSalvar.controla_estoque) {
    dadosParaSalvar.quantidade_estoque = 0;
    dadosParaSalvar.estoque_minimo = 0;
  }

  if (editandoId.value) {
    await supabase
      .from("catalogo")
      .update(dadosParaSalvar)
      .eq("id", editandoId.value);
  } else {
    await supabase.from("catalogo").insert([dadosParaSalvar]);
  }

  cancelarEdicao();
  await carregarCatalogo();
  loading.value = false;
}

function iniciarEdicao(item) {
  editandoId.value = item.id;
  form.value = { ...item };
}

function cancelarEdicao() {
  editandoId.value = null;
  form.value = {
    nome: "",
    tipo: "Peca",
    custo_padrao: 0,
    preco_padrao: 0,
    controla_estoque: false,
    quantidade_estoque: 0,
    estoque_minimo: 0,
  };
}

async function excluirItem(id) {
  if (!confirm("Tem certeza que deseja excluir este item do catálogo?")) return;
  await supabase.from("catalogo").delete().eq("id", id);
  carregarCatalogo();
}

onMounted(() => carregarCatalogo());
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
      <h2 class="title-section" style="margin: 0; border: none">
        🏷️ Catálogo e Estoque
      </h2>
      <button class="btn-outline" @click="$emit('voltar')">
        Voltar ao Painel
      </button>
    </div>

    <div
      class="box"
      style="margin-bottom: 25px; border-top: 4px solid var(--primary)"
    >
      <h4 style="margin-top: 0">
        {{ editandoId ? "✏️ Editar Item" : "➕ Novo Item no Catálogo" }}
      </h4>

      <div
        style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px"
      >
        <div style="flex: 2; min-width: 200px">
          <label>Nome do Serviço / Produto *</label>
          <input
            v-model="form.nome"
            placeholder="Ex: Blindagem, Encordoamento 0.10, Lixa..."
          />
        </div>
        <div style="flex: 1; min-width: 150px">
          <label>Categoria</label>
          <select v-model="form.tipo">
            <option value="MaoDeObra">Mão de Obra (Serviço)</option>
            <option value="Peca">Peça (Visível p/ Cliente)</option>
            <option value="Insumo">Insumo (Custo Oculto)</option>
          </select>
        </div>
      </div>

      <div
        style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px"
      >
        <div style="flex: 1; min-width: 120px">
          <label>Custo de Aquisição (R$)</label>
          <input v-model.number="form.custo_padrao" type="number" step="0.01" />
        </div>
        <div style="flex: 1; min-width: 120px">
          <label>Preço de Venda (R$)</label>
          <input
            v-model.number="form.preco_padrao"
            type="number"
            step="0.01"
            :disabled="form.tipo === 'Insumo'"
          />
          <small v-if="form.tipo === 'Insumo'" class="text-muted"
            >Insumos não têm preço de venda direto.</small
          >
        </div>
      </div>

      <div
        class="box mb-1"
        style="background: var(--bg-body); border: 1px dashed var(--border)"
        v-if="form.tipo !== 'MaoDeObra'"
      >
        <label
          style="
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            color: var(--primary);
            font-size: 1rem;
          "
        >
          <input
            type="checkbox"
            v-model="form.controla_estoque"
            style="width: auto; transform: scale(1.2)"
          />
          <strong>📦 Controlar Estoque deste item?</strong>
        </label>

        <div
          v-if="form.controla_estoque"
          style="display: flex; gap: 15px; margin-top: 15px; flex-wrap: wrap"
        >
          <div style="flex: 1">
            <label>Qtd. Atual em Estoque:</label>
            <input
              v-model.number="form.quantidade_estoque"
              type="number"
              min="0"
            />
          </div>
          <div style="flex: 1">
            <label>Avisar quando chegar a (Estoque Mínimo):</label>
            <input v-model.number="form.estoque_minimo" type="number" min="0" />
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 15px">
        <button
          class="btn-primary"
          @click="salvarItem"
          :disabled="loading"
          style="flex: 1"
        >
          {{
            loading
              ? "⏳ A salvar..."
              : editandoId
                ? "💾 Atualizar Item"
                : "➕ Cadastrar Item"
          }}
        </button>
        <button
          v-if="editandoId"
          class="btn-outline text-danger"
          @click="cancelarEdicao"
          style="flex: 1"
        >
          ❌ Cancelar Edição
        </button>
      </div>
    </div>

    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 10px;
      "
    >
      <h3 style="margin: 0; color: var(--primary)">Itens Cadastrados</h3>

      <div class="filtros-abas">
        <button
          class="btn-tab"
          :class="{ active: filtroTipo === 'Todos' }"
          @click="filtroTipo = 'Todos'"
        >
          📋 Todos
        </button>
        <button
          class="btn-tab"
          :class="{ active: filtroTipo === 'MaoDeObra' }"
          @click="filtroTipo = 'MaoDeObra'"
        >
          🛠️ Serviços
        </button>
        <button
          class="btn-tab"
          :class="{ active: filtroTipo === 'Peca' }"
          @click="filtroTipo = 'Peca'"
        >
          🎸 Peças
        </button>
        <button
          class="btn-tab"
          :class="{ active: filtroTipo === 'Insumo' }"
          @click="filtroTipo = 'Insumo'"
        >
          🧪 Insumos
        </button>
      </div>
    </div>

    <div class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th>Nome do Item</th>
            <th>Tipo</th>
            <th>Valores (Custo / Venda)</th>
            <th style="text-align: center">Estoque</th>
            <th style="text-align: center">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="catalogoFiltrado.length === 0">
            <td colspan="5" align="center" class="text-muted">
              Nenhum item encontrado.
            </td>
          </tr>
          <tr v-for="item in catalogoFiltrado" :key="item.id">
            <td>
              <strong>{{ item.nome }}</strong>
            </td>
            <td>
              <span class="badge" :class="item.tipo">{{
                item.tipo === "MaoDeObra" ? "Serviço" : item.tipo
              }}</span>
            </td>
            <td>
              <span class="text-danger"
                >C: R$ {{ item.custo_padrao.toFixed(2) }}</span
              ><br />
              <span class="text-success" v-if="item.tipo !== 'Insumo'"
                >V: R$ {{ item.preco_padrao.toFixed(2) }}</span
              >
            </td>
            <td align="center">
              <template v-if="item.controla_estoque">
                <div
                  :style="{
                    color:
                      item.quantidade_estoque <= item.estoque_minimo
                        ? 'var(--danger)'
                        : 'var(--success)',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                  }"
                >
                  {{ item.quantidade_estoque }} un.
                </div>
                <small
                  v-if="item.quantidade_estoque <= item.estoque_minimo"
                  class="text-danger"
                  >⚠️ Baixo</small
                >
              </template>
              <span v-else class="text-muted"><small>--</small></span>
            </td>
            <td align="center" style="white-space: nowrap">
              <button
                class="btn-icon bg-light"
                @click="iniciarEdicao(item)"
                title="Editar"
              >
                ✏️
              </button>
              <button
                class="btn-icon bg-light text-danger"
                @click="excluirItem(item.id)"
                title="Excluir"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: white;
  white-space: nowrap;
}
.badge.MaoDeObra {
  background: var(--primary);
}
.badge.Peca {
  background: var(--accent);
}
.badge.Insumo {
  background: var(--text-muted);
}

/* ESTILOS DOS BOTÕES DE ABAS */
.filtros-abas {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn-tab {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-muted);
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.btn-tab:hover {
  background: var(--bg-body);
  border-color: var(--primary);
  color: var(--primary);
}
.btn-tab.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  box-shadow: var(--shadow);
}
</style>
