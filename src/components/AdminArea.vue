<script setup>
/**
 * ============================================================================
 * @file        AdminArea.vue
 * @description Contentor da área administrativa. Botões com ícones padronizados.
 * ============================================================================
 */
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import CatalogoManager from "./CatalogoManager.vue";
import Financeiro from "./Financeiro.vue";
import Configuracoes from "./Configuracoes.vue";
import RelatoriosDashboard from "./RelatoriosDashboard.vue";
import MinhaConta from "./MinhaConta.vue";
import Ajuda from "./Ajuda.vue";
import TermosDeUso from "./TermosDeUso.vue";
import GerenciarSaaS from "./GerenciarSaaS.vue";
import ConfigChecklist from "./ConfigChecklist.vue";
import LimpezaBanco from "./LimpezaBanco.vue";
import PopularContaDemo from "./PopularContaDemo.vue";
import { useOnboarding } from "../composables/useOnboarding";
import GestaoBackups from "./GestaoBackups.vue";
import ListaCompras from "./ListaCompras.vue";

const emit = defineEmits(["voltar"]);
const abaAtual = ref("relatorios");
const { iniciarTour } = useOnboarding();

const isSuperAdmin = ref(false);
const carregandoSeguranca = ref(true);

onMounted(async () => {
  carregandoSeguranca.value = true;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.email) {
      // Validação via Edge Function
      const { data, error } = await supabase.functions.invoke(
        "verificar-super-admin",
      );
      if (!error && data?.isSuperAdmin) {
        isSuperAdmin.value = true;
      }
    }
  } catch (err) {
    console.error("Erro crítico na verificação de Admin:", err);
  } finally {
    carregandoSeguranca.value = false;
  }
});
</script>

<template>
  <div class="admin-wrapper">
    <div class="admin-menu card">
      <div class="admin-header">
        <h2 style="margin: 0; color: var(--primary)">{{ $t('admin.titulo') }}</h2>

        <div class="admin-actions">
          <button type="button"
            class="btn-outline btn-action"
            :class="{ active: abaAtual === 'ajuda' }"
            @click="abaAtual = 'ajuda'"
          >
            <span class="icon-dinamico" style="font-size: 1rem"
              >help_center</span
            >
            {{ $t('admin.ajuda') }}
          </button>

          <button type="button" @click="iniciarTour" class="btn-outline btn-action">
            <span class="icon-dinamico" style="font-size: 1rem">lightbulb</span>
            {{ $t('admin.tutorial') }}
          </button>

          <button type="button"
            class="btn-outline btn-action"
            :class="{ active: abaAtual === 'termos' }"
            @click="abaAtual = 'termos'"
          >
            <span class="icon-dinamico" style="font-size: 1rem">gavel</span>
            {{ $t('admin.termos') }}
          </button>
        </div>
      </div>

      <div class="admin-tabs">
        <button type="button"
          id="tour-relatorios"
          class="btn-tab"
          :class="{ active: abaAtual === 'relatorios' }"
          @click="abaAtual = 'relatorios'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">analytics</span>
          {{ $t('admin.relatorios') }}
        </button>

        <button type="button"
          id="tour-catalogo"
          class="btn-tab"
          :class="{ active: abaAtual === 'catalogo' }"
          @click="abaAtual = 'catalogo'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">sell</span>
          {{ $t('admin.servicos') }}
        </button>

        <button type="button"
          id="tour-financeiro"
          class="btn-tab"
          :class="{ active: abaAtual === 'financeiro' }"
          @click="abaAtual = 'financeiro'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >point_of_sale</span
          >
          {{ $t('admin.caixa') }}
        </button>

        <button type="button"
          id="tour-config"
          class="btn-tab"
          :class="{ active: abaAtual === 'config' }"
          @click="abaAtual = 'config'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">settings</span>
          {{ $t('admin.oficina') }}
        </button>

        <button type="button"
          id="tour-checklist"
          class="btn-tab"
          :class="{ active: abaAtual === 'checklist' }"
          @click="abaAtual = 'checklist'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >fact_check</span
          >
          {{ $t('admin.checklist') }}
        </button>

        <button type="button"
          id="tour-compras"
          class="btn-tab"
          :class="{ active: abaAtual === 'compras' }"
          @click="abaAtual = 'compras'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >shopping_cart</span
          >
          {{ $t('admin.compras') }}
        </button>

        <button type="button"
          id="tour-conta"
          class="btn-tab"
          :class="{ active: abaAtual === 'conta' }"
          @click="abaAtual = 'conta'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >manage_accounts</span
          >
          {{ $t('admin.conta') }}
        </button>

        <button type="button"
          id="tour-demo"
          class="btn-tab text-primary"
          :class="{ active: abaAtual === 'demo' }"
          @click="abaAtual = 'demo'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">science</span>
          {{ $t('admin.demo') }}
        </button>

        <button type="button"
          v-if="isSuperAdmin"
          id="tour-saas"
          class="btn-tab"
          :class="{ active: abaAtual === 'saas' }"
          @click="abaAtual = 'saas'"
          style="
            background-color: var(--danger);
            color: white;
            border-color: var(--danger);
          "
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >admin_panel_settings</span
          >
          {{ $t('admin.saas') }}
        </button>

        <button type="button"
          v-if="isSuperAdmin"
          id="tour-backups"
          class="btn-tab"
          :class="{ active: abaAtual === 'backups' }"
          @click="abaAtual = 'backups'"
          style="background-color: #0f172a; color: white; border-color: #0f172a"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >cloud_download</span
          >
          {{ $t('admin.backups') }}
        </button>

        <button type="button"
          v-if="isSuperAdmin"
          id="tour-limpeza"
          class="btn-tab text-danger"
          :class="{ active: abaAtual === 'limpeza' }"
          @click="abaAtual = 'limpeza'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >delete_sweep</span
          >
          {{ $t('admin.limpeza') }}
        </button>
      </div>
    </div>

    <div class="admin-content">
      <div v-if="carregandoSeguranca" style="text-align: center; padding: 20px">
        {{ $t('admin.validando') }}
      </div>

      <KeepAlive v-else>
        <RelatoriosDashboard v-if="abaAtual === 'relatorios'" />
        <CatalogoManager
          v-else-if="abaAtual === 'catalogo'"
          @voltar="$emit('voltar')"
        />
        <Financeiro
          v-else-if="abaAtual === 'financeiro'"
          @fechar="$emit('voltar')"
        />
        <Configuracoes v-else-if="abaAtual === 'config'" />
        <ConfigChecklist v-else-if="abaAtual === 'checklist'" />

        <MinhaConta v-else-if="abaAtual === 'conta'" />
        <Ajuda v-else-if="abaAtual === 'ajuda'" />
        <TermosDeUso v-else-if="abaAtual === 'termos'" />
        <PopularContaDemo v-else-if="abaAtual === 'demo'" />

        <ListaCompras v-else-if="abaAtual === 'compras'" />

        <LimpezaBanco v-else-if="abaAtual === 'limpeza' && isSuperAdmin" />
        <GerenciarSaaS v-else-if="abaAtual === 'saas' && isSuperAdmin" />

        <GestaoBackups v-else-if="abaAtual === 'backups' && isSuperAdmin" />
      </KeepAlive>
    </div>
  </div>
</template>

<style scoped>
/* =======================================================
   ESTILOS DO CABEÇALHO E AÇÕES (Agora Responsivos!)
   ======================================================= */
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 2px solid var(--border);
  padding-bottom: 10px;
}

.admin-actions {
  display: flex;
  gap: 10px;
}

.btn-action {
  font-size: 0.8rem;
  color: var(--accent);
  border-color: var(--accent);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  min-height: 36px; /* Um pouco mais compactos que os botões padrão */
}

/* =======================================================
   ESTILOS DAS ABAS
   ======================================================= */
.admin-tabs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-tab {
  flex: 1;
  min-width: 140px;
  padding: 12px;
  border: none;
  background: var(--bg-body);
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: 0.2s;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-tab.active {
  background: var(--primary);
  color: white;
  box-shadow: var(--shadow);
}

.admin-content {
  margin-top: 20px;
}

/* =======================================================
   REGRAS PARA DISPOSITIVOS MÓVEIS (A Magia Acontece Aqui)
   ======================================================= */
@media (max-width: 768px) {
  .admin-header {
    flex-direction: column; /* Empilha o título e os botões */
    align-items: stretch;
    gap: 15px;
    text-align: center;
  }

  .admin-actions {
    flex-wrap: wrap; /* Permite que os botões quebrem linha se necessário */
    width: 100%;
  }

  .btn-action {
    flex: 1 1 30%; /* Os 3 botões dividem o espaço por igual */
    justify-content: center;
    padding: 8px 4px !important; /* Reduz o padding para caberem lado a lado */
    font-size: 0.75rem; /* Texto ligeiramente menor para não estourar */
  }
}
</style>
