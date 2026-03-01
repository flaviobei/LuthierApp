<script setup>
/**
 * ============================================================================
 * @file        HistoricoServicos.vue
 * @description Módulo de arquivo morto e relatórios. Exibe todas as Ordens
 * de Serviço que já foram finalizadas ou entregues ao cliente.
 * ATUALIZAÇÃO: Ordenação em colunas, Média de Ticket, Valor da O.S. e Ícones.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted, computed } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const emit = defineEmits(["voltar", "abrirOS"]);
const { triggerToast } = useToast();

const servicosEntregues = ref([]);
const transacoesConcluidas = ref([]); // Para guardar os valores reais
const carregando = ref(true);
const exportando = ref(false);

// FILTROS & ORDENAÇÃO
const termoBusca = ref("");
const mesFiltro = ref("");
const ordenacao = ref({ coluna: "data_conclusao", direcao: "desc" }); // Padrão: Mais recentes primeiro

async function carregarHistorico() {
  carregando.value = true;

  // 1. Busca as O.S. Concluídas
  const { data: servicosData, error: errServicos } = await supabase
    .from("servicos")
    .select(
      `
      *, 
      instrumentos ( 
        marca, 
        modelo, 
        cliente:clientes (id, nome, telefone, email) 
      )
    `,
    )
    .in("status", ["Entregue", "Finalizado"]);

  if (errServicos) {
    triggerToast("Erro ao carregar histórico", "error");
    carregando.value = false;
    return;
  }

  // 2. Busca TODAS as transações de entrada para cruzar os valores reais pagos
  const { data: transacoesData, error: errTransacoes } = await supabase
    .from("transacoes")
    .select("servico_id, valor_bruto, tipo")
    .eq("tipo", "Entrada");

  if (!errTransacoes && transacoesData) {
    transacoesConcluidas.value = transacoesData;
  }

  if (servicosData) {
    servicosEntregues.value = servicosData.map((os) => {
      // Calcula o valor total desta O.S. específica
      const pagamentosOS = transacoesConcluidas.value.filter(
        (t) => t.servico_id === os.id,
      );
      const valorTotalOS = pagamentosOS.reduce(
        (acc, t) => acc + Number(t.valor_bruto),
        0,
      );

      // Anexa o valor calculado diretamente no objeto para facilitar a listagem e ordenação
      return {
        ...os,
        _valor_calculado: valorTotalOS,
      };
    });
  }

  carregando.value = false;
}

// CÁLCULO DA MÉDIA DE TICKET POR CLIENTE
function getMediaTicketCliente(clienteId) {
  if (!clienteId) return 0;

  // Encontra todas as O.S. deste cliente
  const osDoCliente = servicosEntregues.value.filter(
    (os) => os.instrumentos?.cliente?.id === clienteId,
  );
  if (osDoCliente.length === 0) return 0;

  // Soma o valor total de todas as O.S. do cliente
  const valorTotalGasto = osDoCliente.reduce(
    (acc, os) => acc + os._valor_calculado,
    0,
  );

  return valorTotalGasto / osDoCliente.length;
}

// LÓGICA DE ORDENAÇÃO E FILTRAGEM COMBINADAS
const servicosFiltrados = computed(() => {
  let resultado = [...servicosEntregues.value]; // Cria uma cópia para não mutar o original

  // 1. Aplicar Filtro de Busca por Texto
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

  // 2. Aplicar Filtro de Mês
  if (mesFiltro.value) {
    resultado = resultado.filter((os) => {
      if (!os.data_conclusao) return false;
      return os.data_conclusao.startsWith(mesFiltro.value);
    });
  }

  // 3. Aplicar Ordenação
  resultado.sort((a, b) => {
    const col = ordenacao.value.coluna;
    const dir = ordenacao.value.direcao === "asc" ? 1 : -1;
    let valA, valB;

    switch (col) {
      case "data_conclusao":
        valA = new Date(a.data_conclusao || 0).getTime();
        valB = new Date(b.data_conclusao || 0).getTime();
        break;
      case "numero_os":
        valA = Number(a.numero_os);
        valB = Number(b.numero_os);
        break;
      case "cliente":
        valA = (a.instrumentos?.cliente?.nome || "").toLowerCase();
        valB = (b.instrumentos?.cliente?.nome || "").toLowerCase();
        break;
      case "instrumento":
        valA = (a.instrumentos?.marca || "").toLowerCase();
        valB = (b.instrumentos?.marca || "").toLowerCase();
        break;
      case "valor_os":
        valA = a._valor_calculado;
        valB = b._valor_calculado;
        break;
      case "media_ticket":
        valA = getMediaTicketCliente(a.instrumentos?.cliente?.id);
        valB = getMediaTicketCliente(b.instrumentos?.cliente?.id);
        break;
      default:
        valA = 0;
        valB = 0;
    }

    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  return resultado;
});

function alterarOrdenacao(coluna) {
  if (ordenacao.value.coluna === coluna) {
    // Inverte a direção se clicar na mesma coluna
    ordenacao.value.direcao =
      ordenacao.value.direcao === "asc" ? "desc" : "asc";
  } else {
    // Nova coluna, padrão é crescente (asc)
    ordenacao.value.coluna = coluna;
    ordenacao.value.direcao = "asc";
  }
}

function getIconeOrdenacao(coluna) {
  if (ordenacao.value.coluna !== coluna) return "unfold_more";
  return ordenacao.value.direcao === "asc" ? "expand_less" : "expand_more";
}

async function exportarHistoricoCSV() {
  if (servicosFiltrados.value.length === 0) {
    return triggerToast(
      "Não há ordens de serviço para exportar com estes filtros.",
      "error",
    );
  }

  exportando.value = true;

  try {
    let csvContent =
      "Numero O.S.;Cliente;Email;Telefone;Instrumento;Data Entrada;Data Conclusao;Duracao em Dias;Valor Bruto Total (R$);Valor Liquido Estimado (R$);Media Ticket Cliente (R$);Status;Descricao do Servico;Comentarios de Fechamento\n";

    const osIds = servicosFiltrados.value.map((os) => os.id);
    const { data: transacoes } = await supabase
      .from("transacoes")
      .select("servico_id, valor_bruto, descricao, tipo")
      .in("servico_id", osIds)
      .eq("tipo", "Entrada");

    for (const os of servicosFiltrados.value) {
      const numOs = `#${os.numero_os}`;
      const clienteNome = os.instrumentos?.cliente?.nome || "--";
      const email = os.instrumentos?.cliente?.email || "--";
      const telefone = os.instrumentos?.cliente?.telefone || "--";
      const instrumento = os.instrumentos
        ? `${os.instrumentos.marca} ${os.instrumentos.modelo}`
        : "--";
      const status = os.status || "--";
      const descricao = os.descricao_cliente
        ? os.descricao_cliente.replace(/;/g, ",").replace(/\n/g, " ")
        : "--";
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

      // NOVA MÉTRICA DE EXPORTAÇÃO
      const mediaTicketStr = getMediaTicketCliente(os.instrumentos?.cliente?.id)
        .toFixed(2)
        .replace(".", ",");

      csvContent += `${numOs};${clienteNome};${email};${telefone};${instrumento};${dataEntradaFormatada};${dataConclusaoFormatada};${duracaoDias};${vBrutoStr};${vLiquidoStr};${mediaTicketStr};${status};${descricao};${obsFechamento}\n`;
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
          style="
            margin: 0;
            border: none;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">inventory_2</span> Arquivo Morto /
          Histórico
        </h2>
        <p class="text-muted" style="margin: 5px 0 0 0; font-size: 0.9rem">
          Consulte as Ordens de Serviço antigas (Finalizadas / Entregues).
        </p>
      </div>

      <div style="display: flex; gap: 10px">
        <button
          class="btn-outline"
          style="
            border-color: #27ae60;
            color: #27ae60;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          "
          @click="exportarHistoricoCSV"
          :disabled="exportando"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">
            {{ exportando ? "hourglass_empty" : "download" }}
          </span>
          {{
            exportando ? "A calcular relatório..." : "Relatório Excel Completo"
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
          <label style="display: flex; align-items: center; gap: 4px">
            <span class="icon-dinamico" style="font-size: 1.1rem">search</span>
            Procurar por Cliente, Instrumento ou Nº O.S:
          </label>
          <input v-model="termoBusca" placeholder="Ex: Fender, João, 1024..." />
        </div>
        <div style="flex: 1; min-width: 150px">
          <label style="display: flex; align-items: center; gap: 4px">
            <span class="icon-dinamico" style="font-size: 1.1rem"
              >calendar_month</span
            >
            Filtrar por Mês de Fechamento:
          </label>
          <input type="month" v-model="mesFiltro" />
        </div>
      </div>
    </div>

    <div
      v-if="carregando"
      class="text-muted"
      style="
        padding: 40px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      "
    >
      <span
        class="icon-dinamico"
        style="font-size: 2.5rem; animation: spin 1s linear infinite"
        >sync</span
      >
      A escavar os arquivos...
    </div>

    <div v-else class="tabela-responsiva">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th class="th-sortable" @click="alterarOrdenacao('data_conclusao')">
              Entrega
              <span class="icon-dinamico">{{
                getIconeOrdenacao("data_conclusao")
              }}</span>
            </th>
            <th class="th-sortable" @click="alterarOrdenacao('numero_os')">
              O.S.
              <span class="icon-dinamico">{{
                getIconeOrdenacao("numero_os")
              }}</span>
            </th>
            <th class="th-sortable" @click="alterarOrdenacao('cliente')">
              Cliente
              <span class="icon-dinamico">{{
                getIconeOrdenacao("cliente")
              }}</span>
            </th>
            <th class="th-sortable" @click="alterarOrdenacao('instrumento')">
              Instrumento
              <span class="icon-dinamico">{{
                getIconeOrdenacao("instrumento")
              }}</span>
            </th>

            <th
              class="th-sortable text-right"
              @click="alterarOrdenacao('media_ticket')"
            >
              Média
              <span class="icon-dinamico">{{
                getIconeOrdenacao("media_ticket")
              }}</span>
            </th>
            <th
              class="th-sortable text-right"
              @click="alterarOrdenacao('valor_os')"
            >
              Valor OS
              <span class="icon-dinamico">{{
                getIconeOrdenacao("valor_os")
              }}</span>
            </th>

            <th style="text-align: center">Ação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="servicosFiltrados.length === 0">
            <td
              colspan="7"
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
                style="
                  font-size: 0.75rem;
                  color: #16a34a;
                  font-weight: normal;
                  display: inline-flex;
                  align-items: center;
                  gap: 2px;
                "
              >
                <span class="icon-dinamico" style="font-size: 0.9rem"
                  >check_circle</span
                >
                {{ os.status }}
              </span>
            </td>
            <td style="color: var(--primary); font-weight: bold">
              #{{ os.numero_os }}
            </td>
            <td>
              <strong>{{ os.instrumentos?.cliente?.nome }}</strong
              ><br />
              <small
                class="text-muted"
                style="display: inline-flex; align-items: center; gap: 4px"
              >
                <span class="icon-dinamico" style="font-size: 0.9rem"
                  >smartphone</span
                >
                {{ os.instrumentos?.cliente?.telefone || "--" }}
              </small>
            </td>
            <td>
              <strong style="color: var(--accent)">{{
                os.instrumentos?.marca
              }}</strong
              ><br />
              <small>{{ os.instrumentos?.modelo }}</small>
            </td>

            <td align="right" class="text-muted">
              R$
              {{
                getMediaTicketCliente(os.instrumentos?.cliente?.id).toFixed(2)
              }}
            </td>
            <td align="right" style="font-weight: bold; color: var(--success)">
              R$ {{ os._valor_calculado.toFixed(2) }}
            </td>

            <td align="center">
              <button
                class="btn-primary"
                @click="$emit('abrirOS', os)"
                style="
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  font-size: 0.85rem;
                  padding: 6px 12px;
                "
              >
                <span class="icon-dinamico" style="font-size: 1.1rem"
                  >visibility</span
                >
                Ver Registo
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

/* Regras para as setinhas de ordenação da tabela */
.th-sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}
.th-sortable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
.th-sortable .icon-dinamico {
  font-size: 1.1rem;
  vertical-align: middle;
  color: var(--text-muted);
  opacity: 0.5;
}
.th-sortable:hover .icon-dinamico {
  opacity: 1;
}
.text-right {
  text-align: right;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
