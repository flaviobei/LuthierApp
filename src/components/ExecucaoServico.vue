<script setup>
/**
 * ============================================================================
 * @file        ExecucaoServico.vue
 * @description Gestão da O.S. (Pai Orquestrador).
 * ATUALIZAÇÃO: Layouts responsivos de impressão (A4, Térmica 80mm e 58mm).
 * ============================================================================
 */
import { ref, computed, onMounted, nextTick } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import QRCode from "qrcode";

// IMPORTAÇÃO DOS SUB-COMPONENTES
import AbaChecklist from "./os/AbaChecklist.vue";
import AbaDiario from "./os/AbaDiario.vue";
import AbaOrcamento from "./os/AbaOrcamento.vue";
import AbaReceber from "./os/AbaReceber.vue";

const props = defineProps(["servico"]);
const emit = defineEmits(["voltar"]);
const { triggerToast } = useToast();

const servicoLocal = ref({ ...props.servico });
const carregandoDados = ref(true);
const abaAtual = ref("checklist");

const configLuthieria = ref({
  nome_luthieria: "Luthieria",
  tipo_impressora: "padrao",
  taxa_pix: 0,
  taxa_dinheiro: 0,
  taxa_credito: 0,
  taxa_debito: 0,
});

const dadosInstrumento = ref(null);
const dadosCliente = ref(null);
const qrCodeBase64 = ref("");
const tipoImpressao = ref("orcamento");

// Variáveis reativas globais partilhadas entre as abas e a área de impressão
const itensOrcamento = ref([]);
const pagamentosOS = ref([]);

const osFinalizada = computed(
  () =>
    servicoLocal.value.status === "Finalizado" ||
    servicoLocal.value.status === "Entregue",
);
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

async function carregarTudo() {
  carregandoDados.value = true;

  try {
    qrCodeBase64.value = await QRCode.toDataURL(servicoLocal.value.id, {
      width: 150,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch (err) {
    console.error("Erro ao gerar QR Code:", err);
  }

  await Promise.allSettled([
    carregarDadosCompletosDaOS(),
    carregarConfig(),
    carregarOrcamento(),
    carregarPagamentos(),
  ]);
  carregandoDados.value = false;
}

async function carregarDadosCompletosDaOS() {
  try {
    const { data } = await supabase
      .from("servicos")
      .select(`*, instrumentos(marca, modelo, clientes(nome, telefone))`)
      .eq("id", servicoLocal.value.id)
      .single();
    if (data) {
      dadosInstrumento.value = data.instrumentos;
      dadosCliente.value = data.instrumentos?.clientes;
    }
  } catch (err) {}
}

async function carregarConfig() {
  try {
    const { data } = await supabase
      .from("configuracoes")
      .select("*")
      .maybeSingle();
    if (data) configLuthieria.value = { ...configLuthieria.value, ...data };
  } catch (err) {}
}

async function carregarOrcamento() {
  try {
    const { data } = await supabase
      .from("orcamento_itens")
      .select("*")
      .eq("servico_id", servicoLocal.value.id)
      .order("created_at", { ascending: true });
    itensOrcamento.value = data || [];
  } catch (e) {}
}

async function carregarPagamentos() {
  try {
    const { data } = await supabase
      .from("transacoes")
      .select("*")
      .eq("servico_id", servicoLocal.value.id)
      .order("data_pagamento", { ascending: false });
    pagamentosOS.value = data || [];
  } catch (e) {}
}

function marcarComoFinalizada() {
  servicoLocal.value.status = "Finalizado";
  servicoLocal.value.fase_projeto = "Pronto para Entrega";
}

// MÉTODOS DE IMPRESSÃO
async function imprimirOrcamento() {
  tipoImpressao.value = "orcamento";
  await nextTick();
  window.print();
}
async function gerarRecibo() {
  tipoImpressao.value = "recibo";
  await nextTick();
  window.print();
}
async function imprimirQRCode() {
  if (!qrCodeBase64.value)
    return triggerToast("Aguarde a geração do QR Code...", "warning");
  tipoImpressao.value = "qrcode";
  await nextTick();
  window.print();
}

onMounted(carregarTudo);
</script>

<template>
  <div class="execucao-container">
    <div v-if="carregandoDados" class="text-center py-5">
      <div class="loader-simple" style="margin: 0 auto"></div>
      <p class="mt-2 text-muted">A carregar Ordem de Serviço...</p>
    </div>

    <div v-else>
      <div
        class="flex-header mb-2"
        style="
          flex-wrap: wrap;
          gap: 10px;
          background: #f8fafc;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid var(--border);
        "
      >
        <div
          style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap"
        >
          <h2 style="margin: 0; color: var(--primary)">
            O.S. #{{ servicoLocal.numero_os }}
          </h2>
          <span class="badge text-muted" style="font-size: 0.9rem">{{
            servicoLocal.fase_projeto
          }}</span>

          <button
            class="btn-outline"
            @click="imprimirQRCode"
            title="Imprimir Etiqueta QR Code"
            style="
              padding: 6px 12px;
              font-weight: bold;
              font-size: 0.85rem;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              border-color: var(--primary);
              color: var(--primary);
              background: white;
            "
          >
            <span class="icon-dinamico" style="font-size: 1.2rem"
              >qr_code_scanner</span
            >
            Imprimir Etiqueta
          </button>
        </div>

        <button
          class="btn-outline"
          @click="$emit('voltar')"
          style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: white;
          "
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >arrow_back</span
          >
          Voltar
        </button>
      </div>

      <div class="tabs-clean mb-2">
        <button
          :class="{ active: abaAtual === 'checklist' }"
          @click="abaAtual = 'checklist'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >fact_check</span
          >
          Checklist
        </button>
        <button
          :class="{ active: abaAtual === 'diario' }"
          @click="abaAtual = 'diario'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >menu_book</span
          >
          Diário
        </button>
        <button
          :class="{ active: abaAtual === 'orcamento' }"
          @click="abaAtual = 'orcamento'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >request_quote</span
          >
          Orçamento
        </button>
        <button
          :class="{ active: abaAtual === 'checkout' }"
          @click="abaAtual = 'checkout'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >point_of_sale</span
          >
          Receber
        </button>
      </div>

      <div
        v-if="osFinalizada"
        class="banner-aviso mb-2"
        style="background: #e2e8f0; color: #475569; border-color: #cbd5e1"
      >
        <span class="icon-dinamico">lock</span> O.S. Concluída. A edição de
        dados está bloqueada.
      </div>

      <AbaChecklist
        v-if="abaAtual === 'checklist'"
        :servico="servicoLocal"
        :os-finalizada="osFinalizada"
        @observacaoSalva="(val) => (servicoLocal.obs_checklist = val)"
      />

      <AbaDiario
        v-if="abaAtual === 'diario'"
        :servico="servicoLocal"
        :os-finalizada="osFinalizada"
        @faseAtualizada="(val) => (servicoLocal.fase_projeto = val)"
      />

      <AbaOrcamento
        v-if="abaAtual === 'orcamento'"
        :servico="servicoLocal"
        :os-finalizada="osFinalizada"
        :itens-orcamento="itensOrcamento"
        :dados-cliente="dadosCliente"
        :total-orcamento="totalOrcamento"
        @update:itensOrcamento="(val) => (itensOrcamento = val)"
        @imprimir="imprimirOrcamento"
      />

      <AbaReceber
        v-if="abaAtual === 'checkout'"
        :servico="servicoLocal"
        :os-finalizada="osFinalizada"
        :config-luthieria="configLuthieria"
        :pagamentos-o-s="pagamentosOS"
        :total-orcamento="totalOrcamento"
        :total-pago="totalPago"
        :saldo-devedor="saldoDevedor"
        @recarregarPagamentos="carregarPagamentos"
        @recarregarOrcamento="carregarOrcamento"
        @osFinalizadaSucesso="marcarComoFinalizada"
        @imprimirRecibo="gerarRecibo"
        @observacaoSalva="(val) => (servicoLocal.obs_fechamento = val)"
      />

      <div
        id="print-area"
        class="print-only"
        :class="'impressora-' + (configLuthieria.tipo_impressora || 'padrao')"
      >
        <div v-if="tipoImpressao === 'qrcode'" class="print-box-qr">
          <h2 class="print-title">
            {{ configLuthieria.nome_luthieria || "Luthieria" }}
          </h2>
          <hr class="print-divider" />
          <h1 class="print-os-number">O.S. #{{ servicoLocal.numero_os }}</h1>

          <div class="print-qr-info">
            <p>
              <strong>Cliente:</strong>
              {{ dadosCliente?.nome || "Não Registado" }}
            </p>
            <p>
              <strong>Inst:</strong> {{ dadosInstrumento?.marca }}
              {{ dadosInstrumento?.modelo }}
            </p>
            <p>
              <strong>Motivo:</strong>
              {{
                servicoLocal.descricao_cliente
                  ? servicoLocal.descricao_cliente.slice(0, 80) + "..."
                  : "Sem descrição"
              }}
            </p>
          </div>

          <div class="print-qr-image-wrapper">
            <img
              v-if="qrCodeBase64"
              :src="qrCodeBase64"
              alt="QR Code O.S."
              class="qr-code-img"
            />
            <p class="print-qr-hint text-muted">
              Aponte o "QR Scan" do sistema para aceder
            </p>
          </div>
        </div>

        <div
          v-if="tipoImpressao === 'orcamento' || tipoImpressao === 'recibo'"
          class="print-box-doc"
        >
          <div class="print-header">
            <img
              v-if="configLuthieria.logo_url"
              :src="configLuthieria.logo_url"
              class="print-logo"
            />
            <h2 class="print-title">
              {{ configLuthieria.nome_luthieria || "Luthieria" }}
            </h2>
            <p v-if="configLuthieria.telefone">
              WhatsApp: {{ configLuthieria.telefone }}
            </p>
            <p v-if="configLuthieria.endereco">
              {{ configLuthieria.endereco }}
            </p>
          </div>

          <hr class="print-divider" />

          <div class="print-info">
            <h3 class="print-doc-title">
              {{
                tipoImpressao === "orcamento"
                  ? "ORÇAMENTO DE SERVIÇO"
                  : "RECIBO DE PAGAMENTO"
              }}
            </h3>
            <p><strong>O.S. Nº:</strong> {{ servicoLocal.numero_os }}</p>
            <p><strong>Data:</strong> {{ new Date().toLocaleDateString() }}</p>
          </div>

          <hr class="print-divider" />

          <h4 class="print-section-title">Itens da O.S.</h4>
          <table class="print-table">
            <thead>
              <tr>
                <th align="left">Descrição</th>
                <th align="right">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in itensOrcamento" :key="item.id">
                <td align="left">{{ item.descricao }}</td>
                <td align="right">{{ Number(item.valor).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>

          <div class="print-total">
            <strong>Total: R$ {{ totalOrcamento.toFixed(2) }}</strong>
          </div>

          <div v-if="tipoImpressao === 'recibo'" class="print-payments">
            <hr class="print-divider" />
            <h4 class="print-section-title">Histórico de Pagamentos</h4>
            <table class="print-table">
              <thead>
                <tr>
                  <th align="left">Pgto / Data</th>
                  <th align="right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in pagamentosOS" :key="p.id">
                  <td align="left">
                    {{ p.forma_pagamento || p.descricao }}<br />
                    <small
                      >({{
                        new Date(
                          p.data_pagamento +
                            (p.data_pagamento.includes("T") ? "" : "T12:00:00"),
                        ).toLocaleDateString()
                      }})</small
                    >
                  </td>
                  <td align="right">{{ Number(p.valor_bruto).toFixed(2) }}</td>
                </tr>
                <tr v-if="pagamentosOS.length === 0">
                  <td
                    colspan="2"
                    style="text-align: center; font-style: italic"
                  >
                    Nenhum pagamento efetuado.
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="print-balances">
              <p><strong>Total Pago:</strong> R$ {{ totalPago.toFixed(2) }}</p>
              <p>
                <strong>Falta Receber:</strong> R$ {{ saldoDevedor.toFixed(2) }}
              </p>
            </div>
          </div>

          <div v-if="servicoLocal.obs_fechamento" class="print-notes">
            <hr class="print-divider" />
            <p><strong>Notas Importantes:</strong></p>
            <p style="white-space: pre-wrap">
              {{ servicoLocal.obs_fechamento }}
            </p>
          </div>

          <div class="print-footer">
            <p>Obrigado pela preferência!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ESTRUTURA GERAL */
.execucao-container {
  animation: fadeIn 0.3s ease-in-out;
}
.flex-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.badge {
  background: #e2e8f0;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}

/* ABAS (TABS) */
.tabs-clean {
  display: flex;
  gap: 5px;
  background: var(--border);
  padding: 5px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  white-space: nowrap;
}
.tabs-clean button {
  flex: 1;
  border: none;
  padding: 12px 15px;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tabs-clean button.active {
  background: white;
  color: var(--primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
