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
import GerenciarSaaS from "./GerenciarSaaS.vue";
import ConfigChecklist from "./ConfigChecklist.vue";
import LimpezaBanco from "./LimpezaBanco.vue";
import { useOnboarding } from "../composables/useOnboarding";

const emit = defineEmits(["voltar"]);
const abaAtual = ref("relatorios");
const { iniciarTour } = useOnboarding(ref("admin"), ref(false));

const isSuperAdmin = ref(false);
const carregandoSeguranca = ref(true);

onMounted(async () => {
  carregandoSeguranca.value = true;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.email) {
      const { data, error } = await supabase
        .from("super_admins")
        .select("*")
        .eq("email", session.user.email)
        .maybeSingle();

      if (data && !error) {
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
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 10px;
        "
      >
        <h2 style="margin: 0; color: var(--primary)">Painel de Gestão</h2>
        <div style="display: flex; gap: 10px">
          <button
            @click="iniciarTour"
            class="btn-outline"
            style="
              font-size: 0.8rem;
              color: var(--accent);
              border-color: var(--accent);
              display: flex;
              align-items: center;
              gap: 4px;
            "
          >
            <span class="icon-dinamico" style="font-size: 1rem">lightbulb</span>
            Tutorial
          </button>
        </div>
      </div>

      <div class="admin-tabs">
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'relatorios' }"
          @click="abaAtual = 'relatorios'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">analytics</span>
          Relatórios
        </button>

        <button
          id="tour-catalogo"
          class="btn-tab"
          :class="{ active: abaAtual === 'catalogo' }"
          @click="abaAtual = 'catalogo'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">sell</span>
          Serviços
        </button>

        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'financeiro' }"
          @click="abaAtual = 'financeiro'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >point_of_sale</span
          >
          Caixa
        </button>

        <button
          id="tour-config"
          class="btn-tab"
          :class="{ active: abaAtual === 'config' }"
          @click="abaAtual = 'config'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem">settings</span>
          Oficina
        </button>

        <button
          id="tour-checklist"
          class="btn-tab"
          :class="{ active: abaAtual === 'checklist' }"
          @click="abaAtual = 'checklist'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >fact_check</span
          >
          Checklist
        </button>

        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'conta' }"
          @click="abaAtual = 'conta'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >manage_accounts</span
          >
          Minha Conta
        </button>

        <button
          v-if="isSuperAdmin"
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
          Gestão SaaS
        </button>

        <button
          class="btn-tab text-danger"
          :class="{ active: abaAtual === 'limpeza' }"
          @click="abaAtual = 'limpeza'"
        >
          <span class="icon-dinamico" style="font-size: 1.1rem"
            >delete_sweep</span
          >
          Limpeza
        </button>
      </div>
    </div>

    <div class="admin-content">
      <div v-if="carregandoSeguranca" style="text-align: center; padding: 20px">
        A validar credenciais...
      </div>

      <template v-else>
        <RelatoriosDashboard v-if="abaAtual === 'relatorios'" />
        <CatalogoManager
          v-if="abaAtual === 'catalogo'"
          @voltar="$emit('voltar')"
        />
        <Financeiro
          v-if="abaAtual === 'financeiro'"
          @fechar="$emit('voltar')"
        />
        <Configuracoes v-if="abaAtual === 'config'" />
        <ConfigChecklist v-if="abaAtual === 'checklist'" />

        <MinhaConta v-if="abaAtual === 'conta'" />

        <LimpezaBanco v-if="abaAtual === 'limpeza'" />
        <GerenciarSaaS v-if="abaAtual === 'saas' && isSuperAdmin" />
      </template>
    </div>
  </div>
</template>

<style scoped>
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

  /* Flexbox para alinhar ícone e texto */
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
</style>
