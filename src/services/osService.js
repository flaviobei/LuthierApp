/**
 * ============================================================================
 * @file        osService.js
 * @description Central de lógica para Ordens de Serviço (Versão Consolidada)
 * ============================================================================
 */
import { supabase } from "../lib/supabaseClient";

export const osService = {
  /** 1. Busca pendências detalhadas para o Dashboard */
  async buscarPendenciasDash() {
    const { data, error } = await supabase
      .from("servicos")
      .select(
        `
        *, 
        instrumentos ( marca, modelo, cliente:clientes (nome, telefone) ),
        diario_servico ( descricao, foto_url, data_registro )
      `,
      )
      .neq("status", "Entregue")
      .neq("status", "Finalizado")
      .order("data_previsao_entrega", { ascending: true });

    if (error) throw error;

    return data.map((os) => {
      if (!os.fase_projeto) os.fase_projeto = "Fila de Espera";
      if (os.diario_servico && os.diario_servico.length > 0) {
        const diarioOrdenado = [...os.diario_servico].sort(
          (a, b) => new Date(b.data_registro) - new Date(a.data_registro),
        );
        os.ultima_atualizacao = diarioOrdenado[0];
      } else {
        os.ultima_atualizacao = null;
      }
      return os;
    });
  },

  /** 2. Busca oportunidades de pós-venda (CRM) */
  async buscarOportunidadesPosVenda(limite = 5) {
    const dataCorte = new Date();
    dataCorte.setMonth(dataCorte.getMonth() - 6);
    const hoje = new Date().toISOString();

    const { data, error } = await supabase
      .from("servicos")
      .select(
        `*, instrumentos ( marca, modelo, cliente:clientes (nome, telefone) )`,
      )
      .in("status", ["Entregue", "Finalizado"])
      .eq("pos_venda_contatado", false)
      .lte("data_conclusao", dataCorte.toISOString())
      .or(`data_lembrete_pos_venda.is.null,data_lembrete_pos_venda.lte.${hoje}`)
      .order("data_conclusao", { ascending: true })
      .limit(limite);

    if (error) throw error;
    return data;
  },

  /** 3. Busca histórico para o Arquivo Morto */
  async buscarHistorico() {
    // 1. Puxa os serviços finalizados
    const { data: servicos, error: errServicos } = await supabase
      .from("servicos")
      .select(
        `*, instrumentos ( marca, modelo, cliente:clientes (id, nome, telefone, email) )`,
      )
      .in("status", ["Entregue", "Finalizado"]);

    if (errServicos) throw errServicos;
    if (!servicos || servicos.length === 0) return [];

    // Otimização: Pegar apenas as transações das OS que estão na tela, e não do banco inteiro
    const osIds = servicos.map((os) => os.id);

    const { data: transacoes, error: errTransacoes } = await supabase
      .from("transacoes")
      .select("servico_id, valor_bruto")
      .eq("tipo", "Entrada")
      .in("servico_id", osIds); // <-- Correção de Memory Leak

    if (errTransacoes) throw errTransacoes;

    return servicos.map((os) => {
      const pagamentosOS = transacoes.filter((t) => t.servico_id === os.id);
      const valorTotalOS = pagamentosOS.reduce(
        (acc, t) => acc + Number(t.valor_bruto),
        0,
      );
      return { ...os, _valor_calculado: valorTotalOS };
    });
  },

  /** 4. Busca O.S. para exibição no Calendário */
  async buscarParaCalendario() {
    const { data, error } = await supabase
      .from("servicos")
      .select(`*, instrumentos (marca, modelo, cliente:clientes (nome))`)
      .neq("status", "Entregue")
      .neq("status", "Finalizado")
      .not("data_previsao_entrega", "is", null);

    if (error) throw error;
    return data;
  },

  /** 5. Busca detalhes completos de uma O.S. específica (Scanner) */
  async buscarPorId(id) {
    const { data, error } = await supabase
      .from("servicos")
      .select("*, instrumentos(marca, modelo, clientes(nome, telefone))")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /** 6. Ações de Pós-Venda e Status */
  async marcarPosVendaContatado(osId) {
    const { error } = await supabase
      .from("servicos")
      .update({ pos_venda_contatado: true })
      .eq("id", osId);
    if (error) throw error;
  },

  async adiarPosVenda(osId, dias) {
    const diasNumerico = Number(dias) || 0; // Proteção contra datas NaN (Strings injetadas da UI)
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + diasNumerico);
    const { error } = await supabase
      .from("servicos")
      .update({ data_lembrete_pos_venda: novaData.toISOString() })
      .eq("id", osId);
    if (error) throw error;
  },

  async salvarObservacoes(id, campo, valor) {
    // Whitelist: Proteção contra injeção mass-assignment via JS
    const camposPermitidos = [
      "observacoes_internas",
      "observacoes_cliente",
      "checklist_saida_notas",
      "problema_relatado",
    ];

    if (!camposPermitidos.includes(campo)) {
      throw new Error("Atualização de campo não autorizada por segurança.");
    }

    const { error } = await supabase
      .from("servicos")
      .update({ [campo]: valor })
      .eq("id", id);
    if (error) throw error;
  },
};
