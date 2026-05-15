<script setup>
/**
 * ============================================================================
 * @file        AbaReceber.vue
 * @description Sub-componente responsável pelo financeiro da O.S.,
 * registro de pagamentos, estornos, descontos e conclusão da Ordem.
 * ============================================================================
 */
import { ref, watch } from "vue";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../composables/useToast";
import { calcularTaxaPagamento } from "../../lib/financeiroUtils";

const props = defineProps({
  servico: Object,
  osFinalizada: Boolean,
  configLuthieria: Object,
  totalOrcamento: Number,
  totalPago: Number,
  saldoDevedor: Number,
  pagamentosOS: Array,
});

const emit = defineEmits([
  "recarregarPagamentos",
  "recarregarOrcamento",
  "imprimirRecibo",
  "osFinalizadaSucesso",
  "observacaoSalva",
]);

const { triggerToast } = useToast();

function getLocalDatetime() {
  return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const novoPagamento = ref({
  valor: 0,
  metodo: "PIX",
  data_pagamento: getLocalDatetime(),
});

const pgtoExcedenteConfirmado = ref(false);
const mostrarBannerFinalizacao = ref(false);
const bannerOcultadoManual = ref(false);
const novoDesconto = ref({ motivo: "", valor: null });
const idPgtoConfirmar = ref(null);
const obsFechamentoLocal = ref(props.servico.obs_fechamento || props.configLuthieria?.termos_garantia || "");

// Mantém o campo de valor do pagamento sempre sincronizado com o que falta pagar
watch(
  () => props.saldoDevedor,
  (nv) => {
    if (!pgtoExcedenteConfirmado.value) novoPagamento.value.valor = nv;
  },
  { immediate: true },
);

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
    const { error } = await supabase.from("orcamento_itens").insert([payload]);
    if (error) throw error;

    novoDesconto.value = { motivo: "", valor: null };
    triggerToast("Desconto aplicado com sucesso!", "success");
    emit("recarregarOrcamento"); // Pede ao pai para atualizar o orçamento global
  } catch (err) {
    triggerToast("Erro ao aplicar desconto.", "error");
  }
}

async function registrarPagamento() {
  if (novoPagamento.value.valor <= 0) return;

  if (
    novoPagamento.value.valor > props.saldoDevedor + 0.05 &&
    !pgtoExcedenteConfirmado.value
  ) {
    pgtoExcedenteConfirmado.value = true;
    return triggerToast(
      "Valor excede o saldo. Clique para confirmar.",
      "warning",
    );
  }

  try {
    const valorDaTaxa = calcularTaxaPagamento(
      novoPagamento.value.valor,
      novoPagamento.value.metodo,
      props.configLuthieria,
    );

    const transacao = {
      servico_id: props.servico.id,
      descricao: `Pgto O.S. #${props.servico.numero_os} - ${novoPagamento.value.metodo}`,
      valor_bruto: novoPagamento.value.valor,
      taxa_taxa: valorDaTaxa,
      tipo: "Entrada",
      categoria: "Servico",
      forma_pagamento: novoPagamento.value.metodo,
      data_pagamento: novoPagamento.value.data_pagamento
        ? new Date(novoPagamento.value.data_pagamento).toISOString()
        : new Date().toISOString(),
    };

    const { error } = await supabase.from("transacoes").insert([transacao]);
    if (error) throw error;

    // Mostra o botão de finalizar OS se o pagamento zerar a dívida
    if (
      props.saldoDevedor - novoPagamento.value.valor <= 0 &&
      !props.osFinalizada
    ) {
      mostrarBannerFinalizacao.value = true;
    }

    pgtoExcedenteConfirmado.value = false;
    novoPagamento.value.data_pagamento = getLocalDatetime();
    triggerToast("Pagamento registrado!", "success");
    emit("recarregarPagamentos"); // Pede ao pai para carregar os pagamentos atualizados
  } catch (err) {
    triggerToast("Erro Pagamento: " + err.message, "error");
  }
}

async function estornarPagamento(id) {
  if (idPgtoConfirmar.value === id) {
    await supabase.from("transacoes").delete().eq("id", id);
    idPgtoConfirmar.value = null;
    emit("recarregarPagamentos");
  } else {
    idPgtoConfirmar.value = id;
    setTimeout(() => {
      if (idPgtoConfirmar.value === id) idPgtoConfirmar.value = null;
    }, 3000);
  }
}

async function finalizarOSManual() {
  await supabase
    .from("servicos")
    .update({
      status: "Finalizado",
      fase_projeto: "Pronto para Entrega",
      data_conclusao: new Date().toISOString(),
      obs_fechamento: obsFechamentoLocal.value
    })
    .eq("id", props.servico.id);

  emit("observacaoSalva", obsFechamentoLocal.value);
  mostrarBannerFinalizacao.value = false;
  emit("osFinalizadaSucesso"); // Pede ao pai para atualizar a interface visual
}

async function salvarObservacoes() {
  try {
    const { error } = await supabase
      .from("servicos")
      .update({ obs_fechamento: obsFechamentoLocal.value })
      .eq("id", props.servico.id);
    if (error) throw error;
    triggerToast("Notas salvas com sucesso!", "success");
    emit("observacaoSalva", obsFechamentoLocal.value);
  } catch (err) {
    triggerToast("Erro ao salvar notas: " + err.message, "error");
  }
}
</script>

<template>
  <div class="card">
    <div class="resumo-financeiro mb-2">
      <div class="caixa-valor total">
        <small>Total do Serviço</small>
        <strong>R$ {{ totalOrcamento.toFixed(2) }}</strong>
      </div>
      <div class="caixa-valor pago">
        <small>Valor Pago</small>
        <strong>R$ {{ totalPago.toFixed(2) }}</strong>
      </div>
      <div class="caixa-valor restante" :class="{ zerado: saldoDevedor <= 0 }">
        <small>Falta Receber</small>
        <strong>R$ {{ saldoDevedor.toFixed(2) }}</strong>
      </div>
    </div>

    <div
      v-if="
        (mostrarBannerFinalizacao || saldoDevedor <= 0) &&
        !osFinalizada &&
        !bannerOcultadoManual
      "
      class="banner-aviso mb-2"
      style="
        background: #dcfce7;
        color: var(--success);
        border-color: var(--success);
      "
    >
      <p style="margin-top: 0; display: flex; align-items: center; gap: 8px">
        <span class="icon-dinamico" style="font-size: 1.2rem">celebration</span>
        <span v-if="totalOrcamento === 0"
          >O.S. sem custo pendente. Deseja finalizar a O.S. agora?</span
        >
        <span v-else
          >Saldo liquidado! Deseja finalizar e bloquear a O.S. agora?</span
        >
      </p>
      <div class="flex-gap-10">
        <button type="button"
          class="btn-primary"
          @click="finalizarOSManual"
          style="background: var(--success)"
        >
          Sim, Finalizar O.S.
        </button>
        <button type="button"
          class="btn-outline"
          @click="
            mostrarBannerFinalizacao = false;
            bannerOcultadoManual = true;
          "
        >
          Agora não
        </button>
      </div>
    </div>

    <div
      v-if="saldoDevedor > 0 && !osFinalizada"
      class="form-pagamento mb-2"
      style="background-color: #fdf2f8; border-color: #fbcfe8"
    >
      <h4
        style="
          margin-top: 0;
          color: #db2777;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">sell</span> Conceder Desconto
      </h4>
      <div class="flex-gap-10" style="flex-wrap: wrap">
        <input
          v-model="novoDesconto.motivo"
          placeholder="Motivo (Ex: Parceria, Atraso...)"
          style="flex: 2; min-width: 150px; border-color: #fbcfe8"
        />
        <input
          v-model.number="novoDesconto.valor"
          type="number"
          style="flex: 1; min-width: 100px; border-color: #fbcfe8"
          placeholder="Valor R$"
        />
        <button type="button"
          class="btn-outline"
          @click="aplicarDesconto"
          style="
            color: #db2777;
            border-color: #db2777;
            display: flex;
            align-items: center;
            gap: 6px;
          "
        >
          <span class="icon-dinamico">remove_circle</span> Aplicar Desconto
        </button>
      </div>
    </div>

    <div v-if="saldoDevedor > 0 && !osFinalizada" class="form-pagamento mb-2">
      <h4 style="margin: 0; display: flex; align-items: center; gap: 8px">
        <span class="icon-dinamico">payments</span> Registrar Pagamento
      </h4>
      <div class="flex-gap-10 mt-1" style="flex-wrap: wrap">
        <input
          type="datetime-local"
          v-model="novoPagamento.data_pagamento"
          style="flex: 1; min-width: 120px"
          title="Data do Pagamento"
        />
        <select
          v-model="novoPagamento.metodo"
          style="flex: 1; min-width: 120px"
        >
          <option value="PIX">PIX</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Cartão de Crédito">Cartão de Crédito</option>
          <option value="Cartão de Débito">Cartão de Débito</option>
        </select>
        <input
          v-model.number="novoPagamento.valor"
          type="number"
          style="flex: 1; min-width: 100px"
          placeholder="R$"
        />
        <button type="button"
          class="btn-primary"
          @click="registrarPagamento"
          :class="{ 'btn-warning': pgtoExcedenteConfirmado }"
          style="flex: 1; min-width: 120px"
        >
          <span
            v-if="pgtoExcedenteConfirmado"
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle; margin-right: 4px"
            >warning</span
          >
          {{ pgtoExcedenteConfirmado ? "Confirmar?" : "Receber" }}
        </button>
      </div>
    </div>

    <div
      class="flex-between mb-1"
      style="border-top: 1px solid var(--border); padding-top: 20px"
    >
      <h4 style="margin: 0">Histórico de Transações</h4>
      <div style="display: flex; gap: 10px">
        <button type="button"
          v-if="!osFinalizada && bannerOcultadoManual && saldoDevedor <= 0"
          class="btn-primary"
          @click="
            bannerOcultadoManual = false;
            mostrarBannerFinalizacao = true;
          "
          style="
            background: var(--success);
            border-color: var(--success);
            color: white;
          "
        >
          <span class="icon-dinamico">check_circle</span> Finalizar O.S.
        </button>
        <button type="button"
          class="btn-outline"
          @click="$emit('imprimirRecibo')"
          title="Imprimir Recibo"
        >
          <span class="icon-dinamico">print</span> Recibo
        </button>
      </div>
    </div>

    <table class="tabela-padrao">
      <tr v-for="p in pagamentosOS" :key="p.id">
        <td>
          <strong>{{ p.descricao }}</strong
          ><br />
          <small class="text-muted">{{
            new Date(
              p.data_pagamento +
                (p.data_pagamento.includes("T") ? "" : "T12:00:00"),
            ).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
          }}</small>
        </td>
        <td>R$ {{ Number(p.valor_bruto).toFixed(2) }}</td>
        <td align="center" v-if="!osFinalizada">
          <button type="button"
            class="btn-delete-confirm"
            @click="estornarPagamento(p.id)"
            :class="{ confirming: idPgtoConfirmar === p.id }"
          >
            {{ idPgtoConfirmar === p.id ? "Confirmar?" : "Estornar" }}
          </button>
        </td>
      </tr>
      <tr v-if="pagamentosOS.length === 0">
        <td colspan="3" class="text-center text-muted">
          Nenhum pagamento efetuado.
        </td>
      </tr>
    </table>

    <div
      style="
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
      "
    >
      <h4
        style="
          margin-top: 0;
          font-size: 1rem;
          color: var(--text-main);
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">speaker_notes</span> Notas de Fechamento /
        Garantia
      </h4>
      <p
        class="text-muted"
        style="font-size: 0.8rem; margin-top: -5px; margin-bottom: 10px"
      >
        Este texto sairá impresso no recibo/orçamento final do cliente.
      </p>
      <textarea
        v-model="obsFechamentoLocal"
        rows="3"
        placeholder="Dicas de conservação, termos de garantia, alertas..."
        :disabled="osFinalizada"
        style="width: 100%"
      ></textarea>
      <button type="button"
        v-if="!osFinalizada"
        class="btn-primary"
        @click="salvarObservacoes"
        style="
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 0.85rem;
        "
      >
        <span class="icon-dinamico" style="font-size: 1.1rem">save</span> Salvar
        Notas
      </button>
    </div>
  </div>
</template>

<style scoped>
.resumo-financeiro {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.caixa-valor {
  padding: 15px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid var(--border);
}
.caixa-valor small {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 5px;
}
.caixa-valor strong {
  font-size: 1.4rem;
  color: var(--text-main);
}
.caixa-valor.total {
  background: #f8fafc;
}
.caixa-valor.pago {
  background: #f0fdf4;
  border-color: #bbf7d0;
}
.caixa-valor.pago strong {
  color: #16a34a;
}
.caixa-valor.restante {
  background: #fef2f2;
  border-color: #fecaca;
}
.caixa-valor.restante strong {
  color: #dc2626;
}
.caixa-valor.zerado {
  background: #f8fafc;
  border-color: var(--border);
}
.caixa-valor.zerado strong {
  color: var(--text-muted);
}

.banner-aviso {
  padding: 15px;
  border-radius: var(--radius-sm);
  border-left: 5px solid;
  font-weight: bold;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.btn-warning {
  background: var(--warning) !important;
  color: #fff !important;
}

.btn-delete-confirm {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
  font-family: inherit;
}
.btn-delete-confirm.confirming {
  background: #dc2626;
  color: white;
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

@media (max-width: 768px) {
  .resumo-financeiro {
    grid-template-columns: 1fr;
  }
  .form-pagamento .flex-gap-10 {
    flex-direction: column;
  }
  .form-pagamento select,
  .form-pagamento input,
  .form-pagamento button {
    width: 100%;
    flex: none;
  }
}
</style>
