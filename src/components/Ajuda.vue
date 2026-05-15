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
    <div class="header-ajuda" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
      <div>
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
        <p class="text-muted" style="margin-top: 5px; margin-bottom: 0;">
          Guia rápido de como utilizar as funcionalidades do seu sistema de
          gestão.
        </p>
      </div>
      
      <a href="/manual_usuario.pdf" target="_blank" download="Manual_LuthierApp.pdf" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">
        <span class="icon-dinamico">picture_as_pdf</span>
        Baixar Manual (PDF)
      </a>
    </div>

    <div class="conteudo-ajuda">
      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">home</span>
          1. A Bancada de Trabalho (Início)
        </h3>
        <p>A "Bancada" centraliza as atividades diárias. Nela você vê o Dashboard de Atividades (faturamento parado, pós-venda, alertas de estoque) e as Ordens de Serviço (O.S.) ativas.</p>
        <ul>
          <li><strong>Clientes e Instrumentos:</strong> No botão "Gerenciar Clientes", você cadastra a pessoa e depois usa o botão de "Ver Instrumentos" para vincular guitarras, baixos, etc.</li>
          <li><strong>Criando O.S.:</strong> Na aba do instrumento do cliente, inicie um serviço. Ele aparecerá na sua bancada imediatamente com o status "Fila de Espera".</li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">build</span>
          2. Gerenciando uma O.S. (Ordem de Serviço)
        </h3>
        <p>Ao abrir um card de serviço na bancada, você acessa 4 abas práticas:</p>
        <ul>
          <li><strong>Checklist:</strong> Registra as condições do instrumento na chegada e na qualidade de saída. Pode ser pré-configurado com regras padrão no Admin.</li>
          <li><strong>Diário:</strong> Mude a fase do projeto e adicione notas ou fotos (criando um histórico da manutenção para o cliente). Defina o Prazo de Entrega aqui.</li>
          <li><strong>Orçamento:</strong> Puxe os serviços e peças do Catálogo Rápido (o que abate do estoque) ou digite valores avulsos. Aqui se gera o PDF do Orçamento/Recibo.</li>
          <li><strong>Receber:</strong> Registre os pagamentos parciais (sinal) ou totais. Marque a O.S. como Entregue apenas quando o instrumento já tiver saído com o cliente!</li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">qr_code_scanner</span>
          3. QR Code, Scanner e Impressão
        </h3>
        <p>A cada O.S. criada, o sistema gera um Canhoto de Identificação com um QR Code no rodapé do orçamento. Imprima e prenda ao instrumento físico. Quando quiser encontrar rapidamente a ficha dessa O.S., basta clicar em "QR Scan" no menu superior e ler a etiqueta pela câmera.</p>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">auto_graph</span>
          4. Pós-Venda e Alertas da Bancada
        </h3>
        <ul>
          <li><strong>Faturamento Parado:</strong> Exibe o valor total de serviços que já estão "Prontos para Entrega", mas ainda não foram retirados/pagos pelo cliente.</li>
          <li><strong>Retenção (Pós-Venda):</strong> Lista instrumentos que foram entregues há mais de 6 meses. Use o botão para enviar um zap oferecendo revisão periódica preventiva.</li>
          <li><strong>Alertas de Estoque:</strong> Avisa automaticamente quais peças ou insumos do seu catálogo caíram abaixo do Limite Mínimo de Estoque de Segurança.</li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">inventory_2</span>
          5. Catálogo, Estoque e Compras
        </h3>
        <p>Dentro da Área Admin, você tem acesso as ferramentas de gestão de materiais:</p>
        <ul>
          <li><strong>Catálogo Rápido:</strong> Cadastre Peças, Insumos e Serviços (Mão de Obra). Ao definir "Insumos Consumidos" dentro de um Serviço cadastrado, o sistema descontará do estoque as proporções dos insumos sempre que aquele serviço for orçado numa O.S.</li>
          <li><strong>Lista de Compras:</strong> Bloco visual para suas <em>Wishlists</em> (Desejos) e <em>Needlists</em> (Urgências). Salve links e níveis de prioridade.</li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">calendar_month</span>
          6. Agenda e Histórico (Arquivo Morto)
        </h3>
        <ul>
          <li><strong>Agenda (Calendário):</strong> Ao definir um Prazo no diário de uma O.S., a mesma cai direto nesse calendário interativo. Fundamental para não estourar os prazos de oficina.</li>
          <li><strong>Arquivo / Histórico:</strong> Todos os serviços mudados para a fase "Entregue" somem da Bancada (para manter o foco limpo) e vão parar no Histórico, onde você consulta orçamentos e dados antigos para sempre.</li>
        </ul>
      </section>

      <section class="topico mb-2">
        <h3>
          <span class="icon-dinamico" style="color: var(--accent)">settings</span>
          7. Área Admin (Configurações e Relatórios)
        </h3>
        <p>Acesso exclusivo de gestão do proprietário da luthieria:</p>
        <ul>
          <li><strong>Dashboard Financeiro:</strong> Gráficos precisos do seu Lucro Líquido, Receitas Brutas e Despesas mensais.</li>
          <li><strong>Fluxo de Caixa:</strong> Além das O.S., aqui você insere despesas manuais do local, como aluguel, luz e IPTU.</li>
          <li><strong>Identidade e Dados da Oficina:</strong> Ajuste cor do sistema, logomarca, endereço, CNPJ e os Termos Legais de Garantia que aparecerão nos laudos impressos.</li>
          <li><strong>Checklists Padrão:</strong> Crie e edite as perguntas padronizadas de entrada e saída, que serão adicionadas automaticamente a toda nova Ordem de Serviço criada.</li>
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
