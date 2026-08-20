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

  /** 2.5 Busca faturamento parado (Instrumentos prontos e não pagos) */
  async buscarFaturamentoParado() {
    const { data, error } = await supabase
      .from("servicos")
      .select(`
        id, numero_os, fase_projeto, status, data_conclusao,
        instrumentos ( marca, modelo, cliente:clientes (nome) ),
        orcamento_itens ( valor ),
        transacoes ( valor_bruto, tipo ),
        diario_servico ( fase_projeto, data_registro )
      `)
      .eq("fase_projeto", "Pronto para Entrega")
      .neq("status", "Entregue"); // exclui os já entregues

    if (error) throw error;

    const servicosPendentes = [];
    
    for (const os of data) {
      let dataPronto = os.data_conclusao;
      
      if (os.diario_servico && os.diario_servico.length > 0) {
        const entry = os.diario_servico
          .filter(d => d.fase_projeto === "Pronto para Entrega")
          .sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro))[0];
        
        if (entry) {
          dataPronto = entry.data_registro;
        }
      }

      const totalOrcamento = os.orcamento_itens?.reduce((acc, item) => acc + (Number(item.valor) || 0), 0) || 0;
      const totalPago = os.transacoes?.filter(t => t.tipo === "Entrada").reduce((acc, t) => acc + (Number(t.valor_bruto) || 0), 0) || 0;
      const saldoDevedor = Math.max(0, totalOrcamento - totalPago);
      
      if (saldoDevedor > 0) {
        servicosPendentes.push({
          ...os,
          data_conclusao: dataPronto,
          saldoDevedor,
          totalOrcamento,
          totalPago
        });
      }
    }

    return servicosPendentes;
  },

  /** 2.6 Busca recebíveis na bancada (Serviços em andamento) */
  async buscarRecebiveisBancada() {
    const { data, error } = await supabase
      .from("servicos")
      .select(`
        id, status, fase_projeto,
        orcamento_itens ( valor ),
        transacoes ( valor_bruto, tipo )
      `)
      .neq("status", "Entregue")
      .neq("status", "Finalizado"); // Serviços em andamento

    if (error) throw error;

    let totalRecebivel = 0;
    let quantidade = 0;
    
    for (const os of data) {
      const totalOrcamento = os.orcamento_itens?.reduce((acc, item) => acc + (Number(item.valor) || 0), 0) || 0;
      const totalPago = os.transacoes?.filter(t => t.tipo === "Entrada").reduce((acc, t) => acc + (Number(t.valor_bruto) || 0), 0) || 0;
      const saldoDevedor = Math.max(0, totalOrcamento - totalPago);
      
      if (saldoDevedor > 0) {
        totalRecebivel += saldoDevedor;
        quantidade++;
      }
    }

    return { totalRecebivel, quantidade };
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
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("servicos")
      .select("*, instrumentos(marca, modelo, clientes(nome, telefone))")
      .eq("id", id)
      .eq("user_id", user.data.user.id)
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

  /** * 7. Gera uma O.S. de Retrabalho/Garantia baseada numa O.S. finalizada
   */
  async gerarRetrabalho(osOriginalId, motivo) {
    // Busca os dados da O.S. antiga
    const osOriginal = await this.buscarPorId(osOriginalId);
    if (!osOriginal) throw new Error("O.S. original não encontrada.");

    // Monta o "esqueleto" da nova O.S. de Retrabalho usando OS NOMES CORRETOS do seu BD
    const novaOS = {
      instrumento_id: osOriginal.instrumento_id,
      // Como a sua tabela não tem "titulo", usamos a descricao_cliente para o aviso
      descricao_cliente: `🚨 [RETRABALHO] Garantia O.S. #${osOriginal.numero_os}.\n\nMotivo relatado pelo cliente: ${motivo}\n\n--- Histórico Original ---\n${osOriginal.descricao_cliente || "Sem descrição original"}`,
      status: "Aberto", // Volta para Aberto para você fazer o checklist de entrada
      fase_projeto: "Fila de Espera",
      tipo_os: "Retrabalho",
      os_origem_id: osOriginal.id,
      motivo_retorno: motivo,
      // Se tiver outros campos que deseja copiar (ex: relatorio_tecnico), insira-os aqui, mas vazios.
    };

    // Salva no banco de dados
    const { data, error } = await supabase
      .from("servicos")
      .insert([novaOS])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
