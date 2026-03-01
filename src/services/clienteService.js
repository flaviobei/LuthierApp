/**
 * ============================================================================
 * @file        clienteService.js
 * @description Centraliza a gestão de clientes da Luthieria.
 * ============================================================================
 */
import { supabase } from "../lib/supabaseClient";

export const clienteService = {
  /**
   * Busca todos os clientes ordenados por nome
   */
  async buscarTodos() {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("nome", { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Busca um cliente específico com os seus instrumentos vinculados
   */
  async buscarDetalhes(id) {
    const { data, error } = await supabase
      .from("clientes")
      .select("*, instrumentos(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cria um novo cliente
   */
  async criar(dadosCliente) {
    const { data, error } = await supabase
      .from("clientes")
      .insert([dadosCliente])
      .select();

    if (error) throw error;
    return data[0];
  },

  /**
   * Atualiza dados de um cliente existente
   */
  async atualizar(id, novosDados) {
    const { data, error } = await supabase
      .from("clientes")
      .update(novosDados)
      .eq("id", id)
      .select();

    if (error) throw error;
    return data[0];
  },

  /**
   * Pesquisa rápida (autocomplete) para criação de O.S.
   */
  async pesquisar(termo) {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome, telefone")
      .ilike("nome", `%${termo}%`)
      .limit(10);

    if (error) throw error;
    return data;
  },
};
