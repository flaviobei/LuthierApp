<script setup>
/**
 * ============================================================================
 * @file        ExecucaoServico.vue
 * @description Gestão da O.S. (Pai Orquestrador).
 * ATUALIZAÇÃO: Cabeçalho slim com data compacta e exibição de Serviço Solicitado.
 * ============================================================================
 */
import { ref, computed, onMounted, nextTick } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import QRCode from "qrcode";
import { useI18n } from "vue-i18n";
import { osService } from "../services/osService";

// IMPORTAÇÃO DOS SUB-COMPONENTES
import AbaChecklist from "./os/AbaChecklist.vue";
import AbaDiario from "./os/AbaDiario.vue";
import AbaOrcamento from "./os/AbaOrcamento.vue";
import AbaReceber from "./os/AbaReceber.vue";
import { catalogoService } from "../services/catalogoService";

const props = defineProps(["servico"]);
const emit = defineEmits(["voltar"]);
const { triggerToast } = useToast();
const { t } = useI18n();

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
const formFase = ref("");
const formStatus = ref("");

function traduzirFase(fase) {
  if (!fase) return '';
  const mapa = {
    "Fila de Espera": t('dashboard.status_fila_espera'),
    "Aguardando Peças": t('dashboard.status_aguardando_pecas'),
    "Secagem / Cura": t('dashboard.status_secagem'),
    "Na Bancada": t('dashboard.status_na_bancada'),
    "Testes / Setup": t('dashboard.status_testes'),
    "Pronto para Entrega": t('dashboard.status_pronto_entrega')
  };
  return mapa[fase] || fase;
}

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
      // Garante que o servicoLocal tem as informações mais frescas
      servicoLocal.value.data_previsao_entrega = data.data_previsao_entrega;
      servicoLocal.value.tipo_os = data.tipo_os;
      servicoLocal.value.motivo_retorno = data.motivo_retorno;
      servicoLocal.value.descricao_cliente = data.descricao_cliente;
    }
  } catch (err) {
    console.error("Erro ao carregar O.S:", err);
  }
}

async function carregarConfig() {
  try {
    const { data } = await supabase
      .from("configuracoes")
      .select("*")
      .maybeSingle();
    if (data) configLuthieria.value = { ...configLuthieria.value, ...data };
  } catch (err) {
    console.error("Erro ao carregar Configuração:", err);
  }
}

async function carregarOrcamento() {
  try {
    const { data } = await supabase
      .from("orcamento_itens")
      .select("*")
      .eq("servico_id", servicoLocal.value.id)
      .order("created_at", { ascending: true });
    itensOrcamento.value = data || [];
  } catch (e) {
    console.error("Erro ao carregar Orçamento:", e);
  }
}

async function carregarPagamentos() {
  try {
    const { data } = await supabase
      .from("transacoes")
      .select("*")
      .eq("servico_id", servicoLocal.value.id)
      .order("data_pagamento", { ascending: false });
    pagamentosOS.value = data || [];
  } catch (e) {
    console.error("Erro ao carregar Pagamentos:", e);
  }
}

async function marcarComoFinalizada() {
  servicoLocal.value.status = "Finalizado";
  servicoLocal.value.fase_projeto = "Pronto para Entrega";

  // Dispara a baixa automática no catálogo em background
  try {
    await catalogoService.abaterEstoqueOS(servicoLocal.value.id);
  } catch (err) {
    console.error("Erro ao atualizar estoque automático:", err);
  }
}

// NOVA FUNÇÃO: Salvar Data de Previsão
async function salvarDataPrevisao() {
  try {
    const novaData = servicoLocal.value.data_previsao_entrega || null;
    const { error } = await supabase
      .from("servicos")
      .update({ data_previsao_entrega: novaData })
      .eq("id", servicoLocal.value.id);

    if (error) throw error;
    triggerToast(t('os.data_previsao_atualizada'), "success");
  } catch (error) {
    triggerToast(t('os.erro_salvar_data'), "error");
    console.error(error);
  }
}

// AÇÕES DE ORÇAMENTO E EXCLUSÃO
async function aprovarOrcamento() {
  if (!confirm(t('os.confirmar_aprovacao_orcamento', 'Confirmar aprovação do orçamento? A O.S. irá para a fila de espera e o prazo de execução começará a contar agora.'))) return;
  try {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("servicos")
      .update({ fase_projeto: 'Fila de Espera', status: 'Aberto', data_entrada: agora })
      .eq("id", servicoLocal.value.id);
    if (error) throw error;
    servicoLocal.value.fase_projeto = 'Fila de Espera';
    servicoLocal.value.status = 'Aberto';
    servicoLocal.value.data_entrada = agora;
    triggerToast(t('os.orcamento_aprovado', 'Orçamento Aprovado com sucesso!'), 'success');
  } catch (err) {
    triggerToast(t('os.erro_aprovar', 'Erro ao aprovar orçamento.'), 'error');
  }
}

async function recusarOrcamento() {
  if (!confirm(t('os.confirmar_recusa_orcamento', 'Confirmar recusa do orçamento? A O.S. será cancelada.'))) return;
  try {
    const { error } = await supabase
      .from("servicos")
      .update({ fase_projeto: 'Cancelado', status: 'Recusado' })
      .eq("id", servicoLocal.value.id);
    if (error) throw error;
    servicoLocal.value.fase_projeto = 'Cancelado';
    servicoLocal.value.status = 'Recusado';
    triggerToast(t('os.orcamento_recusado', 'Orçamento Recusado e O.S. Cancelada.'), 'info');
  } catch (err) {
    triggerToast(t('os.erro_recusar', 'Erro ao recusar orçamento.'), 'error');
  }
}

async function excluirOS() {
  if (!confirm(t('os.confirmar_exclusao', 'ATENÇÃO: Deseja EXCLUIR PERMANENTEMENTE esta O.S.? Esta ação não pode ser desfeita.'))) return;
  try {
    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", servicoLocal.value.id);
    if (error) throw error;
    triggerToast(t('os.os_excluida', 'O.S. excluída com sucesso!'), 'success');
    emit('voltar');
  } catch (err) {
    triggerToast(t('os.erro_excluir', 'Erro ao excluir O.S.'), 'error');
  }
}

// AÇÕES DE PAUSA E RETOMADA
async function pausarServico() {
  if (!confirm(t('os.confirmar_pausa', 'Deseja pausar o serviço? O tempo não será contado até ser retomado.'))) return;
  try {
    const agora = new Date().toISOString();
    
    const { error } = await supabase
      .from("servicos")
      .update({ fase_projeto: 'Pausado' })
      .eq("id", servicoLocal.value.id);
    if (error) throw error;
    
    await supabase.from("diario_servico").insert([{
      servico_id: servicoLocal.value.id,
      descricao: "Serviço Pausado pelo usuário.",
      fase_projeto: 'Pausado',
      data_registro: agora
    }]);

    servicoLocal.value.fase_projeto = 'Pausado';
    triggerToast(t('os.servico_pausado', 'Serviço pausado com sucesso.'), 'info');
  } catch (err) {
    triggerToast(t('os.erro_pausar', 'Erro ao pausar serviço.'), 'error');
  }
}

async function retomarServico() {
  if (!confirm(t('os.confirmar_retomar', 'Deseja retomar o serviço? Os prazos serão estendidos com base no tempo que ficou pausado.'))) return;
  try {
    const agora = new Date();
    
    const { data: ultimoDiario } = await supabase
      .from("diario_servico")
      .select("data_registro")
      .eq("servico_id", servicoLocal.value.id)
      .eq("fase_projeto", "Pausado")
      .order("data_registro", { ascending: false })
      .limit(1);

    let diasPausados = 0;
    let msPausados = 0;
    if (ultimoDiario && ultimoDiario.length > 0) {
      const dataPausa = new Date(ultimoDiario[0].data_registro);
      msPausados = Math.abs(agora - dataPausa);
      diasPausados = Math.max(1, Math.ceil(msPausados / (1000 * 60 * 60 * 24)));
    }

    let novaDataEntrada = servicoLocal.value.data_entrada;
    let novaDataPrevisao = servicoLocal.value.data_previsao_entrega;

    if (msPausados > 0 && servicoLocal.value.data_entrada) {
      const entradaObj = new Date(servicoLocal.value.data_entrada);
      entradaObj.setTime(entradaObj.getTime() + msPausados);
      novaDataEntrada = entradaObj.toISOString();
    }
    
    if (msPausados > 0 && servicoLocal.value.data_previsao_entrega) {
      const previsaoObj = new Date(servicoLocal.value.data_previsao_entrega);
      previsaoObj.setTime(previsaoObj.getTime() + msPausados);
      novaDataPrevisao = previsaoObj.toISOString().split('T')[0];
    }

    const { error } = await supabase
      .from("servicos")
      .update({ 
        fase_projeto: 'Fila de Espera', 
        data_entrada: novaDataEntrada,
        data_previsao_entrega: novaDataPrevisao
      })
      .eq("id", servicoLocal.value.id);
    
    if (error) throw error;

    await supabase.from("diario_servico").insert([{
      servico_id: servicoLocal.value.id,
      descricao: `Serviço Retomado. Datas estendidas em aproximadamente ${diasPausados} dia(s).`,
      fase_projeto: 'Fila de Espera',
      data_registro: agora.toISOString()
    }]);

    servicoLocal.value.fase_projeto = 'Fila de Espera';
    servicoLocal.value.data_entrada = novaDataEntrada;
    servicoLocal.value.data_previsao_entrega = novaDataPrevisao;
    
    triggerToast(t('os.servico_retomado', 'Serviço retomado com sucesso!'), 'success');
  } catch (err) {
    triggerToast(t('os.erro_retomar', 'Erro ao retomar serviço.'), 'error');
  }
}

// Helper para gerar imagem em alta resolução da etiqueta via Canvas
const etiquetaImagemBase64 = ref("");

async function gerarImagemEtiqueta() {
  const scale = 2; 
  const width = 384 * scale; // ~58mm = 384 pixels em 203 DPI
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pad = 10 * scale;

  const fontOS = `bold ${40 * scale}px sans-serif`;
  const fontNormal = `bold ${28 * scale}px sans-serif`;
  const fontSmall = `bold ${22 * scale}px sans-serif`;

  const qrSize = width - (pad * 2);
  const qrDataUrl = await QRCode.toDataURL(String(servicoLocal.value.id), {
    width: qrSize,
    margin: 0,
    color: { dark: "#000000", light: "#ffffff" }
  });
  
  const imgQR = new Image();
  await new Promise(resolve => {
    imgQR.onload = resolve;
    imgQR.src = qrDataUrl;
  });

  const instMarca = dadosInstrumento.value?.marca || '';
  const instModelo = dadosInstrumento.value?.modelo || '';
  const clienteNome = dadosCliente.value?.nome || 'Não Registrado';
  const motivo = servicoLocal.value.descricao_cliente || 'Sem descrição';
  
  const formatDate = (dateStr) => {
    if(!dateStr) return '--/--/----';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  };
  const dtEntrada = formatDate(servicoLocal.value.data_entrada);
  const dtPrev = formatDate(servicoLocal.value.data_previsao_entrega);

  function getLines(context, text, maxWidth) {
    let words = text.split(' ');
    let lines = [];
    let currentLine = words[0] || '';
    for (let i = 1; i < words.length; i++) {
        let word = words[i];
        let width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
  }

  // Pre-calculate height
  ctx.font = fontSmall;
  const maxTextWidth = width - (pad * 2);
  const motivoLines = getLines(ctx, `Motivo: ${motivo}`, maxTextWidth);

  let totalHeight = pad;
  totalHeight += (40 * scale) + pad; // OS
  totalHeight += (28 * scale) + (pad/2); // Inst
  totalHeight += (28 * scale) + (pad/2); // Cliente
  totalHeight += (motivoLines.length * (26 * scale)) + (pad/2); // Motivo
  totalHeight += (22 * scale) + pad; // Datas
  totalHeight += qrSize + pad; // QR
  totalHeight += pad; // bottom pad

  canvas.width = width;
  canvas.height = totalHeight;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, canvas.height);

  // Text
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let currentY = pad;

  ctx.font = fontOS;
  ctx.fillText(`O.S. #${servicoLocal.value.numero_os}`, width / 2, currentY);
  currentY += (40 * scale) + pad;

  ctx.font = fontNormal;
  ctx.fillText(`${instMarca} ${instModelo}`.trim(), width / 2, currentY);
  currentY += (28 * scale) + (pad/2);

  ctx.fillText(clienteNome, width / 2, currentY);
  currentY += (28 * scale) + (pad/2);

  ctx.font = fontSmall;
  motivoLines.forEach(line => {
      ctx.fillText(line, width / 2, currentY);
      currentY += (26 * scale);
  });
  currentY += (pad/2);

  ctx.fillText(`Ent: ${dtEntrada} | Prev: ${dtPrev}`, width / 2, currentY);
  currentY += (22 * scale) + pad;

  ctx.drawImage(imgQR, pad, currentY, qrSize, qrSize);

  return canvas.toDataURL('image/png');
}

// Helper para imprimir com título de arquivo (PDF) customizado
async function imprimirComTituloCustomizado() {
  const originalTitle = document.title;
  
  const clienteNome = dadosCliente.value?.nome || 'Cliente';
  const instMarca = dadosInstrumento.value?.marca || '';
  const instModelo = dadosInstrumento.value?.modelo || '';
  const instrumento = `${instMarca} ${instModelo}`.trim() || 'Instrumento';
  const numOS = servicoLocal.value?.numero_os || 'OS';

  const printTitle = `${clienteNome} - ${instrumento} - #${numOS}`;
  
  document.title = printTitle;
  await nextTick();
  
  window.print();
  
  // Retorna o título original após abrir o diálogo de impressão
  document.title = originalTitle;
}

// MÉTODOS DE IMPRESSÃO
async function imprimirOrcamento() {
  tipoImpressao.value = "orcamento";
  await imprimirComTituloCustomizado();
}
async function gerarRecibo() {
  tipoImpressao.value = "recibo";
  await imprimirComTituloCustomizado();
}
async function imprimirQRCode() {
  try {
    etiquetaImagemBase64.value = await gerarImagemEtiqueta();
    
    // Força o download da imagem ao invés de abrir o diálogo de impressão do navegador
    const a = document.createElement('a');
    a.href = etiquetaImagemBase64.value;
    a.download = `Etiqueta_OS_${servicoLocal.value.numero_os}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
  } catch (err) {
    console.error("Erro ao gerar imagem da etiqueta:", err);
    triggerToast(t('os.erro_gerar_etiqueta', 'Erro ao gerar etiqueta'), "error");
  }
}

onMounted(carregarTudo);
</script>

<template>
  <div class="execucao-container">
    <div v-if="carregandoDados" class="text-center py-5">
      <div class="loader-simple" style="margin: 0 auto"></div>
      <p class="mt-2 text-muted">{{ $t('os.carregando_os') }}</p>
    </div>

    <div v-else>
      <div v-if="servicoLocal.fase_projeto === 'Orçamento'" class="card mb-2" style="background: #fffbeb; border: 1px solid var(--warning); padding: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="icon-dinamico" style="color: var(--warning); font-size: 2rem;">request_quote</span>
            <div>
              <h3 style="margin: 0; color: #b45309;">{{ $t('os.orcamento_aguardando', 'Orçamento Aguardando Aprovação') }}</h3>
              <p style="margin: 2px 0 0 0; font-size: 0.9rem; color: #78350f;">{{ $t('os.orcamento_aguardando_desc', 'Aguarde o cliente aprovar o orçamento para iniciar o serviço.') }}</p>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn-primary" style="background: var(--success); border-color: var(--success);" @click="aprovarOrcamento">
              <span class="icon-dinamico">check_circle</span> {{ $t('os.btn_aprovar', 'Aprovar e Iniciar') }}
            </button>
            <button type="button" class="btn-outline" style="color: var(--danger); border-color: var(--danger); background: white;" @click="recusarOrcamento">
              <span class="icon-dinamico">cancel</span> {{ $t('os.btn_recusar', 'Recusar') }}
            </button>
          </div>
        </div>
      </div>

      <div
        class="card mb-2"
        style="
          background: #f8fafc;
          padding: 12px 15px;
          border-radius: 8px;
          border: 1px solid var(--border);
        "
      >
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
          "
        >
          <div
            style="
              display: flex;
              align-items: center;
              gap: 12px;
              flex-wrap: wrap;
            "
          >
            <h2 style="margin: 0; color: var(--primary); font-size: 1.3rem">
              {{ $t('os.numero_os') }}{{ servicoLocal.numero_os }}
            </h2>
            <span
              class="badge"
              :style="{ backgroundColor: osService.corFase(servicoLocal.fase_projeto), color: 'white', fontSize: '0.75rem', padding: '2px 8px' }"
              >{{ traduzirFase(servicoLocal.fase_projeto) }}</span
            >

            <span style="font-size: 0.85rem; color: #64748b"
              >{{ $t('os.previsao_entrega') }}</span
            >
            <div
              style="
                display: flex;
                align-items: center;
                background: white;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 2px 6px;
              "
              title="Previsão de Entrega"
            >
              <span
                class="icon-dinamico text-muted"
                style="font-size: 1rem; margin-right: 4px"
                >event</span
              >

              <input
                type="date"
                v-model="servicoLocal.data_previsao_entrega"
                @change="salvarDataPrevisao"
                :disabled="osFinalizada"
                style="
                  border: none;
                  outline: none;
                  background: transparent;
                  font-size: 0.85rem;
                  color: #334155;
                  padding: 0;
                  cursor: pointer;
                  height: 22px;
                "
              />
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px">
            <button type="button"
              v-if="!osFinalizada && servicoLocal.fase_projeto !== 'Pausado' && servicoLocal.fase_projeto !== 'Orçamento' && servicoLocal.status !== 'Recusado'"
              class="btn-outline"
              @click="pausarServico"
              title="Pausar Serviço"
              style="
                padding: 4px 10px;
                font-weight: bold;
                font-size: 0.8rem;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #64748b;
                border-color: #64748b;
                background: white;
              "
            >
              <span class="icon-dinamico" style="font-size: 1.1rem">pause_circle</span>
              Pausar
            </button>
            <button type="button"
              v-if="!osFinalizada && servicoLocal.fase_projeto === 'Pausado'"
              class="btn-outline"
              @click="retomarServico"
              title="Retomar Serviço"
              style="
                padding: 4px 10px;
                font-weight: bold;
                font-size: 0.8rem;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: var(--primary);
                border-color: var(--primary);
                background: white;
              "
            >
              <span class="icon-dinamico" style="font-size: 1.1rem">play_circle</span>
              Retomar
            </button>
            <button type="button"
              class="btn-outline"
              @click="imprimirQRCode"
              title="Imprimir Etiqueta"
              style="
                padding: 4px 10px;
                font-weight: bold;
                font-size: 0.8rem;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: white;
              "
            >
              <span class="icon-dinamico" style="font-size: 1.1rem"
                >qr_code_scanner</span
              >
              {{ $t('os.etiqueta') }}
            </button>
            <button type="button"
              class="btn-outline"
              @click="$emit('voltar')"
              style="
                padding: 4px 10px;
                font-weight: bold;
                font-size: 0.8rem;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: white;
              "
            >
              <span class="icon-dinamico" style="font-size: 1.1rem"
                >arrow_back</span
              >
              {{ $t('geral.voltar') }}
            </button>
            <button type="button"
              class="btn-outline"
              @click="excluirOS"
              title="Excluir O.S."
              style="
                padding: 4px 8px;
                color: var(--danger);
                border-color: var(--danger);
                background: white;
              "
            >
              <span class="icon-dinamico" style="font-size: 1.1rem">delete</span>
            </button>
          </div>
        </div>

        <div
          v-if="servicoLocal.descricao_cliente"
          style="
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #cbd5e1;
          "
        >
          <span
            style="
              font-size: 0.75rem;
              font-weight: bold;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            "
            >{{ $t('os.servico_solicitado') }}</span
          >
          <p
            style="
              margin: 4px 0 0 0;
              font-size: 0.95rem;
              color: #1e293b;
              white-space: pre-wrap;
              line-height: 1.4;
            "
          >
            {{ servicoLocal.descricao_cliente }}
          </p>
        </div>
      </div>

      <div
        v-if="servicoLocal.tipo_os === 'Retrabalho'"
        class="alert-retrabalho mb-2"
      >
        <div
          style="
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 5px;
          "
        >
          <span class="icon-dinamico" style="font-size: 1.5rem">warning</span>
          <h3 style="margin: 0; font-size: 1.1rem">
            {{ $t('os.atencao_retrabalho') }}
          </h3>
        </div>
        <p style="margin: 0; font-size: 0.95rem">
          <strong>{{ $t('os.motivo_retorno') }}</strong>
          {{ servicoLocal.motivo_retorno || $t('os.motivo_nao_especificado') }}
        </p>
      </div>

      <div
        v-if="osFinalizada"
        class="banner-aviso mb-2"
        style="background: #e2e8f0; color: #475569; border-color: #cbd5e1"
      >
        <span class="icon-dinamico">lock</span> {{ $t('os.os_concluida_aviso') }}
      </div>

      <div class="tabs-clean mb-2">
        <button type="button"
          :class="{ active: abaAtual === 'checklist' }"
          @click="abaAtual = 'checklist'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >fact_check</span
          >
          {{ $t('admin.checklist') }}
        </button>
        <button type="button"
          :class="{ active: abaAtual === 'diario' }"
          @click="abaAtual = 'diario'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >menu_book</span
          >
          {{ $t('os.diario') }}
        </button>
        <button type="button"
          :class="{ active: abaAtual === 'orcamento' }"
          @click="abaAtual = 'orcamento'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >request_quote</span
          >
          {{ $t('os.orcamento') }}
        </button>
        <button type="button"
          :class="{ active: abaAtual === 'checkout' }"
          @click="abaAtual = 'checkout'"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1.1rem; vertical-align: middle"
            >point_of_sale</span
          >
          {{ $t('os.receber') }}
        </button>
      </div>

      <KeepAlive>
        <AbaChecklist
          v-if="abaAtual === 'checklist'"
          :servico="servicoLocal"
          :os-finalizada="osFinalizada"
          @observacaoSalva="(val) => (servicoLocal.obs_checklist = val)"
        />

        <AbaDiario
          v-else-if="abaAtual === 'diario'"
          :servico="servicoLocal"
          :os-finalizada="osFinalizada"
          @faseAtualizada="(val) => (servicoLocal.fase_projeto = val)"
        />

        <AbaOrcamento
          v-else-if="abaAtual === 'orcamento'"
          :servico="servicoLocal"
          :os-finalizada="osFinalizada"
          :itens-orcamento="itensOrcamento"
          :dados-cliente="dadosCliente"
          :total-orcamento="totalOrcamento"
          @update:itensOrcamento="(val) => (itensOrcamento = val)"
          @imprimir="imprimirOrcamento"
        />

        <AbaReceber
          v-else-if="abaAtual === 'checkout'"
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
      </KeepAlive>

      <div
        id="print-area"
        class="print-only"
        :class="'impressora-' + (configLuthieria.tipo_impressora || 'padrao')"
      >


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
                  ? $t('os.titulo_orcamento')
                  : $t('os.titulo_recibo')
              }}
            </h3>
            <p>
              <strong>{{ $t('os.cliente') }}</strong> {{ dadosCliente?.nome }}<br />
              <strong>{{ $t('os.instrumento') }}</strong> {{ dadosInstrumento?.marca }}<br />
              <strong>{{ $t('os.modelo') }}</strong> {{ dadosInstrumento?.modelo }}<br />
            </p>

            <p><strong>{{ $t('os.os_numero') }}</strong> {{ servicoLocal.numero_os }}</p>
            <p><strong>{{ $t('os.data') }}</strong> {{ new Date().toLocaleDateString() }}</p>
          </div>

          <hr class="print-divider" />

          <h4 class="print-section-title">{{ $t('os.itens_os') }}</h4>
          <table class="print-table">
            <thead>
              <tr>
                <th align="left">{{ $t('os.descricao') }}</th>
                <th align="right">{{ $t('os.valor_rs') }}</th>
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
            <strong>{{ $t('os.total_rs') }} {{ totalOrcamento.toFixed(2) }}</strong>
          </div>

          <div v-if="tipoImpressao === 'recibo'" class="print-payments">
            <hr class="print-divider" />
            <h4 class="print-section-title">{{ $t('os.historico_pagamentos') }}</h4>
            <table class="print-table">
              <thead>
                <tr>
                  <th align="left">{{ $t('os.pgto_data') }}</th>
                  <th align="right">{{ $t('os.valor_rs') }}</th>
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
                    {{ $t('os.nenhum_pagamento') }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="print-balances">
              <p><strong>{{ $t('os.total_pago') }}</strong> {{ totalPago.toFixed(2) }}</p>
              <p>
                <strong>{{ $t('os.falta_receber') }}</strong> {{ saldoDevedor.toFixed(2) }}
              </p>
            </div>
          </div>

          <div v-if="servicoLocal.obs_fechamento || configLuthieria.termos_garantia" class="print-notes">
            <hr class="print-divider" />
            <p><strong>{{ $t('os.notas_importantes') }}</strong></p>
            <p style="white-space: pre-wrap">
              {{ servicoLocal.obs_fechamento || configLuthieria.termos_garantia }}
            </p>
          </div>

          <div class="print-footer">
            <p>{{ $t('os.agradecimento') }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* CSS do Alerta de Retrabalho (Específico desta página) */
.alert-retrabalho {
  background-color: #fef2f2;
  border-left: 5px solid #ef4444;
  color: #991b1b;
  padding: 12px 15px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.execucao-container {
  animation: fadeIn 0.3s ease-in-out;
}

.badge {
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
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
