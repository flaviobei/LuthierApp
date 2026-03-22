import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function useOnboarding() {
  const tour = driver({
    showProgress: true,
    nextBtnText: "Próximo —>",
    prevBtnText: "<— Voltar",
    doneBtnText: "Concluir Tour",
    steps: [
      {
        element: ".brand-area",
        popover: {
          title: "Bem-vindo!",
          description:
            "Este é o seu novo sistema de gestão. Vamos configurá-lo?",
        },
      },
      {
        element: "#tour-admin",
        popover: {
          title: "Menu de Administração",
          description:
            "Clique aqui para configurar a sua oficina, catálogo e checklists. Bem como verificar suas transações financeiras",
        },
        onNextClick: () => {
          document.getElementById("tour-admin")?.click();
          setTimeout(() => tour.moveNext(), 300);
        },
      },
      {
        element: "#tour-config",
        popover: {
          title: "Sua Identidade",
          description:
            "Defina o seu logo, cores, tipografia e as taxas das suas máquinas aqui.",
        },
      },
      {
        element: "#tour-checklist",
        popover: {
          title: "Checklists",
          description:
            "Crie as regras de inspeção que aparecerão em todas as novas O.S. Checklists são úteis para padronizar o seu trabalho.",
        },
      },
      {
        element: "#tour-catalogo",
        popover: {
          title: "Agilidade",
          description:
            "Registre seus serviços prestados, peças e insumos. Defina custos e valores cobrados.",
        },
        onNextClick: () => {
          document.getElementById("tour-home")?.click();
          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: "#tour-home",
        popover: {
          title: "Sua Bancada",
          description: "Volte sempre aqui para ver as atividades do dia.",
        },
      },
      {
        element: "#tour-clientes",
        popover: {
          title: "Gestão de Clientes",
          description: "Aqui é onde você registra músicos e instrumentos.",
        },
        onNextClick: () => {
          document.getElementById("tour-clientes")?.click();
          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: ".col-form",
        popover: {
          title: "Quase lá!",
          description:
            "Aqui cadastra os seus clientes. Para finalizar, vamos conhecer uma ferramenta secreta na próxima etapa!",
        },
        onNextClick: () => {
          // Tenta fechar a aba de clientes clicando no botão Voltar/Fechar
          const botoes = Array.from(document.querySelectorAll("button"));
          const btnFechar = botoes.find(
            (b) =>
              b.textContent.includes("Voltar") ||
              b.textContent.includes("Fechar") ||
              (b.querySelector(".icon-dinamico") &&
                b
                  .querySelector(".icon-dinamico")
                  .textContent.includes("arrow_back")),
          );
          if (btnFechar) btnFechar.click();

          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: "#tour-admin", // APONTA PARA O ADMIN NOVAMENTE
        popover: {
          title: "De volta ao Painel",
          description:
            "Vamos regressar ao menu de Gestão. Clique em 'Próximo' para abrirmos esta área.",
        },
        onNextClick: () => {
          document.getElementById("tour-admin")?.click();
          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: "#tour-limpeza", // APONTA PARA A ABA LIMPEZA
        popover: {
          title: "Área de Testes",
          description:
            "Esta é a aba de Limpeza/Demo. Clique em 'Próximo' para entrarmos nela.",
        },
        onNextClick: () => {
          document.getElementById("tour-limpeza")?.click();
          setTimeout(() => tour.moveNext(), 400);
        },
      },
      {
        element: ".admin-limpeza-container", // FOCA NA TELA INTEIRA
        popover: {
          title: "Simulação e Limpeza",
          description:
            "Use o Gerador Demo para testar gráficos e o sistema completo com 1 clique. Quando terminar, digite 'LIMPAR' para apagar os dados falsos. Boas manutenções!",
        },
      },
    ],
  });

  return { iniciarTour: () => tour.drive() };
}
