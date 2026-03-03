<script setup>
/**
 * ============================================================================
 * @file        InstrumentoManager.vue
 * @description Gestor de instrumentos técnicos.
 * ATUALIZAÇÃO: Suporte a fotos, observações, afinação e modo de edição.
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import { comprimirImagem } from "../lib/imageUtils"; // Importamos o compressor de imagens

const props = defineProps(["clienteId", "clienteNome"]);
const emit = defineEmits(["fechar", "selecionarInstrumento"]);

const { triggerToast } = useToast();

const instrumentos = ref([]);
const loading = ref(false);
const isEditing = ref(false);
const editId = ref(null);
const uploadingFoto = ref(false);

const form = ref({
  tipo: "Guitarra",
  marca: "",
  modelo: "",
  numero_serie: "",
  afinacao: "E Standard",
  observacoes: "",
  foto_url: "",
});

async function buscarInstrumentos() {
  const { data } = await supabase
    .from("instrumentos")
    .select("*")
    .eq("cliente_id", props.clienteId)
    .order("created_at", { ascending: false });
  if (data) instrumentos.value = data;
}

// --- FUNÇÕES DE FOTO ---
async function uploadFotoInstrumento(event) {
  const arquivoOriginal = event.target.files[0];
  if (!arquivoOriginal) return;

  uploadingFoto.value = true;
  try {
    const arquivoComprimido = await comprimirImagem(
      arquivoOriginal,
      1200,
      1200,
      0.8,
    );
    const fileName = `instrumentos/${props.clienteId}_${Date.now()}.jpg`;

    // Reutilizamos o bucket 'fotos-luthieria' que você já tem
    const { error: uploadError } = await supabase.storage
      .from("fotos-luthieria")
      .upload(fileName, arquivoComprimido);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("fotos-luthieria")
      .getPublicUrl(fileName);

    form.value.foto_url = urlData.publicUrl;
    triggerToast("Foto anexada com sucesso!", "success");
  } catch (err) {
    triggerToast("Erro ao subir foto: " + err.message, "error");
  } finally {
    uploadingFoto.value = false;
  }
}

function removerFoto() {
  form.value.foto_url = "";
}

// --- FUNÇÕES DE EDIÇÃO ---
function iniciarEdicao(inst) {
  isEditing.value = true;
  editId.value = inst.id;
  form.value = {
    tipo: inst.tipo || "Guitarra",
    marca: inst.marca || "",
    modelo: inst.modelo || "",
    numero_serie: inst.numero_serie || "",
    afinacao: inst.afinacao_padrao || "E Standard",
    observacoes: inst.observacoes || "",
    foto_url: inst.foto_url || "",
  };
}

function cancelarEdicao() {
  isEditing.value = false;
  editId.value = null;
  form.value = {
    tipo: "Guitarra",
    marca: "",
    modelo: "",
    numero_serie: "",
    afinacao: "E Standard",
    observacoes: "",
    foto_url: "",
  };
}

// --- SALVAR (CRIAÇÃO OU EDIÇÃO) ---
async function salvarInstrumento() {
  if (!form.value.marca || !form.value.modelo) {
    triggerToast("Preencha a marca e o modelo do instrumento.", "error");
    return;
  }

  loading.value = true;

  const payload = {
    cliente_id: props.clienteId,
    tipo: form.value.tipo,
    marca: form.value.marca,
    modelo: form.value.modelo,
    numero_serie: form.value.numero_serie,
    afinacao_padrao: form.value.afinacao,
    observacoes: form.value.observacoes,
    foto_url: form.value.foto_url,
  };

  let erroLocal = null;

  if (isEditing.value) {
    // Atualiza existente
    const { error } = await supabase
      .from("instrumentos")
      .update(payload)
      .eq("id", editId.value);
    erroLocal = error;
  } else {
    // Insere novo
    const { error } = await supabase.from("instrumentos").insert([payload]);
    erroLocal = error;
  }

  loading.value = false;

  if (!erroLocal) {
    triggerToast(
      isEditing.value ? "Instrumento atualizado!" : "Instrumento registado!",
      "success",
    );
    cancelarEdicao();
    buscarInstrumentos();
  } else {
    triggerToast("Erro ao guardar instrumento: " + erroLocal.message, "error");
  }
}

onMounted(() => buscarInstrumentos());
</script>

<template>
  <div class="card">
    <div class="flex-between mb-2">
      <h3
        class="title-section"
        style="
          margin: 0;
          border: none;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">music_note</span> Instrumentos de:
        {{ clienteNome }}
      </h3>
    </div>

    <div v-if="instrumentos.length > 0" class="lista-instrumentos mb-2">
      <div
        v-for="inst in instrumentos"
        :key="inst.id"
        class="box mb-1 instrumento-card"
      >
        <div
          class="inst-content"
          style="display: flex; gap: 15px; flex-wrap: wrap"
        >
          <div v-if="inst.foto_url" class="inst-foto-mini">
            <img :src="inst.foto_url" alt="Foto do instrumento" />
          </div>
          <div v-else class="inst-foto-placeholder">
            <span class="icon-dinamico">guitar</span>
          </div>

          <div class="inst-dados" style="flex: 1; min-width: 200px">
            <strong style="font-size: 1.15rem; color: var(--primary)">
              {{ inst.tipo }} {{ inst.marca }} {{ inst.modelo }}
            </strong>
            <div
              style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 4px"
            >
              <small class="text-muted"
                ><strong style="color: var(--text-main)">Série:</strong>
                {{ inst.numero_serie || "N/A" }}</small
              >
              <small class="text-muted"
                ><strong style="color: var(--text-main)">Afinação:</strong>
                {{ inst.afinacao_padrao || "Padrão" }}</small
              >
            </div>

            <p v-if="inst.observacoes" class="inst-obs">
              <span class="icon-dinamico" style="font-size: 0.9rem">notes</span>
              {{
                inst.observacoes.length > 80
                  ? inst.observacoes.slice(0, 80) + "..."
                  : inst.observacoes
              }}
            </p>
          </div>
        </div>

        <div
          class="inst-actions"
          style="
            display: flex;
            gap: 8px;
            margin-top: 15px;
            border-top: 1px solid var(--border);
            padding-top: 10px;
          "
        >
          <button
            class="btn-icon bg-light"
            @click="iniciarEdicao(inst)"
            title="Editar Instrumento"
            style="border: 1px solid var(--border)"
          >
            <span class="icon-dinamico">edit</span>
          </button>
          <button
            class="btn-accent"
            @click="$emit('selecionarInstrumento', inst)"
            style="flex: 1"
          >
            <span class="icon-dinamico" style="font-size: 1.1rem">build</span>
            Abrir Serviço (O.S.)
          </button>
        </div>
      </div>
    </div>
    <p
      v-else
      class="text-muted text-center"
      style="
        margin-bottom: 20px;
        padding: 20px;
        background: #f8fafc;
        border-radius: 8px;
      "
    >
      Nenhum instrumento cadastrado para este cliente.
    </p>

    <div class="box form-instrumento" :class="{ editando: isEditing }">
      <div class="flex-between mb-2">
        <h4
          style="
            margin: 0;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">{{
            isEditing ? "edit_square" : "add_circle"
          }}</span>
          {{ isEditing ? "Editar Instrumento" : "Novo Instrumento" }}
        </h4>
        <button
          v-if="isEditing"
          class="btn-icon text-danger"
          @click="cancelarEdicao"
          title="Cancelar Edição"
        >
          <span class="icon-dinamico">close</span>
        </button>
      </div>

      <div class="form-grid mb-1">
        <div class="form-group">
          <label>Tipo</label>
          <select v-model="form.tipo">
            <option>Guitarra</option>
            <option>Baixo</option>
            <option>Violão</option>
            <option>Cavaco</option>
            <option>Viola</option>
          </select>
        </div>
        <div class="form-group" style="flex: 2">
          <label>Marca *</label>
          <input v-model="form.marca" placeholder="Ex: Fender, Tagima..." />
        </div>
        <div class="form-group" style="flex: 2">
          <label>Modelo *</label>
          <input v-model="form.modelo" placeholder="Ex: Stratocaster, JB..." />
        </div>
      </div>

      <div class="form-grid mb-1">
        <div class="form-group" style="flex: 1">
          <label>Nº de Série</label>
          <input v-model="form.numero_serie" placeholder="Opcional" />
        </div>
        <div class="form-group" style="flex: 1">
          <label>Afinação Padrão</label>
          <input
            v-model="form.afinacao"
            placeholder="Ex: E Standard, Drop D..."
          />
        </div>
      </div>

      <div class="form-group mb-1">
        <label>Observações / Especificidades do Instrumento</label>
        <textarea
          v-model="form.observacoes"
          rows="2"
          placeholder="Histórico de pancadas, calibre de corda favorito, elétrica específica..."
        ></textarea>
      </div>

      <div class="foto-upload-area mb-2">
        <label
          style="
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--text-muted);
            font-size: 0.85rem;
          "
          >Foto de Identificação</label
        >

        <div v-if="form.foto_url" class="foto-preview">
          <img :src="form.foto_url" alt="Preview" />
          <button
            class="btn-icon text-danger btn-remove-foto"
            @click="removerFoto"
            title="Remover Foto"
          >
            <span class="icon-dinamico">delete</span>
          </button>
        </div>

        <label v-else class="btn-outline upload-btn">
          <span class="icon-dinamico">{{
            uploadingFoto ? "hourglass_empty" : "add_a_photo"
          }}</span>
          {{ uploadingFoto ? "A processar..." : "Anexar Foto do Instrumento" }}
          <input
            type="file"
            accept="image/*"
            @change="uploadFotoInstrumento"
            hidden
            :disabled="uploadingFoto"
          />
        </label>
      </div>

      <button
        class="btn-primary w-full"
        @click="salvarInstrumento"
        :disabled="loading || uploadingFoto"
      >
        <span class="icon-dinamico">{{
          loading ? "hourglass_empty" : "save"
        }}</span>
        {{
          loading
            ? "A guardar..."
            : isEditing
              ? "Salvar Alterações"
              : "Cadastrar Instrumento"
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.form-instrumento {
  background: var(--bg-body);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}
.form-instrumento.editando {
  background: #fffdfa;
  border-color: var(--accent);
  box-shadow: 0 4px 15px rgba(211, 84, 0, 0.1);
}

.form-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.form-grid .form-group {
  margin-bottom: 5px;
  flex: 1;
  min-width: 120px;
}

.instrumento-card {
  padding: 15px;
}
.inst-foto-mini,
.inst-foto-placeholder {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
}
.inst-foto-mini img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.inst-foto-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #cbd5e1;
}
.inst-foto-placeholder .icon-dinamico {
  font-size: 2rem;
}

.inst-obs {
  margin: 8px 0 0 0;
  font-size: 0.85rem;
  color: #64748b;
  font-style: italic;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

/* Área de Upload de Foto */
.foto-upload-area {
  background: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px dashed var(--border);
}
.foto-preview {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.foto-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.btn-remove-foto {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.upload-btn {
  width: 100%;
  border-style: dashed;
  cursor: pointer;
  display: flex;
  justify-content: center;
}
</style>
