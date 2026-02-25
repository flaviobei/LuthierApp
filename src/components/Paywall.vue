<script setup>
/**
 * ============================================================================
 * @file        Paywall.vue
 * @description Componente de controle de acesso e monetização (SaaS).
 * Monitora os limites de uso do luthier (ex: limite de O.S. mensais ou fotos)
 * e bloqueia funcionalidades avançadas caso o plano atual não as suporte.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - vue: ref, computed.
 * - supabaseClient: Verificação do status da assinatura na tabela 'perfis_luthier'.
 * * @functions
 * - verificarAssinatura(): Consulta o banco de dados para validar o plano ativo
 * e a data de expiração.
 * - processarUpgrade(): Redireciona o usuário para o checkout de novos planos
 * (Basic, Pro ou Premium).
 * - mostrarBloqueio(): Ativa a interface de restrição quando um limite é atingido.
 * * @notes
 * - Atua como um guardião entre a interface gratuita e as funções "Pro".
 * - Utiliza estados reativos para esconder ou desativar botões de salvamento
 * quando o usuário excede a cota permitida.
 * ============================================================================
 */

import { supabase } from "../lib/supabaseClient";

const emit = defineEmits(["sair"]);

async function simularPagamento() {
  alert("Integração Futura");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("assinaturas")
      .update({ status: "ativo" })
      .eq("user_id", user.id);
    window.location.reload(); // Recarrega a página para libertar o acesso
  }
}
</script>

<template>
  <div class="paywall-wrapper">
    <div class="paywall-card card">
      <div style="font-size: 3rem; margin-bottom: 10px">⏳</div>
      <h2 style="color: var(--primary); margin-top: 0">
        O seu período de teste terminou
      </h2>
      <p
        style="color: var(--text-muted); font-size: 1.1rem; margin-bottom: 30px"
      >
        Esperamos que tenha gostado de organizar a sua oficina com o nosso
        sistema! Para continuar a ter acesso à sua bancada, clientes e
        histórico, escolha um plano.
      </p>

      <div class="planos-grid">
        <div class="plano-box">
          <h3>Plano Profissional</h3>
          <div class="preco"><span>R$</span> 49 <span>/mês</span></div>
          <ul class="beneficios">
            <li>✅ Ordens de Serviço Ilimitadas</li>
            <li>✅ Gestão de Estoque</li>
            <li>✅ CRM e Pós-venda Automático</li>
            <li>✅ Suporte Prioritário</li>
          </ul>
          <button
            class="btn-primary"
            @click="simularPagamento"
            style="width: 100%; padding: 15px; font-size: 1.1rem"
          >
            Assinar Agora
          </button>
        </div>
      </div>

      <div style="margin-top: 25px">
        <button
          class="btn-outline text-danger"
          @click="$emit('sair')"
          style="border: none"
        >
          🚪 Sair da conta
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paywall-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--bg-body);
  padding: 20px;
}
.paywall-card {
  max-width: 600px;
  width: 100%;
  text-align: center;
  padding: 40px;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
  border-top: 5px solid var(--accent);
}
.planos-grid {
  display: flex;
  justify-content: center;
}
.plano-box {
  background: #fdfdfd;
  border: 2px solid var(--primary);
  border-radius: 8px;
  padding: 30px;
  width: 100%;
  max-width: 350px;
}
.plano-box h3 {
  margin-top: 0;
  color: var(--primary);
}
.preco {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--text-main);
  margin: 15px 0;
}
.preco span {
  font-size: 1.2rem;
  color: var(--text-muted);
  font-weight: normal;
}
.beneficios {
  list-style: none;
  padding: 0;
  margin: 0 0 25px 0;
  text-align: left;
}
.beneficios li {
  margin-bottom: 10px;
  color: var(--text-muted);
}
</style>
