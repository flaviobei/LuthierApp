<script setup>
/**
 * ============================================================================
 * @file        AbaOrcamento.vue
 * @description Sub-componente responsável pela montagem do orçamento,
 * catálogo, descontos e custos estimados.
 * ATUALIZAÇÃO: Mensagem de WhatsApp profissional estruturada.
 * ============================================================================
 */
import { ref, computed, onMounted } from "vue";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../composables/useToast";
import { calcularCustoEstimado } from "../../lib/financeiroUtils";
import { abrirWhatsapp } from "../../lib/whatsappUtils"; // Importação do utilitário
import { useI18n } from "vue-i18n";

const props = defineProps({
  servico: Object,
  osFinalizada: Boolean,
  itensOrcamento: Array,
  dadosCliente: Object,
  totalOrcamento: Number,
});

const emit = defineEmits(["update:itensOrcamento", "imprimir"]);
const { triggerToast } = useToast();
const { t } = useI18n();

const catalogoOriginal = ref([]);
const idItemCatalogo = ref("");
const novoItem = ref({ descricao: "", valor: null, tipo: "Mão de Obra" });
const novoDesconto = ref({ motivo: "", valor: null });

// Filtra os insumos para não aparecerem no dropdown manual
const catalogoDropdown = computed(() => {
  return catalogoOriginal.value.filter((c) => c.tipo !== "Insumo");
});

// Calcula os custos em background
const custoTotalEstimado = computed(() => {
  return calcularCustoEstimado(props.itensOrcamento, catalogoOriginal.value);
});

async function carregarCatalogo() {
  try {
    const { data } = await supabase
      .from("catalogo")
      .select("*")
      .order("nome", { ascending: true });
    catalogoOriginal.value = data || [];
  } catch (e) {}
}

function usarItemCatalogo() {
  const selecionado = catalogoOriginal.value.find(
    (c) => c.id === idItemCatalogo.value,
  );
  if (selecionado) {
    novoItem.value.descricao = selecionado.nome;
    novoItem.value.valor = selecionado.preco_padrao;
    novoItem.value.tipo = selecionado.tipo === "Peça" ? "Peça" : "Mão de Obra";
  }
}

async function adicionarItemOrcamento() {
  if (!novoItem.value.descricao || !novoItem.value.valor) return;
  try {
    const payload = {
      servico_id: props.servico.id,
      descricao: novoItem.value.descricao,
      valor: novoItem.value.valor,
      tipo: novoItem.value.tipo,
      // ESTA É A MÁGICA: Guarda o ID do catálogo se ele existir
      catalogo_id: idItemCatalogo.value ? idItemCatalogo.value : null,
    };
    const { data, error } = await supabase
      .from("orcamento_itens")
      .insert([payload])
      .select();
    if (error) throw error;
    if (data) {
      emit("update:itensOrcamento", [...props.itensOrcamento, data[0]]);
      novoItem.value = { descricao: "", valor: null, tipo: "Mão de Obra" };
      idItemCatalogo.value = "";
    }
  } catch (err) {
    triggerToast(t('os.orcamento_erro_add'), "error");
  }
}

async function aplicarDesconto() {
  if (!novoDesconto.value.motivo || novoDesconto.value.valor <= 0) {
    return triggerToast(
      t('os.orcamento_erro_desconto'),
      "warning",
    );
  }
  const valorNegativo = -Math.abs(novoDesconto.value.valor);
  try {
    const payload = {
      servico_id: props.servico.id,
      descricao: `Desconto: ${novoDesconto.value.motivo}`,
      valor: valorNegativo,
      tipo: "Desconto",
    };
    const { data, error } = await supabase
      .from("orcamento_itens")
      .insert([payload])
      .select();
    if (error) throw error;
    if (data) {
      emit("update:itensOrcamento", [...props.itensOrcamento, data[0]]);
      novoDesconto.value = { motivo: "", valor: null };
      triggerToast(t('os.orcamento_desconto_sucesso'), "success");
    }
  } catch (err) {
    triggerToast(t('os.orcamento_erro_aplicar_desc'), "error");
  }
}

async function removerItemOrcamento(id) {
  try {
    await supabase.from("orcamento_itens").delete().eq("id", id);
    emit(
      "update:itensOrcamento",
      props.itensOrcamento.filter((i) => i.id !== id),
    );
  } catch (err) {
    triggerToast(t('os.orcamento_erro_remover'), "error");
  }
}

// ============================================================================
// NOVO WHATSAPP ESTRUTURADO (App 5 Estrelas)
// ============================================================================
async function enviarOrcamentoWhatsApp() {
  if (props.itensOrcamento.length === 0) {
    return triggerToast(t('os.orcamento_aviso_vazio'), "warning");
  }

  try {
    if (!props.dadosCliente || !props.dadosCliente.telefone) {
      return triggerToast(t('os.orcamento_erro_telefone'), "error");
    }

    // Busca o nome do instrumento para personalizar a mensagem
    const instrumento = props.servico?.instrumentos;
    const nomeInst = instrumento
      ? `${instrumento.marca} ${instrumento.modelo}`
      : "instrumento";

    // Constrói a mensagem com formatação rica do WhatsApp (Negrito = *, Itálico = _)
    let mensagem = `Olá, *${props.dadosCliente.nome}*! Tudo bem?\n\n`;
    mensagem += `Aqui é da oficina e o orçamento para o seu *${nomeInst}* (O.S. #${props.servico.numero_os}) já está pronto! 🎸✨\n\n`;

    mensagem += `*🛠️ SERVIÇOS E PEÇAS:*\n`;
    mensagem += `-----------------------------------\n`;

    props.itensOrcamento.forEach((item) => {
      // Usa ícones diferentes dependendo do tipo de item
      let icone = "🔧";
      if (item.tipo === "Peça") icone = "⚙️";
      if (item.tipo === "Desconto") icone = "🎁";

      let valorFormatado = Number(item.valor).toFixed(2);
      mensagem += `${icone} ${item.descricao}\n      *R$ ${valorFormatado}*\n`;
    });

    mensagem += `-----------------------------------\n`;
    mensagem += `*💰 TOTAL DO ORÇAMENTO: R$ ${props.totalOrcamento.toFixed(2)}*\n\n`;

    mensagem += `Aprova a execução do serviço? Basta responder a esta mensagem com um *"Sim"*! 👍\n\n`;
    mensagem += `_Qualquer dúvida sobre os itens, estou à total disposição._`;

    // Usa a função padronizada do seu whatsappUtils.js
    abrirWhatsapp(props.dadosCliente, mensagem);
  } catch (err) {
    triggerToast(t('os.orcamento_erro_whatsapp'), "error");
  }
}

onMounted(() => carregarCatalogo());
</script>

<template>
  <div>
    <div class="card mb-2" v-if="!osFinalizada">
      <h4 style="margin-top: 0">
        <span class="icon-dinamico" style="vertical-align: middle"
          >add_shopping_cart</span
        >
        {{ $t('os.orcamento_add_item') }}
      </h4>
      <div class="form-group mb-1">
        <label>{{ $t('os.orcamento_buscar_catalogo') }}</label>
        <select v-model="idItemCatalogo" @change="usarItemCatalogo">
          <option value="">{{ $t('os.orcamento_preencher_manual') }}</option>
          <option v-for="cat in catalogoDropdown" :key="cat.id" :value="cat.id">
            {{ cat.nome }} (R$ {{ cat.preco_padrao }})
          </option>
        </select>
      </div>
      <div class="grid-orcamento mb-1">
        <input v-model="novoItem.descricao" :placeholder="$t('os.orcamento_desc_manual')" />
        <select v-model="novoItem.tipo">
          <option value="Mão de Obra">{{ $t('os.orcamento_mao_de_obra') }}</option>
          <option value="Peça">{{ $t('os.orcamento_peca') }}</option>
        </select>
        <input
          v-model.number="novoItem.valor"
          type="number"
          :placeholder="$t('os.orcamento_valor_placeholder')"
        />
        <button type="button" class="btn-primary" @click="adicionarItemOrcamento">
          {{ $t('os.orcamento_adicionar_btn') }}
        </button>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb-1" style="flex-wrap: wrap; gap: 10px">
        <h4 class="title-section" style="margin: 0; border: none">
          <span class="icon-dinamico" style="vertical-align: middle"
            >receipt_long</span
          >
          {{ $t('os.itens_os') }}
        </h4>

        <div style="display: flex; gap: 8px; align-items: center">
          <button type="button"
            class="btn-outline"
            @click="$emit('imprimir')"
            :title="$t('os.orcamento_imprimir_title')"
            style="padding: 6px 10px; font-size: 0.85rem"
          >
            <span
              class="icon-dinamico"
              style="font-size: 1.1rem; vertical-align: middle"
              >print</span
            >
            {{ $t('os.orcamento_imprimir_btn') }}
          </button>
          <button type="button"
            class="btn-outline"
            @click="enviarOrcamentoWhatsApp"
            :title="$t('os.orcamento_whatsapp_title')"
            style="
              padding: 6px 10px;
              font-size: 0.85rem;
              border-color: #25d366;
              color: #25d366;
            "
          >
            <span
              class="icon-dinamico"
              style="font-size: 1.1rem; vertical-align: middle"
              >chat</span
            >
            {{ $t('os.orcamento_whatsapp_btn') }}
          </button>
        </div>
      </div>

      <table class="tabela-padrao">
        <tr v-for="item in itensOrcamento" :key="item.id">
          <td>
            <strong :class="{ 'text-danger': item.tipo === 'Desconto' }">{{
              item.descricao
            }}</strong
            ><br />
            <span
              class="badge"
              style="font-size: 0.7rem"
              :style="
                item.tipo === 'Desconto' ? 'background: var(--danger)' : ''
              "
            >
              {{ item.tipo }}
            </span>
          </td>
          <td
            :class="{
              'text-danger': item.tipo === 'Desconto',
              'font-bold': item.tipo === 'Desconto',
            }"
          >
            R$ {{ Number(item.valor).toFixed(2) }}
          </td>
          <td align="center" v-if="!osFinalizada">
            <button type="button"
              class="btn-icon text-danger"
              @click="removerItemOrcamento(item.id)"
            >
              <span class="icon-dinamico">delete</span>
            </button>
          </td>
        </tr>
        <tr v-if="itensOrcamento.length === 0">
          <td colspan="3" class="text-center text-muted">
            {{ $t('os.orcamento_nenhum_item') }}
          </td>
        </tr>
      </table>

      <div
        class="text-right mt-2"
        style="
          border-top: 2px dashed var(--border);
          padding-top: 15px;
          text-align: right;
        "
      >
        <h3 style="margin: 0; color: var(--success)">
          {{ $t('os.total_rs') }} {{ totalOrcamento.toFixed(2) }}
        </h3>

        <div
          v-if="custoTotalEstimado > 0"
          style="
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
          "
        >
          <small
            style="display: block; color: var(--danger); font-weight: bold"
          >
            {{ $t('os.orcamento_custo_estimado') }}
            {{ custoTotalEstimado.toFixed(2) }}
          </small>
          <small
            style="
              display: block;
              color: var(--primary);
              font-weight: bold;
              font-size: 0.95rem;
              margin-top: 4px;
            "
          >
            {{ $t('os.orcamento_lucro_estimado') }}
            {{ (totalOrcamento - custoTotalEstimado).toFixed(2) }}
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-orcamento {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 10px;
  align-items: center;
}
.badge {
  background: #e2e8f0;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}
.font-bold {
  font-weight: bold;
}
@media (max-width: 768px) {
  .grid-orcamento {
    grid-template-columns: 1fr;
  }
}
</style>
