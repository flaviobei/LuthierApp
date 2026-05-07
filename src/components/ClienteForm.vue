<script setup>
/**
 * ============================================================================
 * @file        ClienteForm.vue
 * @description Gestão de clientes com suporte a endereço de delivery.
 * ============================================================================
 */

import { ref, watch } from "vue";
import { useToast } from "../composables/useToast";
import { clienteService } from "../services/clienteService";

const props = defineProps(["clienteEdit"]);
const emit = defineEmits(["clienteSalvo", "cancelarEdicao"]);

const { triggerToast } = useToast();

// Variável 'endereco' adicionada ao estado do formulário
const form = ref({
  nome: "",
  telefone: "",
  email: "",
  cpf_cnpj: "",
  endereco: "",
});
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
      form.value = {
        nome: newVal.nome || "",
        telefone: newVal.telefone || "",
        email: newVal.email || "",
        cpf_cnpj: newVal.cpf_cnpj || "",
        endereco: newVal.endereco || "", // Carrega o endereço ao editar
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
  form.value = {
    nome: "",
    telefone: "",
    email: "",
    cpf_cnpj: "",
    endereco: "",
  };
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

  try {
    if (isEditing.value) {
      await clienteService.atualizar(currentEditId.value, form.value);
      triggerToast("Cliente atualizado com sucesso!", "success");
    } else {
      await clienteService.criar(form.value);
      triggerToast("Cliente cadastrado com sucesso!", "success");
    }

    resetarFormulario();
    emit("clienteSalvo");
  } catch (error) {
    triggerToast("Falha na operação: " + error.message, "error");
  } finally {
    loading.value = false;
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

      <button type="button"
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
      <label style="display: flex; align-items: center; gap: 5px">
        Endereço (Recolha/Entrega):
      </label>
      <textarea
        v-model="form.endereco"
        rows="3"
        placeholder="Rua, Número, Bairro, Cidade. Pontos de referência..."
        style="
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 10px;
          font-family: inherit;
          resize: vertical;
        "
      ></textarea>
    </div>

    <div class="form-group">
      <label>Email (Opcional):</label>
      <input v-model="form.email" type="email" placeholder="joao@email.com" />
    </div>

    <div class="form-group">
      <label>CPF/CNPJ (Opcional):</label>
      <input v-model="form.cpf_cnpj" type="text" placeholder="000.000.000-00" />
    </div>

    <button type="button"
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
.edit-mode {
  border: 2px solid var(--accent);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}
</style>
