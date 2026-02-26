<script setup>
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

// Estados para Confirmação sem Alert
const idFotoParaDeletar = ref(null);
const idPagamentoParaEstornar = ref(null);
const confirmarValorExcedente = ref(false);
const sugestaoFinalizarOS = ref(false);

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
const arquivoFotoDiario = ref(null);
const subindoDiario = ref(false);

const checklistItens = ref([]);
const fotosChecklist = ref([]);
const subindoFotoChecklist = ref(false);

const itensOrcamento = ref([]);
const catalogoOriginal = ref([]);
const novoItem = ref({ descricao: "", valor: null, tipo: "Mão de Obra" });
const processandoOrcamento = ref(false);

const pagamentosOS = ref([]);
const subindoPagamento = ref(false);
const novoPagamento = ref({ valor: 0, metodo: "PIX" });

const osFinalizada = computed(
  () =>
    servicoLocal.value.status === "Finalizado" ||
    servicoLocal.value.status === "Entregue",
);

function formatarDataHora(dataIso) {
  if (!dataIso) return "---";
  const d = new Date(dataIso.length === 10 ? `${dataIso}T12:00:00` : dataIso);
  return isNaN(d.getTime()) ? "Data Inválida" : d.toLocaleDateString("pt-BR");
}

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

async function carregarConfig() {
  const { data } = await supabase
    .from("configuracoes")
    .select("*")
    .maybeSingle();
  if (data) configLuthieria.value = { ...configLuthieria.value, ...data };
}

async function carregarCatalogo() {
  const { data } = await supabase.from("catalogo").select("*").order("nome");
  if (data) catalogoOriginal.value = data;
}

async function carregarDiario() {
  const { data } = await supabase
    .from("diario_servico")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("data_registro", { ascending: false });
  if (data) diario.value = data;
}

async function carregarChecklist() {
  const { data } = await supabase
    .from("checklist_servico")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("id");
  if (data && data.length > 0) {
    checklistItens.value = data;
  } else {
    const { data: padroes } = await supabase
      .from("checklist_padrao")
      .select("*")
      .order("id");
    if (padroes?.length > 0) {
      const itens = padroes.map((p) => ({
        servico_id: servicoLocal.value.id,
        item_nome: `[${p.tipo}] ${p.item_nome}`,
        opcao_positiva: p.opcao_positiva || "✅ Sim",
        opcao_negativa: p.opcao_negativa || "❌ Não",
        status: "Pendente",
      }));
      const { data: inserted } = await supabase
        .from("checklist_servico")
        .insert(itens)
        .select();
      if (inserted) checklistItens.value = inserted;
    }
  }
}

async function carregarFotosChecklist() {
  const { data } = await supabase
    .from("checklist_fotos")
    .select("*")
    .eq("servico_id", servicoLocal.value.id);
  if (data) fotosChecklist.value = data;
}

async function carregarOrcamento() {
  const { data } = await supabase
    .from("itens_servico")
    .select("*")
    .eq("servico_id", servicoLocal.value.id);
  if (data) itensOrcamento.value = data;
}

async function carregarPagamentos() {
  const { data } = await supabase
    .from("transacoes")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("data_pagamento", { ascending: false });
  if (data) pagamentosOS.value = data;
}

async function registrarPagamento() {
  if (novoPagamento.value.valor <= 0)
    return triggerToast("Valor inválido.", "error");

  // Confirmação de valor excedente sem alert
  if (
    novoPagamento.value.valor > saldoDevedor.value + 0.05 &&
    !confirmarValorExcedente.value
  ) {
    confirmarValorExcedente.value = true;
    return triggerToast(
      "O valor excede o saldo. Clique novamente para confirmar.",
      "info",
    );
  }

  subindoPagamento.value = true;
  const transacao = {
    servico_id: servicoLocal.value.id,
    descricao: `Pgto O.S. #${servicoLocal.value.numero_os} - ${novoPagamento.value.metodo} ${taxaSelecionada.value > 0 ? "(" + taxaSelecionada.value + "% taxa)" : ""}`,
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
    triggerToast(`Recebido R$ ${novoPagamento.value.valor}`, "success");
    confirmarValorExcedente.value = false;

    if (saldoDevedor.value <= 0 && !osFinalizada.value) {
      sugestaoFinalizarOS.value = true;
    }
  }
  subindoPagamento.value = false;
}

async function finalizarOSAutomatico() {
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
  sugestaoFinalizarOS.value = false;
  triggerToast("Ordem de Serviço finalizada!", "success");
}

async function estornarPagamento(id) {
  if (idPagamentoParaEstornar.value === id) {
    await supabase.from("transacoes").delete().eq("id", id);
    pagamentosOS.value = pagamentosOS.value.filter((p) => p.id !== id);
    idPagamentoParaEstornar.value = null;
    triggerToast("Pagamento estornado.", "info");
  } else {
    idPagamentoParaEstornar.value = id;
    setTimeout(() => {
      if (idPagamentoParaEstornar.value === id)
        idPagamentoParaEstornar.value = null;
    }, 3000);
  }
}

async function deletarFoto(id) {
  if (idFotoParaDeletar.value === id) {
    await supabase.from("checklist_fotos").delete().eq("id", id);
    fotosChecklist.value = fotosChecklist.value.filter((f) => f.id !== id);
    idFotoParaDeletar.value = null;
    triggerToast("Foto apagada.", "info");
  } else {
    idFotoParaDeletar.value = id;
    setTimeout(() => {
      if (idFotoParaDeletar.value === id) idFotoParaDeletar.value = null;
    }, 3000);
  }
}

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
  (newVal) => {
    if (!confirmarValorExcedente.value) novoPagamento.value.valor = newVal;
  },
  { immediate: true },
);

const taxaSelecionada = computed(() => {
  const c = configLuthieria.value;
  if (novoPagamento.value.metodo === "PIX") return c.taxa_pix || 0;
  if (novoPagamento.value.metodo === "Dinheiro") return c.taxa_dinheiro || 0;
  if (novoPagamento.value.metodo === "Cartão de Crédito")
    return c.taxa_credito || 0;
  if (novoPagamento.value.metodo === "Cartão de Débito")
    return c.taxa_debito || 0;
  return 0;
});
const valorLiquidoPagamento = computed(() => {
  const v = Number(novoPagamento.value.valor) || 0;
  return v - v * (taxaSelecionada.value / 100);
});

// Funções de OBS e Itens (Simplificadas para o exemplo)
async function salvarObsChecklist() {
  await supabase
    .from("servicos")
    .update({ obs_checklist: servicoLocal.value.obs_checklist })
    .eq("id", servicoLocal.value.id);
  triggerToast("Obs salvas", "success");
}
async function salvarObsFechamento() {
  await supabase
    .from("servicos")
    .update({ obs_fechamento: servicoLocal.value.obs_fechamento })
    .eq("id", servicoLocal.value.id);
  triggerToast("Comentários salvos", "success");
}
async function adicionarItem() {
  const item = {
    servico_id: servicoLocal.value.id,
    descricao: novoItem.value.descricao,
    valor: novoItem.value.valor || 0,
    tipo: novoItem.value.tipo,
  };
  const { data } = await supabase.from("itens_servico").insert([item]).select();
  if (data) {
    itensOrcamento.value.push(data[0]);
    novoItem.value = { descricao: "", valor: null, tipo: "Mão de Obra" };
  }
}
async function removerItem(id) {
  await supabase.from("itens_servico").delete().eq("id", id);
  itensOrcamento.value = itensOrcamento.value.filter((i) => i.id !== id);
}

const checklistChegada = computed(() =>
  checklistItens.value.filter((i) => i.item_nome.startsWith("[Chegada]")),
);
const checklistSaida = computed(() =>
  checklistItens.value.filter((i) => i.item_nome.startsWith("[Saída]")),
);

function importarDoCatalogoOriginal(e) {
  const item = catalogoOriginal.value.find(
    (s) => String(s.id) === String(e.target.value),
  );
  if (item) {
    novoItem.value = {
      descricao: item.nome,
      valor: item.preco_padrao || item.custo_padrao || 0,
      tipo: item.tipo === "MaoDeObra" ? "Mão de Obra" : "Peça / Insumo",
    };
  }
}

onMounted(carregarTudo);
</script>

<template>
  <div class="execucao-container">
    <div class="flex-between mb-2">
      <h3 class="text-primary">
        O.S. #{{ servicoLocal.numero_os }} - {{ servicoLocal.fase_projeto }}
      </h3>
      <button class="btn-outline" @click="$emit('voltar')">Voltar</button>
    </div>

    <div class="tabs-clean">
      <button
        :class="{ active: abaAtual === 'checklist' }"
        @click="abaAtual = 'checklist'"
      >
        📋 Checklist
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
        💳 Pagamento
      </button>
    </div>

    <div v-if="osFinalizada" class="alerta-pago mb-2">
      🔒 O.S. Concluída. Histórico bloqueado.
    </div>

    <div v-if="carregandoDados" class="card text-center p-40">
      A carregar O.S...
    </div>

    <div v-else>
      <div v-if="abaAtual === 'orcamento'">
        <div class="card">
          <div v-if="!osFinalizada" class="mb-2">
            <select
              @change="importarDoCatalogoOriginal"
              class="w-full p-8 mb-1"
            >
              <option value="">📖 Importar do Catálogo...</option>
              <option v-for="s in catalogoOriginal" :key="s.id" :value="s.id">
                {{ s.nome }}
              </option>
            </select>
            <div class="grid-orcamento">
              <input v-model="novoItem.descricao" placeholder="Descrição..." />
              <input
                v-model.number="novoItem.valor"
                type="number"
                placeholder="R$"
              />
              <button class="btn-primary" @click="adicionarItem">➕</button>
            </div>
          </div>
          <table class="tabela-padrao">
            <tr v-for="item in itensOrcamento" :key="item.id">
              <td>{{ item.descricao }}</td>
              <td class="text-bold">R$ {{ Number(item.valor).toFixed(2) }}</td>
              <td v-if="!osFinalizada" align="center">
                <button class="btn-text-danger" @click="removerItem(item.id)">
                  Remover
                </button>
              </td>
            </tr>
          </table>
          <div class="card-footer bg-light-green flex-between">
            <strong>TOTAL</strong>
            <strong class="text-green"
              >R$ {{ totalOrcamento.toFixed(2) }}</strong
            >
          </div>
        </div>
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

          <div v-if="sugestaoFinalizarOS" class="alerta-sugestao mb-2">
            <p>🎉 Saldo zerado! Deseja finalizar esta O.S. agora?</p>
            <button class="btn-primary" @click="finalizarOSAutomatico">
              ✅ Sim, Finalizar O.S.
            </button>
            <button class="btn-text" @click="sugestaoFinalizarOS = false">
              Agora não
            </button>
          </div>

          <div v-if="saldoDevedor > 0 && !osFinalizada" class="form-pagamento">
            <div class="flex-gap-15">
              <select v-model="novoPagamento.metodo" class="flex-1">
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de Crédito">Cartão Crédito</option>
              </select>
              <input
                v-model.number="novoPagamento.valor"
                type="number"
                class="flex-1"
              />
            </div>
            <button
              class="btn-primary w-full mt-15"
              @click="registrarPagamento"
              :class="{ 'btn-warning': confirmarValorExcedente }"
            >
              {{
                confirmarValorExcedente
                  ? "⚠️ Confirmar Valor Maior?"
                  : "✅ Registrar Recebimento"
              }}
            </button>
          </div>

          <div class="mt-20">
            <h4>📑 Histórico</h4>
            <table class="tabela-padrao">
              <tr v-for="p in pagamentosOS" :key="p.id">
                <td>{{ formatarDataHora(p.data_pagamento) }}</td>
                <td class="text-green">
                  R$ {{ Number(p.valor_bruto).toFixed(2) }}
                </td>
                <td v-if="!osFinalizada">
                  <button
                    class="btn-delete-confirm"
                    @click="estornarPagamento(p.id)"
                    :class="{ confirming: idPagamentoParaEstornar === p.id }"
                  >
                    {{
                      idPagamentoParaEstornar === p.id
                        ? "Confirmar?"
                        : "Estornar"
                    }}
                  </button>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'checklist'">
        <div class="grid-2-cols">
          <div class="card checklist-box">
            <h4 class="title-chegada">📥 Chegada</h4>
            <div
              v-for="item in checklistChegada"
              :key="item.id"
              class="check-item-row"
            >
              <span>{{ item.item_nome.replace("[Chegada] ", "") }}</span>
              <div class="toggle-group" :class="{ bloqueado: osFinalizada }">
                <button
                  class="btn-toggle"
                  :class="{
                    'btn-active-pos':
                      item.status === (item.opcao_positiva || 'Boa'),
                  }"
                  @click="
                    atualizarStatusChecklist(item, item.opcao_positiva || 'Boa')
                  "
                >
                  {{ item.opcao_positiva || "Boa" }}
                </button>
                <button
                  class="btn-toggle"
                  :class="{
                    'btn-active-neg':
                      item.status === (item.opcao_negativa || 'Ruim'),
                  }"
                  @click="
                    atualizarStatusChecklist(
                      item,
                      item.opcao_negativa || 'Ruim',
                    )
                  "
                >
                  {{ item.opcao_negativa || "Ruim" }}
                </button>
              </div>
            </div>
          </div>
          <div class="card">
            <h4>📸 Fotos</h4>
            <div class="galeria-inline">
              <div
                v-for="foto in fotosChecklist"
                :key="foto.id"
                class="foto-thumb-wrapper"
              >
                <img :src="foto.foto_url" class="foto-img" />
                <button
                  v-if="!osFinalizada"
                  class="btn-del-foto"
                  @click="deletarFoto(foto.id)"
                  :class="{ confirming: idFotoParaDeletar === foto.id }"
                >
                  {{ idFotoParaDeletar === foto.id ? "?" : "❌" }}
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
/* Estilos existentes mantidos + Novos para confirmação */
.alerta-sugestao {
  background: #fffbeb;
  border: 2px solid #f59e0b;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}
.btn-delete-confirm {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-delete-confirm.confirming {
  background: #dc2626;
  color: white;
  font-weight: bold;
  animation: pulse 1s infinite;
}
.btn-del-foto.confirming {
  background: #dc2626;
  color: white;
  border-radius: 4px;
  width: auto;
  padding: 0 5px;
}
.btn-warning {
  background-color: #f59e0b !important;
  border-color: #f59e0b !important;
}
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}
/* ... (outros estilos omitidos para brevidade) */
</style>
