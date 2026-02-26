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
          title: "Configurações Master",
          description:
            "Clique aqui para configurar a sua oficina, catálogo e checklists.",
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
          description: "Defina o seu logo e as taxas das suas máquinas aqui.",
        },
      },
      {
        element: "#tour-checklist",
        popover: {
          title: "Padronização",
          description:
            "Crie as regras de inspeção que aparecerão em todas as novas O.S.",
        },
      },
      {
        element: "#tour-catalogo",
        popover: {
          title: "Agilidade",
          description:
            "Registe serviços e peças frequentes para gerar orçamentos rápidos.",
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
          description: "Aqui é onde você regista músicos e instrumentos.",
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
