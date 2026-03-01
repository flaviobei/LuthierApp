<script setup>
/**
 * ============================================================================
 * @file        CatalogoManager.vue
 * @description Gestor global de itens da oficina. Centraliza o cadastro de
 * serviços, peças e insumos. Inclui controle de estoque, cálculo automático
 * de custos baseados em receitas, exportação para CSV e confirmação segura.
 * ATUALIZAÇÃO: Padronização de botões e ícones dinâmicos.
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
const idParaExcluir = ref(null); // Estado para confirmação de exclusão sem alert

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

// --- LÓGICA DE EXPORTAÇÃO DE ESTOQUE ---
function exportarEstoqueCSV() {
  if (catalogoFiltrado.value.length === 0) {
    return triggerToast("Não há itens para exportar nesta categoria.", "error");
  }

  let csvContent =
    "Nome do Item;Categoria;Custo (R$);Preco de Venda (R$);Controla Estoque;Qtd Atual;Estoque Minimo;Status do Estoque\n";

  catalogoFiltrado.value.forEach((item) => {
    const nome = item.nome
      ? item.nome.replace(/;/g, ",").replace(/\n/g, " ")
      : "--";
    const tipo = item.tipo === "MaoDeObra" ? "Serviço" : item.tipo;
    const custoStr = calcularCustoTotal(item).toFixed(2).replace(".", ",");
    const vendaStr =
      item.tipo !== "Insumo"
        ? (Number(item.preco_padrao) || 0).toFixed(2).replace(".", ",")
        : "--";
    const controlaEstoque = item.controla_estoque ? "Sim" : "Não";
    const qtdAtual = item.controla_estoque ? item.quantidade_estoque : "--";
    const qtdMinima = item.controla_estoque ? item.estoque_minimo : "--";

    let status = "--";
    if (item.controla_estoque) {
      status =
        item.quantidade_estoque <= item.estoque_minimo
          ? "BAIXO / ALERTA"
          : "Normal";
    }

    csvContent += `${nome};${tipo};${custoStr};${vendaStr};${controlaEstoque};${qtdAtual};${qtdMinima};${status}\n`;
  });

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `Relatorio_Estoque_${filtroTipo.value}_${new Date().toISOString().substring(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  triggerToast("Relatório de estoque exportado!", "success");
}

// --- LÓGICA DE RECEITAS E CÁLCULO DE CUSTOS ---
function calcularCustoTotal(item) {
  let custo = Number(item.custo_padrao) || 0;
  if (item.tipo === "MaoDeObra" && item.insumos_consumidos?.length > 0) {
    item.insumos_consumidos.forEach((ins) => {
      const insumoRef = catalogo.value.find((c) => c.id === ins.insumo_id);
      if (insumoRef)
        custo += (Number(insumoRef.custo_padrao) || 0) * Number(ins.quantidade);
    });
  }
  return custo;
}

const custoTotalForm = computed(() => calcularCustoTotal(form.value));

function adicionarInsumoNaReceita() {
  if (!insumoSelecionado.value || insumoQuantidade.value <= 0) {
    return triggerToast(
      "Selecione um insumo e uma quantidade válida.",
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

async function salvarItem() {
  if (!form.value.nome)
    return triggerToast("O nome do item é obrigatório.", "error");
  loading.value = true;
  const dadosParaSalvar = { ...form.value };
  if (!dadosParaSalvar.controla_estoque) {
    dadosParaSalvar.quantidade_estoque = 0;
    dadosParaSalvar.estoque_minimo = 0;
  }
  if (dadosParaSalvar.tipo !== "MaoDeObra")
    dadosParaSalvar.insumos_consumidos = [];

  const { error } = editandoId.value
    ? await supabase
        .from("catalogo")
        .update(dadosParaSalvar)
        .eq("id", editandoId.value)
    : await supabase.from("catalogo").insert([dadosParaSalvar]);

  if (!error) {
    triggerToast(
      editandoId.value ? "Item atualizado!" : "Novo item adicionado!",
      "success",
    );
    cancelarEdicao();
    await carregarCatalogo();
  } else {
    triggerToast("Erro ao gravar: " + error.message, "error");
  }
  loading.value = false;
}

function iniciarEdicao(item) {
  editandoId.value = item.id;
  form.value = { ...item, insumos_consumidos: item.insumos_consumidos || [] };
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

/**
 * Lógica de exclusão em dois passos (sem alert)
 */
async function excluirItem(id) {
  if (idParaExcluir.value === id) {
    const { error } = await supabase.from("catalogo").delete().eq("id", id);
    if (!error) {
      triggerToast("Item removido do catálogo.", "info");
      carregarCatalogo();
    } else {
      triggerToast("Erro ao excluir: " + error.message, "error");
    }
    idParaExcluir.value = null;
  } else {
    idParaExcluir.value = id;
    setTimeout(() => {
      if (idParaExcluir.value === id) idParaExcluir.value = null;
    }, 4000);
  }
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
      <h2
        class="title-section"
        style="
          margin: 0;
          border: none;
          display: flex;
          align-items: center;
          gap: 10px;
        "
      >
        <span class="icon-dinamico" style="font-size: 1.8rem">local_offer</span>
        Catálogo e Estoque
      </h2>
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
        <h4 style="margin: 0; display: flex; align-items: center; gap: 8px">
          <span class="icon-dinamico">
            {{ editandoId ? "edit_note" : "add_box" }}
          </span>
          {{ editandoId ? "Editar Item" : "Novo Item no Catálogo" }}
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
            style="
              padding: 5px 12px;
              display: flex;
              align-items: center;
              gap: 5px;
            "
          >
            <span class="icon-dinamico" style="font-size: 1.1rem"
              >description</span
            >
            Dados Básicos
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
              display: flex;
              align-items: center;
              gap: 5px;
            "
          >
            <span class="icon-dinamico" style="font-size: 1.1rem">science</span>
            Receita de Insumos
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
              placeholder="Ex: Blindagem, Encordoamento, Lixa..."
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
            <label>Custo Base (R$)</label>
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
            <strong style="display: flex; align-items: center; gap: 6px">
              <span class="icon-dinamico">inventory_2</span> Controlar Estoque
              deste item?
            </strong>
          </label>
          <div
            v-if="form.controla_estoque"
            style="display: flex; gap: 15px; margin-top: 15px; flex-wrap: wrap"
          >
            <div style="flex: 1">
              <label>Qtd. Atual:</label
              ><input
                v-model.number="form.quantidade_estoque"
                type="number"
                min="0"
              />
            </div>
            <div style="flex: 1">
              <label>Estoque Mínimo:</label
              ><input
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
          <h4
            style="
              margin-top: 0;
              color: #b45309;
              display: flex;
              align-items: center;
              gap: 8px;
            "
          >
            <span class="icon-dinamico">science</span> Definir Receita
          </h4>
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
                <option :value="null">-- Escolha um insumo --</option>
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
              <label>Qtd:</label
              ><input
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
                display: flex;
                align-items: center;
                gap: 6px;
              "
            >
              <span class="icon-dinamico">add</span> Adicionar
            </button>
          </div>
        </div>
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th style="background: #fef3c7">Insumo</th>
              <th style="background: #fef3c7">Quantidade</th>
              <th style="background: #fef3c7; text-align: center">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rec in form.insumos_consumidos" :key="rec.insumo_id">
              <td style="font-weight: bold">{{ rec.nome }}</td>
              <td>{{ rec.quantidade }} un/ml</td>
              <td align="center">
                <button
                  class="btn-icon"
                  style="color: #ff4757; background: transparent"
                  @click="removerInsumoDaReceita(rec.insumo_id)"
                  title="Remover Insumo"
                >
                  <span class="icon-dinamico">delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
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
          style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">
            {{
              loading ? "hourglass_empty" : editandoId ? "save" : "add_circle"
            }}
          </span>
          {{
            loading
              ? "A gravar..."
              : editandoId
                ? "Atualizar Item"
                : "Cadastrar Item"
          }}
        </button>
        <button
          v-if="editandoId"
          class="btn-outline text-danger"
          @click="cancelarEdicao"
          style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">cancel</span> Cancelar Edição
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
            display: flex;
            align-items: center;
            gap: 6px;
          "
          @click="exportarEstoqueCSV"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >file_download</span
          >
          Exportar CSV
        </button>
      </div>
      <div class="filtros-abas">
        <button
          v-for="t in ['Todos', 'MaoDeObra', 'Peca', 'Insumo']"
          :key="t"
          class="btn-tab"
          :class="{ active: filtroTipo === t }"
          @click="filtroTipo = t"
          style="display: flex; align-items: center; gap: 5px"
        >
          <span class="icon-dinamico" style="font-size: 1rem">
            {{
              t === "MaoDeObra"
                ? "handyman"
                : t === "Peca"
                  ? "playlist_add"
                  : t === "Insumo"
                    ? "science"
                    : "list_alt"
            }}
          </span>
          {{
            t === "MaoDeObra"
              ? "Serviços"
              : t === "Peca"
                ? "Peças"
                : t === "Insumo"
                  ? "Insumos"
                  : "Todos"
          }}
        </button>
      </div>
    </div>

    <div class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th>Nome do Item</th>
            <th>Tipo</th>
            <th>Valores</th>
            <th style="text-align: center">Estoque</th>
            <th style="text-align: center">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in catalogoFiltrado" :key="item.id">
            <td data-label="Nome do Item">
              <strong>{{ item.nome }}</strong>
            </td>
            <td data-label="Tipo">
              <span class="badge" :class="item.tipo">{{
                item.tipo === "MaoDeObra" ? "Serviço" : item.tipo
              }}</span>
            </td>
            <td data-label="Valores">
              <span class="text-danger" style="font-weight: bold"
                >C: R$ {{ calcularCustoTotal(item).toFixed(2) }}</span
              ><br />
              <span class="text-success" v-if="item.tipo !== 'Insumo'"
                >V: R$ {{ item.preco_padrao.toFixed(2) }}</span
              >
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }"
                >
                  <span class="icon-dinamico" style="font-size: 1rem">
                    {{
                      item.quantidade_estoque <= item.estoque_minimo
                        ? "running_with_errors"
                        : "check_circle"
                    }}
                  </span>
                  {{ item.quantidade_estoque }} un.
                </div>
                <small
                  v-if="item.quantidade_estoque <= item.estoque_minimo"
                  class="text-danger"
                  style="font-weight: bold"
                  >Baixo</small
                >
              </template>
              <span v-else class="text-muted">--</span>
            </td>
            <td data-label="Ações" align="center" style="white-space: nowrap">
              <button
                class="btn-icon bg-light"
                @click="iniciarEdicao(item)"
                title="Editar"
              >
                <span class="icon-dinamico">edit</span>
              </button>
              <button
                class="btn-delete-step"
                :class="{ confirming: idParaExcluir === item.id }"
                @click="excluirItem(item.id)"
                :title="
                  idParaExcluir === item.id
                    ? 'Clique para confirmar'
                    : 'Excluir'
                "
              >
                <span class="icon-dinamico" style="font-size: 1.1rem">
                  {{ idParaExcluir === item.id ? "check" : "delete" }}
                </span>
                <span v-if="idParaExcluir === item.id">Confirmar?</span>
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
.btn-tab.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Botão de exclusão com sistema de confirmação seguro */
.btn-delete-step {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 40px;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.btn-delete-step.confirming {
  background: #dc2626;
  color: white;
  font-weight: bold;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
</style>
