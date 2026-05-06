import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// O Cors Headers é essencial para o Frontend do Vue conseguir chamar a função
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Lida com o Preflight do CORS (Browser checando se a rota existe)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Criamos um cliente Supabase injetando o Token do utilizador que chamou a função
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Extraímos com segurança o ID e o Email reais de quem está logado
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ isSuperAdmin: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 3. Criamos um cliente de "Admin" para ler a tabela restrita ignorando o RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Verificamos se o email do usuário logado consta na tabela de Super Admins
    const { data: adminData, error } = await supabaseAdmin
      .from('super_admins')
      .select('email')
      .eq('email', user.email)
      .maybeSingle()

    // Responde `true` se achou o dado ou `false` se for nulo
    const isSuperAdmin = !!adminData && !error

    return new Response(JSON.stringify({ isSuperAdmin }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
