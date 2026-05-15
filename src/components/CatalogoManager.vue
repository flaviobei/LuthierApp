<script setup>
/**
 * ============================================================================
 * @file        CatalogoManager.vue
 * @description Gestor de itens refatorado para usar catalogoService.
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { useToast } from "../composables/useToast";
import { catalogoService } from "../services/catalogoService"; // Importação do Serviço
import { useI18n } from "vue-i18n";

const emit = defineEmits(["voltar"]);
const { triggerToast } = useToast();
const { t } = useI18n();

const catalogo = ref([]);
const loading = ref(false);
const editandoId = ref(null);
const abaEdicao = ref("dados");
const idParaExcluir = ref(null);

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
const termoBusca = ref("");
const ordenacao = ref({ campo: "nome", direcao: "asc" });

function alternarOrdenacao(campo) {
  if (ordenacao.value.campo === campo) {
    ordenacao.value.direcao =
      ordenacao.value.direcao === "asc" ? "desc" : "asc";
  } else {
    ordenacao.value.campo = campo;
    ordenacao.value.direcao = "asc";
  }
}

// --- CARREGAMENTO ---
async function carregarCatalogo() {
  loading.value = true;
  try {
    catalogo.value = await catalogoService.buscarTodos();
  } catch (error) {
    triggerToast(t('catalogo.erro_carregar') + error.message, "error");
  } finally {
    loading.value = false;
  }
}

// --- LÓGICA DE NEGÓCIO (Mantida no componente por ser visual/local) ---
const catalogoFiltrado = computed(() => {
  let result = catalogo.value;

  if (filtroTipo.value !== "Todos") {
    result = result.filter((item) => item.tipo === filtroTipo.value);
  }

  if (termoBusca.value) {
    const termo = termoBusca.value.toLowerCase();
    result = result.filter((item) => item.nome.toLowerCase().includes(termo));
  }

  result = result.slice().sort((a, b) => {
    let valA, valB;
    switch (ordenacao.value.campo) {
      case "nome":
        valA = a.nome.toLowerCase();
        valB = b.nome.toLowerCase();
        break;
      case "tipo":
        valA = a.tipo;
        valB = b.tipo;
        break;
      case "preco":
        valA = a.preco_padrao || 0;
        valB = b.preco_padrao || 0;
        break;
      case "custo":
        valA = calcularCustoTotal(a);
        valB = calcularCustoTotal(b);
        break;
      case "estoque":
        valA = a.controla_estoque ? a.quantidade_estoque : -1;
        valB = b.controla_estoque ? b.quantidade_estoque : -1;
        break;
      default:
        valA = a.nome.toLowerCase();
        valB = b.nome.toLowerCase();
    }

    if (valA < valB) return ordenacao.value.direcao === "asc" ? -1 : 1;
    if (valA > valB) return ordenacao.value.direcao === "asc" ? 1 : -1;
    return 0;
  });

  return result;
});

const insumosDisponiveis = computed(() => {
  return catalogo.value.filter(
    (item) => item.tipo === "Insumo" && item.controla_estoque,
  );
});

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

// --- AÇÕES DE SALVAR E EXCLUIR (Via Service) ---
async function salvarItem() {
  if (!form.value.nome)
    return triggerToast(t('catalogo.erro_nome_obrig'), "error");

  loading.value = true;
  try {
    const dadosParaSalvar = { ...form.value };

    // Limpeza lógica antes de enviar ao serviço
    if (!dadosParaSalvar.controla_estoque) {
      dadosParaSalvar.quantidade_estoque = 0;
      dadosParaSalvar.estoque_minimo = 0;
    }
    if (dadosParaSalvar.tipo !== "MaoDeObra") {
      dadosParaSalvar.insumos_consumidos = [];
    }
    if (editandoId.value) {
      dadosParaSalvar.id = editandoId.value;
    }

    await catalogoService.salvar(dadosParaSalvar);

    triggerToast(
      editandoId.value ? t('catalogo.atualizado') : t('catalogo.adicionado'),
      "success",
    );
    cancelarEdicao();
    await carregarCatalogo();
  } catch (error) {
    triggerToast(t('catalogo.erro_gravar') + error.message, "error");
  } finally {
    loading.value = false;
  }
}

async function excluirItem(id) {
  if (idParaExcluir.value === id) {
    try {
      await catalogoService.excluir(id);
      triggerToast(t('catalogo.removido'), "info");
      carregarCatalogo();
    } catch (error) {
      triggerToast(t('catalogo.erro_excluir') + error.message, "error");
    }
    idParaExcluir.value = null;
  } else {
    idParaExcluir.value = id;
    setTimeout(() => {
      if (idParaExcluir.value === id) idParaExcluir.value = null;
    }, 4000);
  }
}

// --- AUXILIARES DE INTERFACE ---
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

function adicionarInsumoNaReceita() {
  if (!insumoSelecionado.value || insumoQuantidade.value <= 0) {
    return triggerToast(
      t('catalogo.erro_insumo_invalido'),
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

// Mantivemos a exportação CSV aqui por ser uma manipulação direta do DOM/Blob
function exportarEstoqueCSV() {
  if (catalogoFiltrado.value.length === 0) {
    return triggerToast(t('catalogo.erro_exportar_vazio'), "error");
  }

  let csvContent = t('catalogo.csv_header');

  catalogoFiltrado.value.forEach((item) => {
    const nome = item.nome
      ? item.nome.replace(/;/g, ",").replace(/\n/g, " ")
      : "--";
    const tipo = item.tipo === "MaoDeObra" ? t('catalogo.tipo_servico') : item.tipo;
    const custoStr = calcularCustoTotal(item).toFixed(2).replace(".", ",");
    const vendaStr =
      item.tipo !== "Insumo"
        ? (Number(item.preco_padrao) || 0).toFixed(2).replace(".", ",")
        : "--";
    const controlaEstoque = item.controla_estoque ? t('geral.sim') : t('geral.nao');
    const qtdAtual = item.controla_estoque ? item.quantidade_estoque : "--";
    const qtdMinima = item.controla_estoque ? item.estoque_minimo : "--";
    let status = "--";
    if (item.controla_estoque) {
      status =
        item.quantidade_estoque <= item.estoque_minimo
          ? t('catalogo.status_baixo')
          : t('catalogo.status_normal');
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
    `${t('catalogo.prefixo_relatorio')}${filtroTipo.value}_${new Date().toISOString().substring(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  triggerToast(t('catalogo.exportado'), "success");
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
        {{ $t('catalogo.titulo') }}
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
          {{ editandoId ? $t('catalogo.editar_item') : $t('catalogo.novo_item') }}
        </h4>
        <div
          v-if="form.tipo === 'MaoDeObra'"
          class="btn-group"
          style="display: flex; gap: 5px"
        >
          <button type="button"
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
            {{ $t('catalogo.aba_dados') }}
          </button>
          <button type="button"
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
            {{ $t('catalogo.aba_receita') }}
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
            <label>{{ $t('catalogo.label_nome') }}</label>
            <input
              v-model="form.nome"
              :placeholder="$t('catalogo.placeholder_nome')"
            />
          </div>
          <div style="flex: 1; min-width: 150px">
            <label>{{ $t('catalogo.label_categoria') }}</label>
            <select v-model="form.tipo">
              <option value="MaoDeObra">{{ $t('catalogo.cat_servico') }}</option>
              <option value="Peca">{{ $t('catalogo.cat_peca') }}</option>
              <option value="Insumo">{{ $t('catalogo.cat_insumo') }}</option>
            </select>
          </div>
        </div>

        <div
          style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px"
        >
          <div style="flex: 1; min-width: 120px">
            <label>{{ $t('catalogo.label_custo') }}</label>
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
              {{ $t('catalogo.custo_total') }} {{ custoTotalForm.toFixed(2) }}
            </small>
          </div>
          <div style="flex: 1; min-width: 120px">
            <label>{{ $t('catalogo.label_preco') }}</label>
            <input
              v-model.number="form.preco_padrao"
              type="number"
              step="0.01"
              :disabled="form.tipo === 'Insumo'"
            />
            <small v-if="form.tipo === 'Insumo'" class="text-muted"
              >{{ $t('catalogo.aviso_preco_insumo') }}</small
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
              <span class="icon-dinamico">inventory_2</span> {{ $t('catalogo.controlar_estoque') }}
            </strong>
          </label>
          <div
            v-if="form.controla_estoque"
            style="display: flex; gap: 15px; margin-top: 15px; flex-wrap: wrap"
          >
            <div style="flex: 1">
              <label>{{ $t('catalogo.qtd_atual') }}</label
              ><input
                v-model.number="form.quantidade_estoque"
                type="number"
                min="0"
              />
            </div>
            <div style="flex: 1">
              <label>{{ $t('catalogo.estoque_minimo') }}</label
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
            <span class="icon-dinamico">science</span> {{ $t('catalogo.definir_receita') }}
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
              <label>{{ $t('catalogo.selecione_insumo') }}</label>
              <select v-model="insumoSelecionado">
                <option :value="null">{{ $t('catalogo.placeholder_insumo') }}</option>
                <option
                  v-for="ins in insumosDisponiveis"
                  :key="ins.id"
                  :value="ins.id"
                >
                  {{ ins.nome }} ({{ $t('catalogo.coluna_estoque') }}: {{ ins.quantidade_estoque }})
                </option>
              </select>
            </div>
            <div style="flex: 1; min-width: 100px">
              <label>{{ $t('catalogo.qtd_insumo') }}</label
              ><input
                type="number"
                v-model.number="insumoQuantidade"
                min="1"
                step="0.1"
              />
            </div>
            <button type="button"
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
              <span class="icon-dinamico">add</span> {{ $t('catalogo.btn_adicionar') }}
            </button>
          </div>
        </div>
        <table class="tabela-padrao">
          <thead>
            <tr>
              <th style="background: #fef3c7">{{ $t('catalogo.coluna_insumo') }}</th>
              <th style="background: #fef3c7">{{ $t('catalogo.coluna_quantidade') }}</th>
              <th style="background: #fef3c7; text-align: center">{{ $t('catalogo.coluna_acao') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rec in form.insumos_consumidos" :key="rec.insumo_id">
              <td style="font-weight: bold">{{ rec.nome }}</td>
              <td>{{ rec.quantidade }} {{ $t('catalogo.unidade') }}</td>
              <td align="center">
                <button type="button"
                  class="btn-icon text-danger"
                  style="background: transparent"
                  @click="removerInsumoDaReceita(rec.insumo_id)"
                  :title="$t('catalogo.remover_insumo')"
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
        <button type="button"
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
              ? $t('catalogo.gravando')
              : editandoId
                ? $t('catalogo.atualizar')
                : $t('catalogo.cadastrar')
          }}
        </button>
        <button type="button"
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
          <span class="icon-dinamico">cancel</span> {{ $t('catalogo.cancelar_edicao') }}
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
        style="
          display: flex;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
          flex: 1;
        "
      >
        <h3 style="margin: 0; color: var(--primary)">{{ $t('catalogo.itens_cadastrados') }}</h3>

        <div style="position: relative; display: flex; align-items: center">
          <span
            class="icon-dinamico"
            style="
              position: absolute;
              left: 10px;
              color: var(--text-muted);
              font-size: 1.1rem;
              pointer-events: none;
            "
            >search</span
          >
          <input
            v-model="termoBusca"
            :placeholder="$t('catalogo.buscar')"
            style="
              padding-left: 36px;
              padding-right: 30px;
              border-radius: 20px;
              border: 1px solid var(--border);
              padding-top: 6px;
              padding-bottom: 6px;
              width: 220px;
              font-size: 0.9rem;
            "
          />
          <button type="button"
            v-if="termoBusca"
            @click="termoBusca = ''"
            class="btn-icon"
            style="
              position: absolute;
              right: 4px;
              background: transparent;
              padding: 4px;
              color: var(--text-muted);
              border: none;
              cursor: pointer;
              display: flex;
              align-items: center;
            "
          >
            <span class="icon-dinamico" style="font-size: 1.1rem">close</span>
          </button>
        </div>
        <button type="button"
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
          {{ $t('catalogo.exportar_csv') }}
        </button>
      </div>
      <div class="filtros-abas">
        <button type="button"
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
              ? $t('catalogo.filtro_servicos')
              : t === "Peca"
                ? $t('catalogo.filtro_pecas')
                : t === "Insumo"
                  ? $t('catalogo.filtro_insumos')
                  : $t('geral.todos')
          }}
        </button>
      </div>
    </div>

    <div class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th
              @click="alternarOrdenacao('nome')"
              style="cursor: pointer; user-select: none"
            >
              <div style="display: flex; align-items: center; gap: 4px">
                {{ $t('catalogo.coluna_nome') }}
                <span
                  v-if="ordenacao.campo === 'nome'"
                  class="icon-dinamico"
                  style="font-size: 1rem"
                >
                  {{
                    ordenacao.direcao === "asc"
                      ? "arrow_upward"
                      : "arrow_downward"
                  }}
                </span>
                <span
                  v-else
                  class="icon-dinamico"
                  style="font-size: 1rem; color: transparent"
                  >arrow_upward</span
                >
              </div>
            </th>
            <th
              @click="alternarOrdenacao('tipo')"
              style="cursor: pointer; user-select: none"
            >
              <div style="display: flex; align-items: center; gap: 4px">
                {{ $t('catalogo.coluna_tipo') }}
                <span
                  v-if="ordenacao.campo === 'tipo'"
                  class="icon-dinamico"
                  style="font-size: 1rem"
                >
                  {{
                    ordenacao.direcao === "asc"
                      ? "arrow_upward"
                      : "arrow_downward"
                  }}
                </span>
                <span
                  v-else
                  class="icon-dinamico"
                  style="font-size: 1rem; color: transparent"
                  >arrow_upward</span
                >
              </div>
            </th>
            <th
              @click="alternarOrdenacao('preco')"
              style="cursor: pointer; user-select: none"
            >
              <div style="display: flex; align-items: center; gap: 4px">
                {{ $t('catalogo.coluna_valores') }}
                <span
                  v-if="ordenacao.campo === 'preco'"
                  class="icon-dinamico"
                  style="font-size: 1rem"
                >
                  {{
                    ordenacao.direcao === "asc"
                      ? "arrow_upward"
                      : "arrow_downward"
                  }}
                </span>
                <span
                  v-else
                  class="icon-dinamico"
                  style="font-size: 1rem; color: transparent"
                  >arrow_upward</span
                >
              </div>
            </th>
            <th
              @click="alternarOrdenacao('estoque')"
              style="text-align: center; cursor: pointer; user-select: none"
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 4px;
                "
              >
                {{ $t('catalogo.coluna_estoque') }}
                <span
                  v-if="ordenacao.campo === 'estoque'"
                  class="icon-dinamico"
                  style="font-size: 1rem"
                >
                  {{
                    ordenacao.direcao === "asc"
                      ? "arrow_upward"
                      : "arrow_downward"
                  }}
                </span>
                <span
                  v-else
                  class="icon-dinamico"
                  style="font-size: 1rem; color: transparent"
                  >arrow_upward</span
                >
              </div>
            </th>
            <th style="text-align: center">{{ $t('geral.acoes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in catalogoFiltrado" :key="item.id">
            <td data-label="Nome do Item">
              <strong>{{ item.nome }}</strong>
            </td>
            <td data-label="Tipo">
              <span class="badge" :class="item.tipo">{{
                item.tipo === "MaoDeObra" ? $t('catalogo.tipo_servico') : item.tipo
              }}</span>
            </td>
            <td data-label="Valores">
              <span class="text-danger" style="font-weight: bold"
                >{{ $t('catalogo.custo_abreviado') }} R$ {{ calcularCustoTotal(item).toFixed(2) }}</span
              ><br />
              <span class="text-success" v-if="item.tipo !== 'Insumo'"
                >{{ $t('catalogo.venda_abreviado') }} R$ {{ item.preco_padrao.toFixed(2) }}</span
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
                  >{{ $t('catalogo.baixo') }}</small
                >
              </template>
              <span v-else class="text-muted">--</span>
            </td>
            <td data-label="Ações" align="center" style="white-space: nowrap">
              <button type="button"
                class="btn-icon bg-light"
                @click="iniciarEdicao(item)"
                :title="$t('geral.editar')"
              >
                <span class="icon-dinamico">edit</span>
              </button>
              <button type="button"
                class="btn-delete-step"
                :class="{ confirming: idParaExcluir === item.id }"
                @click="excluirItem(item.id)"
                :title="
                  idParaExcluir === item.id
                    ? $t('catalogo.clique_confirmar')
                    : $t('geral.excluir')
                "
              >
                <span class="icon-dinamico" style="font-size: 1.1rem">
                  {{ idParaExcluir === item.id ? "check" : "delete" }}
                </span>
                <span v-if="idParaExcluir === item.id">{{ $t('catalogo.confirmar') }}</span>
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
