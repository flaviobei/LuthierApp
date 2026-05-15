/**
 * ============================================================================
 * @file        catalogoService.js
 * @description Centraliza a gestão de preços, peças e insumos.
 * ATUALIZAÇÃO: Motor de baixa automática de estoque.
 * ============================================================================
 */
import { supabase } from "../lib/supabaseClient";

const locksDeEstoque = new Set();

export const catalogoService = {
  async buscarTodos() {
    const { data, error } = await supabase
      .from("catalogo")
      .select("*")
      .order("nome", { ascending: true })
      .limit(1000);
    if (error) throw error;
    return data;
  },

  async buscarItensVenda() {
    const { data, error } = await supabase
      .from("catalogo")
      .select("*")
      .neq("tipo", "Insumo")
      .order("nome", { ascending: true })
      .limit(1000);
    if (error) throw error;
    return data;
  },

  async salvar(item) {
    const isUpdate = !!item.id;
    let query = supabase.from("catalogo");

    // Whitelist: Proteção contra mass-assignment de campos não autorizados
    const payload = {
      nome: item.nome,
      tipo: item.tipo,
      custo_padrao: item.custo_padrao,
      preco_padrao: item.preco_padrao,
      controla_estoque: item.controla_estoque,
      quantidade_estoque: item.quantidade_estoque,
      estoque_minimo: item.estoque_minimo,
      insumos_consumidos: item.insumos_consumidos,
    };

    if (isUpdate) {
      const { data, error } = await query
        .update(payload)
        .eq("id", item.id)
        .select();
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await query.insert([payload]).select();
      if (error) throw error;
      return data[0];
    }
  },

  async excluir(id) {
    const { error } = await supabase.from("catalogo").delete().eq("id", id);
    if (error) throw error;
  },

  // ==========================================================================
  // MOTOR DE ESTOQUE INTELIGENTE
  // ==========================================================================
  async abaterEstoqueOS(servicoId) {
    // Trava imediata em memória contra duplo-clique (Race Condition)
    if (locksDeEstoque.has(servicoId)) return;
    locksDeEstoque.add(servicoId);

    try {
      // 1. Verifica a trava de segurança (Se já foi descontado, aborta)
      const { data: os } = await supabase
        .from("servicos")
        .select("estoque_abatido")
        .eq("id", servicoId)
        .single();
      if (os?.estoque_abatido) return;

      // 2. Busca os itens do orçamento que estão linkados ao catálogo
      const { data: itens } = await supabase
        .from("orcamento_itens")
        .select("catalogo_id")
        .eq("servico_id", servicoId)
        .not("catalogo_id", "is", null);

      if (!itens || itens.length === 0) {
        // Se não tem peças de catálogo, só marca como abatido e encerra
        await supabase
          .from("servicos")
          .update({ estoque_abatido: true })
          .eq("id", servicoId);
        return;
      }

      // 3. Puxa as regras do catálogo
      const catalogoIds = itens.map(i => i.catalogo_id).filter(Boolean);
      const { data: catalogo } = await supabase
        .from("catalogo")
        .select("*")
        .in("id", catalogoIds);
      const deducoes = {}; // Armazena o que precisamos descontar { id_do_item: quantidade }

      itens.forEach((itemOS) => {
        const catItem = catalogo.find((c) => c.id === itemOS.catalogo_id);
        if (!catItem) return;

        // Se for Peça com controlo de estoque (1 unidade por cada vez que aparece no orçamento)
        if (catItem.tipo === "Peca" && catItem.controla_estoque) {
          deducoes[catItem.id] = (deducoes[catItem.id] || 0) + 1;
        }

        // Se for Serviço, vai descontar os insumos "invisíveis" baseados na Receita configurada
        if (
          catItem.tipo === "MaoDeObra" &&
          catItem.insumos_consumidos?.length > 0
        ) {
          catItem.insumos_consumidos.forEach((ins) => {
            deducoes[ins.insumo_id] =
              (deducoes[ins.insumo_id] || 0) + Number(ins.quantidade);
          });
        }
      });

      // 4. Executa a baixa real no banco de dados de forma atômica via RPC
      await Promise.all(
        Object.entries(deducoes).map(([catId, qtdAbater]) => {
          const itemRef = catalogo.find((c) => c.id === catId);
          if (itemRef && itemRef.quantidade_estoque !== null) {
            return supabase.rpc('abater_estoque', {
              p_item_id: catId,
              p_quantidade: qtdAbater
            });
          }
          return Promise.resolve();
        })
      );

      // 5. Aciona a trava de segurança da O.S.
      await supabase
        .from("servicos")
        .update({ estoque_abatido: true })
        .eq("id", servicoId);
    } finally {
      // Libera a trava independente de sucesso ou erro
      locksDeEstoque.delete(servicoId);
    }
  },
};
