<script setup>
import html2canvas from "html2canvas";
import { ref, computed, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { abrirWhatsapp } from "../lib/whatsappUtils";

const props = defineProps(["servico"]);
const emit = defineEmits(["voltar"]);

const servicoLocal = ref({ ...props.servico });
const carregandoDados = ref(true);

const configLuthieria = ref({
  nome_luthieria: "Minha Luthieria",
  documento: "",
  telefone: "",
  endereco: "",
  termos_garantia: "Garantia de 90 dias sobre os serviços executados.",
  logo_url: "",
});

async function carregarConfiguracoes() {
  const { data } = await supabase
    .from("configuracoes")
    .select("*")
    .maybeSingle();
  if (data) configLuthieria.value = data;
}

async function buscarDadosCompletos() {
  carregandoDados.value = true;
  const { data } = await supabase
    .from("servicos")
    .select(`*, instrumentos (*, cliente:clientes (*))`)
    .eq("id", props.servico.id)
    .single();
  if (data) servicoLocal.value = data;
  carregandoDados.value = false;
}

const isFinalizado = computed(() => servicoLocal.value?.status === "Entregue");
const abaAtual = ref("orcamento");
const mostrarRecibo = ref(false);

const fotoAmpliada = ref(null);
const mostrarModalFoto = ref(false);

function abrirModalFoto(url) {
  if (!url) return;
  fotoAmpliada.value = url;
  mostrarModalFoto.value = true;
}
function fecharModalFoto() {
  fotoAmpliada.value = null;
  mostrarModalFoto.value = false;
}

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
  proximos_passos: "",
  data_proxima_etapa: "",
});
const carregandoDiarioSalvar = ref(false);
const arquivoFotoDiario = ref(null);
const previewFotoDiario = ref(null);

async function carregarDiario() {
  const { data } = await supabase
    .from("diario_servico")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("data_registro", { ascending: false });
  if (data) diario.value = data;
}
function selecionarFotoDiario(event) {
  const file = event.target.files[0];
  if (!file) return;
  arquivoFotoDiario.value = file;
  previewFotoDiario.value = URL.createObjectURL(file);
}
function removerFotoDiario() {
  arquivoFotoDiario.value = null;
  previewFotoDiario.value = null;
}

async function salvarEntradaDiario() {
  if (!novaEntradaDiario.value.descricao)
    return alert("Descreva a etapa executada.");
  carregandoDiarioSalvar.value = true;
  let urlFoto = null;
  if (arquivoFotoDiario.value) {
    const fileName = `diario/${servicoLocal.value.id}/${Date.now()}_img`;
    const { error: erroUpload } = await supabase.storage
      .from("fotos-luthieria")
      .upload(fileName, arquivoFotoDiario.value);
    if (erroUpload) {
      alert("Erro ao enviar foto: " + erroUpload.message);
      carregandoDiarioSalvar.value = false;
      return;
    }
    const { data } = supabase.storage
      .from("fotos-luthieria")
      .getPublicUrl(fileName);
    urlFoto = data.publicUrl;
  }
  const entrada = {
    servico_id: servicoLocal.value.id,
    descricao: novaEntradaDiario.value.descricao,
    fase_projeto: novaEntradaDiario.value.fase_projeto,
    proximos_passos: novaEntradaDiario.value.proximos_passos,
    data_proxima_etapa: novaEntradaDiario.value.data_proxima_etapa || null,
    foto_url: urlFoto,
  };
  const { data, error } = await supabase
    .from("diario_servico")
    .insert([entrada])
    .select();
  if (!error) {
    diario.value.unshift(data[0]);
    await supabase
      .from("servicos")
      .update({ fase_projeto: entrada.fase_projeto })
      .eq("id", servicoLocal.value.id);
    servicoLocal.value.fase_projeto = entrada.fase_projeto;
    novaEntradaDiario.value = {
      descricao: "",
      fase_projeto: entrada.fase_projeto,
      proximos_passos: "",
      data_proxima_etapa: "",
    };
    removerFotoDiario();
  } else alert("Erro ao guardar no diário: " + error.message);
  carregandoDiarioSalvar.value = false;
}

const itensChecklist = ref([]);
const carregandoFoto = ref(false);
const areasPadrao = [
  "Headstock",
  "Braço/Escala",
  "Corpo",
  "Elétrica",
  "Ferragens",
];

async function carregarChecklist() {
  const { data } = await supabase
    .from("checklist")
    .select("*")
    .eq("servico_id", servicoLocal.value.id);
  if (data && data.length > 0) itensChecklist.value = data;
  else
    itensChecklist.value = areasPadrao.map((area) => ({
      servico_id: servicoLocal.value.id,
      etapa: "Entrada",
      area,
      condicao: "Bom",
      observacao: "",
      foto_url: null,
    }));
}
async function uploadFoto(event, itemIndex) {
  const file = event.target.files[0];
  if (!file) return;
  carregandoFoto.value = true;
  const fileName = `${servicoLocal.value.id}/${Date.now()}_img`;
  const { error } = await supabase.storage
    .from("fotos-luthieria")
    .upload(fileName, file);
  if (error) {
    alert("Erro: " + error.message);
    carregandoFoto.value = false;
    return;
  }
  const { data } = supabase.storage
    .from("fotos-luthieria")
    .getPublicUrl(fileName);
  itensChecklist.value[itemIndex].foto_url = data.publicUrl;
  carregandoFoto.value = false;
}
function removerFoto(itemIndex) {
  if (confirm("Remover esta foto?"))
    itensChecklist.value[itemIndex].foto_url = null;
}
async function salvarChecklist() {
  const { error } = await supabase
    .from("checklist")
    .upsert(itensChecklist.value);
  if (error) alert("Erro: " + error.message);
  else alert("Checklist salvo!");
}

const listaCatalogo = ref([]);
const itensServico = ref([]);
const novoItem = ref({
  descricao: "",
  tipo: "MaoDeObra",
  custo_aquisicao: 0,
  valor_cobrado: 0,
  catalogo_id: null,
});
const mostrarFechamento = ref(false);
const totalJaPago = ref(0);
const dadosPagamento = ref({
  forma: "Pix",
  taxa: 0,
  desconto: 0,
  valorPago: 0,
});

const totalCusto = computed(() =>
  itensServico.value.reduce(
    (acc, item) => acc + Number(item.custo_aquisicao || 0),
    0,
  ),
);
const totalServico = computed(() =>
  itensServico.value.reduce(
    (acc, item) => acc + Number(item.valor_cobrado || 0),
    0,
  ),
);
const valorFinalCliente = computed(
  () => totalServico.value - dadosPagamento.value.desconto,
);
const lucroEstimado = computed(
  () => valorFinalCliente.value - totalCusto.value,
);
const saldoDevedor = computed(
  () => valorFinalCliente.value - totalJaPago.value,
);
const itensVisiveisCliente = computed(() =>
  itensServico.value.filter((item) => item.tipo !== "Insumo"),
);

async function carregarCatalogo() {
  const { data } = await supabase.from("catalogo").select("*").order("nome");
  if (data) listaCatalogo.value = data;
}
async function carregarItens() {
  const { data } = await supabase
    .from("itens_servico")
    .select("*")
    .eq("servico_id", servicoLocal.value.id);
  if (data) itensServico.value = data;
}

async function selecionarItemCatalogo(event) {
  const idSelecionado = event.target.value;
  if (!idSelecionado) return;
  const item = listaCatalogo.value.find((i) => i.id === idSelecionado);

  if (item) {
    if (item.controla_estoque && item.quantidade_estoque <= 0) {
      alert(
        `⚠️ Atenção: O item "${item.nome}" está esgotado no seu Catálogo!\nA peça será adicionada à O.S., mas lembre-se de repor o estoque.`,
      );
    }
    novoItem.value = {
      descricao: item.nome,
      tipo: item.tipo || "MaoDeObra",
      custo_aquisicao: item.custo_padrao || 0,
      valor_cobrado: item.preco_padrao || 0,
      catalogo_id: item.id,
    };
    await adicionarItem();
    event.target.value = "";
  }
}

async function adicionarItem() {
  if (!novoItem.value.descricao) return alert("Descreva o item.");
  const { data, error } = await supabase
    .from("itens_servico")
    .insert([{ servico_id: servicoLocal.value.id, ...novoItem.value }])
    .select();

  if (!error && data) {
    itensServico.value.push(data[0]);
    if (novoItem.value.catalogo_id) {
      const catItem = listaCatalogo.value.find(
        (c) => c.id === novoItem.value.catalogo_id,
      );
      if (catItem && catItem.controla_estoque) {
        const novaQuantidade = catItem.quantidade_estoque - 1;
        await supabase
          .from("catalogo")
          .update({ quantidade_estoque: novaQuantidade })
          .eq("id", catItem.id);
        catItem.quantidade_estoque = novaQuantidade;
      }
    }
    novoItem.value = {
      descricao: "",
      tipo: "MaoDeObra",
      custo_aquisicao: 0,
      valor_cobrado: 0,
      catalogo_id: null,
    };
  } else alert("Erro ao adicionar: " + error.message);
}

async function removerItem(id) {
  const itemRemovido = itensServico.value.find((i) => i.id === id);
  const { error } = await supabase.from("itens_servico").delete().eq("id", id);
  if (!error) {
    itensServico.value = itensServico.value.filter((i) => i.id !== id);
    if (itemRemovido && itemRemovido.catalogo_id && !isFinalizado.value) {
      const catItem = listaCatalogo.value.find(
        (c) => c.id === itemRemovido.catalogo_id,
      );
      if (catItem && catItem.controla_estoque) {
        const novaQuantidade = catItem.quantidade_estoque + 1;
        await supabase
          .from("catalogo")
          .update({ quantidade_estoque: novaQuantidade })
          .eq("id", catItem.id);
        catItem.quantidade_estoque = novaQuantidade;
      }
    }
  }
}

function enviarOrcamentoWhatsapp() {
  const inst = servicoLocal.value?.instrumentos;
  const cli = inst?.cliente;
  if (!cli || !cli.telefone) return alert("Telefone não cadastrado.");
  let msg = `Olá *${cli.nome}*! 👋\nOrçamento: *${inst.marca} ${inst.modelo}*\n\n`;
  itensVisiveisCliente.value.forEach((item) => {
    msg += `▪️ ${item.descricao}: R$ ${Number(item.valor_cobrado).toFixed(2)}\n`;
  });
  msg += `\n*TOTAL: R$ ${valorFinalCliente.value.toFixed(2)}*\n`;
  if (totalJaPago.value > 0)
    msg += `Pago: -R$ ${totalJaPago.value.toFixed(2)}\n*Falta: R$ ${saldoDevedor.value.toFixed(2)}*\n`;
  msg += isFinalizado.value ? `\n✅ Concluído!` : `\nPodemos prosseguir?`;
  abrirWhatsapp(cli, msg);
}

async function baixarImagemRecibo() {
  const elemento = document.getElementById("area-do-recibo");
  if (!elemento) return;
  setTimeout(async () => {
    const canvas = await html2canvas(elemento, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `OS_${servicoLocal.value.numero_os}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, 100);
}

async function carregarDadosPagamento() {
  const { data } = await supabase
    .from("transacoes")
    .select("valor_bruto")
    .eq("servico_id", servicoLocal.value.id)
    .eq("tipo", "Entrada");
  totalJaPago.value = data
    ? data.reduce((acc, t) => acc + Number(t.valor_bruto), 0)
    : 0;
}

function abrirFechamento() {
  dadosPagamento.value.valorPago = Number(saldoDevedor.value.toFixed(2));
  mostrarFechamento.value = true;
}

async function registrarPagamento() {
  const v = Number(dadosPagamento.value.valorPago);
  if (v <= 0) return alert("Valor inválido");
  await supabase
    .from("transacoes")
    .insert([
      {
        servico_id: servicoLocal.value.id,
        tipo: "Entrada",
        categoria: "Servico",
        descricao: `Recebimento O.S. #${servicoLocal.value.numero_os}`,
        valor_bruto: v,
        forma_pagamento: dadosPagamento.value.forma,
        data_pagamento: new Date(),
      },
    ]);
  totalJaPago.value += v;
  if (saldoDevedor.value <= 0.02) {
    await supabase
      .from("servicos")
      .update({
        status: "Entregue",
        fase_projeto: "Pronto para Entrega",
        data_conclusao: new Date(),
      })
      .eq("id", servicoLocal.value.id);
    servicoLocal.value.status = "Entregue";
    emit("voltar");
  } else {
    alert("Pagamento parcial registado!");
    mostrarFechamento.value = false;
  }
}

onMounted(() => {
  carregarConfiguracoes();
  buscarDadosCompletos();
  carregarChecklist();
  carregarDiario();
  carregarItens();
  carregarCatalogo();
  carregarDadosPagamento();
});
</script>

<template>
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
      <h3 style="margin: 0; color: var(--primary)">
        O.S. #{{ servicoLocal.numero_os }} -
        {{ servicoLocal.fase_projeto || "Em Andamento" }}
      </h3>
      <button class="btn-outline" @click="$emit('voltar')">
        &larr; Voltar
      </button>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 20px">
      <button
        class="btn-tab"
        :class="{ active: abaAtual === 'diario' }"
        @click="abaAtual = 'diario'"
      >
        📓 Diário
      </button>
      <button
        class="btn-tab"
        :class="{ active: abaAtual === 'checklist' }"
        @click="abaAtual = 'checklist'"
      >
        📸 Checklist
      </button>
      <button
        class="btn-tab"
        :class="{ active: abaAtual === 'orcamento' }"
        @click="abaAtual = 'orcamento'"
      >
        💰 Orçamento e Custos
      </button>
    </div>

    <div v-if="abaAtual === 'diario'">
      <div
        class="box"
        style="
          border-left: 4px solid var(--danger);
          background: #fff5f5;
          margin-bottom: 20px;
        "
      >
        <h4 style="margin: 0 0 5px 0; color: var(--danger)">
          🚨 Problema Original / Reclamação
        </h4>
        <p style="margin: 0; font-style: italic; font-size: 0.95rem">
          {{ servicoLocal.descricao_cliente || "Nenhuma descrição fornecida." }}
        </p>
      </div>

      <div class="box mb-1" v-if="!isFinalizado">
        <h4 style="margin-top: 0">📝 Nova Atualização</h4>
        <div class="form-group">
          <label>O que foi executado? *</label
          ><textarea
            v-model="novaEntradaDiario.descricao"
            rows="2"
            placeholder="Ex: Braço colado, a aguardar secagem..."
          ></textarea>
        </div>
        <div
          style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap"
        >
          <div style="flex: 1">
            <label>Fase do Projeto:</label
            ><select v-model="novaEntradaDiario.fase_projeto">
              <option v-for="f in fasesPermitidas" :key="f">{{ f }}</option>
            </select>
          </div>
          <div style="flex: 1">
            <label>Data da Próxima Etapa:</label
            ><input
              type="date"
              v-model="novaEntradaDiario.data_proxima_etapa"
            />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 10px">
          <label>Próximos Passos (Opcional):</label
          ><input
            v-model="novaEntradaDiario.proximos_passos"
            placeholder="Ex: Lixar excesso de cola e polir"
          />
        </div>
        <div class="form-group" style="margin-bottom: 0">
          <label>Anexar Foto (Opcional):</label>
          <div
            style="
              display: flex;
              gap: 10px;
              align-items: center;
              margin-bottom: 10px;
            "
          >
            <label
              class="btn-outline"
              style="cursor: pointer; font-size: 0.85rem; padding: 6px 12px"
              >{{ previewFotoDiario ? "🔄 Trocar Foto" : "📷 Escolher Foto"
              }}<input
                type="file"
                accept="image/*"
                @change="selecionarFotoDiario"
                hidden
            /></label>
            <button
              v-if="previewFotoDiario"
              class="btn-icon text-danger"
              @click="removerFotoDiario"
            >
              ❌
            </button>
          </div>
          <img
            v-if="previewFotoDiario"
            :src="previewFotoDiario"
            @click="abrirModalFoto(previewFotoDiario)"
            class="img-clicavel"
            style="
              max-height: 120px;
              border-radius: 4px;
              border: 1px solid var(--border);
            "
          />
        </div>
        <button
          class="btn-primary"
          @click="salvarEntradaDiario"
          :disabled="carregandoDiarioSalvar"
          style="width: 100%; margin-top: 15px"
        >
          {{
            carregandoDiarioSalvar ? "⏳ A guardar..." : "➕ Registar no Diário"
          }}
        </button>
      </div>

      <div class="linha-tempo">
        <h4 class="title-section">Histórico</h4>
        <div v-for="entrada in diario" :key="entrada.id" class="diario-item">
          <div
            style="
              display: flex;
              justify-content: space-between;
              border-bottom: 1px solid var(--border);
              padding-bottom: 5px;
              margin-bottom: 8px;
            "
          >
            <small class="text-muted">{{
              new Date(entrada.data_registro).toLocaleString()
            }}</small
            ><span class="badge-fase">{{ entrada.fase_projeto }}</span>
          </div>
          <p style="margin: 0 0 10px 0; font-size: 0.95rem">
            <strong>Executado:</strong> {{ entrada.descricao }}
          </p>
          <div v-if="entrada.foto_url" style="margin-bottom: 10px">
            <img
              :src="entrada.foto_url"
              @click="abrirModalFoto(entrada.foto_url)"
              class="img-clicavel"
              style="
                max-width: 100%;
                max-height: 250px;
                border-radius: 4px;
                border: 1px solid var(--border);
                object-fit: cover;
              "
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="abaAtual === 'checklist'">
      <div
        v-for="(item, index) in itensChecklist"
        :key="index"
        class="box mb-1"
      >
        <div
          style="
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          "
        >
          <strong>{{ item.area }}</strong
          ><select
            v-model="item.condicao"
            style="width: auto; padding: 2px 5px"
          >
            <option>Bom</option>
            <option>Regular</option>
            <option>Ruim</option>
            <option>Danificado</option>
          </select>
        </div>
        <input
          v-model="item.observacao"
          placeholder="Observações..."
          style="margin-bottom: 10px"
        />
        <div class="foto-area">
          <img
            v-if="item.foto_url"
            :src="item.foto_url"
            @click="abrirModalFoto(item.foto_url)"
            class="preview-img img-clicavel"
          />
          <div style="display: flex; gap: 5px">
            <label
              class="btn-outline"
              style="cursor: pointer; font-size: 0.9rem; padding: 6px 12px"
              >{{ item.foto_url ? "🔄 Trocar" : "📷 Foto"
              }}<input
                type="file"
                accept="image/*"
                @change="(e) => uploadFoto(e, index)"
                hidden
            /></label>
            <button
              v-if="item.foto_url"
              class="btn-icon text-danger"
              @click="removerFoto(index)"
              title="Excluir Foto"
            >
              ❌
            </button>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click="salvarChecklist" style="width: 100%">
        💾 Salvar Checklist
      </button>
    </div>

    <div v-if="abaAtual === 'orcamento'">
      <div style="display: flex; gap: 10px; margin-bottom: 15px">
        <button
          class="btn-success"
          @click="enviarOrcamentoWhatsapp"
          style="flex: 1"
        >
          📱 Enviar Proposta
        </button>
        <button
          class="btn-primary"
          @click="mostrarRecibo = true"
          style="flex: 1; background: #6f42c1"
        >
          📄 Gerar PDF (Recibo)
        </button>
      </div>

      <table class="tabela-padrao mb-1">
        <thead>
          <tr>
            <th>Item</th>
            <th>Tipo</th>
            <th>Custo (R$)</th>
            <th>Venda (R$)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in itensServico" :key="item.id">
            <td>
              {{ item.descricao }}
              <span
                v-if="item.tipo === 'Insumo'"
                style="
                  display: block;
                  font-size: 0.75rem;
                  color: var(--danger);
                  font-style: italic;
                "
                >Oculto do Cliente</span
              >
            </td>
            <td>
              <span class="badge" :class="item.tipo">{{
                item.tipo === "MaoDeObra" ? "Serviço" : item.tipo
              }}</span>
            </td>
            <td class="text-danger">{{ item.custo_aquisicao }}</td>
            <td class="text-success" style="font-weight: bold">
              {{ item.valor_cobrado }}
            </td>
            <td>
              <button
                class="btn-icon text-danger"
                @click="removerItem(item.id)"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        class="box mb-1"
        style="background: #fdfdfd; border: 1px dashed var(--border)"
      >
        <h4 style="margin-top: 0; color: var(--primary)">📊 Margem e Custos</h4>
        <div
          style="
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
          "
        >
          <div>
            Custo de Execução:<br /><strong class="text-danger"
              >R$ {{ totalCusto.toFixed(2) }}</strong
            >
          </div>
          <div>
            Total Cliente:<br /><strong class="text-primary"
              >R$ {{ valorFinalCliente.toFixed(2) }}</strong
            >
          </div>
          <div>
            Lucro Estimado:<br /><strong
              class="text-success"
              style="font-size: 1.2rem"
              >R$ {{ lucroEstimado.toFixed(2) }}</strong
            >
          </div>
        </div>
      </div>

      <div class="box mb-1" v-if="!isFinalizado">
        <h4 style="margin-top: 0">Adicionar Serviço, Peça ou Insumo Extra</h4>

        <div style="margin-bottom: 10px">
          <select @change="selecionarItemCatalogo" style="width: 100%">
            <option value="">
              -- Selecionar do Catálogo Automático (Desconta Estoque) --
            </option>
            <option v-for="cat in listaCatalogo" :key="cat.id" :value="cat.id">
              {{ cat.nome }}
              ({{
                cat.tipo === "Insumo"
                  ? "Custo: R$ " + cat.custo_padrao
                  : "Venda: R$ " + cat.preco_padrao
              }})
              {{
                cat.controla_estoque
                  ? ` [📦 Estoque: ${cat.quantidade_estoque}]`
                  : ""
              }}
            </option>
          </select>
        </div>

        <div
          style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px"
        >
          <input
            v-model="novoItem.descricao"
            placeholder="Descrição avulsa (Não afeta estoque)..."
            style="flex: 2; min-width: 150px"
          />
          <select v-model="novoItem.tipo" style="flex: 1; min-width: 120px">
            <option value="MaoDeObra">Serviço</option>
            <option value="Peca">Peça/Produto</option>
            <option value="Insumo">Insumo (Custo Oculto)</option>
          </select>
        </div>

        <div style="display: flex; gap: 10px; align-items: flex-end">
          <div style="flex: 1">
            <label>Seu Custo (R$)</label
            ><input
              v-model="novoItem.custo_aquisicao"
              type="number"
              step="0.01"
            />
          </div>
          <div style="flex: 1">
            <label>Valor Cliente (R$)</label
            ><input
              v-model="novoItem.valor_cobrado"
              type="number"
              step="0.01"
              :disabled="novoItem.tipo === 'Insumo'"
            />
          </div>
          <button
            class="btn-accent"
            @click="adicionarItem"
            style="height: 42px"
          >
            + Adicionar
          </button>
        </div>
      </div>

      <div v-if="!isFinalizado">
        <button
          v-if="!mostrarFechamento"
          class="btn-primary"
          @click="abrirFechamento"
          style="width: 100%; padding: 15px; font-size: 1.1rem"
        >
          💲 Registar Pagamento / Fechar O.S.
        </button>
        <div v-else class="box" style="border: 2px solid var(--success)">
          <h3>Recebimento</h3>
          <p>
            Total da O.S.: <strong>R$ {{ totalServico.toFixed(2) }}</strong>
          </p>
          <p v-if="totalJaPago > 0" class="text-success">
            Já Recebido: <strong>-R$ {{ totalJaPago.toFixed(2) }}</strong>
          </p>
          <p
            style="
              color: var(--danger);
              font-size: 1.2rem;
              border-top: 1px solid #ccc;
              margin-top: 5px;
            "
          >
            <strong>Falta: R$ {{ saldoDevedor.toFixed(2) }}</strong>
          </p>

          <div style="display: flex; gap: 10px; margin: 10px 0">
            <div style="flex: 1">
              <label>Desconto (R$):</label
              ><input v-model.number="dadosPagamento.desconto" type="number" />
            </div>
            <div style="flex: 1">
              <label>A Pagar AGORA:</label
              ><input v-model.number="dadosPagamento.valorPago" type="number" />
            </div>
          </div>
          <label>Forma:</label
          ><select v-model="dadosPagamento.forma" style="margin-bottom: 10px">
            <option>Pix</option>
            <option>Dinheiro</option>
            <option>Cartão</option>
          </select>
          <button
            class="btn-success"
            @click="registrarPagamento"
            style="
              width: 100%;
              padding: 12px;
              border-radius: 4px;
              border: none;
              color: white;
              font-weight: bold;
              cursor: pointer;
            "
          >
            ✅ Confirmar
          </button>
        </div>
      </div>
      <div
        v-else
        class="box"
        style="
          background: var(--success);
          color: white;
          text-align: center;
          font-weight: bold;
        "
      >
        ✅ Serviço Quitado e Entregue
      </div>
    </div>
  </div>

  <div
    v-if="mostrarRecibo"
    class="modal-overlay"
    @click.self="mostrarRecibo = false"
  >
    <div class="modal-content">
      <div id="area-do-recibo" class="folha-recibo">
        <div style="text-align: center; margin-bottom: 20px">
          <img
            v-if="configLuthieria.logo_url"
            :src="configLuthieria.logo_url"
            style="max-height: 80px; margin-bottom: 10px; object-fit: contain"
          />
          <h2 style="margin: 0; font-size: 1.4rem; color: #333">
            {{ configLuthieria.nome_luthieria }}
          </h2>
          <p style="margin: 5px 0; font-size: 0.85rem; color: #555">
            <span v-if="configLuthieria.documento"
              >Doc: {{ configLuthieria.documento }} | </span
            ><span v-if="configLuthieria.telefone"
              >Contato: {{ configLuthieria.telefone }}</span
            >
          </p>
          <p
            v-if="configLuthieria.endereco"
            style="margin: 3px 0; font-size: 0.8rem; color: #777"
          >
            {{ configLuthieria.endereco }}
          </p>
        </div>
        <hr style="border: 1px solid #000; margin: 15px 0" />
        <div
          style="
            font-size: 0.95rem;
            margin-bottom: 20px;
            background: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #eee;
          "
        >
          <p style="margin: 3px 0">
            <strong>O.S. Número:</strong> #{{ servicoLocal.numero_os }}
          </p>
          <p style="margin: 3px 0">
            <strong>Cliente:</strong>
            {{ servicoLocal.instrumentos?.cliente?.nome }}
          </p>
          <p style="margin: 3px 0">
            <strong>Instrumento:</strong> {{ servicoLocal.instrumentos?.marca }}
            {{ servicoLocal.instrumentos?.modelo }}
          </p>
          <p style="margin: 3px 0">
            <strong>Data de Emissão:</strong>
            {{ new Date().toLocaleDateString() }}
          </p>
        </div>
        <table
          style="
            width: 100%;
            font-size: 0.95rem;
            border-collapse: collapse;
            margin-bottom: 15px;
          "
        >
          <tr v-for="item in itensVisiveisCliente" :key="item.id">
            <td style="border-bottom: 1px dashed #ccc; padding: 5px 0">
              {{ item.descricao }}
            </td>
            <td
              align="right"
              style="border-bottom: 1px dashed #ccc; padding: 5px 0"
            >
              R$ {{ item.valor_cobrado }}
            </td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding-top: 10px; font-size: 1.1rem">
              TOTAL DO SERVIÇO
            </td>
            <td
              align="right"
              style="font-weight: bold; padding-top: 10px; font-size: 1.1rem"
            >
              R$ {{ valorFinalCliente.toFixed(2) }}
            </td>
          </tr>
          <tr v-if="totalJaPago > 0">
            <td style="padding-top: 5px; color: green">Sinal / Valor Pago</td>
            <td align="right" style="padding-top: 5px; color: green">
              - R$ {{ totalJaPago.toFixed(2) }}
            </td>
          </tr>
          <tr v-if="saldoDevedor > 0">
            <td style="font-weight: bold; padding-top: 5px">
              RESTANTE A PAGAR
            </td>
            <td align="right" style="font-weight: bold; padding-top: 5px">
              R$ {{ saldoDevedor.toFixed(2) }}
            </td>
          </tr>
        </table>
        <div
          style="
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px dashed #999;
            font-size: 0.8rem;
            color: #444;
            white-space: pre-wrap;
            text-align: justify;
            line-height: 1.4;
          "
        >
          <strong>Termos e Condições / Garantia:</strong><br />{{
            configLuthieria.termos_garantia
          }}
        </div>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 15px">
        <button class="btn-success" @click="baixarImagemRecibo" style="flex: 1">
          ⬇️ Baixar PDF
        </button>
        <button
          class="btn-outline"
          @click="mostrarRecibo = false"
          style="flex: 1"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="mostrarModalFoto"
    class="modal-overlay"
    @click.self="fecharModalFoto"
    style="z-index: 9999"
  >
    <div class="modal-foto-content">
      <button class="btn-fechar-foto" @click="fecharModalFoto">✖</button>
      <img :src="fotoAmpliada" class="foto-ampliada-img" />
    </div>
  </div>
</template>

<style scoped>
.btn-tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: var(--bg-body);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.btn-tab.active {
  background: var(--accent);
  color: white;
}
.btn-success {
  background: var(--success);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
.badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: white;
  white-space: nowrap;
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
.img-clicavel {
  cursor: pointer;
  transition: transform 0.2s;
}
.img-clicavel:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
.modal-foto-content {
  position: relative;
  max-width: 95vw;
  max-height: 95vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
.foto-ampliada-img {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
  object-fit: contain;
  background: #000;
}
.btn-fechar-foto {
  position: absolute;
  top: -15px;
  right: -15px;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: 50%;
  width: 35px;
  height: 35px;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  z-index: 110;
}
.btn-fechar-foto:hover {
  background: #a83232;
}
.foto-area {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  border-top: 1px dashed var(--border);
  padding-top: 8px;
}
.preview-img {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
}
.linha-tempo {
  border-left: 2px solid var(--border);
  padding-left: 15px;
  margin-left: 10px;
  margin-top: 20px;
}
.diario-item {
  position: relative;
  background: var(--bg-body);
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 15px;
  border: 1px solid var(--border);
}
.diario-item::before {
  content: "";
  position: absolute;
  left: -22px;
  top: 15px;
  width: 12px;
  height: 12px;
  background: var(--primary);
  border-radius: 50%;
}
.badge-fase {
  padding: 3px 8px;
  background: var(--primary);
  border-radius: 12px;
  font-size: 0.75rem;
  color: white;
  font-weight: bold;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: #e0e0e0;
  padding: 20px;
  width: 95%;
  max-width: 500px;
  border-radius: 8px;
  max-height: 90vh;
  overflow-y: auto;
}
.folha-recibo {
  padding: 30px;
  border: 1px solid #ddd;
  margin-bottom: 5px;
  font-family: "Courier New", monospace;
  background: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}
</style>
