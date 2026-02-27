<script setup>
/**
 * ============================================================================
 * @file        ExecucaoServico.vue
 * @description Gestão da O.S. (Checklist, Diário, Orçamento e Pagamento).
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
  nome_luthieria: "Luthieria",
  tipo_impressora: "padrao",
});

const diario = ref([]);
const novaEntradaDiario = ref({
  descricao: "",
  fase_projeto: servicoLocal.value.fase_projeto || "Na Bancada",
});
const fasesPermitidas = [
  "Fila de Espera",
  "Aguardando Peças",
  "Secagem / Cura",
  "Na Bancada",
  "Testes / Setup",
  "Pronto para Entrega",
];

const checklistItens = ref([]);
const fotosChecklist = ref([]);
const carregandoFoto = ref(false);

const itensOrcamento = ref([]);
const catalogoOriginal = ref([]);
const idItemCatalogo = ref(""); // Para o autocomplete funcionar
const novoItem = ref({ descricao: "", valor: null, tipo: "Mão de Obra" });

const pagamentosOS = ref([]);
const novoPagamento = ref({ valor: 0, metodo: "PIX" });

const osFinalizada = computed(
  () =>
    servicoLocal.value.status === "Finalizado" ||
    servicoLocal.value.status === "Entregue",
);

// ==========================================
// FUNÇÕES DE CARREGAMENTO DO BANCO DE DADOS
// ==========================================
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

async function carregarDiario() {
  const { data, error } = await supabase
    .from("diario_servico")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("data_registro", { ascending: false });
  if (error) triggerToast("Erro ao carregar diário", "error");
  if (data) diario.value = data;
}

async function carregarChecklist() {
  const { data, error } = await supabase
    .from("checklist_servico")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("id", { ascending: true });
  if (error) triggerToast("Erro ao carregar checklist", "error");
  if (data) checklistItens.value = data;
}

async function carregarFotosChecklist() {
  const { data, error } = await supabase
    .from("checklist_fotos")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("created_at", { ascending: false });
  if (error) console.error(error);
  if (data) fotosChecklist.value = data;
}

async function carregarOrcamento() {
  const { data, error } = await supabase
    .from("orcamento_itens")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("created_at", { ascending: true });
  if (error) console.error(error);
  if (data) itensOrcamento.value = data;
}

async function carregarCatalogo() {
  const { data } = await supabase
    .from("catalogo")
    .select("*")
    .order("nome", { ascending: true });
  if (data) catalogoOriginal.value = data;
}

async function carregarPagamentos() {
  const { data, error } = await supabase
    .from("transacoes")
    .select("*")
    .eq("servico_id", servicoLocal.value.id)
    .order("data_pagamento", { ascending: false });
  if (error) console.error(error);
  if (data) pagamentosOS.value = data;
}

// ==========================================
// FUNÇÕES DE CHECKLIST E FOTOS
// ==========================================
async function atualizarStatusChecklist(item) {
  const { error } = await supabase
    .from("checklist_servico")
    .update({ status: item.status })
    .eq("id", item.id);
  if (error) triggerToast("Erro ao salvar status: " + error.message, "error");
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
    const fileName = `${servicoLocal.value.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("fotos-luthieria")
      .upload(fileName, arquivoComprimido);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("fotos-luthieria")
      .getPublicUrl(fileName);

    // CORREÇÃO AQUI: Mudado de 'url' para 'foto_url' conforme o erro avisou
    const { data: insertData, error: dbError } = await supabase
      .from("checklist_fotos")
      .insert([
        { servico_id: servicoLocal.value.id, foto_url: urlData.publicUrl },
      ])
      .select();

    if (dbError) throw dbError;

    if (insertData) fotosChecklist.value.unshift(insertData[0]);
    triggerToast("Foto anexada com sucesso!", "success");
  } catch (err) {
    triggerToast("Erro ao enviar foto: " + err.message, "error");
  } finally {
    carregandoFoto.value = false;
  }
}

async function deletarFoto(id) {
  if (idFotoConfirmar.value === id) {
    const { error } = await supabase
      .from("checklist_fotos")
      .delete()
      .eq("id", id);
    if (error) return triggerToast("Erro ao excluir.", "error");
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

// ==========================================
// FUNÇÕES DE DIÁRIO
// ==========================================
async function adicionarEntradaDiario() {
  if (!novaEntradaDiario.value.descricao)
    return triggerToast("Anotação não pode estar vazia.", "error");
  const { data, error } = await supabase
    .from("diario_servico")
    .insert([
      {
        servico_id: servicoLocal.value.id,
        descricao: novaEntradaDiario.value.descricao,
        fase_projeto: novaEntradaDiario.value.fase_projeto,
      },
    ])
    .select();

  if (error)
    return triggerToast("Erro ao salvar diário: " + error.message, "error");

  if (data) {
    diario.value.unshift(data[0]);
    await supabase
      .from("servicos")
      .update({ fase_projeto: novaEntradaDiario.value.fase_projeto })
      .eq("id", servicoLocal.value.id);
    servicoLocal.value.fase_projeto = novaEntradaDiario.value.fase_projeto;
    novaEntradaDiario.value.descricao = "";
    triggerToast("Diário atualizado!", "success");
  }
}

// ==========================================
// FUNÇÕES DE ORÇAMENTO (CORRIGIDAS)
// ==========================================
function usarItemCatalogo() {
  const selecionado = catalogoOriginal.value.find(
    (c) => c.id === idItemCatalogo.value,
  );
  if (selecionado) {
    novoItem.value.descricao = selecionado.nome;
    novoItem.value.valor = selecionado.preco_base;
    novoItem.value.tipo = selecionado.tipo || "Mão de Obra";
  }
}

async function adicionarItemOrcamento() {
  if (!novoItem.value.descricao || !novoItem.value.valor)
    return triggerToast("Preencha descrição e valor.", "error");

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

  if (error)
    return triggerToast("Erro ao salvar item: " + error.message, "error");

  if (data) {
    itensOrcamento.value.push(data[0]);
    novoItem.value = { descricao: "", valor: null, tipo: "Mão de Obra" };
    idItemCatalogo.value = ""; // Reseta o select
    triggerToast("Item adicionado ao orçamento.", "success");
  }
}

async function removerItemOrcamento(id) {
  const { error } = await supabase
    .from("orcamento_itens")
    .delete()
    .eq("id", id);
  if (error) return triggerToast("Erro ao remover.", "error");
  itensOrcamento.value = itensOrcamento.value.filter((i) => i.id !== id);
  triggerToast("Item removido.", "info");
}

// ==========================================
// FINANCEIRO E RECEBIMENTO
// ==========================================
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

  if (error)
    return triggerToast(
      "Erro ao registar pagamento: " + error.message,
      "error",
    );

  if (data) {
    pagamentosOS.value.unshift(data[0]);
    triggerToast(`Recebido: R$ ${novoPagamento.value.valor}`, "success");
    pgtoExcedenteConfirmado.value = false;
    if (saldoDevedor.value <= 0 && !osFinalizada.value)
      mostrarBannerFinalizacao.value = true;
  }
}

async function estornarPagamento(id) {
  if (idPgtoConfirmar.value === id) {
    const { error } = await supabase.from("transacoes").delete().eq("id", id);
    if (error) return triggerToast("Erro ao estornar.", "error");
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

async function finalizarOSManual() {
  const { error } = await supabase
    .from("servicos")
    .update({
      status: "Finalizado",
      fase_projeto: "Pronto para Entrega",
      data_conclusao: new Date().toISOString(),
    })
    .eq("id", servicoLocal.value.id);
  if (error) return triggerToast("Erro ao finalizar.", "error");
  servicoLocal.value.status = "Finalizado";
  servicoLocal.value.fase_projeto = "Pronto para Entrega";
  mostrarBannerFinalizacao.value = false;
  triggerToast("O.S. Finalizada!", "success");
}

function gerarRecibo() {
  triggerToast(
    `Imprimindo no formato: ${configLuthieria.value.tipo_impressora}`,
    "info",
  );
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
        class="banner-aviso mb-2"
        style="background: #e2e8f0; color: #475569; border-color: #cbd5e1"
      >
        <span class="icon-dinamico">lock</span> O.S. Concluída. A edição de
        dados está bloqueada.
      </div>

      <div v-if="abaAtual === 'checklist'">
        <div class="card mb-2">
          <h4 class="title-section">Checklist de Inspeção</h4>
          <div v-if="checklistItens.length === 0" class="text-muted">
            Nenhum item configurado nesta O.S.
          </div>
          <div
            v-for="item in checklistItens"
            :key="item.id"
            class="checklist-row"
          >
            <span>{{ item.descricao }}</span>
            <select
              v-model="item.status"
              @change="atualizarStatusChecklist(item)"
              :disabled="osFinalizada"
              :class="{
                'text-danger': item.status === 'Com Defeito',
                'text-success': item.status === 'Ok',
              }"
            >
              <option value="Ok">✅ Ok</option>
              <option value="Com Defeito">❌ Com Defeito</option>
              <option value="Ausente">➖ Ausente</option>
            </select>
          </div>
        </div>

        <div class="card">
          <div class="flex-between mb-1">
            <h4 style="margin: 0">Fotos e Evidências</h4>
            <label
              v-if="!osFinalizada"
              class="btn-outline"
              style="cursor: pointer; font-size: 0.8rem; padding: 5px 10px"
            >
              {{ carregandoFoto ? "⏳ Enviando..." : "📷 Adicionar Foto" }}
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
            >
              Nenhuma foto anexada.
            </div>
            <div
              v-for="foto in fotosChecklist"
              :key="foto.id"
              class="foto-card"
            >
              <img :src="foto.foto_url || foto.url" class="img-preview" />
              <button
                v-if="!osFinalizada"
                class="btn-delete-confirm w-full"
                @click="deletarFoto(foto.id)"
                :class="{ confirming: idFotoConfirmar === foto.id }"
              >
                {{ idFotoConfirmar === foto.id ? "Tem a certeza?" : "Excluir" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'diario'">
        <div class="card mb-2" v-if="!osFinalizada">
          <h4 style="margin-top: 0">Nova Anotação</h4>
          <textarea
            v-model="novaEntradaDiario.descricao"
            rows="2"
            placeholder="O que foi feito hoje?"
          ></textarea>
          <div class="flex-gap-10 mt-1">
            <select v-model="novaEntradaDiario.fase_projeto" class="flex-1">
              <option v-for="fase in fasesPermitidas" :key="fase" :value="fase">
                {{ fase }}
              </option>
            </select>
            <button class="btn-primary" @click="adicionarEntradaDiario">
              Salvar Anotação
            </button>
          </div>
        </div>

        <div class="card">
          <h4 class="title-section">Histórico da Bancada</h4>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="abaAtual === 'orcamento'">
        <div class="card mb-2" v-if="!osFinalizada">
          <h4 style="margin-top: 0">Adicionar Serviço / Peça</h4>
          <div class="form-group mb-1">
            <label>Buscar do Catálogo:</label>
            <select v-model="idItemCatalogo" @change="usarItemCatalogo">
              <option value="">-- Preencher Manualmente --</option>
              <option
                v-for="cat in catalogoOriginal"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.nome }} (R$ {{ cat.preco_base }})
              </option>
            </select>
          </div>
          <div class="grid-orcamento mb-1">
            <input
              v-model="novoItem.descricao"
              placeholder="Descrição manual"
            />
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
          <div class="flex-between mb-1">
            <h4 class="title-section" style="margin: 0; border: none">
              Itens da O.S.
            </h4>
            <h3 style="margin: 0; color: var(--success)">
              Total: R$ {{ totalOrcamento.toFixed(2) }}
            </h3>
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
            <h4 style="margin-top: 0">Registrar Pagamento</h4>
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

/* CHECKLIST & FOTOS */
.checklist-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px dashed var(--border);
}
.checklist-row select {
  width: auto;
  padding: 4px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: bold;
}
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
