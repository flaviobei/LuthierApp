<script setup>
/**
 * ============================================================================
 * @file        LimpezaBanco.vue
 * @description Módulo de segurança ("Zona de Perigo") para eliminação de dados
 * em massa. Permite que o luthier limpe testes ou recomece a base de dados.
 * ATUALIZAÇÃO: Padronização de botões e ícones dinâmicos.
 * @project     LuthierApp
 * ============================================================================
 * @dependencies
 * - supabaseClient: Executa comandos DELETE filtrados por ID.
 * * @functions
 * - apagarTabela(): Função genérica que busca IDs do utilizador logado e os remove,
 * respeitando as políticas de segurança (RLS).
 * - apagarDados(): Orquestra a limpeza por categorias (Só O.S., Só Financeiro ou Tudo).
 * * @notes
 * - Segurança: Exige que o utilizador escreva a palavra "LIMPAR" para ativar os botões.
 * - Integridade: Apaga os dados numa ordem específica para não quebrar chaves estrangeiras.
 * - Multi-tabela: Tenta limpar variações de nomes de tabelas (ex: financeiro/transacoes).
 * ============================================================================
 */

import { ref, computed } from "vue";
import { supabase } from "../lib/supabaseClient";

const textoConfirmacao = ref("");
const statusMensagem = ref("");
const processando = ref(false);

const podeLimpar = computed(() => textoConfirmacao.value === "LIMPAR");

// Função blindada: tenta apagar os dados do utilizador, mas se a tabela não existe, ignora suavemente
async function apagarTabela(nomeTabela) {
  const { data, error } = await supabase.from(nomeTabela).select("id");

  // Se der erro porque a tabela não existe (capturando a mensagem exata do Supabase)
  if (error) {
    if (
      error.message &&
      (error.message.includes("schema cache") ||
        error.message.includes("does not exist"))
    ) {
      console.warn(
        `A tabela '${nomeTabela}' não existe no banco de dados. Ignorando...`,
      );
      return; // Sai da função sem quebrar o sistema
    }
    throw error; // Se for outro erro grave (ex: sem internet), ele avisa
  }

  // Se encontrou dados, apaga APENAS os IDs do utilizador atual
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
    // 1. ORDENS DE SERVIÇO
    if (tipo === "os" || tipo === "tudo") {
      await apagarTabela("itens_servico");
      await apagarTabela("diario_servico");
      await apagarTabela("checklist_servico");
      await apagarTabela("checklist_fotos");
      await apagarTabela("servicos");
      statusMensagem.value =
        "As suas Ordens de Serviço e históricos foram apagados.";
    }

    // 2. INSTRUMENTOS
    if (tipo === "instrumentos" || tipo === "tudo") {
      await apagarTabela("instrumentos");
      statusMensagem.value = "Os seus Instrumentos foram apagados.";
    }

    // 3. FINANCEIRO (Tenta as nomenclaturas mais prováveis)
    if (tipo === "financeiro" || tipo === "tudo") {
      await apagarTabela("financeiro");
      await apagarTabela("fluxo_caixa");
      await apagarTabela("caixa");
      await apagarTabela("transacoes");
      statusMensagem.value = "As suas Movimentações Financeiras foram zeradas.";
    }

    // 4. CLIENTES E RESET TOTAL
    if (tipo === "clientes" || tipo === "tudo") {
      await apagarTabela("clientes");
      statusMensagem.value =
        tipo === "tudo"
          ? "BASE ZERADA COM SUCESSO. A sua conta está limpa e pronta para começar!"
          : "Os seus Clientes foram apagados.";
    }

    textoConfirmacao.value = "";
  } catch (err) {
    statusMensagem.value = "Erro ao apagar: " + err.message;
  }

  processando.value = false;
}
</script>

<template>
  <div class="card" style="text-align: left; border: 2px solid #ef4444">
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
          color: #b91c1c;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">warning</span> Zona de Perigo - Limpeza de
        Banco de Dados
      </h3>
      <p style="color: #991b1b">
        Esta área permite-lhe apagar os <strong>seus registos</strong> em massa
        para limpar testes ou começar a oficina do zero.
        <strong>Esta ação é irreversível.</strong> <br />Os serviços/produtos do
        catálogo e configurações não serão afetados.
      </p>

      <div
        style="
          background: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #fca5a5;
          display: inline-block;
        "
      >
        <label style="font-weight: bold; color: #7f1d1d"
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
        Clientes (Cuidado!)
      </button>

      <button
        class="btn-clean btn-nuke"
        :disabled="!podeLimpar || processando"
        @click="apagarDados('tudo')"
        style="grid-column: 1 / -1"
      >
        <span class="icon-dinamico">delete_forever</span> APAGAR TUDO (O.S,
        Instrumentos, Financeiro e Clientes)
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
        :style="{ animation: processando ? 'spin 1s linear infinite' : 'none' }"
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
</template>

<style scoped>
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

  /* Flexbox para alinhamento perfeito do ícone e texto */
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
  .card > div:nth-child(2) {
    grid-template-columns: 1fr !important;
  }
}
</style>
