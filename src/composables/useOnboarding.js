import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function useOnboarding() {
  const tour = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: "Próximo —>",
    prevBtnText: "<— Voltar",
    doneBtnText: "Concluir Tour",
    steps: [
      {
        element: ".brand-area",
        popover: {
          title: "Bem-vindo!",
          description:
            "Este é o seu novo sistema de gestão para luthieria. Para começar com o pé direito, vamos fazer algo importante na próxima etapa.",
        },
      },
      {
        element: "#tour-admin",
        popover: {
          title: "Primeira Parada: Gestão",
          description:
            "A forma mais fácil de entender a mágica do sistema é vê-lo com dados reais. Clique em 'Próximo' para entrarmos no painel.",
        },
        onNextClick: () => {
          document.getElementById("tour-admin")?.click();
          const interval = setInterval(() => {
            if (document.getElementById("tour-demo")) {
              clearInterval(interval);
              tour.moveNext();
            }
          }, 200);
          setTimeout(() => clearInterval(interval), 10000);
        },
      },
      {
        element: "#tour-demo",
        popover: {
          title: "Aba Conta Demo",
          description:
            "Esta é a aba de simulação. Clique em 'Próximo' para abrirmos as opções e vermos como injetar dados reais no sistema.",
        },
        onNextClick: () => {
          document.getElementById("tour-demo")?.click();
          const interval = setInterval(() => {
            if (document.getElementById("btn-iniciar-simulacao")) {
              clearInterval(interval);
              tour.moveNext();
            }
          }, 200);
          setTimeout(() => clearInterval(interval), 10000);
        },
      },
      {
        element: "#btn-iniciar-simulacao",
        popover: {
          title: "Conta Demo (Altamente Recomendado!)",
          description:
            "Gere uma base de dados fictícia agora mesmo! A experiência e o entendimento do software sem dados são completamente diferentes de um banco totalmente populado. Se não quiser gerar, apenas clique em 'Próximo' para continuar o tour com o painel vazio.",
        },
        onNextClick: () => {
          document.getElementById("tour-home")?.click();
          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: "#tour-home",
        popover: {
          title: "Página Principal",
          description:
            "A sua Bancada de trabalho diária. Volte sempre aqui para a operação do dia a dia.",
        },
      },
      {
        element: "#tour-bancada",
        popover: {
          title: "Instrumentos na Bancada",
          description:
            "Acompanhe o progresso e o status atual de todas as suas Ordens de Serviço (O.S.) abertas.",
        },
      },
      {
        element: "#tour-faturamento-parado",
        popover: {
          title: "Faturamento Parado",
          description:
            "Controle imediato de valores pendentes de serviços prontos, que aguardam retirada ou pagamento.",
        },
      },
      {
        element: "#tour-pos-venda",
        popover: {
          title: "Pós-Venda (Retenção)",
          description:
            "Gere novos serviços! O sistema alerta quando instrumentos antigos precisam de revisão - Aparecem aqui instrumentos que não recebem serviços há mais de 6 meses.",
        },
      },
      {
        element: "#tour-alertas",
        popover: {
          title: "Alertas de Estoque",
          description:
            "Avisa automaticamente quando peças ou cordas estão acabando no seu inventário.",
        },
      },
      {
        element: "#tour-clientes",
        popover: {
          title: "Clientes",
          description:
            "Área para consultar ou cadastrar rapidamente músicos e os seus respectivos instrumentos.",
        },
        onNextClick: () => {
          document.getElementById("tour-clientes")?.click();
          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: "#tour-admin",
        popover: {
          title: "De volta ao Painel de Gestão",
          description:
            "O cérebro da oficina. Agora vamos ver as outras ferramentas de administração.",
        },
        onNextClick: () => {
          document.getElementById("tour-admin")?.click();
          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: "#tour-relatorios",
        popover: {
          title: "Relatórios",
          description:
            "Métricas claras: Saúde financeira, produtividade, total de contas a receber e KPIs de sucesso.",
        },
      },
      {
        element: "#tour-catalogo",
        popover: {
          title: "Serviços e Estoque",
          description:
            "Monte o seu catálogo. Defina preços de mão de obra e administre peças físicas.",
        },
      },
      {
        element: "#tour-financeiro",
        popover: {
          title: "Caixa",
          description:
            "Controle o fluxo de dinheiro que entra e sai fora das Ordens de Serviço (despesas fixas, etc).",
        },
      },
      {
        element: "#tour-config",
        popover: {
          title: "Identidade Visual",
          description:
            "Personalize o sistema com a cor da sua marca, logotipo, taxas de cartão e muito mais.",
        },
      },
      {
        element: "#tour-checklist",
        popover: {
          title: "Checklists Padrão",
          description:
            "Crie formulários de inspeção de entrada para dar segurança técnica e visual a você e ao cliente.",
        },
      },
      {
        element: "#tour-compras",
        popover: {
          title: "Lista de Compras",
          description:
            "Bloco de notas rápido para não esquecer peças essenciais na próxima ida à loja.",
        },
      },
      {
        element: "#tour-conta",
        popover: {
          title: "Minha Conta",
          description:
            "Atualize os seus dados de perfil, email e senhas de acesso.",
        },
      },
    ],
  });

  return { 
    iniciarTour: (stepIndex = 0) => {
      const startAt = typeof stepIndex === 'number' ? stepIndex : 0;
      tour.drive(startAt);
    }
  };
}
