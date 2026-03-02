import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function useOnboarding(modoAtual, mostrarClientes) {
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
          modoAtual.value = "admin"; // Navega para Admin
          setTimeout(() => tour.moveNext(), 300);
        },
      },
      {
        element: "#tour-config",
        popover: {
          title: "Sua Identidade",
          description:
            "Defina o seu logo, cores, tipografia, informações da sua Luthieria, suas taxas das suas máquinas aqui. ",
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
            "Registre seus serviços prestados, peças, acessórios e insumos. Defina custos e valores cobrados. Serviços possuem receitas que podem incluir insumos.",
        },
        onNextClick: () => {
          modoAtual.value = "bancada"; // Volta para o Início
          setTimeout(() => tour.moveNext(), 300);
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
          mostrarClientes.value = true; // Abre a lista de clientes
          setTimeout(() => tour.moveNext(), 300);
        },
      },
      {
        element: ".col-form",
        popover: {
          title: "Tudo Pronto!",
          description:
            "Cadastre o seu primeiro cliente agora. Boas manutenções!",
        },
      },
    ],
  });

  return { iniciarTour: () => tour.drive() };
}
