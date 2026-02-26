<script setup>
/**
 * ============================================================================
 * @file        HistoricoServicos.vue
 * @description Módulo de arquivo morto e relatórios. Exibe todas as Ordens
 * de Serviço que já foram finalizadas ou entregues ao cliente.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const emit = defineEmits(["voltar", "abrirOS"]);
const { triggerToast } = useToast();

const servicosEntregues = ref([]);
const carregando = ref(true);
const exportando = ref(false); // Para mostrar um "loading" no botão enquanto processa

// FILTROS
const termoBusca = ref("");
const mesFiltro = ref(""); // Formato 'YYYY-MM'

async function carregarHistorico() {
  carregando.value = true;
  const { data, error } = await supabase
    .from("servicos")
    .select(
      `
      *, 
      instrumentos ( marca, modelo, cliente:clientes (nome, telefone, email) )
    `,
    )
    .in("status", ["Entregue", "Finalizado"])
    .order("data_conclusao", { ascending: false });

  if (!error && data) {
    servicosEntregues.value = data;
  }
  carregando.value = false;
}

const servicosFiltrados = computed(() => {
  let resultado = servicosEntregues.value;

  if (termoBusca.value) {
    const termo = termoBusca.value.toLowerCase();
    resultado = resultado.filter((os) => {
      const cli = os.instrumentos?.cliente?.nome?.toLowerCase() || "";
      const inst =
        `${os.instrumentos?.marca} ${os.instrumentos?.modelo}`.toLowerCase();
      const numOs = String(os.numero_os);
      return (
        cli.includes(termo) || inst.includes(termo) || numOs.includes(termo)
      );
    });
  }

  if (mesFiltro.value) {
    resultado = resultado.filter((os) => {
      if (!os.data_conclusao) return false;
      return os.data_conclusao.startsWith(mesFiltro.value);
    });
  }

  return resultado;
});

// --- FUNÇÃO AVANÇADA DE EXPORTAÇÃO PARA CSV (EXCEL) ---
async function exportarHistoricoCSV() {
  if (servicosFiltrados.value.length === 0) {
    return triggerToast(
      "Não há ordens de serviço para exportar com estes filtros.",
      "error",
    );
  }

  exportando.value = true;

  try {
    // 1. Criar o cabeçalho do arquivo (Adicionada a coluna Comentarios de Fechamento)
    let csvContent =
      "Numero O.S.;Cliente;Email;Telefone;Instrumento;Data Entrada;Data Conclusao;Duracao em Dias;Valor Bruto Total (R$);Valor Liquido Estimado (R$);Status;Descricao do Servico;Comentarios de Fechamento\n";

    const osIds = servicosFiltrados.value.map((os) => os.id);
    const { data: transacoes } = await supabase
      .from("transacoes")
      .select("servico_id, valor_bruto, descricao, tipo")
      .in("servico_id", osIds)
      .eq("tipo", "Entrada");

    // 3. Processar cada O.S. filtrada
    for (const os of servicosFiltrados.value) {
      const numOs = `#${os.numero_os}`;
      const cliente = os.instrumentos?.cliente?.nome || "--";
      const email = os.instrumentos?.cliente?.email || "--";
      const telefone = os.instrumentos?.cliente?.telefone || "--";
      const instrumento = os.instrumentos
        ? `${os.instrumentos.marca} ${os.instrumentos.modelo}`
        : "--";
      const status = os.status || "--";

      const descricao = os.descricao_cliente
        ? os.descricao_cliente.replace(/;/g, ",").replace(/\n/g, " ")
        : "--";

      // NOVA COLUNA: Limpa as quebras de linha das observações de fechamento
      const obsFechamento = os.obs_fechamento
        ? os.obs_fechamento.replace(/;/g, ",").replace(/\n/g, " ")
        : "--";

      let dataEntradaFormatada = "--";
      let dataConclusaoFormatada = "--";
      let duracaoDias = "--";

      if (os.data_entrada) {
        dataEntradaFormatada = new Date(
          os.data_entrada + (os.data_entrada.includes("T") ? "" : "T12:00:00"),
        ).toLocaleDateString("pt-BR");
      }

      if (os.data_conclusao) {
        dataConclusaoFormatada = new Date(
          os.data_conclusao +
            (os.data_conclusao.includes("T") ? "" : "T12:00:00"),
        ).toLocaleDateString("pt-BR");
      }

      if (os.data_entrada && os.data_conclusao) {
        const dEntrada = new Date(
          os.data_entrada + (os.data_entrada.includes("T") ? "" : "T12:00:00"),
        );
        const dConclusao = new Date(
          os.data_conclusao +
            (os.data_conclusao.includes("T") ? "" : "T12:00:00"),
        );
        const diffTime = Math.abs(dConclusao - dEntrada);
        duracaoDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      let valorBrutoTotal = 0;
      let valorLiquidoTotal = 0;

      if (transacoes && transacoes.length > 0) {
        const pagamentosDestaOS = transacoes.filter(
          (t) => t.servico_id === os.id,
        );

        pagamentosDestaOS.forEach((pgto) => {
          let vBruto = Number(pgto.valor_bruto) || 0;
          valorBrutoTotal += vBruto;

          let taxaPorcentagem = 0;
          const matchTaxa = pgto.descricao?.match(
            /Taxa da Maquininha:\s*([\d.]+)%/,
          );
          if (matchTaxa && matchTaxa[1]) {
            taxaPorcentagem = parseFloat(matchTaxa[1]);
          }

          let vLiquido = vBruto;
          if (taxaPorcentagem > 0) {
            vLiquido = vBruto - vBruto * (taxaPorcentagem / 100);
          }
          valorLiquidoTotal += vLiquido;
        });
      }

      const vBrutoStr = valorBrutoTotal.toFixed(2).replace(".", ",");
      const vLiquidoStr = valorLiquidoTotal.toFixed(2).replace(".", ",");

      // Monta a linha do CSV com a nova variável `obsFechamento` no final
      csvContent += `${numOs};${cliente};${email};${telefone};${instrumento};${dataEntradaFormatada};${dataConclusaoFormatada};${duracaoDias};${vBrutoStr};${vLiquidoStr};${status};${descricao};${obsFechamento}\n`;
    }

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    const nomeFicheiro = mesFiltro.value
      ? `Relatorio_Completo_OS_${mesFiltro.value}.csv`
      : `Relatorio_Completo_OS_Historico.csv`;
    link.setAttribute("download", nomeFicheiro);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast("Relatório analítico exportado com sucesso!", "success");
  } catch (error) {
    triggerToast("Erro ao gerar ficheiro Excel: " + error.message, "error");
  } finally {
    exportando.value = false;
  }
}

function formatarData(dataIso) {
  if (!dataIso) return "--";
  const dataSegura = dataIso.includes("T") ? dataIso : dataIso + "T12:00:00";
  return new Date(dataSegura).toLocaleDateString("pt-BR");
}

onMounted(() => carregarHistorico());
</script>

<template>
  <div class="card" style="text-align: left">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 10px;
      "
    >
      <div>
        <h2
          class="title-section"
          style="margin: 0; border: none; font-size: 1.5rem"
        >
          📦 Arquivo Morto / Histórico
        </h2>
        <p class="text-muted" style="margin: 5px 0 0 0; font-size: 0.9rem">
          Consulte as Ordens de Serviço antigas (Finalizadas / Entregues).
        </p>
      </div>

      <div style="display: flex; gap: 10px">
        <button
          class="btn-outline"
          style="border-color: #27ae60; color: #27ae60"
          @click="exportarHistoricoCSV"
          :disabled="exportando"
        >
          {{
            exportando
              ? "⏳ A calcular relatório..."
              : "📥 Relatório Excel Completo"
          }}
        </button>
      </div>
    </div>

    <div
      class="box"
      style="
        margin-bottom: 20px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      "
    >
      <div style="display: flex; gap: 15px; flex-wrap: wrap">
        <div style="flex: 2; min-width: 250px">
          <label>🔍 Procurar por Cliente, Instrumento ou Nº O.S:</label>
          <input v-model="termoBusca" placeholder="Ex: Fender, João, 1024..." />
        </div>
        <div style="flex: 1; min-width: 150px">
          <label>📅 Filtrar por Mês de Fechamento:</label>
          <input type="month" v-model="mesFiltro" />
        </div>
      </div>
    </div>

    <div
      v-if="carregando"
      class="text-muted"
      style="padding: 20px; text-align: center"
    >
      A escavar os arquivos... ⏳
    </div>

    <div v-else class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th>Data de Fecho</th>
            <th>O.S.</th>
            <th>Cliente / Contato</th>
            <th>Instrumento</th>
            <th style="text-align: center">Ação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="servicosFiltrados.length === 0">
            <td
              colspan="5"
              class="text-muted"
              style="text-align: center; padding: 30px"
            >
              Nenhum registo encontrado para os filtros atuais.
            </td>
          </tr>
          <tr v-for="os in servicosFiltrados" :key="os.id">
            <td style="font-weight: bold; color: var(--text-main)">
              {{ formatarData(os.data_conclusao) }}
              <br />
              <span
                style="font-size: 0.75rem; color: #16a34a; font-weight: normal"
                >{{ os.status }}</span
              >
            </td>
            <td style="color: var(--primary); font-weight: bold">
              #{{ os.numero_os }}
            </td>
            <td>
              <strong>{{ os.instrumentos?.cliente?.nome }}</strong
              ><br />
              <small class="text-muted"
                >📱 {{ os.instrumentos?.cliente?.telefone || "--" }}</small
              >
            </td>
            <td>
              <strong style="color: var(--accent)">{{
                os.instrumentos?.marca
              }}</strong
              ><br />
              <small>{{ os.instrumentos?.modelo }}</small>
            </td>
            <td align="center">
              <button class="btn-primary" @click="$emit('abrirOS', os)">
                👁️ Ver Registo
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* O design principal é herdado do App.vue. A tabela já está padronizada! */
</style>
