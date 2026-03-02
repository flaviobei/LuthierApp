<script setup>
/**
 * ============================================================================
 * @file        Ajuda.vue
 * @description Manual do Usuário Embutido (Guia para o Luthier).
 * ============================================================================
 */
</script>

<template>
  <div class="ajuda-container card">
    <div class="header-ajuda">
      <h2
        style="
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--primary);
        "
      >
        <span class="icon-dinamico" style="font-size: 2rem">help_center</span>
        Manual do Sistema & Ajuda
      </h2>
      <p class="text-muted" style="margin-top: 5px">
        Guia rápido de como utilizar as funcionalidades do seu sistema de
        gestão.
      </p>
    </div>

    <div class="conteudo-ajuda">
      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">home</span>
          1. A Bancada de Trabalho (Início)
        </h3>
        <p>
          A "Bancada" é o coração da sua luthieria. Aqui você vê todas as Ordens
          de Serviço (O.S.) que estão em andamento ou pendentes.
        </p>
        <ul>
          <li>
            <strong>Clientes e Instrumentos:</strong> Ao final da página da
            bancada, clique em "Gerenciar Clientes". Primeiro você cadastra o
            cliente. Depois escolhe a opção "Ver Instrumentos" para vincular
            guitarras, baixos, baterias àquele contato.
          </li>
          <li>
            <strong>Criando O.S.:</strong> Na aba do instrumento do cliente,
            você pode iniciar um serviço (O.S.). Ele aparecerá na sua bancada
            imediatamente com o status "Fila de Espera".
          </li>

          <li>
            <strong>Localizando uma OS com QRCode:</strong> Na aba da OS você
            encontra o botão de QRCode. Você pode imprimir um canhoto e juntar
            ao instrumento para facilitar a localização da OS. Para ler um
            QRCode, clique no boão QRScan, autorize o uso da câmera e aponte
            para o QRCode.
          </li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">build</span>
          2. Gerenciando uma O.S.
        </h3>
        <p>
          Ao clicar em um card de serviço na sua bancada, você abre a visão de
          Execução daquela O.S. Ela é dividida em 4 abas práticas:
        </p>
        <ul>
          <li>
            <strong>Checklist:</strong> Anote como o instrumento chegou
            (arranhões, cordas velhas, batidas). Importante para documentar
            defeitos pré-existentes e enviar o termo em PDF ao cliente.
          </li>
          <li>
            <strong>Diário:</strong> Uma espécie de bloco de notas infinito.
            Você muda o status do projeto (Ex: "Na Bancada" -> "Secagem de
            Verniz" -> "Pronto pra Entrega") e pode adicionar fotos para montar
            um relatório bacana pro cliente depois.
          </li>
          <li>
            <strong>Orçamento:</strong> Puxe os serviços pré-cadastrados do seu
            catálogo ou adicione valores avulsos. Aqui se gera o PDF de
            Orçamento.
          </li>
          <li>
            <strong>Receber:</strong> O momento de registrar os pagamentos.
            Lançou uma entrada (Sinal)? Fica salvo aqui e já entra no seu
            faturamento do mês! Marque o serviço como Finalizado quando estiver
            entregue!
          </li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)"
            >lightbulb</span
          >
          3. Retenção (CRM / Pós-Venda)
        </h3>
        <p>
          Na bancada inicial, o sistema avisará instrumentos que foram entregues
          há mais de 6 meses. Use o botão <strong>"Chamar no Zap"</strong> para
          enviar uma mensagem customizada oferecendo um setup preventivo.
        </p>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)"
            >calendar_month</span
          >
          4. Agenda e Entregas
        </h3>
        <p>
          Ao definir um "Prazo Estimado de Conclusão" numa O.S. (na aba Diário),
          o serviço vai direto pro Calendário do sistema. Fique de olho na aba
          "Agenda" para não estourar prazos.
        </p>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)"
            >settings</span
          >
          5. Menu Admin e Relatórios
        </h3>
        <p>Nesta área exclusiva do dono, você configura:</p>
        <ul>
          <li>
            <strong>Identidade e Temas:</strong> Coloque sua Logomarca, mude a
            cor para vermelho, verde, escuro. As configurações refletem nos
            canhotos!
          </li>
          <li>
            <strong>Dashboard / Rentabilidade:</strong> Descubra seu lucro
            líquido descontando as peças/despesas compradas e faturamento dos
            serviços concluídos por mês.
          </li>
          <li>
            <strong>Catálogo Rápido:</strong> Cadastre serviços com valor
            tabelado (Ex: "Troca de Trastes - R$400") para chamar com apenas um
            clique durante seus orçamentos.
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ajuda-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 30px;
}
.header-ajuda {
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
.alerta-suporte {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 20px;
  border-radius: var(--radius);
  color: #1e3a8a;
  text-align: center;
}
</style>
