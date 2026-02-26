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
const abaAtual = ref("orcamento"); // Aba padrão inicial

const configLuthieria = ref({
  nome_luthieria: "Minha Luthieria",
  documento: "",
  telefone: "",
  endereco: "",
  termos_garantia: "",
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
  const dataAjustada = dataIso.length === 10 ? `${dataIso}T12:00:00` : dataIso;
  const d = new Date(dataAjustada);
  return isNaN(d.getTime()) ? "Data Inválida" : d.toLocaleDateString("pt-BR");
}

function getBotoesChecklist(nomeFull) {
  const n = nomeFull.toLowerCase();
  if (n.includes("elétrica") || n.includes("altura") || n.includes("ação"))
    return { pos: "👍 Boa", neg: "👎 Ruim", valPos: "Boa", valNeg: "Ruim" };
  if (
    n.includes("marcas") ||
    n.includes("batidas") ||
    n.includes("empenamento")
  )
    return {
      pos: "✅ Não tem",
      neg: "⚠️ Tem",
      valPos: "Não tem",
      valNeg: "Tem",
    };
  if (
    n.includes("limpeza") ||
    n.includes("afinação") ||
    n.includes("polimento")
  )
    return { pos: "✨ OK", neg: "❌ Refazer", valPos: "OK", valNeg: "Refazer" };
  if (n.includes("falta"))
    return {
      pos: "✅ Tudo Certo",
      neg: "⚠️ Faltam",
      valPos: "Tudo Certo",
      valNeg: "Faltam",
    };
  return { pos: "✅ Sim", neg: "❌ Não", valPos: "Sim", valNeg: "Não" };
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
  const { data, error } = await supabase
    .from("catalogo")
    .select("*")
    .order("nome");
  if (!error && data) catalogoOriginal.value = data;
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
  try {
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
      if (padroes && padroes.length > 0) {
        const itensParaInserir = padroes.map((p) => ({
          servico_id: servicoLocal.value.id,
          item_nome: `[${p.tipo}] ${p.item_nome}`,
          opcao_positiva: p.opcao_positiva || "✅ Sim",
          opcao_negativa: p.opcao_negativa || "❌ Não",
          status: "Pendente",
        }));
        const { data: inserted } = await supabase
          .from("checklist_servico")
          .insert(itensParaInserir)
          .select();
        if (inserted) checklistItens.value = inserted;
      }
    }
  } catch (err) {
    console.error("Erro no checklist:", err);
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

// ==========================================
// NOVA FUNÇÃO: SALVA OBSERVAÇÕES
// ==========================================
async function salvarObsChecklist() {
  if (osFinalizada.value) return;
  const { error } = await supabase
    .from("servicos")
    .update({ obs_checklist: servicoLocal.value.obs_checklist })
    .eq("id", servicoLocal.value.id);

  if (error) {
    triggerToast("Erro ao gravar observações: " + error.message, "error");
  } else {
    triggerToast("Observações adicionais guardadas!", "success");
  }
}

async function salvarObsFechamento() {
  if (osFinalizada.value) return;
  const { error } = await supabase
    .from("servicos")
    .update({ obs_fechamento: servicoLocal.value.obs_fechamento })
    .eq("id", servicoLocal.value.id);

  if (error) {
    triggerToast(
      "Erro ao gravar comentários de fecho: " + error.message,
      "error",
    );
  } else {
    triggerToast("Comentários de fechamento guardados!", "success");
  }
}

const checklistChegada = computed(() =>
  checklistItens.value.filter((i) => i.item_nome.startsWith("[Chegada]")),
);
const checklistSaida = computed(() =>
  checklistItens.value.filter((i) => i.item_nome.startsWith("[Saída]")),
);

function importarDoCatalogoOriginal(event) {
  const idEscolhido = event.target.value;
  if (!idEscolhido) return;
  const itemBanco = catalogoOriginal.value.find(
    (s) => String(s.id) === String(idEscolhido),
  );
  if (itemBanco) {
    novoItem.value.descricao = itemBanco.nome;
    novoItem.value.valor =
      itemBanco.preco_padrao || itemBanco.custo_padrao || 0;
    novoItem.value.tipo =
      itemBanco.tipo === "MaoDeObra" ? "Mão de Obra" : "Peça / Insumo";
  }
}

async function adicionarItem() {
  if (!novoItem.value.descricao)
    return triggerToast("Preencha a descrição do serviço ou peça.", "error");
  processandoOrcamento.value = true;
  const itemParaSalvar = {
    servico_id: servicoLocal.value.id,
    descricao: novoItem.value.descricao,
    valor: novoItem.value.valor || 0,
    tipo: novoItem.value.tipo,
  };
  const { data, error } = await supabase
    .from("itens_servico")
    .insert([itemParaSalvar])
    .select();
  if (error) {
    triggerToast("Erro ao salvar: " + error.message, "error");
  } else if (data) {
    itensOrcamento.value.push(data[0]);
    novoItem.value = { descricao: "", valor: null, tipo: "Mão de Obra" };
    triggerToast("Item adicionado ao orçamento!", "success");
    const selectCat = document.getElementById("select-catalogo-original");
    if (selectCat) selectCat.value = "";
  }
  processandoOrcamento.value = false;
}

async function removerItem(id) {
  await supabase.from("itens_servico").delete().eq("id", id);
  itensOrcamento.value = itensOrcamento.value.filter((i) => i.id !== id);
  triggerToast("Item removido.", "info");
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
    novoPagamento.value.valor = newVal;
  },
  { immediate: true },
);

const taxaSelecionada = computed(() => {
  const c = configLuthieria.value;
  if (novoPagamento.value.metodo === "PIX") return c.taxa_pix || 0;
  if (novoPagamento.value.metodo === "Dinheiro") return c.taxa_dinheiro || 0;
  if (novoPagamento.value.metodo === "Cartão de Crédito")
    return c.taxa_credito || c.taxa_cartao_credito || 0;
  if (novoPagamento.value.metodo === "Cartão de Débito")
    return c.taxa_debito || c.taxa_cartao_debito || 0;
  return 0;
});
const valorLiquidoPagamento = computed(() => {
  const v = Number(novoPagamento.value.valor) || 0;
  return v - v * (taxaSelecionada.value / 100);
});

async function registrarPagamento() {
  if (novoPagamento.value.valor <= 0)
    return triggerToast("O valor deve ser maior que zero.", "error");
  if (novoPagamento.value.valor > saldoDevedor.value + 0.05)
    if (
      !confirm(
        "O valor lançado é maior do que o saldo que falta pagar. Deseja continuar mesmo assim?",
      )
    )
      return;

  subindoPagamento.value = true;
  let descricaoVenda = `Pgto O.S. #${servicoLocal.value.numero_os} - ${novoPagamento.value.metodo}`;
  if (taxaSelecionada.value > 0)
    descricaoVenda += ` (Taxa da Maquininha: ${taxaSelecionada.value}%)`;

  const transacao = {
    servico_id: servicoLocal.value.id,
    descricao: descricaoVenda,
    valor_bruto: novoPagamento.value.valor,
    tipo: "Entrada",
    categoria: "Servico",
    data_pagamento: new Date().toISOString().substring(0, 10),
  };
  const { data, error } = await supabase
    .from("transacoes")
    .insert([transacao])
    .select();

  if (error) {
    triggerToast("Erro ao salvar pagamento: " + error.message, "error");
  } else if (data) {
    pagamentosOS.value.unshift(data[0]);
    triggerToast(
      `Recebimento de R$ ${novoPagamento.value.valor} registado!`,
      "success",
    );

    if (
      saldoDevedor.value <= 0 &&
      servicoLocal.value.status !== "Finalizado" &&
      servicoLocal.value.status !== "Entregue"
    ) {
      if (
        confirm(
          "Recebimento concluído! O saldo devedor está zerado. Deseja marcar esta O.S. como 'Finalizada / Pronta para Entrega'?",
        )
      ) {
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
        triggerToast("Ordem de Serviço finalizada!", "success");
      }
    }
  }
  subindoPagamento.value = false;
}

async function removerPagamento(id) {
  if (
    !confirm(
      "Tem certeza que deseja cancelar este recebimento? O valor será apagado do seu Fluxo de Caixa.",
    )
  )
    return;
  await supabase.from("transacoes").delete().eq("id", id);
  pagamentosOS.value = pagamentosOS.value.filter((p) => p.id !== id);
  triggerToast("Pagamento estornado.", "info");
}

function enviarOrcamentoWhatsApp() {
  const cliente = servicoLocal.value.instrumentos?.cliente;
  if (!cliente || !cliente.telefone)
    return triggerToast(
      "O cliente não possui um telefone cadastrado.",
      "error",
    );
  const numLimpo = cliente.telefone.replace(/\D/g, "");
  const telefoneZap = numLimpo.length <= 11 ? `55${numLimpo}` : numLimpo;
  let texto = `Olá, *${cliente.nome}*! Tudo bem?\n\nSegue o orçamento detalhado para o seu instrumento (*${servicoLocal.value.instrumentos?.marca} ${servicoLocal.value.instrumentos?.modelo}*):\n\n`;
  itensOrcamento.value.forEach((item) => {
    texto += `🔸 ${item.descricao}: R$ ${(Number(item.valor) || 0).toFixed(2)}\n`;
  });
  texto += `\n*TOTAL DO ORÇAMENTO: R$ ${totalOrcamento.value.toFixed(2)}*\n\n`;
  if (totalPago.value > 0) {
    texto += `*Valor já pago:* R$ ${totalPago.value.toFixed(2)}\n*Saldo restante:* R$ ${saldoDevedor.value.toFixed(2)}\n\n`;
  }
  texto += `Qualquer dúvida, estou à disposição!\n\nAtt, *${configLuthieria.value.nome_luthieria}*`;
  window.open(
    `https://wa.me/${telefoneZap}?text=${encodeURIComponent(texto)}`,
    "_blank",
  );
}

function imprimirOrcamento() {
  const janela = window.open("", "", "width=900,height=700");
  const cliente = servicoLocal.value.instrumentos?.cliente;
  const inst = servicoLocal.value.instrumentos;
  const config = configLuthieria.value;
  let linhasHTML = itensOrcamento.value
    .map(
      (i) =>
        `<tr><td style="padding: 12px; border-bottom: 1px solid #eee;">${i.descricao}</td><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666; font-size: 0.85em;">${i.tipo || "Serviço"}</td><td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">R$ ${(Number(i.valor) || 0).toFixed(2)}</td></tr>`,
    )
    .join("");
  const logoHTML = config.logo_url
    ? `<img src="${config.logo_url}" style="max-height: 80px; object-fit: contain;" />`
    : `<h2 style="margin:0; color: #2c3e50;">${config.nome_luthieria}</h2>`;
  janela.document.write(
    `<html><head><title>Orçamento O.S. #${servicoLocal.value.numero_os}</title><style>body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; margin: 0; } .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px; } .dados-oficina { text-align: right; font-size: 0.9em; color: #555; } .dados-cliente { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #eee; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { background: #f0f4f8; padding: 12px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 0.8em; color: #475569; text-align: left;} .total-row { background: #f0fdf4; font-size: 1.2em; border-top: 2px solid #22c55e; } .footer { margin-top: 50px; text-align: center; font-size: 0.85em; color: #777; border-top: 1px solid #eee; padding-top: 20px; }</style></head><body><div class="header"><div>${logoHTML}</div><div class="dados-oficina"><strong style="font-size: 1.1em; color: #2c3e50;">${config.nome_luthieria}</strong><br>${config.telefone ? "WhatsApp: " + config.telefone + "<br>" : ""}${config.endereco ? config.endereco : ""}</div></div><h3 style="margin-top: 0; color: #2c3e50; font-size: 1.4em;">ORÇAMENTO - O.S. #${servicoLocal.value.numero_os}</h3><div class="dados-cliente"><strong>Cliente:</strong> ${cliente?.nome || "Não informado"} <br><strong>Contato:</strong> ${cliente?.telefone || "--"} <br><strong>Instrumento:</strong> ${inst?.marca} ${inst?.modelo}</div><table><thead><tr><th>Descrição</th><th>Categoria</th><th style="text-align: right;">Valor</th></tr></thead><tbody>${linhasHTML}</tbody><tfoot><tr class="total-row"><td colspan="2" style="padding: 15px; font-weight: bold; text-align: right;">VALOR TOTAL APROVADO:</td><td style="padding: 15px; font-weight: bold; text-align: right; color: #166534;">R$ ${totalOrcamento.value.toFixed(2)}</td></tr></tfoot></table><div class="footer"><p>Orçamento válido por 15 dias.<br>${config.termos_garantia || "Garantia de 90 dias sobre a mão de obra."}</p></div><script>window.onload = function() { window.print(); window.close(); }<\/script></body></html>`,
  );
  janela.document.close();
}

async function atualizarStatusChecklist(item, novoStatus) {
  if (osFinalizada.value) return;
  item.status = novoStatus;
  await supabase
    .from("checklist_servico")
    .update({ status: novoStatus })
    .eq("id", item.id);
}

async function uploadFotoChecklist(event) {
  const arquivoOriginal = event.target.files[0];
  if (!arquivoOriginal) return;
  subindoFotoChecklist.value = true;
  try {
    const arquivoComprimido = await comprimirImagem(arquivoOriginal);
    const fileName = `checklist/${servicoLocal.value.id}/${Date.now()}_img`;
    const { error: erroUpload } = await supabase.storage
      .from("fotos-luthieria")
      .upload(fileName, arquivoComprimido);
    if (!erroUpload) {
      const { data: urlData } = supabase.storage
        .from("fotos-luthieria")
        .getPublicUrl(fileName);
      const { data: novaFoto } = await supabase
        .from("checklist_fotos")
        .insert([
          { servico_id: servicoLocal.value.id, foto_url: urlData.publicUrl },
        ])
        .select();
      if (novaFoto) {
        fotosChecklist.value.push(novaFoto[0]);
        triggerToast("Foto anexada à O.S. com sucesso!", "success");
      }
    } else {
      triggerToast("Erro ao enviar foto: " + erroUpload.message, "error");
    }
  } catch (err) {
    triggerToast("Erro ao processar e comprimir imagem.", "error");
  } finally {
    subindoFotoChecklist.value = false;
  }
}

async function deletarFoto(id) {
  if (!confirm("Excluir esta foto?")) return;
  await supabase.from("checklist_fotos").delete().eq("id", id);
  fotosChecklist.value = fotosChecklist.value.filter((f) => f.id !== id);
  triggerToast("Foto apagada.", "info");
}

function selecionarFotoDiario(event) {
  arquivoFotoDiario.value = event.target.files[0];
}

async function salvarEntradaDiario() {
  if (!novaEntradaDiario.value.descricao)
    return triggerToast(
      "Por favor, descreva o que foi feito na etapa.",
      "error",
    );
  subindoDiario.value = true;
  let urlFoto = null;
  try {
    if (arquivoFotoDiario.value) {
      const arquivoComprimido = await comprimirImagem(arquivoFotoDiario.value);
      const fileName = `diario/${servicoLocal.value.id}/${Date.now()}_img`;
      const { error: errUp } = await supabase.storage
        .from("fotos-luthieria")
        .upload(fileName, arquivoComprimido);
      if (!errUp) {
        const { data } = supabase.storage
          .from("fotos-luthieria")
          .getPublicUrl(fileName);
        urlFoto = data.publicUrl;
      }
    }
    const entrada = {
      servico_id: servicoLocal.value.id,
      descricao: novaEntradaDiario.value.descricao,
      fase_projeto: novaEntradaDiario.value.fase_projeto,
      data_registro: novaEntradaDiario.value.data_registro,
      foto_url: urlFoto,
    };
    const { data, error } = await supabase
      .from("diario_servico")
      .insert([entrada])
      .select();
    if (!error && data) {
      diario.value.unshift(data[0]);
      await supabase
        .from("servicos")
        .update({ fase_projeto: entrada.fase_projeto })
        .eq("id", servicoLocal.value.id);
      servicoLocal.value.fase_projeto = entrada.fase_projeto;
      novaEntradaDiario.value.descricao = "";
      arquivoFotoDiario.value = null;
      triggerToast("Nova etapa registada no Diário de Bordo!", "success");
      const inpFoto = document.getElementById("foto-diario");
      if (inpFoto) inpFoto.value = "";
    } else {
      triggerToast("Erro ao gravar etapa: " + error.message, "error");
    }
  } catch (err) {
    triggerToast("Erro ao processar ficheiro da etapa.", "error");
  } finally {
    subindoDiario.value = false;
  }
}

onMounted(carregarTudo);
</script>

<template>
  <div class="execucao-container" style="text-align: left">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      "
    >
      <h3 style="margin: 0; color: var(--primary)">
        O.S. #{{ servicoLocal.numero_os }} - {{ servicoLocal.fase_projeto }}
      </h3>
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

    <div
      v-if="osFinalizada"
      class="alerta-pago mb-2"
      style="
        background: #e0f2fe;
        color: #0369a1;
        border-color: #bae6fd;
        font-size: 0.95rem;
      "
    >
      🔒 <strong>O.S. {{ servicoLocal.status }}</strong
      >. Esta Ordem de Serviço foi concluída e o seu histórico (orçamento,
      diário e checklists) está bloqueado contra edições.
    </div>

    <div
      v-if="carregandoDados"
      class="card"
      style="text-align: center; padding: 40px"
    >
      A carregar dados da O.S...
    </div>

    <div v-else>
      <div v-if="abaAtual === 'orcamento'">
        <div class="card">
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
            <h4 style="margin: 0">💰 Composição do Serviço</h4>
            <div style="display: flex; gap: 10px">
              <button class="btn-outline" @click="imprimirOrcamento">
                🖨️ PDF / Imprimir
              </button>
              <button
                class="btn-primary"
                style="
                  background-color: #25d366;
                  border-color: #25d366;
                  color: white;
                "
                @click="enviarOrcamentoWhatsApp"
              >
                📱 Enviar WhatsApp
              </button>
            </div>
          </div>

          <div v-if="!osFinalizada">
            <div
              class="form-group mb-2"
              style="
                background: #f8fafc;
                padding: 10px;
                border-radius: 6px;
                border: 1px solid #e2e8f0;
              "
            >
              <label style="color: var(--primary); font-weight: bold"
                >📖 Importar do Catálogo da Administração:</label
              >
              <select
                id="select-catalogo-original"
                @change="importarDoCatalogoOriginal"
                style="width: 100%; padding: 8px; margin-top: 5px"
              >
                <option value="">
                  -- Digite manualmente abaixo ou escolha um item aqui --
                </option>
                <option v-for="s in catalogoOriginal" :key="s.id" :value="s.id">
                  [{{ s.tipo === "MaoDeObra" ? "Serviço" : s.tipo || "Geral" }}]
                  {{ s.nome }} (R$
                  {{ (Number(s.preco_padrao) || 0).toFixed(2) }})
                </option>
              </select>
            </div>
            <div class="grid-orcamento mb-2">
              <input
                v-model="novoItem.descricao"
                placeholder="Descrição do Serviço ou Peça..."
              />
              <input
                v-model.number="novoItem.valor"
                type="number"
                placeholder="Valor (R$)"
                min="0"
              />
              <select v-model="novoItem.tipo">
                <option>Mão de Obra</option>
                <option>Peça / Insumo</option>
              </select>
              <button
                class="btn-primary"
                @click="adicionarItem"
                :disabled="processandoOrcamento"
              >
                {{ processandoOrcamento ? "⏳" : "➕ Adicionar" }}
              </button>
            </div>
          </div>

          <div class="tabela-responsiva">
            <table class="tabela-padrao">
              <thead>
                <tr>
                  <th style="text-align: left">Item / Descrição</th>
                  <th style="text-align: left">Tipo</th>
                  <th style="text-align: left">Valor</th>
                  <th v-if="!osFinalizada" style="text-align: center">Ação</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in itensOrcamento" :key="item.id">
                  <td style="font-weight: 500">{{ item.descricao }}</td>
                  <td>
                    <span
                      :class="[
                        'badge-tipo',
                        item.tipo === 'Mão de Obra'
                          ? 'badge-mao-obra'
                          : 'badge-peca',
                      ]"
                      >{{ item.tipo || "Serviço" }}</span
                    >
                  </td>
                  <td style="font-weight: bold">
                    R$ {{ (Number(item.valor) || 0).toFixed(2) }}
                  </td>
                  <td v-if="!osFinalizada" align="center">
                    <button
                      class="btn-text-danger"
                      @click="removerItem(item.id)"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
                <tr v-if="itensOrcamento.length === 0">
                  <td
                    colspan="100%"
                    class="text-muted"
                    style="text-align: center; padding: 20px"
                  >
                    Orçamento vazio.
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="background: #f0fdf4">
                  <td colspan="2">
                    <strong style="font-size: 1.1rem; color: #166534"
                      >TOTAL DO ORÇAMENTO</strong
                    >
                  </td>
                  <td>
                    <strong style="font-size: 1.3rem; color: #16a34a"
                      >R$ {{ totalOrcamento.toFixed(2) }}</strong
                    >
                  </td>
                  <td v-if="!osFinalizada" align="center">
                    <button
                      class="btn-primary"
                      style="background: #10b981; border: none"
                      @click="abaAtual = 'checkout'"
                    >
                      💸 Cobrar
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'checkout'">
        <div class="card mb-2">
          <h4 style="margin-top: 0; color: var(--primary)">
            💳 Finalizar Venda e Recebimento
          </h4>

          <div class="resumo-financeiro">
            <div class="caixa-valor total">
              <small>Total do Serviço</small>
              <strong>R$ {{ totalOrcamento.toFixed(2) }}</strong>
            </div>
            <div class="caixa-valor pago">
              <small>Já Recebido</small>
              <strong>R$ {{ totalPago.toFixed(2) }}</strong>
            </div>
            <div
              class="caixa-valor restante"
              :class="{ zerado: saldoDevedor <= 0 }"
            >
              <small>Saldo Devedor</small>
              <strong>R$ {{ saldoDevedor.toFixed(2) }}</strong>
            </div>
          </div>

          <div
            class="form-pagamento mb-2"
            v-if="saldoDevedor > 0 && !osFinalizada"
          >
            <h5 style="margin-top: 0; color: var(--primary)">
              ➕ Lançar Pagamento (Permite Sinal / Parcial)
            </h5>
            <div
              class="grid-form"
              style="display: flex; gap: 15px; flex-wrap: wrap"
            >
              <div class="f-item" style="flex: 1; min-width: 200px">
                <label>Método de Pagamento:</label>
                <select v-model="novoPagamento.metodo">
                  <option value="PIX">PIX</option>
                  <option value="Dinheiro">Dinheiro Físico</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                </select>
              </div>
              <div class="f-item" style="flex: 1; min-width: 200px">
                <label>Valor Pago pelo Cliente (R$):</label>
                <input
                  type="number"
                  v-model.number="novoPagamento.valor"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <p class="taxa-info" v-if="taxaSelecionada > 0">
              ℹ️ A sua taxa de máquina para
              <strong>{{ novoPagamento.metodo }}</strong> é de
              <strong>{{ taxaSelecionada }}%</strong>. O valor líquido que entra
              no fluxo de caixa será
              <strong>R$ {{ valorLiquidoPagamento.toFixed(2) }}</strong
              >.
            </p>
            <p
              class="taxa-info"
              v-else
              style="background: #e0f2fe; border-color: #0284c7; color: #0369a1"
            >
              ℹ️ Nenhuma taxa foi cobrada ou configurada para este método (100%
              de lucro líquido).
            </p>

            <button
              class="btn-primary mt-1"
              style="
                background: #10b981;
                border: none;
                width: 100%;
                font-size: 1.1rem;
                padding: 12px;
                margin-top: 15px;
              "
              @click="registrarPagamento"
              :disabled="subindoPagamento"
            >
              {{
                subindoPagamento
                  ? "⏳ A salvar transação..."
                  : "✅ Receber e Lançar no Fluxo de Caixa"
              }}
            </button>
          </div>

          <div v-else-if="saldoDevedor <= 0" class="alerta-pago mb-2">
            🎉 O saldo está liquidado. Esta Ordem de Serviço já está 100% paga!
          </div>

          <div
            style="
              background: #fef9c3;
              border: 1px dashed #fde047;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
            "
          >
            <h5 style="margin-top: 0; color: #b45309">
              📝 Comentários de Fechamento
            </h5>
            <textarea
              v-model="servicoLocal.obs_fechamento"
              @change="salvarObsFechamento"
              :disabled="osFinalizada"
              rows="2"
              placeholder="Ex: Cliente levantou o instrumento hoje. Ficou de trazer o outro baixo na próxima semana..."
            ></textarea>
            <small
              v-if="!osFinalizada"
              class="text-muted"
              style="display: block; margin-top: 5px"
            >
              💾 Guarda automaticamente ao clicar fora. Aparecerá no relatório
              exportado.
            </small>
          </div>
        </div>

        <div class="card">
          <h4 style="margin-top: 0; color: var(--primary)">
            📑 Histórico de Recebimentos desta O.S.
          </h4>
          <div class="tabela-responsiva">
            <table class="tabela-padrao">
              <thead>
                <tr>
                  <th style="text-align: left">Data</th>
                  <th style="text-align: left">Descrição do Pagamento</th>
                  <th style="text-align: left">Valor Recebido</th>
                  <th v-if="!osFinalizada" style="text-align: center">Ação</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in pagamentosOS" :key="p.id">
                  <td>
                    {{
                      new Date(
                        p.data_pagamento + "T12:00:00",
                      ).toLocaleDateString("pt-BR")
                    }}
                  </td>
                  <td>{{ p.descricao }}</td>
                  <td style="font-weight: bold; color: #16a34a">
                    R$ {{ Number(p.valor_bruto).toFixed(2) }}
                  </td>
                  <td v-if="!osFinalizada" align="center">
                    <button
                      class="btn-text-danger"
                      @click="removerPagamento(p.id)"
                    >
                      Estornar
                    </button>
                  </td>
                </tr>
                <tr v-if="pagamentosOS.length === 0">
                  <td
                    colspan="100%"
                    class="text-muted"
                    style="text-align: center; padding: 20px"
                  >
                    Nenhum pagamento registrado ainda. O cliente não deu sinal.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'checklist'">
        <div
          class="card mb-2 p-15"
          style="background: #fdfdfd; border: 1px dashed var(--border)"
        >
          <h4 style="margin-top: 0; color: var(--primary)">
            📝 Observações Gerais da Inspeção
          </h4>
          <textarea
            v-model="servicoLocal.obs_checklist"
            @change="salvarObsChecklist"
            :disabled="osFinalizada"
            rows="3"
            placeholder="Anote detalhes importantes, batidas pré-existentes, ou pedidos extras do cliente..."
          ></textarea>
          <small
            v-if="!osFinalizada"
            class="text-muted"
            style="display: block; margin-top: 5px"
            >💾 Guarda automaticamente assim que terminar de escrever (ao clicar
            fora da caixa).</small
          >
        </div>

        <div class="grid-2-cols mb-2">
          <div class="card p-15 checklist-box">
            <h4 class="title-chegada">📥 Inspeção de Chegada</h4>
            <div class="check-lista">
              <div
                v-for="item in checklistChegada"
                :key="item.id"
                class="check-item-row"
              >
                <span class="check-text">{{
                  item.item_nome.replace("[Chegada] ", "")
                }}</span>
                <div class="toggle-group" :class="{ bloqueado: osFinalizada }">
                  <button
                    :disabled="osFinalizada"
                    :class="[
                      'btn-toggle',
                      {
                        'btn-active-pos':
                          item.status ===
                          (item.opcao_positiva ||
                            getBotoesChecklist(item.item_nome).valPos),
                      },
                    ]"
                    @click="
                      atualizarStatusChecklist(
                        item,
                        item.opcao_positiva ||
                          getBotoesChecklist(item.item_nome).valPos,
                      )
                    "
                  >
                    {{
                      item.opcao_positiva ||
                      getBotoesChecklist(item.item_nome).pos
                    }}
                  </button>
                  <button
                    :disabled="osFinalizada"
                    :class="[
                      'btn-toggle',
                      {
                        'btn-active-neg':
                          item.status ===
                          (item.opcao_negativa ||
                            getBotoesChecklist(item.item_nome).valNeg),
                      },
                    ]"
                    @click="
                      atualizarStatusChecklist(
                        item,
                        item.opcao_negativa ||
                          getBotoesChecklist(item.item_nome).valNeg,
                      )
                    "
                  >
                    {{
                      item.opcao_negativa ||
                      getBotoesChecklist(item.item_nome).neg
                    }}
                  </button>
                </div>
              </div>
              <p
                v-if="checklistChegada.length === 0"
                class="text-muted"
                style="font-size: 0.85em"
              >
                Não há regras de chegada.
              </p>
            </div>
          </div>
          <div class="card p-15 checklist-box">
            <h4 class="title-saida">📤 Qualidade de Saída</h4>
            <div class="check-lista">
              <div
                v-for="item in checklistSaida"
                :key="item.id"
                class="check-item-row"
              >
                <span class="check-text">{{
                  item.item_nome.replace("[Saída] ", "")
                }}</span>
                <div class="toggle-group" :class="{ bloqueado: osFinalizada }">
                  <button
                    :disabled="osFinalizada"
                    :class="[
                      'btn-toggle',
                      {
                        'btn-active-pos':
                          item.status ===
                          (item.opcao_positiva ||
                            getBotoesChecklist(item.item_nome).valPos),
                      },
                    ]"
                    @click="
                      atualizarStatusChecklist(
                        item,
                        item.opcao_positiva ||
                          getBotoesChecklist(item.item_nome).valPos,
                      )
                    "
                  >
                    {{
                      item.opcao_positiva ||
                      getBotoesChecklist(item.item_nome).pos
                    }}
                  </button>
                  <button
                    :disabled="osFinalizada"
                    :class="[
                      'btn-toggle',
                      {
                        'btn-active-neg':
                          item.status ===
                          (item.opcao_negativa ||
                            getBotoesChecklist(item.item_nome).valNeg),
                      },
                    ]"
                    @click="
                      atualizarStatusChecklist(
                        item,
                        item.opcao_negativa ||
                          getBotoesChecklist(item.item_nome).valNeg,
                      )
                    "
                  >
                    {{
                      item.opcao_negativa ||
                      getBotoesChecklist(item.item_nome).neg
                    }}
                  </button>
                </div>
              </div>
              <p
                v-if="checklistSaida.length === 0"
                class="text-muted"
                style="font-size: 0.85em"
              >
                Não há regras de saída.
              </p>
            </div>
          </div>
        </div>
        <div class="card">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
            "
          >
            <div><h4 style="margin: 0">📸 Registo Fotográfico</h4></div>
            <div v-if="!osFinalizada">
              <input
                type="file"
                @change="uploadFotoChecklist"
                accept="image/*"
                id="upload-foto-check"
                hidden
              />
              <label
                for="upload-foto-check"
                class="btn-primary"
                style="cursor: pointer; padding: 8px 15px; border-radius: 6px"
                >{{
                  subindoFotoChecklist ? "⏳ A enviar..." : "➕ Adicionar Foto"
                }}</label
              >
            </div>
          </div>
          <div class="galeria-inline">
            <div
              v-for="foto in fotosChecklist"
              :key="foto.id"
              class="foto-thumb-wrapper"
            >
              <img
                :src="foto.foto_url"
                @click="window.open(foto.foto_url)"
                class="foto-img"
              />
              <button
                v-if="!osFinalizada"
                class="btn-del-foto"
                @click="deletarFoto(foto.id)"
                title="Remover"
              >
                ❌
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'diario'">
        <div class="box mb-2" v-if="!osFinalizada">
          <h4 style="margin-top: 0">➕ Nova Atualização</h4>
          <textarea
            v-model="novaEntradaDiario.descricao"
            rows="2"
            placeholder="O que foi feito?"
          ></textarea>
          <div class="grid-form mb-1 mt-1" style="display: flex; gap: 15px">
            <div class="f-item" style="flex: 1">
              <label>Data:</label
              ><input type="date" v-model="novaEntradaDiario.data_registro" />
            </div>
            <div class="f-item" style="flex: 1">
              <label>Fase:</label
              ><select v-model="novaEntradaDiario.fase_projeto">
                <option v-for="f in fasesPermitidas" :key="f">{{ f }}</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Foto (Opcional):</label
            ><input
              type="file"
              @change="selecionarFotoDiario"
              accept="image/*"
              id="foto-diario"
            />
          </div>
          <button
            class="btn-primary"
            @click="salvarEntradaDiario"
            :disabled="subindoDiario"
            style="width: 100%; margin-top: 15px"
          >
            {{ subindoDiario ? "⏳ A gravar..." : "Registar Etapa" }}
          </button>
        </div>
        <div class="timeline">
          <div v-for="item in diario" :key="item.id" class="timeline-item">
            <div class="timeline-header">
              <span class="timeline-date">{{
                formatarDataHora(item.data_registro)
              }}</span
              ><span class="timeline-badge">{{ item.fase_projeto }}</span>
            </div>
            <p class="timeline-desc">{{ item.descricao }}</p>
            <img
              v-if="item.foto_url"
              :src="item.foto_url"
              class="img-diario"
              @click="window.open(item.foto_url)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.execucao-container {
  text-align: left;
}
.mb-1 {
  margin-bottom: 10px;
}
.mb-2 {
  margin-bottom: 20px;
}
.mt-1 {
  margin-top: 10px;
}
.p-15 {
  padding: 15px;
}

/* TABS E ORÇAMENTO */
.tabs-clean {
  display: flex;
  gap: 5px;
  margin-bottom: 20px;
  background: #eee;
  padding: 5px;
  border-radius: 8px;
  justify-content: flex-start;
  overflow-x: auto;
}
.tabs-clean button {
  flex: 1;
  border: none;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  background: transparent;
  color: #777;
  transition: 0.2s;
  text-align: center;
  white-space: nowrap;
}
.tabs-clean button.active {
  background: white;
  color: var(--primary);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.grid-orcamento {
  display: grid;
  grid-template-columns: 3fr 1fr 1fr auto;
  gap: 10px;
  align-items: center;
}
.badge-tipo {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}
.badge-mao-obra {
  background-color: #e0f2fe;
  color: #0284c7;
}
.badge-peca {
  background-color: #fef08a;
  color: #a16207;
}

/* CHECKOUT E FINANCEIRO */
.resumo-financeiro {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-top: 15px;
  margin-bottom: 20px;
}
.caixa-valor {
  padding: 15px;
  border-radius: 8px;
  color: white;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.caixa-valor.total {
  background: #3b82f6;
}
.caixa-valor.pago {
  background: #10b981;
}
.caixa-valor.restante {
  background: #ef4444;
}
.caixa-valor.restante.zerado {
  background: #64748b;
}
.caixa-valor small {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 5px;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.caixa-valor strong {
  font-size: 1.5rem;
}
.form-pagamento {
  background: #f8fafc;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.taxa-info {
  font-size: 0.85rem;
  color: #b45309;
  margin-top: 10px;
  padding: 10px;
  background: #fef3c7;
  border-radius: 6px;
  border-left: 4px solid #f59e0b;
}
.alerta-pago {
  background: #dcfce7;
  color: #166534;
  padding: 15px;
  text-align: center;
  font-weight: bold;
  border-radius: 8px;
  border: 1px solid #bbf7d0;
  font-size: 1.1rem;
}

/* CHECKLIST & DIÁRIO */
.grid-2-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 900px) {
  .grid-2-cols {
    grid-template-columns: 1fr;
  }
}
.checklist-box {
  background: #fafafa;
  border: 1px solid #eaeaea;
}
.title-chegada {
  color: #d97706;
  border-bottom: 2px solid #fde68a;
  padding-bottom: 8px;
  margin-top: 0;
}
.title-saida {
  color: #059669;
  border-bottom: 2px solid #a7f3d0;
  padding-bottom: 8px;
  margin-top: 0;
}
.check-lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}
.check-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 10px 15px;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
}
.check-text {
  font-weight: 500;
  color: #3f3f46;
  font-size: 0.95rem;
}
.toggle-group {
  display: flex;
  gap: 5px;
  background: #f4f4f5;
  padding: 4px;
  border-radius: 8px;
}
.toggle-group.bloqueado {
  pointer-events: none;
  opacity: 0.7;
}
.btn-toggle:disabled {
  cursor: not-allowed;
}
.btn-toggle {
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: #a1a1aa;
  background: transparent;
  transition: all 0.2s ease;
}
.btn-active-pos {
  background: #10b981;
  color: white !important;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}
.btn-active-neg {
  background: #f59e0b;
  color: white !important;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}
.galeria-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 15px;
}
.foto-thumb-wrapper {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #eee;
}
.foto-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.3s;
}
.foto-img:hover {
  transform: scale(1.05);
}
.btn-del-foto {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}
.btn-text-danger {
  background: none;
  border: none;
  color: #ff4757;
  cursor: pointer;
  font-weight: bold;
  padding: 5px;
}
.timeline {
  margin-top: 20px;
  border-left: 2px solid #eee;
  padding-left: 20px;
}
.timeline-item {
  position: relative;
  margin-bottom: 25px;
}
.timeline-item::before {
  content: "";
  position: absolute;
  left: -27px;
  top: 5px;
  width: 12px;
  height: 12px;
  background: var(--primary);
  border-radius: 50%;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  align-items: center;
}
.timeline-date {
  font-size: 0.85rem;
  font-weight: bold;
  color: #555;
}
.timeline-badge {
  font-size: 0.7rem;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
  color: #777;
  text-transform: uppercase;
}
.timeline-desc {
  margin: 0;
  font-size: 0.95rem;
  color: #333;
  line-height: 1.4;
}
.img-diario {
  max-width: 200px;
  border-radius: 6px;
  margin-top: 10px;
  cursor: pointer;
  border: 1px solid #ddd;
}
</style>
