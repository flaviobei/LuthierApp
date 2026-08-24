<script setup>
/**
 * ============================================================================
 * @file        InstrumentoManager.vue
 * @description Gestor de instrumentos técnicos.
 * ATUALIZAÇÃO: Suporte a fotos, observações, afinação e modo de edição.
 * ============================================================================
 */

import { ref, onMounted, watch } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import { comprimirImagem } from "../lib/imageUtils"; // Importamos o compressor de imagens
import { useI18n } from "vue-i18n";

const props = defineProps(["clienteId", "clienteNome"]);
const emit = defineEmits(["fechar", "selecionarInstrumento"]);

const { triggerToast } = useToast();
const { t } = useI18n();

const instrumentos = ref([]);
const loading = ref(false);
const isEditing = ref(false);
const editId = ref(null);
const uploadingFoto = ref(false);
const mostrarModalForm = ref(false);

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
    triggerToast(t('instrumentos.foto_sucesso'), "success");
  } catch (err) {
    triggerToast(t('instrumentos.erro_subir_foto') + err.message, "error");
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
  mostrarModalForm.value = true;
}

function cancelarEdicao() {
  isEditing.value = false;
  editId.value = null;
  mostrarModalForm.value = false;
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
    triggerToast(t('instrumentos.erro_marca_modelo'), "error");
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
      isEditing.value ? t('instrumentos.atualizado') : t('instrumentos.registrado'),
      "success",
    );
    cancelarEdicao();
    buscarInstrumentos();
  } else {
    triggerToast(t('instrumentos.erro_salvar') + erroLocal.message, "error");
  }
}

onMounted(() => buscarInstrumentos());

watch(() => props.clienteId, (newId) => {
  if (newId) buscarInstrumentos();
});
</script>

<template>
  <div class="card">
    <div class="flex-between mb-2">
        <button type="button" class="btn-primary" @click="mostrarModalForm = true; isEditing = false; form = {tipo:'Guitarra', marca:'', modelo:'', numero_serie:'', afinacao:'E Standard', observacoes:'', foto_url:''}">
        <span class="icon-dinamico">add</span> {{ $t('instrumentos.novo_curto') }}
      </button>
    </div>

    <div v-if="instrumentos.length > 0" class="lista-instrumentos mb-2">
      <div
        v-for="inst in instrumentos"
        :key="inst.id"
        class="box mb-1 instrumento-card"
      >
        <div class="inst-content">
          <div v-if="inst.foto_url" class="inst-foto-mini">
            <img :src="inst.foto_url" :alt="$t('instrumentos.alt_foto')" />
          </div>
          <div v-else class="inst-foto-placeholder">
            <span class="icon-dinamico" style="font-size: 2.5rem;">guitar</span>
          </div>

          <div class="inst-dados">
            <strong style="font-size: 1rem; color: var(--text-main); display: block; margin-top: 10px;">
              {{ inst.tipo }}
            </strong>
            <strong style="font-size: 1.1rem; color: var(--primary); display: block;">
              {{ inst.marca }} {{ inst.modelo }}
            </strong>
            
            <div style="margin-top: 8px; font-size: 0.8rem;">
              <div v-if="inst.numero_serie" class="text-muted">
                <strong>{{ $t('instrumentos.label_serie') }}</strong> {{ inst.numero_serie }}
              </div>
              <div class="text-muted">
                <strong>{{ $t('instrumentos.label_afinacao') }}</strong> {{ inst.afinacao_padrao || 'E Standard' }}
              </div>
            </div>

            <p v-if="inst.observacoes" class="inst-obs text-muted" style="font-size: 0.8rem; margin-top: 8px; font-style: italic;">
              <span class="icon-dinamico" style="font-size: 0.8rem">notes</span>
              {{
                inst.observacoes.length > 50
                  ? inst.observacoes.slice(0, 50) + "..."
                  : inst.observacoes
              }}
            </p>
          </div>
        </div>

        <div class="inst-actions">
          <button type="button"
            class="btn-icon bg-light"
            @click="iniciarEdicao(inst)"
            :title="$t('instrumentos.editar')"
            style="border: 1px solid var(--border);"
          >
            <span class="icon-dinamico">edit</span>
          </button>
          <button type="button"
            class="btn-accent"
            @click="$emit('selecionarInstrumento', inst)"
            style="flex: 1;"
          >
            <span class="icon-dinamico" style="font-size: 1.1rem">build</span>
            {{ $t('perfil.coluna_os') }}
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
      {{ $t('instrumentos.nenhum_cadastrado') }}
    </p>

    <!-- MODAL DE INSTRUMENTO -->
    <div v-if="mostrarModalForm" class="modal-overlay" @click.self="cancelarEdicao">
      <div class="modal-content box form-instrumento" :class="{ editando: isEditing }" style="width: 100%; max-width: 500px;">
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
            {{ isEditing ? $t('instrumentos.editar') : $t('instrumentos.novo') }}
          </h4>
          <button type="button"
            class="btn-icon text-danger"
            @click="cancelarEdicao"
            :title="$t('instrumentos.cancelar_edicao')"
          >
            <span class="icon-dinamico">close</span>
          </button>
        </div>

        <div class="form-grid mb-1">
          <div class="form-group">
            <label>{{ $t('instrumentos.label_tipo') }}</label>
            <select v-model="form.tipo">
              <option value="Guitarra">{{ $t('instrumentos.tipos.guitarra') }}</option>
              <option value="Baixo">{{ $t('instrumentos.tipos.baixo') }}</option>
              <option value="Violão">{{ $t('instrumentos.tipos.violao') }}</option>
              <option value="Cavaco">{{ $t('instrumentos.tipos.cavaco') }}</option>
              <option value="Viola">{{ $t('instrumentos.tipos.viola') }}</option>
            </select>
          </div>
          <div class="form-group" style="flex: 2">
            <label>{{ $t('instrumentos.label_marca') }}</label>
            <input v-model="form.marca" :placeholder="$t('instrumentos.placeholder_marca')" />
          </div>
          <div class="form-group" style="flex: 2">
            <label>{{ $t('instrumentos.label_modelo') }}</label>
            <input v-model="form.modelo" :placeholder="$t('instrumentos.placeholder_modelo')" />
          </div>
        </div>

        <div class="form-grid mb-1">
          <div class="form-group" style="flex: 1">
            <label>{{ $t('instrumentos.label_n_serie') }}</label>
            <input v-model="form.numero_serie" :placeholder="$t('instrumentos.placeholder_opcional')" />
          </div>
          <div class="form-group" style="flex: 1">
            <label>{{ $t('instrumentos.label_afinacao_padrao') }}</label>
            <input
              v-model="form.afinacao"
              :placeholder="$t('instrumentos.placeholder_afinacao')"
            />
          </div>
        </div>

        <div class="form-group mb-1">
          <label>{{ $t('instrumentos.label_observacoes') }}</label>
          <textarea
            v-model="form.observacoes"
            rows="2"
            :placeholder="$t('instrumentos.placeholder_observacoes')"
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
            >{{ $t('instrumentos.label_foto') }}</label
          >

          <div v-if="form.foto_url" class="foto-preview">
            <img :src="form.foto_url" alt="Preview" />
            <button type="button"
              class="btn-icon text-danger btn-remove-foto"
              @click="removerFoto"
              :title="$t('instrumentos.remover_foto')"
            >
              <span class="icon-dinamico">delete</span>
            </button>
          </div>

          <label v-else class="btn-outline upload-btn">
            <span class="icon-dinamico">{{
              uploadingFoto ? "hourglass_empty" : "add_a_photo"
            }}</span>
            {{ uploadingFoto ? $t('instrumentos.processando') : $t('instrumentos.anexar_foto') }}
            <input
              type="file"
              accept="image/*"
              @change="uploadFotoInstrumento"
              hidden
              :disabled="uploadingFoto"
            />
          </label>
        </div>

        <button type="button"
          class="btn-primary w-full"
          @click="salvarInstrumento"
          :disabled="loading || uploadingFoto"
          style="justify-content: center;"
        >
          <span class="icon-dinamico">{{
            loading ? "hourglass_empty" : "save"
          }}</span>
          {{
            loading
              ? $t('instrumentos.guardando')
              : isEditing
                ? $t('instrumentos.salvar_alteracoes')
                : $t('instrumentos.cadastrar')
          }}
        </button>
      </div>
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

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 15px;
}
.modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  max-height: 90vh;
  overflow-y: auto;
}

.lista-instrumentos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 15px;
}

.instrumento-card {
  padding: 15px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.inst-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.inst-dados {
  width: 100%;
}

.inst-actions {
  display: flex;
  gap: 8px;
  margin-top: 15px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  width: 100%;
}

.inst-foto-mini,
.inst-foto-placeholder {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid var(--border);
  margin: 0 auto;
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
