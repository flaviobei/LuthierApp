/**
 * ============================================================================
 * @file        catalogoService.js
 * @description Centraliza a gestão de preços, peças e insumos.
 * ============================================================================
 */
import { supabase } from "../lib/supabaseClient";

export const catalogoService = {
  /**
   * Busca todos os itens do catálogo
   */
  async buscarTodos() {
    const { data, error } = await supabase
      .from("catalogo")
      .select("*")
      .order("nome", { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Busca apenas itens que podem ser vendidos (Mão de Obra e Peças)
   * Útil para os dropdowns de Orçamento.
   */
  async buscarItensVenda() {
    const { data, error } = await supabase
      .from("catalogo")
      .select("*")
      .neq("tipo", "Insumo")
      .order("nome", { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Salva um item (Criação ou Atualização)
   */
  async salvar(item) {
    const isUpdate = !!item.id;
    let query = supabase.from("catalogo");

    if (isUpdate) {
      const { data, error } = await query
        .update(item)
        .eq("id", item.id)
        .select();
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await query.insert([item]).select();
      if (error) throw error;
      return data[0];
    }
  },

  /**
   * Remove um item do catálogo
   */
  async excluir(id) {
    const { error } = await supabase.from("catalogo").delete().eq("id", id);
    if (error) throw error;
  },
};
