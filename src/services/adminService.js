import { supabase } from "../lib/supabaseClient";
export const adminService = {
  async verificarSuperAdmin(email) {
    if (!email) return false;
    const { data } = await supabase
      .from("super_admins")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    return !!data;
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

    // Força o payload a ter o ID do usuário corrente por segurança
    const dadosParaSalvar = {
      ...payload,
      user_id: user.data.user.id,
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
