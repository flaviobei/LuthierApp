import { supabase } from "../lib/supabaseClient";
export const adminService = {
  async verificarSuperAdmin(email) {
    if (!email) return false;
    try {
      const { data, error } = await supabase.functions.invoke("verificar-super-admin");
      if (error) throw error;
      return !!data?.isSuperAdmin;
    } catch (err) {
      console.error("Erro na Edge Function:", err);
      return false;
    }
  },
  async buscarAssinatura() {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return null;

    const { data } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("user_id", user.data.user.id)
      .maybeSingle();
    return data;
  },
  async buscarConfiguracoes() {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return null;

    const { data } = await supabase
      .from("configuracoes")
      .select("*")
      .eq("user_id", user.data.user.id)
      .maybeSingle();
    return data;
  },
  async salvarConfiguracoes(configId, payload) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("Usuário não autenticado");

    // Whitelist estrita para configurações
    const dadosParaSalvar = {
      nome_luthieria: payload.nome_luthieria,
      documento: payload.documento,
      telefone: payload.telefone,
      endereco: payload.endereco,
      termos_garantia: payload.termos_garantia,
      logo_url: payload.logo_url,
      estilo_icones: payload.estilo_icones,
      tipo_impressora: payload.tipo_impressora,
      cor_primaria: payload.cor_primaria,
      cor_secundaria: payload.cor_secundaria,
      cor_fundo: payload.cor_fundo,
      text_color: payload.text_color,
      btn_primary_bg: payload.btn_primary_bg,
      btn_primary_text: payload.btn_primary_text,
      btn_accent_bg: payload.btn_accent_bg,
      btn_accent_text: payload.btn_accent_text,
      fonte_principal: payload.fonte_principal,
      radius_perc: Number(payload.radius_perc) || 0,
      taxa_pix: Number(payload.taxa_pix) || 0,
      taxa_dinheiro: Number(payload.taxa_dinheiro) || 0,
      taxa_credito: Number(payload.taxa_credito) || 0,
      taxa_debito: Number(payload.taxa_debito) || 0,
      user_id: user.data.user.id, // Forçado pelo sistema
    };

    if (configId) {
      const { data, error } = await supabase
        .from("configuracoes")
        .update(dadosParaSalvar)
        .eq("id", configId)
        .eq("user_id", user.data.user.id) // Double-check do RLS no Client
        .select();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("configuracoes")
        .insert([dadosParaSalvar])
        .select();
      if (error) throw error;
      return data;
    }
  },
};
