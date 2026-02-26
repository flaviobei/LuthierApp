<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import CatalogoManager from "./CatalogoManager.vue";
import Financeiro from "./Financeiro.vue";
import Configuracoes from "./Configuracoes.vue";
import RelatoriosDashboard from "./RelatoriosDashboard.vue";
import MinhaConta from "./MinhaConta.vue";
import ConfigChecklist from "./ConfigChecklist.vue";
import LimpezaBanco from "./LimpezaBanco.vue";
import { useOnboarding } from "../composables/useOnboarding";

const emit = defineEmits(["voltar"]);
const abaAtual = ref("relatorios");
const { iniciarTour } = useOnboarding(ref("admin"), ref(false));

const isSuperAdmin = ref(false);

onMounted(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.email) {
    const { data } = await supabase
      .from("super_admins")
      .select("*")
      .eq("email", session.user.email)
      .maybeSingle();
    if (data) isSuperAdmin.value = true;
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
        <button
          @click="iniciarTour"
          class="btn-outline"
          style="
            font-size: 0.8rem;
            color: var(--accent);
            border-color: var(--accent);
          "
        >
          💡 Ver Tutorial
        </button>
      </div>

      <div class="admin-tabs">
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'relatorios' }"
          @click="abaAtual = 'relatorios'"
        >
          📊 Relatórios
        </button>
        <button
          id="tour-catalogo"
          class="btn-tab"
          :class="{ active: abaAtual === 'catalogo' }"
          @click="abaAtual = 'catalogo'"
        >
          🏷️ Serviços
        </button>
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'financeiro' }"
          @click="abaAtual = 'financeiro'"
        >
          💰 Caixa
        </button>
        <button
          id="tour-config"
          class="btn-tab"
          :class="{ active: abaAtual === 'config' }"
          @click="abaAtual = 'config'"
        >
          ⚙️ Oficina
        </button>
        <button
          id="tour-checklist"
          class="btn-tab"
          :class="{ active: abaAtual === 'checklist' }"
          @click="abaAtual = 'checklist'"
        >
          📋 Checklist
        </button>
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'limpeza' }"
          @click="abaAtual = 'limpeza'"
          style="color: #ef4444"
        >
          🚨 Limpeza
        </button>
      </div>
    </div>

    <div class="admin-content">
      <RelatoriosDashboard v-if="abaAtual === 'relatorios'" />
      <CatalogoManager
        v-if="abaAtual === 'catalogo'"
        @voltar="$emit('voltar')"
      />
      <Financeiro v-if="abaAtual === 'financeiro'" @fechar="$emit('voltar')" />
      <Configuracoes v-if="abaAtual === 'config'" />
      <ConfigChecklist v-if="abaAtual === 'checklist'" />
      <LimpezaBanco v-if="abaAtual === 'limpeza'" />
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
}
.btn-tab.active {
  background: var(--primary);
  color: white;
}
.admin-content {
  margin-top: 20px;
}
</style>
