<script setup>
/**
 * ============================================================================
 * @file        Ajuda.vue
 * @description Manual do Usuário Embutido (Guia para o Luthier).
 * ============================================================================
 */
import { useI18n } from "vue-i18n";

const { locale } = useI18n();
</script>

<template>
  <div class="ajuda-container card">
    <div v-if="locale === 'pt-BR'">
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

    <!-- BLOCO EM INGLÊS -->
    <div v-else>
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
            System Manual & Help
          </h2>
          <p class="text-muted" style="margin-top: 5px; margin-bottom: 0;">
            Quick guide on how to use your management system features.
          </p>
        </div>
        
        <a href="/manual_usuario.pdf" target="_blank" download="Manual_LuthierApp.pdf" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">
          <span class="icon-dinamico">picture_as_pdf</span>
          Download Manual (PDF)
        </a>
      </div>

      <div class="conteudo-ajuda">
        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">home</span>
            1. The Workbench (Home)
          </h3>
          <p>The "Workbench" centralizes daily activities. There you can see the Activities Dashboard (pending revenue, post-sales, stock alerts) and active Service Orders (S.O.).</p>
          <ul>
            <li><strong>Clients and Instruments:</strong> On the "Manage Clients" button, register the person and then use the "View Instruments" button to link guitars, basses, etc.</li>
            <li><strong>Creating S.O.:</strong> On the client's instrument tab, start a service. It will immediately appear on your workbench with the status "Waiting List".</li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">build</span>
            2. Managing an S.O. (Service Order)
          </h3>
          <p>Opening a service card on the workbench gives you access to 4 practical tabs:</p>
          <ul>
            <li><strong>Checklist:</strong> Records instrument conditions upon arrival and exit quality. It can be pre-configured with standard rules in Admin.</li>
            <li><strong>Diary:</strong> Change the project phase and add notes or photos (creating a maintenance history for the client). Set the Delivery Deadline here.</li>
            <li><strong>Quote:</strong> Pull services and parts from the Quick Catalog (which deducts from stock) or type loose values. Here the Quote/Receipt PDF is generated.</li>
            <li><strong>Receive:</strong> Register partial (deposit) or total payments. Mark the S.O. as Delivered only when the instrument has left with the client!</li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">qr_code_scanner</span>
            3. QR Code, Scanner and Printing
          </h3>
          <p>For each created S.O., the system generates an Identification Tag with a QR Code at the bottom of the quote. Print and attach it to the physical instrument. When you want to quickly find this S.O. file, just click "QR Scan" on the top menu and read the tag with the camera.</p>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">auto_graph</span>
            4. Post-Sales and Workbench Alerts
          </h3>
          <ul>
            <li><strong>Pending Revenue:</strong> Shows the total value of services that are "Ready for Delivery", but have not yet been picked up/paid by the client.</li>
            <li><strong>Retention (Post-Sales):</strong> Lists instruments delivered more than 6 months ago. Use the button to send a WhatsApp offering a preventive review.</li>
            <li><strong>Stock Alerts:</strong> Automatically warns which parts or supplies in your catalog have fallen below the Minimum Safety Stock Limit.</li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">inventory_2</span>
            5. Catalog, Stock and Shopping
          </h3>
          <p>Inside the Admin Area, you have access to material management tools:</p>
          <ul>
            <li><strong>Quick Catalog:</strong> Register Parts, Supplies and Services (Labor). By defining "Supplies Consumed" within a registered Service, the system will deduct from stock the proportions of supplies whenever that service is quoted on an S.O.</li>
            <li><strong>Shopping List:</strong> Visual block for your <em>Wishlists</em> and <em>Needlists</em>. Save links and priority levels.</li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">calendar_month</span>
            6. Calendar and History (Archive)
          </h3>
          <ul>
            <li><strong>Calendar:</strong> By setting a Deadline in the diary of an S.O., it falls straight into this interactive calendar. Fundamental for not missing shop deadlines.</li>
            <li><strong>Archive / History:</strong> All services moved to the "Delivered" phase disappear from the Workbench (to keep focus clean) and end up in the History, where you can consult old quotes and data forever.</li>
          </ul>
        </section>

        <section class="topico mb-2">
          <h3>
            <span class="icon-dinamico" style="color: var(--accent)">settings</span>
            7. Admin Area (Settings and Reports)
          </h3>
          <p>Exclusive management access for the luthieria owner:</p>
          <ul>
            <li><strong>Financial Dashboard:</strong> Accurate charts of your Net Profit, Gross Revenue and monthly Expenses.</li>
            <li><strong>Cash Flow:</strong> In addition to S.O.s, here you insert manual local expenses, such as rent, electricity and taxes.</li>
            <li><strong>Identity and Shop Data:</strong> Adjust system color, logo, address, ID and the Legal Warranty Terms that will appear on printed reports.</li>
            <li><strong>Standard Checklists:</strong> Create and edit standardized entry and exit questions, which will be automatically added to every new created Service Order.</li>
          </ul>
        </section>
      </div>
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
