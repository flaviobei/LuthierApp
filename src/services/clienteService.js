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
      .order("nome", { ascending: true })
      .limit(1000);

    if (error) throw error;
    return data;
  },

  /**
   * Busca um cliente específico com os seus instrumentos vinculados
   */
  async buscarDetalhes(id) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("clientes")
      .select("*, instrumentos(*)")
      .eq("id", id)
      .eq("user_id", user.data.user.id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Função interna de validação de input (Whitelist e Sanitização)
   */
  validarPayload(dados) {
    if (!dados || typeof dados !== 'object') throw new Error("Payload inválido.");
    
    const payloadSeguro = {};
    
    if (dados.nome !== undefined) {
      if (typeof dados.nome !== 'string' || dados.nome.trim().length === 0) {
        throw new Error("O nome do cliente é obrigatório.");
      }
      if (dados.nome.length > 100) throw new Error("O nome excede o limite de 100 caracteres.");
      payloadSeguro.nome = dados.nome.trim();
    }
    
    if (dados.telefone !== undefined) {
      if (dados.telefone && dados.telefone.length > 20) throw new Error("Telefone excede limite de caracteres.");
      payloadSeguro.telefone = dados.telefone ? dados.telefone.trim() : null;
    }

    if (dados.email !== undefined) {
      if (dados.email && !/^[\w.-]+@([\w-]+\.)+[\w-]{2,}$/.test(dados.email)) {
        throw new Error("Formato de e-mail inválido.");
      }
      payloadSeguro.email = dados.email ? dados.email.trim() : null;
    }
    
    if (dados.endereco !== undefined) {
      payloadSeguro.endereco = dados.endereco ? String(dados.endereco).substring(0, 200).trim() : null;
    }
    
    if (dados.cpf_cnpj !== undefined) {
      payloadSeguro.cpf_cnpj = dados.cpf_cnpj ? String(dados.cpf_cnpj).substring(0, 20).trim() : null;
    }

    return payloadSeguro;
  },

  /**
   * Cria um novo cliente
   */
  async criar(dadosCliente) {
    const payload = this.validarPayload(dadosCliente);
    if (!payload.nome) throw new Error("O nome do cliente é obrigatório para criação.");

    const { data, error } = await supabase
      .from("clientes")
      .insert([payload])
      .select();

    if (error) throw error;
    return data[0];
  },

  /**
   * Atualiza dados de um cliente existente
   */
  async atualizar(id, novosDados) {
    if (!id) throw new Error("ID do cliente ausente.");
    const payload = this.validarPayload(novosDados);
    
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("clientes")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.data.user.id)
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
