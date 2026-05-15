import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useI18n } from "vue-i18n";

export function useOnboarding() {
  const { t } = useI18n();

  const createTour = () => driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: t('admin_onboarding.btn_prox'),
    prevBtnText: t('admin_onboarding.btn_voltar'),
    doneBtnText: t('admin_onboarding.btn_concluir'),
    steps: [
      {
        element: ".brand-area",
        popover: {
          title: t('admin_onboarding.bem_vindo_titulo'),
          description: t('admin_onboarding.bem_vindo_desc'),
        },
      },
      {
        element: "#tour-admin",
        popover: {
          title: t('admin_onboarding.parada_gestao_titulo'),
          description: t('admin_onboarding.parada_gestao_desc'),
        },
        onNextClick: () => {
          document.getElementById("tour-admin")?.click();
          const interval = setInterval(() => {
            if (document.getElementById("tour-demo")) {
              clearInterval(interval);
              window.currentTourInstance?.moveNext();
            }
          }, 200);
          setTimeout(() => clearInterval(interval), 10000);
        },
      },
      {
        element: "#tour-demo",
        popover: {
          title: t('admin_onboarding.aba_demo_titulo'),
          description: t('admin_onboarding.aba_demo_desc'),
        },
        onNextClick: () => {
          document.getElementById("tour-demo")?.click();
          const interval = setInterval(() => {
            if (document.getElementById("btn-iniciar-simulacao")) {
              clearInterval(interval);
              window.currentTourInstance?.moveNext();
            }
          }, 200);
          setTimeout(() => clearInterval(interval), 10000);
        },
      },
      {
        element: "#btn-iniciar-simulacao",
        popover: {
          title: t('admin_onboarding.conta_demo_titulo'),
          description: t('admin_onboarding.conta_demo_desc'),
        },
        onNextClick: () => {
          document.getElementById("tour-home")?.click();
          setTimeout(() => window.currentTourInstance?.moveNext(), 400);
        },
      },
      {
        element: "#tour-home",
        popover: {
          title: t('admin_onboarding.principal_titulo'),
          description: t('admin_onboarding.principal_desc'),
        },
      },
      {
        element: "#tour-bancada",
        popover: {
          title: t('admin_onboarding.bancada_titulo'),
          description: t('admin_onboarding.bancada_desc'),
        },
      },
      {
        element: "#tour-faturamento-parado",
        popover: {
          title: t('admin_onboarding.faturamento_titulo'),
          description: t('admin_onboarding.faturamento_desc'),
        },
      },
      {
        element: "#tour-pos-venda",
        popover: {
          title: t('admin_onboarding.posvenda_titulo'),
          description: t('admin_onboarding.posvenda_desc'),
        },
      },
      {
        element: "#tour-alertas",
        popover: {
          title: t('admin_onboarding.alertas_titulo'),
          description: t('admin_onboarding.alertas_desc'),
        },
      },
      {
        element: "#tour-clientes",
        popover: {
          title: t('admin_onboarding.clientes_titulo'),
          description: t('admin_onboarding.clientes_desc'),
        },
        onNextClick: () => {
          document.getElementById("tour-clientes")?.click();
          setTimeout(() => window.currentTourInstance?.moveNext(), 400);
        },
      },
      {
        element: "#tour-admin",
        popover: {
          title: t('admin_onboarding.voltagestao_titulo'),
          description: t('admin_onboarding.voltagestao_desc'),
        },
        onNextClick: () => {
          document.getElementById("tour-admin")?.click();
          setTimeout(() => window.currentTourInstance?.moveNext(), 400);
        },
      },
      {
        element: "#tour-relatorios",
        popover: {
          title: t('admin_onboarding.relatorios_titulo'),
          description: t('admin_onboarding.relatorios_desc'),
        },
      },
      {
        element: "#tour-catalogo",
        popover: {
          title: t('admin_onboarding.catalogo_titulo'),
          description: t('admin_onboarding.catalogo_desc'),
        },
      },
      {
        element: "#tour-financeiro",
        popover: {
          title: t('admin_onboarding.financeiro_titulo'),
          description: t('admin_onboarding.financeiro_desc'),
        },
      },
      {
        element: "#tour-config",
        popover: {
          title: t('admin_onboarding.config_titulo'),
          description: t('admin_onboarding.config_desc'),
        },
      },
      {
        element: "#tour-checklist",
        popover: {
          title: t('admin_onboarding.checklist_titulo'),
          description: t('admin_onboarding.checklist_desc'),
        },
      },
      {
        element: "#tour-compras",
        popover: {
          title: t('admin_onboarding.compras_titulo'),
          description: t('admin_onboarding.compras_desc'),
        },
      },
      {
        element: "#tour-conta",
        popover: {
          title: t('admin_onboarding.conta_titulo'),
          description: t('admin_onboarding.conta_desc'),
        },
      },
    ],
  });

  return { 
    iniciarTour: (stepIndex = 0) => {
      const startAt = typeof stepIndex === 'number' ? stepIndex : 0;
      window.currentTourInstance = createTour();
      window.currentTourInstance.drive(startAt);
    }
  };
}
