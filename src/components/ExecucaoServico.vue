<script setup>
/**
 * ============================================================================
 * @file        ExecucaoServico.vue
 * @description Gestão da O.S. (Checklist, Diário, Orçamento e Pagamento).
 * Atualizado para eliminar alertas nativos e usar confirmação em dois passos.
 * ============================================================================
 */
import { ref, computed, onMounted, watch } from "vue";
import { supabase } from "../lib/supabaseClient";
import { comprimirImagem } from "../lib/imageUtils";
import { useToast } from "../composables/useToast";

const props = defineProps(["servico"]);
const emit = defineEmits(["voltar"]);
const { triggerToast } = useToast();

const servicoLocal = ref({ ...props.servico });
const carregandoDados = ref(true);
const abaAtual = ref("orcamento");

// Estados de Confirmação (UX PWA)
const idFotoConfirmar = ref(null);
const idPgtoConfirmar = ref(null);
const pgtoExcedenteConfirmado = ref(false);
const mostrarBannerFinalizacao = ref(false);

const configLuthieria = ref({
  nome_luthieria: "Minha Luthieria",
  logo_url: "",
  taxa_pix: 0,
  taxa_dinheiro: 0,
  taxa_credito: 0,
  taxa_debito: 0,
});

const diario = ref([]);
const fasesPermitidas = [
  "Fila de Espera",
  "Aguardando Peças",
  "Secagem / Cura",
  "Na Bancada",
  "Testes / Setup",
  "Pronto para Entrega",
];
const novaEntradaDiario = ref({
  descricao: "",
  fase_projeto: servicoLocal.value.fase_projeto || "Na Bancada",
  data_registro: new Date().toISOString().substring(0, 10),
});
const checklistItens = ref([]);
const fotosChecklist = ref([]);
const itensOrcamento = ref([]);
const catalogoOriginal = ref([]);
const novoItem = ref({ descricao: "", valor: null, tipo: "Mão de Obra" });
const pagamentosOS = ref([]);
const novoPagamento = ref({ valor: 0, metodo: "PIX" });

const osFinalizada = computed(
  () =>
    servicoLocal.value.status === "Finalizado" ||
    servicoLocal.value.status === "Entregue",
);

async function carregarTudo() {
  carregandoDados.value = true;
  await Promise.all([
    carregarConfig(),
    carregarDiario(),
    carregarChecklist(),
    carregarFotosChecklist(),
    carregarOrcamento(),
    carregarCatalogo(),
    carregarPagamentos(),
  ]);
  carregandoDados.value = false;
}

// Lógica de Pagamento sem Confirm()
async function registrarPagamento() {
  if (novoPagamento.value.valor <= 0)
    return triggerToast("Valor inválido.", "error");

  if (
    novoPagamento.value.valor > saldoDevedor.value + 0.05 &&
    !pgtoExcedenteConfirmado.value
  ) {
    pgtoExcedenteConfirmado.value = true;
    return triggerToast(
      "Valor maior que o saldo. Clique novamente para confirmar.",
      "info",
    );
  }

  const transacao = {
    servico_id: servicoLocal.value.id,
    descricao: `Pgto O.S. #${servicoLocal.value.numero_os} - ${novoPagamento.value.metodo}`,
    valor_bruto: novoPagamento.value.valor,
    tipo: "Entrada",
    categoria: "Servico",
    data_pagamento: new Date().toISOString().substring(0, 10),
  };

  const { data, error } = await supabase
    .from("transacoes")
    .insert([transacao])
    .select();

  if (!error && data) {
    pagamentosOS.value.unshift(data[0]);
    triggerToast(`Recebido: R$ ${novoPagamento.value.valor}`, "success");
    pgtoExcedenteConfirmado.value = false;
    if (saldoDevedor.value <= 0 && !osFinalizada.value)
      mostrarBannerFinalizacao.value = true;
  }
}

async function finalizarOSManual() {
  await supabase
    .from("servicos")
    .update({
      status: "Finalizado",
      fase_projeto: "Pronto para Entrega",
      data_conclusao: new Date().toISOString(),
    })
    .eq("id", servicoLocal.value.id);
  servicoLocal.value.status = "Finalizado";
  servicoLocal.value.fase_projeto = "Pronto para Entrega";
  mostrarBannerFinalizacao.value = false;
  triggerToast("O.S. Finalizada!", "success");
}

async function deletarFoto(id) {
  if (idFotoConfirmar.value === id) {
    await supabase.from("checklist_fotos").delete().eq("id", id);
    fotosChecklist.value = fotosChecklist.value.filter((f) => f.id !== id);
    idFotoConfirmar.value = null;
    triggerToast("Foto removida.", "info");
  } else {
    idFotoConfirmar.value = id;
    setTimeout(() => {
      if (idFotoConfirmar.value === id) idFotoConfirmar.value = null;
    }, 3000);
  }
}

async function estornarPagamento(id) {
  if (idPgtoConfirmar.value === id) {
    await supabase.from("transacoes").delete().eq("id", id);
    pagamentosOS.value = pagamentosOS.value.filter((p) => p.id !== id);
    idPgtoConfirmar.value = null;
    triggerToast("Pagamento estornado.", "info");
  } else {
    idPgtoConfirmar.value = id;
    setTimeout(() => {
      if (idPgtoConfirmar.value === id) idPgtoConfirmar.value = null;
    }, 3000);
  }
}

// Funções de apoio (carregamento, orçamentos, etc) omitidas para foco na correção, mas mantidas no arquivo real
const totalOrcamento = computed(() =>
  itensOrcamento.value.reduce((acc, i) => acc + (Number(i.valor) || 0), 0),
);
const totalPago = computed(() =>
  pagamentosOS.value
    .filter((p) => p.tipo === "Entrada")
    .reduce((acc, p) => acc + Number(p.valor_bruto), 0),
);
const saldoDevedor = computed(() =>
  Math.max(0, totalOrcamento.value - totalPago.value),
);
watch(
  saldoDevedor,
  (nv) => {
    if (!pgtoExcedenteConfirmado.value) novoPagamento.value.valor = nv;
  },
  { immediate: true },
);

onMounted(carregarTudo);
</script>

<template>
  <div class="execucao-container">
    <div class="flex-header">
      <h3>O.S. #{{ servicoLocal.numero_os }}</h3>
      <button class="btn-outline" @click="$emit('voltar')">Voltar</button>
    </div>

    <div class="tabs-clean">
      <button
        :class="{ active: abaAtual === 'checklist' }"
        @click="abaAtual = 'checklist'"
      >
        📋 Checklists
      </button>
      <button
        :class="{ active: abaAtual === 'diario' }"
        @click="abaAtual = 'diario'"
      >
        📓 Diário
      </button>
      <button
        :class="{ active: abaAtual === 'orcamento' }"
        @click="abaAtual = 'orcamento'"
      >
        💰 Orçamento
      </button>
      <button
        :class="{ active: abaAtual === 'checkout' }"
        @click="abaAtual = 'checkout'"
      >
        💳 Recebimento
      </button>
    </div>

    <div v-if="osFinalizada" class="alerta-pago mb-2">
      🔒 O.S. Concluída. Histórico bloqueado.
    </div>

    <div v-if="abaAtual === 'checkout'">
      <div class="card">
        <div class="resumo-financeiro">
          <div class="caixa-valor total">
            <small>Total</small
            ><strong>R$ {{ totalOrcamento.toFixed(2) }}</strong>
          </div>
          <div class="caixa-valor pago">
            <small>Pago</small><strong>R$ {{ totalPago.toFixed(2) }}</strong>
          </div>
          <div
            class="caixa-valor restante"
            :class="{ zerado: saldoDevedor <= 0 }"
          >
            <small>Saldo</small
            ><strong>R$ {{ saldoDevedor.toFixed(2) }}</strong>
          </div>
        </div>

        <div v-if="mostrarBannerFinalizacao" class="banner-success-action mb-2">
          <p>🎉 Saldo liquidado! Deseja finalizar a O.S. agora?</p>
          <div class="flex-gap-10">
            <button
              class="btn-primary"
              @click="finalizarOSManual"
              style="background: #10b981"
            >
              Sim, Finalizar O.S.
            </button>
            <button class="btn-text" @click="mostrarBannerFinalizacao = false">
              Agora não
            </button>
          </div>
        </div>

        <div v-if="saldoDevedor > 0 && !osFinalizada" class="form-pagamento">
          <div class="flex-gap-15">
            <select v-model="novoPagamento.metodo" class="flex-1">
              <option value="PIX">PIX</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
            </select>
            <input
              v-model.number="novoPagamento.valor"
              type="number"
              class="flex-1"
            />
          </div>
          <button
            class="btn-primary w-full mt-1"
            @click="registrarPagamento"
            :class="{ 'btn-warning': pgtoExcedenteConfirmado }"
          >
            {{
              pgtoExcedenteConfirmado
                ? "⚠️ Confirmar valor maior?"
                : "✅ Registrar Recebimento"
            }}
          </button>
        </div>

        <div class="mt-2">
          <h4>Histórico de Pagamentos</h4>
          <table class="tabela-padrao">
            <tr v-for="p in pagamentosOS" :key="p.id">
              <td>{{ p.data_pagamento }}</td>
              <td>R$ {{ Number(p.valor_bruto).toFixed(2) }}</td>
              <td v-if="!osFinalizada">
                <button
                  class="btn-delete-confirm"
                  @click="estornarPagamento(p.id)"
                  :class="{ confirming: idPgtoConfirmar === p.id }"
                >
                  {{ idPgtoConfirmar === p.id ? "Confirmar?" : "Estornar" }}
                </button>
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flex-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.tabs-clean {
  display: flex;
  gap: 5px;
  background: #eee;
  padding: 5px;
  border-radius: 8px;
  overflow-x: auto;
}
.tabs-clean button {
  flex: 1;
  border: none;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
}
.tabs-clean button.active {
  background: white;
  color: var(--primary);
  font-weight: bold;
}
.banner-success-action {
  background: #dcfce7;
  border: 2px solid #22c55e;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}
.btn-delete-confirm {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: 0.3s;
}
.btn-delete-confirm.confirming {
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
