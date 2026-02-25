<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import CatalogoManager from "./CatalogoManager.vue";
import Financeiro from "./Financeiro.vue";
import Configuracoes from "./Configuracoes.vue";
import RelatoriosDashboard from "./RelatoriosDashboard.vue";
import MinhaConta from "./MinhaConta.vue";
import GerenciarSaaS from "./GerenciarSaaS.vue"; // NOVO IMPORT

const emit = defineEmits(["voltar"]);
const abaAtual = ref("relatorios");

// Verificação de segurança VIP
const isSuperAdmin = ref(false);

onMounted(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.email) {
    // Pergunta à base de dados se este e-mail está na tabela de donos
    const { data } = await supabase
      .from("super_admins")
      .select("*")
      .eq("email", session.user.email)
      .maybeSingle();
    if (data) {
      isSuperAdmin.value = true;
    }
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
        <h2 style="margin: 0; color: var(--primary)">
          Painel de Administração da Oficina
        </h2>
        <button class="btn-outline" @click="$emit('voltar')">
          🚪 Voltar à Bancada
        </button>
      </div>

      <div class="admin-tabs">
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'relatorios' }"
          @click="abaAtual = 'relatorios'"
        >
          📊 Visão Geral
        </button>
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'catalogo' }"
          @click="abaAtual = 'catalogo'"
        >
          🏷️ Catálogo & Fichas
        </button>
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'financeiro' }"
          @click="abaAtual = 'financeiro'"
        >
          💰 Caixa & Relatórios
        </button>
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'config' }"
          @click="abaAtual = 'config'"
        >
          ⚙️ Oficina
        </button>
        <button
          class="btn-tab"
          :class="{ active: abaAtual === 'conta' }"
          @click="abaAtual = 'conta'"
        >
          🔐 Minha Conta
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
          👑 Gestão SaaS (Master)
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
      <MinhaConta v-if="abaAtual === 'conta'" />

      <GerenciarSaaS v-if="abaAtual === 'saas' && isSuperAdmin" />
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
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.95rem;
  transition: 0.2s;
}
.btn-tab:hover {
  background: #e2e6ea;
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
