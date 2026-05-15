/**
 * ============================================================================
 * @file        exportUtils.js
 * @description Módulo responsável pela geração e download de relatórios
 * ============================================================================
 */
import { supabase } from "./supabaseClient";

export async function gerarRelatorioHistoricoCSV(
  servicosFiltrados,
  servicosEntregues,
  mesFiltro,
) {
  if (!servicosFiltrados || servicosFiltrados.length === 0) {
    throw new Error("Não há ordens de serviço para exportar.");
  }

  let csvContent =
    "Numero O.S.;Cliente;Email;Telefone;Instrumento;Data Entrada;Data Conclusao;Duracao em Dias;Valor Bruto Total (R$);Valor Liquido Estimado (R$);Media Ticket Cliente (R$);Status;Descricao do Servico;Comentarios de Fechamento\n";

  // Busca transações apenas das O.S. filtradas para o cálculo de liquidez
  const osIds = servicosFiltrados.map((os) => os.id);
  const { data: transacoes, error: errTransacoes } = await supabase
    .from("transacoes")
    .select("servico_id, valor_bruto, descricao, tipo")
    .in("servico_id", osIds)
    .eq("tipo", "Entrada");

  if (errTransacoes) throw errTransacoes;

  // Função auxiliar para calcular o ticket do cliente no momento da exportação
  function getMediaTicket(clienteId) {
    if (!clienteId) return 0;
    const osDoCliente = servicosEntregues.filter(
      (os) => os.instrumentos?.cliente?.id === clienteId,
    );
    if (osDoCliente.length === 0) return 0;
    const valorTotalGasto = osDoCliente.reduce(
      (acc, os) => acc + (os._valor_calculado || 0),
      0,
    );
    return valorTotalGasto / osDoCliente.length;
  }

  for (const os of servicosFiltrados) {
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
    const mediaTicketStr = getMediaTicket(os.instrumentos?.cliente?.id)
      .toFixed(2)
      .replace(".", ",");

    csvContent += `${numOs};${clienteNome};${email};${telefone};${instrumento};${dataEntradaFormatada};${dataConclusaoFormatada};${duracaoDias};${vBrutoStr};${vLiquidoStr};${mediaTicketStr};${status};${descricao};${obsFechamento}\n`;
  }

  // Gera e faz o download do ficheiro
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const nomeFicheiro = mesFiltro
    ? `Relatorio_OS_${mesFiltro}.csv`
    : `Relatorio_Historico_OS.csv`;
  link.setAttribute("download", nomeFicheiro);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
