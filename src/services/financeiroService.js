/**
 * ============================================================================
 * @file        financeiroService.js
 * @description Centraliza a lógica de transações, caixa e KPIs financeiros.
 * ============================================================================
 */
import { supabase } from "../lib/supabaseClient";

export const financeiroService = {
  /**
   * Busca todas as transações de um mês específico
   */
  async buscarTransacoes(mesFiltro, dataInicio = null, dataFim = null) {
    let query = supabase
      .from("transacoes")
      .select(`*, servicos ( instrumentos ( cliente:clientes (nome), marca ) )`) // Traz as relações para não dar erro na tabela
      .order("data_pagamento", { ascending: false });

    // Se vieram as datas exatas (do filtro avançado na tela)
    if (dataInicio && dataFim) {
      query = query
        .gte("data_pagamento", dataInicio)
        .lte("data_pagamento", dataFim + "T23:59:59.999Z");
    } else if (mesFiltro) {
      // Fallback: se não vier início/fim, usa o mês base (comportamento antigo)
      const [ano, mes] = mesFiltro.split("-");
      const ultimoDia = new Date(ano, mes, 0).getDate();

      const inicioMes = `${mesFiltro}-01`;
      const fimMes = `${mesFiltro}-${String(ultimoDia).padStart(2, "0")}`;

      query = query
        .gte("data_pagamento", inicioMes)
        .lte("data_pagamento", fimMes + "T23:59:59.999Z");
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  /**
   * Calcula os indicadores (KPIs) financeiros do mês
   */
  async calcularResumoMensal(transacoes) {
    const resumo = {
      receitaBruta: 0,
      receitaLiquida: 0,
      despesas: 0,
      lucroReal: 0,
      totalTaxas: 0,
    };

    transacoes.forEach((t) => {
      const valorBruto = Number(t.valor_bruto) || 0;
      const taxa = Number(t.taxa_taxa) || 0;

      if (t.tipo === "Entrada") {
        resumo.receitaBruta += valorBruto;
        resumo.receitaLiquida += valorBruto - taxa;
        resumo.totalTaxas += taxa;
      } else {
        resumo.despesas += valorBruto;
      }
    });

    resumo.lucroReal = resumo.receitaLiquida - resumo.despesas;
    return resumo;
  },

  /**
   * Insere uma nova transação manual (ex: compra de ferramentas, aluguer)
   */
  async salvarGasto(dados) {
    const { data, error } = await supabase
      .from("transacoes")
      .insert([
        {
          ...dados,
          tipo: "Saída",
          categoria: dados.categoria || "Geral",
        },
      ])
      .select();

    if (error) throw error;
    return data[0];
  },

  /**
   * Remove uma transação (Estorno/Exclusão)
   */
  async excluirTransacao(id) {
    const { error } = await supabase.from("transacoes").delete().eq("id", id);
    if (error) throw error;
  },
};
