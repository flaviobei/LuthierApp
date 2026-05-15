<script setup>
/**
 * ============================================================================
 * @file        TermosDeUso.vue
 * @description Termos de Uso e Políticas de Privacidade do Sistema Luthier.
 * ============================================================================
 */
import { useI18n } from "vue-i18n";

const { locale } = useI18n();
</script>

<template>
  <div class="termos-container card">
    <div v-if="locale === 'pt-BR'">
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

    <!-- BLOCO EM INGLÊS -->
    <div v-else>
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
          Terms of Use and Privacy
        </h2>
        <p class="text-muted" style="margin-top: 5px">
          Platform usage, security and data handling policies.
        </p>
      </div>

      <div class="conteudo-termos">
        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)"
              >verified_user</span
            >
            1. Acceptance of Terms
          </h3>
          <p>
            By accessing and using LuthierApp, you agree to comply with and be
            bound by the following terms and conditions of use. If you disagree
            with any part of these terms, you must not use our services.
          </p>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)"
              >data_exploration</span
            >
            2. Data Collection and Use
          </h3>
          <p>
            LuthierApp acts as a facilitator for managing your shop.
            As a user (luthier), you are the controller of your clients' data.
          </p>
          <ul>
            <li>
              <strong>Client Data:</strong> Name, phone, email, and instrument
              data are securely stored for the system to function (quotes,
              service orders, and contacts).
            </li>
            <li>
              <strong>Responsibility:</strong> You commit to lawfully collecting
              your clients' data, informing them about the purpose of the
              collection.
            </li>
            <li>
              <strong>No Sharing:</strong> LuthierApp does not sell, rent, or
              share your clients' data with third parties for advertising purposes.
            </li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">lock</span>
            3. Security and Access
          </h3>
          <p>
            We take security seriously. We use industry standard practices to
            protect your information against unauthorized access.
          </p>
          <ul>
            <li>
              <strong>Credentials:</strong> You are responsible for maintaining the
              confidentiality of your login and password. Any activity in your
              account is your responsibility.
            </li>
            <li>
              <strong>Backups:</strong> The system performs regular backups to
              ensure the integrity of your shop's registered information.
            </li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)"
              >payments</span
            >
            4. Subscription and Payments
          </h3>
          <p>
            LuthierApp may be offered in SaaS (Software as a Service) format.
            Continuous access to premium features depends on payment of an
            active subscription.
          </p>
          <ul>
            <li>
              In case of default, the system may restrict access to advanced
              features, ensuring only the visualization of already registered
              services.
            </li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)"
              >warning</span
            >
            5. Limitation of Liability
          </h3>
          <p>
            The system is provided "as is". We are not responsible for:
          </p>
          <ul>
            <li>
              Systemic failures arising from internet connection problems.
            </li>
            <li>
              Losses resulting from pricing or quotes mistakenly generated by the
              user.
            </li>
          </ul>
        </section>
      </div>
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
