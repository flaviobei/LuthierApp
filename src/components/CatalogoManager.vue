<script setup>
/**
 * ============================================================================
 * @file        CatalogoManager.vue
 * @description Gestor global de itens da oficina. Centraliza o cadastro de
 * serviços, peças e insumos. Inclui controle de estoque, cálculo automático
 * de custos baseados em receitas e exportação para CSV.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const emit = defineEmits(["voltar"]);
const { triggerToast } = useToast();

const catalogo = ref([]);
const loading = ref(false);
const editandoId = ref(null);
const abaEdicao = ref("dados");

const form = ref({
  nome: "",
  tipo: "Peca",
  custo_padrao: 0,
  preco_padrao: 0,
  controla_estoque: false,
  quantidade_estoque: 0,
  estoque_minimo: 0,
  insumos_consumidos: [],
});

const insumoSelecionado = ref(null);
const insumoQuantidade = ref(1);
const filtroTipo = ref("Todos");

const catalogoFiltrado = computed(() => {
  if (filtroTipo.value === "Todos") return catalogo.value;
  return catalogo.value.filter((item) => item.tipo === filtroTipo.value);
});

const insumosDisponiveis = computed(() => {
  return catalogo.value.filter(
    (item) => item.tipo === "Insumo" && item.controla_estoque,
  );
});

async function carregarCatalogo() {
  loading.value = true;
  const { data } = await supabase.from("catalogo").select("*").order("nome");
  if (data) catalogo.value = data;
  loading.value = false;
}

// --- LÓGICA DE EXPORTAÇÃO DE ESTOQUE (NOVO) ---
function exportarEstoqueCSV() {
  if (catalogoFiltrado.value.length === 0) {
    return triggerToast("Não há itens para exportar nesta categoria.", "error");
  }

  // 1. Cabeçalho do ficheiro
  let csvContent =
    "Nome do Item;Categoria;Custo (R$);Preco de Venda (R$);Controla Estoque;Qtd Atual;Estoque Minimo;Status do Estoque\n";

  // 2. Preenchimento de Dados
  catalogoFiltrado.value.forEach((item) => {
    const nome = item.nome
      ? item.nome.replace(/;/g, ",").replace(/\n/g, " ")
      : "--";
    const tipo = item.tipo === "MaoDeObra" ? "Serviço" : item.tipo;

    // Formatação de Valores
    const custoStr = calcularCustoTotal(item).toFixed(2).replace(".", ",");
    const vendaStr =
      item.tipo !== "Insumo"
        ? (Number(item.preco_padrao) || 0).toFixed(2).replace(".", ",")
        : "--";

    // Dados de Estoque
    const controlaEstoque = item.controla_estoque ? "Sim" : "Não";
    const qtdAtual = item.controla_estoque ? item.quantidade_estoque : "--";
    const qtdMinima = item.controla_estoque ? item.estoque_minimo : "--";

    // Status do Estoque
    let status = "--";
    if (item.controla_estoque) {
      status =
        item.quantidade_estoque <= item.estoque_minimo
          ? "BAIXO / ALERTA"
          : "Normal";
    }

    csvContent += `${nome};${tipo};${custoStr};${vendaStr};${controlaEstoque};${qtdAtual};${qtdMinima};${status}\n`;
  });

  // 3. Gerar e baixar
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  const nomeFicheiro = `Relatorio_Estoque_${filtroTipo.value}_${new Date().toISOString().substring(0, 10)}.csv`;
  link.setAttribute("download", nomeFicheiro);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  triggerToast("Relatório de estoque exportado com sucesso!", "success");
}

// --- LÓGICA DE RECEITAS E CÁLCULO DE CUSTOS ---
function calcularCustoTotal(item) {
  let custo = Number(item.custo_padrao) || 0;

  if (
    item.tipo === "MaoDeObra" &&
    item.insumos_consumidos &&
    item.insumos_consumidos.length > 0
  ) {
    item.insumos_consumidos.forEach((ins) => {
      const insumoRef = catalogo.value.find((c) => c.id === ins.insumo_id);
      if (insumoRef) {
        custo += (Number(insumoRef.custo_padrao) || 0) * Number(ins.quantidade);
      }
    });
  }
  return custo;
}

const custoTotalForm = computed(() => calcularCustoTotal(form.value));

function adicionarInsumoNaReceita() {
  if (!insumoSelecionado.value || insumoQuantidade.value <= 0) {
    return triggerToast(
      "Selecione um insumo e digite uma quantidade válida.",
      "error",
    );
  }

  const insumo = catalogo.value.find((i) => i.id === insumoSelecionado.value);
  if (insumo) {
    const existe = form.value.insumos_consumidos.find(
      (i) => i.insumo_id === insumoSelecionado.value,
    );
    if (existe) {
      existe.quantidade += insumoQuantidade.value;
    } else {
      form.value.insumos_consumidos.push({
        insumo_id: insumoSelecionado.value,
        nome: insumo.nome,
        quantidade: insumoQuantidade.value,
      });
    }
    insumoSelecionado.value = null;
    insumoQuantidade.value = 1;
  }
}

function removerInsumoDaReceita(insumoId) {
  form.value.insumos_consumidos = form.value.insumos_consumidos.filter(
    (i) => i.insumo_id !== insumoId,
  );
}
// -------------------------------------

async function salvarItem() {
  if (!form.value.nome) {
    return triggerToast("O nome do item é obrigatório.", "error");
  }

  loading.value = true;
  const dadosParaSalvar = { ...form.value };

  if (!dadosParaSalvar.controla_estoque) {
    dadosParaSalvar.quantidade_estoque = 0;
    dadosParaSalvar.estoque_minimo = 0;
  }

  if (dadosParaSalvar.tipo !== "MaoDeObra") {
    dadosParaSalvar.insumos_consumidos = [];
  }

  let errorMessage = null;

  if (editandoId.value) {
    const { error } = await supabase
      .from("catalogo")
      .update(dadosParaSalvar)
      .eq("id", editandoId.value);
    errorMessage = error;
  } else {
    const { error } = await supabase.from("catalogo").insert([dadosParaSalvar]);
    errorMessage = error;
  }

  if (!errorMessage) {
    triggerToast(
      editandoId.value
        ? "Item atualizado com sucesso!"
        : "Novo item adicionado ao catálogo!",
      "success",
    );
    cancelarEdicao();
    await carregarCatalogo();
  } else {
    triggerToast("Erro ao gravar item: " + errorMessage.message, "error");
  }

  loading.value = false;
}

function iniciarEdicao(item) {
  editandoId.value = item.id;
  form.value = {
    ...item,
    insumos_consumidos: item.insumos_consumidos || [],
  };
  abaEdicao.value = "dados";
}

function cancelarEdicao() {
  editandoId.value = null;
  abaEdicao.value = "dados";
  form.value = {
    nome: "",
    tipo: "Peca",
    custo_padrao: 0,
    preco_padrao: 0,
    controla_estoque: false,
    quantidade_estoque: 0,
    estoque_minimo: 0,
    insumos_consumidos: [],
  };
}

async function excluirItem(id) {
  if (!confirm("Tem certeza que deseja excluir este item do catálogo?")) return;
  await supabase.from("catalogo").delete().eq("id", id);
  triggerToast("Item excluído permanentemente.", "info");
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
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
          margin-bottom: 15px;
        "
      >
        <h4 style="margin: 0">
          {{ editandoId ? "✏️ Editar Item" : "➕ Novo Item no Catálogo" }}
        </h4>

        <div
          v-if="form.tipo === 'MaoDeObra'"
          class="btn-group"
          style="display: flex; gap: 5px"
        >
          <button
            class="btn-tab"
            :class="{ active: abaEdicao === 'dados' }"
            @click="abaEdicao = 'dados'"
            style="padding: 5px 12px"
          >
            📄 Dados Básicos
          </button>
          <button
            class="btn-tab"
            :class="{ active: abaEdicao === 'insumos' }"
            @click="abaEdicao = 'insumos'"
            style="
              padding: 5px 12px;
              background: #fffbeb;
              color: #d97706;
              border-color: #fde68a;
            "
          >
            🧪 Receita de Insumos
            <span v-if="form.insumos_consumidos.length > 0"
              >({{ form.insumos_consumidos.length }})</span
            >
          </button>
        </div>
      </div>

      <div v-if="abaEdicao === 'dados'">
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
            <label>Custo Base de Aquisição/Fixo (R$)</label>
            <input
              v-model.number="form.custo_padrao"
              type="number"
              step="0.01"
            />
            <small
              v-if="
                form.tipo === 'MaoDeObra' && custoTotalForm > form.custo_padrao
              "
              class="text-danger"
              style="display: block; margin-top: 5px; font-weight: bold"
            >
              Custo Total com Insumos: R$ {{ custoTotalForm.toFixed(2) }}
            </small>
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
              <input
                v-model.number="form.estoque_minimo"
                type="number"
                min="0"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="abaEdicao === 'insumos' && form.tipo === 'MaoDeObra'">
        <div
          style="
            background: #fffbeb;
            border: 1px dashed #f59e0b;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
          "
        >
          <h4 style="margin-top: 0; color: #b45309">🧪 Definir Receita</h4>
          <p style="font-size: 0.85rem; color: #78350f; margin-bottom: 15px">
            Se este serviço consumir materiais invisíveis para o cliente (ex:
            Óleo de Linhaça, Solda, Lixa), adicione-os aqui. O custo deles será
            somado ao custo da mão de obra.
          </p>

          <div
            style="
              display: flex;
              gap: 10px;
              align-items: flex-end;
              flex-wrap: wrap;
            "
          >
            <div style="flex: 2; min-width: 200px">
              <label>Selecione o Insumo:</label>
              <select v-model="insumoSelecionado">
                <option :value="null">
                  -- Escolha um insumo com estoque --
                </option>
                <option
                  v-for="ins in insumosDisponiveis"
                  :key="ins.id"
                  :value="ins.id"
                >
                  {{ ins.nome }} (Estoque: {{ ins.quantidade_estoque }})
                </option>
              </select>
            </div>
            <div style="flex: 1; min-width: 100px">
              <label>Quantidade:</label>
              <input
                type="number"
                v-model.number="insumoQuantidade"
                min="1"
                step="0.1"
              />
            </div>
            <button
              class="btn-primary"
              @click="adicionarInsumoNaReceita"
              style="
                background: #f59e0b;
                border: none;
                height: 40px;
                margin-bottom: 2px;
              "
            >
              ➕ Adicionar
            </button>
          </div>
        </div>

        <div class="tabela-responsiva">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th style="background: #fef3c7">Insumo Consumido</th>
                <th style="background: #fef3c7">Quantidade a descontar</th>
                <th style="background: #fef3c7; text-align: center">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="form.insumos_consumidos.length === 0">
                <td
                  colspan="3"
                  class="text-center text-muted"
                  style="padding: 15px"
                >
                  Nenhum insumo configurado.
                </td>
              </tr>
              <tr v-for="rec in form.insumos_consumidos" :key="rec.insumo_id">
                <td style="font-weight: bold">{{ rec.nome }}</td>
                <td>{{ rec.quantidade }} un/ml</td>
                <td align="center">
                  <button
                    class="btn-text-danger"
                    @click="removerInsumoDaReceita(rec.insumo_id)"
                  >
                    ❌
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        style="
          display: flex;
          gap: 10px;
          margin-top: 15px;
          border-top: 1px solid var(--border);
          padding-top: 15px;
        "
      >
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
      <div
        style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap"
      >
        <h3 style="margin: 0; color: var(--primary)">Itens Cadastrados</h3>
        <button
          class="btn-outline"
          style="
            border-color: #27ae60;
            color: #27ae60;
            padding: 6px 12px;
            font-size: 0.85rem;
          "
          @click="exportarEstoqueCSV"
        >
          📥 Exportar CSV
        </button>
      </div>

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
            <td data-label="Nome do Item">
              <strong>{{ item.nome }}</strong>
              <div
                v-if="
                  item.tipo === 'MaoDeObra' &&
                  item.insumos_consumidos &&
                  item.insumos_consumidos.length > 0
                "
                style="font-size: 0.75rem; color: #d97706; margin-top: 4px"
              >
                🧪 Consome {{ item.insumos_consumidos.length }} insumo(s)
              </div>
            </td>
            <td data-label="Tipo">
              <span class="badge" :class="item.tipo">{{
                item.tipo === "MaoDeObra" ? "Serviço" : item.tipo
              }}</span>
            </td>

            <td data-label="Valores">
              <span class="text-danger" style="font-weight: bold">
                Custo: R$ {{ calcularCustoTotal(item).toFixed(2) }} </span
              ><br />
              <span class="text-success" v-if="item.tipo !== 'Insumo'">
                Venda: R$ {{ item.preco_padrao.toFixed(2) }}
              </span>

              <div
                v-if="
                  item.tipo === 'MaoDeObra' &&
                  calcularCustoTotal(item) > (item.custo_padrao || 0)
                "
                style="
                  font-size: 0.7rem;
                  color: var(--text-muted);
                  margin-top: 2px;
                "
              >
                (Inclui R$
                {{
                  (calcularCustoTotal(item) - (item.custo_padrao || 0)).toFixed(
                    2,
                  )
                }}
                em insumos)
              </div>
            </td>

            <td data-label="Estoque" align="center">
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
            <td data-label="Ações" align="center" style="white-space: nowrap">
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
.btn-text-danger {
  background: none;
  border: none;
  color: #ff4757;
  cursor: pointer;
  font-weight: bold;
  padding: 5px;
}
</style>
