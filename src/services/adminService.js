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
    const { data } = await supabase
      .from("assinaturas")
      .select("*")
      .maybeSingle();
    return data;
  },
  async buscarConfiguracoes() {
    const { data } = await supabase
      .from("configuracoes")
      .select("*")
      .maybeSingle();
    return data;
  },
};
