import { supabase } from "../lib/supabaseClient";

export const authService = {
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
