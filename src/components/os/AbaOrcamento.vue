<script setup>
/**
 * ============================================================================
 * @file        AbaOrcamento.vue
 * @description Sub-componente responsável pela montagem do orçamento,
 * catálogo, descontos e custos estimados.
 * ============================================================================
 */
import { ref, computed, onMounted } from "vue";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../composables/useToast";
import { calcularCustoEstimado } from "../../lib/financeiroUtils";

const props = defineProps({
  servico: Object,
  osFinalizada: Boolean,
  itensOrcamento: Array,
  dadosCliente: Object,
  totalOrcamento: Number,
});

const emit = defineEmits(["update:itensOrcamento", "imprimir"]);
const { triggerToast } = useToast();

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
    triggerToast("Erro Orçamento", "error");
  }
}

async function aplicarDesconto() {
  if (!novoDesconto.value.motivo || novoDesconto.value.valor <= 0) {
    return triggerToast(
      "Preencha o motivo e um valor válido para o desconto.",
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
      triggerToast("Desconto aplicado com sucesso!", "success");
    }
  } catch (err) {
    triggerToast("Erro ao aplicar desconto.", "error");
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
    triggerToast("Erro ao remover item", "error");
  }
}

async function enviarOrcamentoWhatsApp() {
  if (props.itensOrcamento.length === 0) {
    return triggerToast("Adicione itens ao orçamento primeiro.", "warning");
  }
  try {
    if (!props.dadosCliente || !props.dadosCliente.telefone) {
      return triggerToast("Telefone do cliente não encontrado.", "error");
    }

    let mensagem = `Olá, ${props.dadosCliente.nome}! Aqui está o orçamento da O.S. #${props.servico.numero_os}:\n\n`;
    props.itensOrcamento.forEach((item) => {
      mensagem += `- ${item.descricao}: R$ ${Number(item.valor).toFixed(2)}\n`;
    });
    mensagem += `\n*Total: R$ ${props.totalOrcamento.toFixed(2)}*\n\nQualquer dúvida, estamos à disposição!`;

    const numeroLimpo = props.dadosCliente.telefone.replace(/\D/g, "");
    const numeroFinal =
      numeroLimpo.length <= 11 ? `55${numeroLimpo}` : numeroLimpo;

    window.open(
      `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`,
      "_blank",
    );
  } catch (err) {
    triggerToast("Erro ao gerar link do WhatsApp.", "error");
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
        Adicionar Item
      </h4>
      <div class="form-group mb-1">
        <label>Buscar do Catálogo:</label>
        <select v-model="idItemCatalogo" @change="usarItemCatalogo">
          <option value="">-- Preencher Manualmente --</option>
          <option v-for="cat in catalogoDropdown" :key="cat.id" :value="cat.id">
            {{ cat.nome }} (R$ {{ cat.preco_padrao }})
          </option>
        </select>
      </div>
      <div class="grid-orcamento mb-1">
        <input v-model="novoItem.descricao" placeholder="Descrição manual" />
        <select v-model="novoItem.tipo">
          <option value="Mão de Obra">Mão de Obra</option>
          <option value="Peça">Peça</option>
        </select>
        <input
          v-model.number="novoItem.valor"
          type="number"
          placeholder="Valor R$"
        />
        <button class="btn-primary" @click="adicionarItemOrcamento">
          Adicionar
        </button>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb-1" style="flex-wrap: wrap; gap: 10px">
        <h4 class="title-section" style="margin: 0; border: none">
          <span class="icon-dinamico" style="vertical-align: middle"
            >receipt_long</span
          >
          Itens da O.S.
        </h4>

        <div style="display: flex; gap: 8px; align-items: center">
          <button
            class="btn-outline"
            @click="$emit('imprimir')"
            title="Imprimir Orçamento"
            style="padding: 6px 10px; font-size: 0.85rem"
          >
            <span
              class="icon-dinamico"
              style="font-size: 1.1rem; vertical-align: middle"
              >print</span
            >
            Imprimir
          </button>
          <button
            class="btn-outline"
            @click="enviarOrcamentoWhatsApp"
            title="Enviar por WhatsApp"
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
            WhatsApp
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
            <button
              class="btn-icon text-danger"
              @click="removerItemOrcamento(item.id)"
            >
              <span class="icon-dinamico">delete</span>
            </button>
          </td>
        </tr>
        <tr v-if="itensOrcamento.length === 0">
          <td colspan="3" class="text-center text-muted">
            Nenhum item adicionado.
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
          Total: R$ {{ totalOrcamento.toFixed(2) }}
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
            Custo Estimado (Peças + Insumos): - R$
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
            Lucro Estimado do Serviço: R$
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
