<script setup>
/**
 * ============================================================================
 * @file        ClienteForm.vue
 * @description Componente de gestão de clientes. Responsável pelo cadastro e
 * edição dos proprietários dos instrumentos.
 * ATUALIZAÇÃO: Suporte a Edição de clientes (UPDATE vs INSERT) com ícones.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, watch } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const props = defineProps(["clienteEdit"]);
const emit = defineEmits(["clienteSalvo", "cancelarEdicao"]);

const { triggerToast } = useToast();

const form = ref({ nome: "", telefone: "", email: "", cpf_cnpj: "" });
const loading = ref(false);
const isEditing = ref(false);
const currentEditId = ref(null);

// Monitoriza se o App.vue mandou algum cliente para editar
watch(
  () => props.clienteEdit,
  (newVal) => {
    if (newVal) {
      isEditing.value = true;
      currentEditId.value = newVal.id;
      // Preenche os campos do formulário com os dados do cliente
      form.value = {
        nome: newVal.nome || "",
        telefone: newVal.telefone || "",
        email: newVal.email || "",
        cpf_cnpj: newVal.cpf_cnpj || "",
      };
    } else {
      resetarFormulario();
    }
  },
  { immediate: true },
);

function resetarFormulario() {
  isEditing.value = false;
  currentEditId.value = null;
  form.value = { nome: "", telefone: "", email: "", cpf_cnpj: "" };
}

function cancelar() {
  resetarFormulario();
  emit("cancelarEdicao");
}

async function salvarCliente() {
  if (!form.value.nome) {
    return triggerToast("O nome do cliente é obrigatório!", "error");
  }

  loading.value = true;

  if (isEditing.value) {
    // === LÓGICA DE ATUALIZAÇÃO (UPDATE) ===
    const { error } = await supabase
      .from("clientes")
      .update(form.value)
      .eq("id", currentEditId.value);

    loading.value = false;

    if (error) {
      triggerToast("Erro ao atualizar: " + error.message, "error");
    } else {
      triggerToast("Cliente atualizado com sucesso!", "success");
      resetarFormulario();
      emit("clienteSalvo");
    }
  } else {
    // === LÓGICA DE CRIAÇÃO (INSERT) ===
    const { error } = await supabase.from("clientes").insert([form.value]);

    loading.value = false;

    if (error) {
      triggerToast("Erro ao cadastrar: " + error.message, "error");
    } else {
      triggerToast("Cliente cadastrado com sucesso!", "success");
      resetarFormulario();
      emit("clienteSalvo");
    }
  }
}
</script>

<template>
  <div class="card" :class="{ 'edit-mode': isEditing }">
    <div
      class="flex-between"
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      "
    >
      <h3 class="title-section" style="margin: 0; color: var(--primary)">
        <span class="icon-dinamico" style="vertical-align: middle">
          {{ isEditing ? "manage_accounts" : "person_add" }}
        </span>
        {{ isEditing ? "Editar Cliente" : "Novo Cliente" }}
      </h3>

      <button
        v-if="isEditing"
        @click="cancelar"
        class="btn-icon text-danger"
        title="Cancelar Edição"
      >
        <span class="icon-dinamico">close</span>
      </button>
    </div>

    <div class="form-group">
      <label>Nome Completo:</label>
      <input v-model="form.nome" type="text" placeholder="Ex: João da Silva" />
    </div>

    <div class="form-group">
      <label>WhatsApp:</label>
      <input
        v-model="form.telefone"
        type="text"
        placeholder="(00) 00000-0000"
      />
    </div>

    <div class="form-group">
      <label>Email (Opcional):</label>
      <input v-model="form.email" type="email" placeholder="joao@email.com" />
    </div>

    <div class="form-group">
      <label>CPF/CNPJ (Opcional):</label>
      <input v-model="form.cpf_cnpj" type="text" placeholder="000.000.000-00" />
    </div>

    <button
      class="btn-accent"
      style="
        width: 100%;
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      "
      @click="salvarCliente"
      :disabled="loading"
    >
      <span class="icon-dinamico" style="font-size: 1.1rem">
        {{ loading ? "hourglass_empty" : isEditing ? "save" : "add_circle" }}
      </span>
      {{
        loading
          ? "A guardar..."
          : isEditing
            ? "Salvar Alterações"
            : "Cadastrar Cliente"
      }}
    </button>
  </div>
</template>

<style scoped>
/* Um pequeno destaque na caixa quando o cliente está a ser editado */
.edit-mode {
  border: 2px solid var(--accent);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}
</style>
