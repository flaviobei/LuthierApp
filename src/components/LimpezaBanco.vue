<script setup>
/**
 * ============================================================================
 * @file        LimpezaBanco.vue
 * @description Módulo de segurança ("Zona de Perigo") para eliminação de dados
 * em massa e injetor de dados de demonstração (Semeador).
 * ============================================================================
 */

import { ref, computed } from "vue";
import { supabase } from "../lib/supabaseClient";
import PopularContaDemo from "./PopularContaDemo.vue";

const textoConfirmacao = ref("");
const statusMensagem = ref("");
const processando = ref(false);

const podeLimpar = computed(() => textoConfirmacao.value === "LIMPAR");

// Função blindada: tenta apagar os dados do utilizador
async function apagarTabela(nomeTabela) {
  const { data, error } = await supabase.from(nomeTabela).select("id");

  if (error) {
    if (
      error.message &&
      (error.message.includes("schema cache") ||
        error.message.includes("does not exist"))
    ) {
      console.warn(`A tabela '${nomeTabela}' não existe. Ignorando...`);
      return;
    }
    throw error;
  }

  if (data && data.length > 0) {
    const idsParaApagar = data.map((item) => item.id);
    const { error: errDelete } = await supabase
      .from(nomeTabela)
      .delete()
      .in("id", idsParaApagar);
    if (errDelete) throw errDelete;
  }
}

async function apagarDados(tipo) {
  if (!podeLimpar.value) return;
  processando.value = true;
  statusMensagem.value = "A procurar e apagar os seus dados com segurança...";

  try {
    // ====================================================================
    // ORDEM RIGOROSA DE EXCLUSÃO (Para evitar bloqueios de Chave Estrangeira)
    // Apagamos sempre os "Filhos" antes dos "Pais".
    // ====================================================================

    // 1. FINANCEIRO
    if (tipo === "financeiro" || tipo === "os" || tipo === "tudo") {
      await apagarTabela("transacoes");
      await apagarTabela("fluxo_caixa");
      await apagarTabela("caixa");
      await apagarTabela("financeiro");
    }

    // 2. ORDENS DE SERVIÇO E DETALHES
    if (tipo === "os" || tipo === "tudo") {
      await apagarTabela("orcamento_itens");
      await apagarTabela("itens_servico");
      await apagarTabela("checklist");
      await apagarTabela("checklist_servico");
      await apagarTabela("checklist_fotos");
      await apagarTabela("diario_servico");
      await apagarTabela("servicos");
    }

    // 3. INSTRUMENTOS
    if (tipo === "instrumentos" || tipo === "tudo") {
      await apagarTabela("instrumentos");
    }

    // 4. CLIENTES
    if (tipo === "clientes" || tipo === "tudo") {
      await apagarTabela("clientes");
    }

    // 5. CATÁLOGO (Peças, Insumos, Serviços e Receitas)
    if (tipo === "catalogo" || tipo === "tudo") {
      await apagarTabela("catalogo");
    }

    // MENSAGENS DE SUCESSO
    if (tipo === "financeiro")
      statusMensagem.value = "As suas Movimentações Financeiras foram zeradas.";
    else if (tipo === "os")
      statusMensagem.value =
        "As suas Ordens de Serviço e históricos foram apagados.";
    else if (tipo === "instrumentos")
      statusMensagem.value = "Os seus Instrumentos foram apagados.";
    else if (tipo === "clientes")
      statusMensagem.value = "Os seus Clientes foram apagados.";
    else if (tipo === "catalogo")
      statusMensagem.value =
        "O seu Catálogo (Peças, Insumos e Serviços) foi apagado.";
    else if (tipo === "tudo")
      statusMensagem.value =
        "BASE ZERADA COM SUCESSO. A sua conta está limpa e pronta para começar!";

    textoConfirmacao.value = "";
  } catch (err) {
    statusMensagem.value = "Erro ao apagar: " + err.message;
    console.error(err);
  }

  processando.value = false;
}
</script>

<template>
  <div class="admin-limpeza-container">
    <PopularContaDemo />

    <div
      class="card"
      style="text-align: left; border: 2px solid #ef4444; margin-top: 20px"
    >
      <div
        style="
          background: #fef2f2;
          padding: 20px;
          border-radius: 8px;
          border-bottom: 1px solid #fee2e2;
        "
      >
        <h3
          style="
            margin-top: 0;
            color: var(--danger);
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">warning</span> Zona de Perigo - Limpeza de
          Banco de Dados
        </h3>
        <p class="text-danger">
          Esta área permite-lhe apagar os <strong>seus registos</strong> em
          massa para limpar testes ou começar a oficina do zero.
          <strong>Esta ação é irreversível.</strong> <br />As configurações
          visuais e taxas da oficina não serão afetadas.
        </p>

        <div
          style="
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #fca5a5;
            display: inline-block;
            margin-top: 10px;
          "
        >
          <label class="text-danger" style="font-weight: bold"
            >Digite a palavra LIMPAR em maiúsculas para desbloquear os
            botões:</label
          ><br />
          <input
            v-model="textoConfirmacao"
            placeholder="Digite LIMPAR"
            style="
              margin-top: 8px;
              padding: 10px;
              border: 2px solid #fca5a5;
              border-radius: 4px;
              font-weight: bold;
              width: 200px;
            "
          />
        </div>
      </div>

      <div
        style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 20px;
        "
      >
        <button
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('os')"
        >
          <span class="icon-dinamico">cleaning_services</span> 1. Limpar Apenas
          Ordens de Serviço
        </button>
        <button
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('instrumentos')"
        >
          <span class="icon-dinamico">music_note</span> 2. Limpar Todos
          Instrumentos
        </button>
        <button
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('financeiro')"
        >
          <span class="icon-dinamico">money_off</span> 3. Limpar Movimentações
          Financeiras
        </button>
        <button
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('clientes')"
        >
          <span class="icon-dinamico">group_remove</span> 4. Limpar Base de
          Clientes
        </button>

        <button
          class="btn-clean"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('catalogo')"
          style="grid-column: 1 / -1"
        >
          <span class="icon-dinamico">inventory_2</span> 5. Limpar Catálogo
          (Peças, Insumos e Serviços)
        </button>

        <button
          class="btn-clean btn-nuke"
          :disabled="!podeLimpar || processando"
          @click="apagarDados('tudo')"
          style="grid-column: 1 / -1; margin-top: 10px"
        >
          <span class="icon-dinamico">delete_forever</span> APAGAR TUDO (O.S,
          Instrumentos, Financeiro, Clientes e Catálogo)
        </button>
      </div>

      <div
        v-if="statusMensagem"
        style="
          margin-top: 20px;
          padding: 15px;
          border-radius: 6px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 10px;
        "
        :style="{
          background: statusMensagem.includes('Erro') ? '#fef2f2' : '#333',
          color: statusMensagem.includes('Erro') ? '#b91c1c' : '#fff',
        }"
      >
        <span
          class="icon-dinamico"
          :style="{
            animation: processando ? 'spin 1s linear infinite' : 'none',
          }"
        >
          {{
            processando
              ? "sync"
              : statusMensagem.includes("Erro")
                ? "error"
                : "check_circle"
          }}
        </span>
        {{ statusMensagem }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-limpeza-container {
  display: flex;
  flex-direction: column;
}

.btn-clean {
  padding: 15px;
  border-radius: 6px;
  font-weight: bold;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
  transition: 0.3s;
  width: 100%;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-clean:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f0f0f0;
  border-color: #ddd;
  color: #999;
}

.btn-clean:not(:disabled):hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #b91c1c;
}

.btn-nuke:not(:disabled) {
  background: #ef4444;
  color: white;
  border-color: #b91c1c;
  font-size: 1.1rem;
}

.btn-nuke:not(:disabled):hover {
  background: #dc2626;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .card > div:nth-child(2) > div:nth-child(2) {
    grid-template-columns: 1fr !important;
  }
}
</style>
