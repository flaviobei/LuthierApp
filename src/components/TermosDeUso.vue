<script setup>
/**
 * ============================================================================
 * @file        TermosDeUso.vue
 * @description Termos de Uso e Políticas de Privacidade do Sistema Luthier.
 * ============================================================================
 */
</script>

<template>
  <div class="termos-container card">
    <div class="header-termos">
      <h2
        style="
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--primary);
        "
      >
        <span class="icon-dinamico" style="font-size: 2rem">gavel</span>
        Termos de Uso e Privacidade
      </h2>
      <p class="text-muted" style="margin-top: 5px">
        Políticas de utilização, segurança e tratamento de dados da plataforma.
      </p>
    </div>

    <div class="conteudo-termos">
      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)"
            >verified_user</span
          >
          1. Aceitação dos Termos
        </h3>
        <p>
          Ao acessar e utilizar o LuthierApp, você concorda em cumprir e ficar
          vinculado aos seguintes termos e condições de uso. Se você não
          concordar com qualquer parte destes termos, não deverá utilizar nossos
          serviços.
        </p>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)"
            >data_exploration</span
          >
          2. Coleta e Uso de Dados (LGPD)
        </h3>
        <p>
          O LuthierApp atua como um facilitador para a gestão da sua oficina.
          Como usuário (luthier), você é o controlador dos dados de seus
          clientes.
        </p>
        <ul>
          <li>
            <strong>Dados de Clientes:</strong> Nome, telefone, email e dados de
            instrumentos são armazenados com segurança para o funcionamento do
            sistema (orçamentos, ordens de serviço e contatos).
          </li>
          <li>
            <strong>Responsabilidade:</strong> Você se compromete a coletar
            dados de seus clientes de forma lícita, informando-os sobre a
            finalidade da coleta.
          </li>
          <li>
            <strong>Nenhum Compartilhamento:</strong> O LuthierApp não vende,
            aluga ou compartilha os dados de seus clientes com terceiros para
            fins publicitários.
          </li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">lock</span>
          3. Segurança e Acesso
        </h3>
        <p>
          Levamos a segurança a sério. Utilizamos práticas padrão da indústria
          para proteger suas informações contra acesso não autorizado.
        </p>
        <ul>
          <li>
            <strong>Credenciais:</strong> Você é responsável por manter a
            confidencialidade do seu login e senha. Qualquer atividade na sua
            conta é de sua responsabilidade.
          </li>
          <li>
            <strong>Backups:</strong> O sistema realiza backups regulares para
            garantir a integridade das informações cadastradas da sua oficina.
          </li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)"
            >payments</span
          >
          4. Assinatura e Pagamentos
        </h3>
        <p>
          O LuthierApp pode ser oferecido no formato SaaS (Software as a
          Service). O acesso contínuo aos recursos premium depende do pagamento
          da assinatura ativa.
        </p>
        <ul>
          <li>
            Em caso de inadimplência, o sistema poderá restringir o acesso a
            funcionalidades avançadas, garantindo apenas a visualização de
            serviços já cadastrados.
          </li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)"
            >warning</span
          >
          5. Limitações de Responsabilidade
        </h3>
        <p>
          O sistema é fornecido "no estado em que se encontra". Não nos
          responsabilizamos por:
        </p>
        <ul>
          <li>
            Falhas sistêmicas decorrentes de problemas de conexão com a
            internet.
          </li>
          <li>
            Prejuízos decorrentes de precificação ou orçamentos gerados de forma
            equivocada pelo usuário.
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.termos-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 30px;
}
.header-termos {
  border-bottom: 2px solid var(--border);
  padding-bottom: 15px;
  margin-bottom: 25px;
}
.topico {
  background: var(--bg-body);
  padding: 20px;
  border-radius: var(--radius);
  border-left: 4px solid var(--accent);
}
.topico h3 {
  margin-top: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
}
.topico p,
.topico li {
  color: var(--text-muted);
  line-height: 1.6;
}
.topico ul {
  padding-left: 20px;
  margin-top: 10px;
}
</style>
