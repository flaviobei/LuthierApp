<script setup>
/**
 * ============================================================================
 * @file        ExecucaoServico.vue
 * @description Gestão da O.S. (Checklist, Diário, Orçamento e Pagamento).
 * ============================================================================
 */
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { supabase } from "../lib/supabaseClient";
import { comprimirImagem } from "../lib/imageUtils";
import { useToast } from "../composables/useToast";

const props = defineProps(["servico"]);
const emit = defineEmits(["voltar"]);
const { triggerToast } = useToast();

const servicoLocal = ref({ ...props.servico });
const carregandoDados = ref(true);
const abaAtual = ref("orcamento");

const idFotoConfirmar = ref(null);
const idPgtoConfirmar = ref(null);
const pgtoExcedenteConfirmado = ref(false);
const mostrarBannerFinalizacao = ref(false);

const configLuthieria = ref({
  nome_luthieria: "Luthieria",
  tipo_impressora: "padrao",
  taxa_pix: 0,
  taxa_dinheiro: 0,
  taxa_credito: 0,
  taxa_debito: 0,
});

// ================= DIÁRIO =================
const diario = ref([]);
const novaEntradaDiario = ref({
  descricao: "",
  fase_projeto: servicoLocal.value.fase_projeto || "Na Bancada",
});
const fotoDiarioUpload = ref(null);
const carregandoFotoDiario = ref(false);
const fasesPermitidas = [
  "Fila de Espera",
  "Aguardando Peças",
  "Secagem / Cura",
  "Na Bancada",
  "Testes / Setup",
  "Pronto para Entrega",
];

// ================= CHECKLIST =================
const checklistItens = ref([]);
const fotosChecklist = ref([]);
const carregandoFoto = ref(false);

// ================= ORÇAMENTO =================
const itensOrcamento = ref([]);
const catalogoOriginal = ref([]);
const idItemCatalogo = ref("");
const novoItem = ref({ descricao: "", valor: null, tipo: "Serviço" });

// ================= FINANCEIRO E IMPRESSÃO =================
const pagamentosOS = ref([]);
const novoPagamento = ref({ valor: 0, metodo: "PIX" });
const tipoImpressao = ref("orcamento"); // Controla o que vai aparecer no papel

const osFinalizada = computed(
  () =>
    servicoLocal.value.status === "Finalizado" ||
    servicoLocal.value.status === "Entregue",
);

// ==========================================
// 1. CARREGAMENTO INICIAL
// ==========================================
async function carregarTudo() {
  carregandoDados.value = true;
  await Promise.allSettled([
    carregarConfig(),
    carregarChecklist(),
    carregarFotosChecklist(),
    carregarDiario(),
    carregarOrcamento(),
    carregarCatalogo(),
    carregarPagamentos(),
  ]);
  carregandoDados.value = false;
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

// ==========================================
// 2. CHECKLIST
// ==========================================
async function carregarChecklist() {
  try {
    const { data: itensOS, error: errOS } = await supabase
      .from("checklist")
      .select("*")
      .eq("servico_id", servicoLocal.value.id)
      .order("id", { ascending: true });
    if (errOS) throw errOS;

    if (itensOS && itensOS.length > 0) {
      checklistItens.value = itensOS;
      return;
    }

    const { data: padrao, error: errPadrao } = await supabase
      .from("checklist_padrao")
      .select("*");
    if (errPadrao) throw errPadrao;

    if (padrao && padrao.length > 0) {
      const novosItens = padrao.map((p) => ({
        servico_id: servicoLocal.value.id,
        etapa: p.tipo || "Geral",
        area: p.item_nome || "Item sem nome",
        condicao: "Pendente",
        observacao: "",
      }));
      const { data: inseridos, error: errInsert } = await supabase
        .from("checklist")
        .insert(novosItens)
        .select();
      if (errInsert) throw errInsert;
      checklistItens.value = inseridos || [];
    } else {
      checklistItens.value = [];
    }
  } catch (error) {
    triggerToast("Erro ao carregar checklist: " + error.message, "error");
  }
}

async function atualizarStatusChecklist(item, statusOpcao) {
  try {
    const { error } = await supabase
      .from("checklist")
      .update({ condicao: statusOpcao })
      .eq("id", item.id);
    if (error) throw error;
    item.condicao = statusOpcao;
  } catch (err) {
    triggerToast("Falha ao atualizar item: " + err.message, "error");
  }
}

const checklistsAgrupados = computed(() => {
  const grupos = {};
  checklistItens.value.forEach((item) => {
    const etapaNome = item.etapa || "Geral";
    if (!grupos[etapaNome]) grupos[etapaNome] = [];
    grupos[etapaNome].push(item);
  });
  return Object.keys(grupos).map((etapa) => ({ etapa, itens: grupos[etapa] }));
});

// ==========================================
// 3. FOTOS DO CHECKLIST
// ==========================================
async function carregarFotosChecklist() {
  try {
    const { data, error } = await supabase
      .from("checklist_fotos")
      .select("*")
      .eq("servico_id", servicoLocal.value.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    fotosChecklist.value = data || [];
  } catch (err) {
    console.error(err);
  }
}

async function uploadFotoChecklist(event) {
  const arquivoOriginal = event.target.files[0];
  if (!arquivoOriginal) return;
  carregandoFoto.value = true;
  try {
    const arquivoComprimido = await comprimirImagem(
      arquivoOriginal,
      1200,
      1200,
      0.8,
    );
    const fileName = `${servicoLocal.value.id}/checklist_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("fotos-luthieria")
      .upload(fileName, arquivoComprimido);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("fotos-luthieria")
      .getPublicUrl(fileName);
    const { data: insertData, error: dbError } = await supabase
      .from("checklist_fotos")
      .insert([
        { servico_id: servicoLocal.value.id, foto_url: urlData.publicUrl },
      ])
      .select();
    if (dbError) throw dbError;

    if (insertData) fotosChecklist.value.unshift(insertData[0]);
    triggerToast("Foto anexada!", "success");
  } catch (err) {
    triggerToast("Erro ao gravar foto: " + err.message, "error");
  } finally {
    carregandoFoto.value = false;
  }
}

async function deletarFoto(id) {
  if (idFotoConfirmar.value === id) {
    try {
      const { error } = await supabase
        .from("checklist_fotos")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fotosChecklist.value = fotosChecklist.value.filter((f) => f.id !== id);
      idFotoConfirmar.value = null;
    } catch (err) {
      triggerToast("Erro ao excluir: " + err.message, "error");
    }
  } else {
    idFotoConfirmar.value = id;
    setTimeout(() => {
      if (idFotoConfirmar.value === id) idFotoConfirmar.value = null;
    }, 3000);
  }
}

// ==========================================
// 4. DIÁRIO
// ==========================================
async function carregarDiario() {
  try {
    const { data } = await supabase
      .from("diario_servico")
      .select("*")
      .eq("servico_id", servicoLocal.value.id)
      .order("data_registro", { ascending: false });
    diario.value = data || [];
  } catch (e) {}
}

function setFotoDiario(event) {
  fotoDiarioUpload.value = event.target.files[0];
}

async function adicionarEntradaDiario() {
  if (!novaEntradaDiario.value.descricao)
    return triggerToast("Anotação não pode estar vazia.", "error");
  carregandoFotoDiario.value = true;
  let urlFotoDiario = null;
  try {
    if (fotoDiarioUpload.value) {
      const arquivoComprimido = await comprimirImagem(
        fotoDiarioUpload.value,
        1200,
        1200,
        0.8,
      );
      const fileName = `${servicoLocal.value.id}/diario_${Date.now()}.jpg`;
      await supabase.storage
        .from("fotos-luthieria")
        .upload(fileName, arquivoComprimido);
      urlFotoDiario = supabase.storage
        .from("fotos-luthieria")
        .getPublicUrl(fileName).data.publicUrl;
    }
    const payload = {
      servico_id: servicoLocal.value.id,
      descricao: novaEntradaDiario.value.descricao,
      fase_projeto: novaEntradaDiario.value.fase_projeto,
      foto_url: urlFotoDiario,
    };
    const { data, error } = await supabase
      .from("diario_servico")
      .insert([payload])
      .select();
    if (error) throw error;
    if (data) {
      diario.value.unshift(data[0]);
      await supabase
        .from("servicos")
        .update({ fase_projeto: novaEntradaDiario.value.fase_projeto })
        .eq("id", servicoLocal.value.id);
      servicoLocal.value.fase_projeto = novaEntradaDiario.value.fase_projeto;
      novaEntradaDiario.value.descricao = "";
      fotoDiarioUpload.value = null;
      triggerToast("Anotação salva!", "success");
    }
  } catch (err) {
    triggerToast("Erro no diário: " + err.message, "error");
  } finally {
    carregandoFotoDiario.value = false;
  }
}

// ==========================================
// 5. ORÇAMENTO
// ==========================================
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

async function carregarCatalogo() {
  try {
    const { data } = await supabase
      .from("catalogo")
      .select("*")
      .neq("tipo", "Insumo")
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
    novoItem.value.tipo = selecionado.tipo === "Peça" ? "Peça" : "Serviço";
  }
}

async function adicionarItemOrcamento() {
  if (!novoItem.value.descricao || !novoItem.value.valor) return;
  try {
    const { data, error } = await supabase
      .from("orcamento_itens")
      .insert([
        {
          servico_id: servicoLocal.value.id,
          descricao: novoItem.value.descricao,
          valor: novoItem.value.valor,
          tipo: novoItem.value.tipo,
        },
      ])
      .select();
    if (error) throw error;
    if (data) {
      itensOrcamento.value.push(data[0]);
      novoItem.value = { descricao: "", valor: null, tipo: "Serviço" };
      idItemCatalogo.value = "";
    }
  } catch (err) {
    triggerToast("Erro Orçamento", "error");
  }
}

async function removerItemOrcamento(id) {
  await supabase.from("orcamento_itens").delete().eq("id", id);
  itensOrcamento.value = itensOrcamento.value.filter((i) => i.id !== id);
}

async function enviarOrcamentoWhatsApp() {
  if (itensOrcamento.value.length === 0) {
    return triggerToast("Adicione itens ao orçamento primeiro.", "warning");
  }

  try {
    const { data: servicoData, error } = await supabase
      .from("servicos")
      .select("instrumentos(clientes(nome, telefone))")
      .eq("id", servicoLocal.value.id)
      .single();

    if (error) throw error;

    const cliente = servicoData?.instrumentos?.clientes;
    if (!cliente || !cliente.telefone) {
      return triggerToast("Telefone do cliente não encontrado.", "error");
    }

    let mensagem = `Olá, ${cliente.nome}! Aqui está o orçamento da O.S. #${servicoLocal.value.numero_os}:\n\n`;
    itensOrcamento.value.forEach((item) => {
      mensagem += `- ${item.descricao}: R$ ${Number(item.valor).toFixed(2)}\n`;
    });
    mensagem += `\n*Total: R$ ${totalOrcamento.value.toFixed(2)}*\n\n`;
    mensagem += `Qualquer dúvida, estamos à disposição!`;

    const numeroLimpo = cliente.telefone.replace(/\D/g, "");
    const numeroFinal =
      numeroLimpo.length <= 11 ? `55${numeroLimpo}` : numeroLimpo;

    const url = `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
  } catch (err) {
    triggerToast("Erro ao gerar link do WhatsApp.", "error");
    console.error(err);
  }
}

// MÉTODOS DE IMPRESSÃO CORRIGIDOS PARA BLOQUEAR A UI
async function imprimirOrcamento() {
  tipoImpressao.value = "orcamento";
  await nextTick(); // Aguarda o Vue atualizar a DOM
  window.print();
}

async function gerarRecibo() {
  tipoImpressao.value = "recibo";
  await nextTick(); // Aguarda o Vue atualizar a DOM
  window.print();
}

// ==========================================
// 6. FINANCEIRO E RECEBIMENTO
// ==========================================
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

async function registrarPagamento() {
  if (novoPagamento.value.valor <= 0) return;
  if (
    novoPagamento.value.valor > saldoDevedor.value + 0.05 &&
    !pgtoExcedenteConfirmado.value
  ) {
    pgtoExcedenteConfirmado.value = true;
    return triggerToast(
      "Valor excede o saldo. Clique para confirmar.",
      "warning",
    );
  }
  try {
    // --- CÁLCULO DA TAXA INJETADO AQUI ---
    let percentualTaxa = 0;
    const metodo = novoPagamento.value.metodo;
    if (metodo === "PIX") {
      percentualTaxa = Number(configLuthieria.value.taxa_pix) || 0;
    } else if (metodo === "Dinheiro") {
      percentualTaxa = Number(configLuthieria.value.taxa_dinheiro) || 0;
    } else if (metodo === "Cartão de Crédito") {
      percentualTaxa = Number(configLuthieria.value.taxa_credito) || 0;
    } else if (metodo === "Cartão de Débito") {
      percentualTaxa = Number(configLuthieria.value.taxa_debito) || 0;
    }

    const valorDaTaxa = (novoPagamento.value.valor * percentualTaxa) / 100;
    // -------------------------------------

    const transacao = {
      servico_id: servicoLocal.value.id,
      descricao: `Pgto O.S. #${servicoLocal.value.numero_os} - ${novoPagamento.value.metodo}`,
      valor_bruto: novoPagamento.value.valor,
      taxa_taxa: valorDaTaxa, // <--- ENVIAMOS O VALOR DA TAXA PARA O BANCO DE DADOS
      tipo: "Entrada",
      categoria: "Servico",
      forma_pagamento: novoPagamento.value.metodo,
      data_pagamento: new Date().toISOString().substring(0, 10),
    };
    const { data, error } = await supabase
      .from("transacoes")
      .insert([transacao])
      .select();
    if (error) throw error;
    if (data) {
      pagamentosOS.value.unshift(data[0]);
      pgtoExcedenteConfirmado.value = false;
      triggerToast("Pagamento registrado!", "success");
      if (saldoDevedor.value <= 0 && !osFinalizada.value)
        mostrarBannerFinalizacao.value = true;
    }
  } catch (err) {
    triggerToast("Erro Pagamento: " + err.message, "error");
  }
}

async function estornarPagamento(id) {
  if (idPgtoConfirmar.value === id) {
    await supabase.from("transacoes").delete().eq("id", id);
    pagamentosOS.value = pagamentosOS.value.filter((p) => p.id !== id);
    idPgtoConfirmar.value = null;
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
    })
    .eq("id", servicoLocal.value.id);
  servicoLocal.value.status = "Finalizado";
  servicoLocal.value.fase_projeto = "Pronto para Entrega";
  mostrarBannerFinalizacao.value = false;
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
      <div class="flex-header mb-2">
        <div>
          <h2 style="margin: 0; color: var(--primary)">
            O.S. #{{ servicoLocal.numero_os }}
          </h2>
          <span class="badge text-muted">{{ servicoLocal.fase_projeto }}</span>
        </div>
        <button class="btn-outline" @click="$emit('voltar')">
          <span class="icon-dinamico">arrow_back</span> Voltar
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

      <div v-if="abaAtual === 'checklist'">
        <div
          v-if="checklistsAgrupados.length === 0"
          class="card mb-2 text-muted text-center py-5"
        >
          <span
            class="icon-dinamico"
            style="font-size: 3rem; color: var(--text-muted)"
            >sentiment_dissatisfied</span
          ><br />
          Nenhuma regra de checklist encontrada.<br /><small
            >Configure regras em "Admin > Checklist".</small
          >
        </div>

        <div class="checklists-grid mb-2">
          <div
            v-for="grupo in checklistsAgrupados"
            :key="grupo.etapa"
            class="card"
            style="margin-bottom: 0"
          >
            <h4
              class="title-section"
              style="margin-top: 0; font-size: 1rem; color: var(--text-main)"
            >
              <span class="icon-dinamico" style="vertical-align: middle"
                >checklist</span
              >
              {{ grupo.etapa }}
            </h4>

            <div v-for="item in grupo.itens" :key="item.id" class="compact-row">
              <span class="item-name">{{ item.area }}</span>

              <div class="item-actions">
                <button
                  class="btn-check"
                  :class="{ active: item.condicao === '✅ Sim' }"
                  @click="
                    !osFinalizada && atualizarStatusChecklist(item, '✅ Sim')
                  "
                  :disabled="osFinalizada"
                  title="Sim / Ok"
                >
                  <span class="icon-dinamico" style="font-size: 1.1rem"
                    >check</span
                  >
                </button>

                <button
                  class="btn-close"
                  :class="{ active: item.condicao === '❌ Não' }"
                  @click="
                    !osFinalizada && atualizarStatusChecklist(item, '❌ Não')
                  "
                  :disabled="osFinalizada"
                  title="Não / Defeito"
                >
                  <span class="icon-dinamico" style="font-size: 1.1rem"
                    >close</span
                  >
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex-between mb-1">
            <h4 style="margin: 0; font-size: 1rem">
              <span class="icon-dinamico" style="vertical-align: middle"
                >photo_library</span
              >
              Evidências
            </h4>
            <label
              v-if="!osFinalizada"
              class="btn-outline"
              style="cursor: pointer; font-size: 0.8rem; padding: 5px 10px"
            >
              <span
                class="icon-dinamico"
                style="font-size: 1rem; vertical-align: bottom"
                >add_a_photo</span
              >
              {{ carregandoFoto ? "Aguarde..." : "Anexar" }}
              <input
                type="file"
                accept="image/*"
                @change="uploadFotoChecklist"
                hidden
                :disabled="carregandoFoto"
              />
            </label>
          </div>
          <div class="galeria-fotos">
            <div
              v-if="fotosChecklist.length === 0"
              class="text-muted text-center w-full"
              style="font-size: 0.85rem"
            >
              Nenhuma foto anexada.
            </div>
            <div
              v-for="foto in fotosChecklist"
              :key="foto.id"
              class="foto-card"
            >
              <a :href="foto.foto_url" target="_blank"
                ><img :src="foto.foto_url" class="img-preview"
              /></a>
              <button
                v-if="!osFinalizada"
                class="btn-delete-confirm w-full"
                @click="deletarFoto(foto.id)"
                :class="{ confirming: idFotoConfirmar === foto.id }"
              >
                {{ idFotoConfirmar === foto.id ? "Confirma?" : "Excluir" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'diario'">
        <div class="card mb-2" v-if="!osFinalizada">
          <h4 style="margin-top: 0">
            <span class="icon-dinamico" style="vertical-align: middle"
              >edit_note</span
            >
            Nova Anotação
          </h4>
          <textarea
            v-model="novaEntradaDiario.descricao"
            rows="2"
            placeholder="O que foi feito hoje?"
          ></textarea>

          <div class="flex-gap-10 mt-1" style="flex-wrap: wrap">
            <select
              v-model="novaEntradaDiario.fase_projeto"
              class="flex-1 min-w-140"
            >
              <option v-for="fase in fasesPermitidas" :key="fase" :value="fase">
                {{ fase }}
              </option>
            </select>

            <label
              class="btn-outline"
              style="cursor: pointer; padding: 0 15px; font-size: 0.85rem"
              :title="
                fotoDiarioUpload ? 'Foto Pronta para Envio' : 'Anexar Foto'
              "
            >
              <span
                class="icon-dinamico"
                style="vertical-align: middle; font-size: 1rem"
                >{{ fotoDiarioUpload ? "check_circle" : "add_a_photo" }}</span
              >
              {{ fotoDiarioUpload ? "Foto Pronta" : "Juntar Foto" }}
              <input
                type="file"
                accept="image/*"
                @change="setFotoDiario"
                hidden
              />
            </label>

            <button
              class="btn-primary"
              @click="adicionarEntradaDiario"
              :disabled="carregandoFotoDiario"
            >
              {{ carregandoFotoDiario ? "A enviar..." : "Salvar Anotação" }}
            </button>
          </div>
        </div>

        <div class="card">
          <h4 class="title-section">
            <span class="icon-dinamico" style="vertical-align: middle"
              >history</span
            >
            Histórico da Bancada
          </h4>
          <div v-if="diario.length === 0" class="text-muted">
            Nenhuma anotação registada.
          </div>
          <div class="timeline">
            <div v-for="nota in diario" :key="nota.id" class="timeline-item">
              <div class="timeline-date">
                <span class="icon-dinamico" style="font-size: 1rem">event</span>
                {{ new Date(nota.data_registro).toLocaleDateString() }}
              </div>
              <div class="timeline-content">
                <span class="badge-fase">{{ nota.fase_projeto }}</span>
                <p>{{ nota.descricao }}</p>
                <a v-if="nota.foto_url" :href="nota.foto_url" target="_blank">
                  <img
                    :src="nota.foto_url"
                    style="
                      max-height: 80px;
                      margin-top: 10px;
                      border-radius: 4px;
                      border: 1px solid var(--border);
                    "
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'orcamento'">
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
              <option
                v-for="cat in catalogoOriginal"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.nome }} (R$ {{ cat.preco_padrao }})
              </option>
            </select>
          </div>
          <div class="grid-orcamento mb-1">
            <input
              v-model="novoItem.descricao"
              placeholder="Descrição manual"
            />
            <select v-model="novoItem.tipo">
              <option value="Serviço">Serviço</option>
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
                @click="imprimirOrcamento"
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
                <strong>{{ item.descricao }}</strong
                ><br />
                <span class="badge" style="font-size: 0.7rem">{{
                  item.tipo
                }}</span>
              </td>
              <td>R$ {{ Number(item.valor).toFixed(2) }}</td>
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
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'checkout'">
        <div class="card">
          <div class="resumo-financeiro mb-2">
            <div class="caixa-valor total">
              <small>Total do Serviço</small
              ><strong>R$ {{ totalOrcamento.toFixed(2) }}</strong>
            </div>
            <div class="caixa-valor pago">
              <small>Valor Pago</small
              ><strong>R$ {{ totalPago.toFixed(2) }}</strong>
            </div>
            <div
              class="caixa-valor restante"
              :class="{ zerado: saldoDevedor <= 0 }"
            >
              <small>Falta Receber</small
              ><strong>R$ {{ saldoDevedor.toFixed(2) }}</strong>
            </div>
          </div>

          <div
            v-if="mostrarBannerFinalizacao"
            class="banner-aviso mb-2"
            style="background: #dcfce7; color: #166534; border-color: #22c55e"
          >
            <p style="margin-top: 0">
              🎉 Saldo liquidado! Deseja finalizar e bloquear a O.S. agora?
            </p>
            <div class="flex-gap-10">
              <button
                class="btn-primary"
                @click="finalizarOSManual"
                style="background: #10b981"
              >
                Sim, Finalizar O.S.
              </button>
              <button
                class="btn-outline"
                @click="mostrarBannerFinalizacao = false"
              >
                Agora não
              </button>
            </div>
          </div>

          <div
            v-if="saldoDevedor > 0 && !osFinalizada"
            class="form-pagamento mb-2"
          >
            <h4 style="margin-top: 0">
              <span class="icon-dinamico" style="vertical-align: middle"
                >payments</span
              >
              Registrar Pagamento
            </h4>
            <div class="flex-gap-10">
              <select v-model="novoPagamento.metodo" style="flex: 2">
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
              </select>
              <input
                v-model.number="novoPagamento.valor"
                type="number"
                style="flex: 1"
                placeholder="R$"
              />
              <button
                class="btn-primary"
                @click="registrarPagamento"
                :class="{ 'btn-warning': pgtoExcedenteConfirmado }"
              >
                {{ pgtoExcedenteConfirmado ? "⚠️ Confirmar?" : "Receber" }}
              </button>
            </div>
          </div>

          <div
            class="flex-between mb-1"
            style="border-top: 1px solid var(--border); padding-top: 20px"
          >
            <h4 style="margin: 0">Histórico de Transações</h4>
            <button
              class="btn-outline"
              @click="gerarRecibo"
              title="Imprimir Recibo"
            >
              <span class="icon-dinamico">print</span> Recibo
            </button>
          </div>

          <table class="tabela-padrao">
            <tr v-for="p in pagamentosOS" :key="p.id">
              <td>
                <strong>{{ p.descricao }}</strong
                ><br /><small class="text-muted">{{
                  new Date(p.data_pagamento).toLocaleDateString()
                }}</small>
              </td>
              <td>R$ {{ Number(p.valor_bruto).toFixed(2) }}</td>
              <td align="center" v-if="!osFinalizada">
                <button
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
        </div>
      </div>

      <div id="print-area" class="print-only">
        <div
          class="print-header"
          style="text-align: center; margin-bottom: 20px"
        >
          <img
            v-if="configLuthieria.logo_url"
            :src="configLuthieria.logo_url"
            style="max-height: 80px; margin-bottom: 10px"
          />

          <h2 style="margin: 0">
            {{ configLuthieria.nome_luthieria || "Luthieria" }}
          </h2>
          <p style="margin: 5px 0 0 0" v-if="configLuthieria.telefone">
            WhatsApp: {{ configLuthieria.telefone }}
          </p>
          <p style="margin: 5px 0 0 0" v-if="configLuthieria.endereco">
            {{ configLuthieria.endereco }}
          </p>
        </div>

        <hr style="border: 1px dashed #000; margin: 15px 0" />

        <div class="print-info">
          <h3 style="text-align: center; margin: 0 0 15px 0">
            {{
              tipoImpressao === "orcamento"
                ? "ORÇAMENTO DE SERVIÇO"
                : "RECIBO DE PAGAMENTO"
            }}
          </h3>
          <p style="margin: 5px 0">
            <strong>O.S. Nº:</strong> {{ servicoLocal.numero_os }}
          </p>
          <p style="margin: 5px 0">
            <strong>Data:</strong> {{ new Date().toLocaleDateString() }}
          </p>
        </div>

        <hr style="border: 1px dashed #000; margin: 15px 0" />

        <div v-if="tipoImpressao === 'orcamento' || tipoImpressao === 'recibo'">
          <h4 style="margin: 0 0 10px 0">Itens da O.S.</h4>
          <table style="width: 100%; border-collapse: collapse">
            <thead>
              <tr>
                <th
                  align="left"
                  style="border-bottom: 1px solid #ccc; padding: 6px 0"
                >
                  Descrição
                </th>
                <th
                  align="right"
                  style="border-bottom: 1px solid #ccc; padding: 6px 0"
                >
                  Valor (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in itensOrcamento" :key="item.id">
                <td style="border-bottom: 1px dashed #eee; padding: 6px 0">
                  {{ item.descricao }}
                </td>
                <td
                  align="right"
                  style="border-bottom: 1px dashed #eee; padding: 6px 0"
                >
                  {{ Number(item.valor).toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div style="text-align: right; margin-top: 15px; font-size: 1.1rem">
            <strong>Total: R$ {{ totalOrcamento.toFixed(2) }}</strong>
          </div>
        </div>

        <div v-if="tipoImpressao === 'recibo'" style="margin-top: 20px">
          <hr style="border: 1px dashed #000; margin: 15px 0" />
          <h4 style="margin: 0 0 10px 0">Histórico de Pagamentos</h4>
          <table style="width: 100%; border-collapse: collapse">
            <thead>
              <tr>
                <th
                  align="left"
                  style="border-bottom: 1px solid #ccc; padding: 6px 0"
                >
                  Pgto / Data
                </th>
                <th
                  align="right"
                  style="border-bottom: 1px solid #ccc; padding: 6px 0"
                >
                  Valor (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pagamentosOS" :key="p.id">
                <td style="border-bottom: 1px dashed #eee; padding: 6px 0">
                  {{ p.forma_pagamento || p.descricao }}
                  <small
                    >({{
                      new Date(p.data_pagamento).toLocaleDateString()
                    }})</small
                  >
                </td>
                <td
                  align="right"
                  style="border-bottom: 1px dashed #eee; padding: 6px 0"
                >
                  {{ Number(p.valor_bruto).toFixed(2) }}
                </td>
              </tr>
              <tr v-if="pagamentosOS.length === 0">
                <td
                  colspan="2"
                  style="text-align: center; font-style: italic; padding: 10px"
                >
                  Nenhum pagamento efetuado.
                </td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 15px">
            <p style="margin: 5px 0">
              <strong>Total Pago:</strong> R$ {{ totalPago.toFixed(2) }}
            </p>
            <p style="margin: 5px 0">
              <strong>Falta Receber:</strong> R$ {{ saldoDevedor.toFixed(2) }}
            </p>
          </div>
        </div>

        <div v-if="servicoLocal.obs_fechamento" style="margin-top: 20px">
          <hr style="border: 1px dashed #000; margin: 15px 0" />
          <p style="margin: 5px 0"><strong>Notas Importantes:</strong></p>
          <p style="margin: 5px 0; white-space: pre-wrap">
            {{ servicoLocal.obs_fechamento }}
          </p>
        </div>

        <div style="margin-top: 40px; text-align: center; font-size: 0.9rem">
          <p style="margin: 0">Obrigado pela preferência!</p>
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
.min-w-140 {
  min-width: 140px;
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

/* BANNERS E AVISOS */
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

/* ========================================= */
/* CHECKLIST CSS NOVO (2 COLUNAS & COMPACTO) */
/* ========================================= */
.checklists-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  align-items: flex-start;
}

.compact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border);
}
.compact-row:last-child {
  border-bottom: none;
}

.item-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}

.item-actions {
  display: flex;
  gap: 4px;
}

.btn-check,
.btn-close {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.btn-check:hover:not(:disabled) {
  border-color: #10b981;
  color: #10b981;
}
.btn-check.active {
  background: #dcfce7;
  border-color: #10b981;
  color: #166534;
}

.btn-close:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
}
.btn-close.active {
  background: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}

.btn-check:disabled,
.btn-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* GALERIA FOTOS */
.galeria-fotos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  margin-top: 15px;
}
.foto-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.img-preview {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

/* DIÁRIO TIMELINE */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 15px;
  border-left: 2px solid var(--border);
  margin-left: 10px;
  padding-left: 15px;
}
.timeline-item {
  position: relative;
}
.timeline-item::before {
  content: "";
  position: absolute;
  left: -21px;
  top: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid white;
}
.timeline-date {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: bold;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.timeline-content {
  background: #f8fafc;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.badge-fase {
  display: inline-block;
  background: var(--primary);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  margin-bottom: 5px;
}

/* ORÇAMENTO E FINANCEIRO */
.grid-orcamento {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 10px;
  align-items: center;
}
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

/* BOTÕES DE CONFIRMAÇÃO */
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

/* MOBILE RESPONSIVO */
@media (max-width: 768px) {
  .checklists-grid {
    grid-template-columns: 1fr;
  }
  .grid-orcamento {
    grid-template-columns: 1fr;
  }
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

<style>
.print-only {
  display: none;
}

@media print {
  /* Esconde TUDO do aplicativo */
  body * {
    visibility: hidden !important;
  }

  /* Mas deixa o Recibo e os itens dentro do Recibo visíveis */
  .print-only,
  .print-only * {
    visibility: visible !important;
  }

  /* Posiciona o recibo no canto superior esquerdo do papel, com fundo branco */
  .print-only {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    display: block !important;
    background: #fff;
    color: #000;
    font-family: sans-serif;
  }
}
</style>
