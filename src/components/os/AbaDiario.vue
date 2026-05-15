<script setup>
/**
 * ============================================================================
 * @file        AbaDiario.vue
 * @description Sub-componente responsável pelo histórico da bancada (anotações e fotos).
 * ============================================================================
 */
import { ref, onMounted } from "vue";
import { supabase } from "../../lib/supabaseClient";
import { comprimirImagem } from "../../lib/imageUtils";
import { useToast } from "../../composables/useToast";
import { useI18n } from "vue-i18n";

const props = defineProps({
  servico: Object,
  osFinalizada: Boolean,
});

// O emit serve para avisar o Pai que a "Fase do Projeto" mudou e precisa ser atualizada no título
const emit = defineEmits(["faseAtualizada"]);
const { triggerToast } = useToast();
const { t } = useI18n();

const diario = ref([]);
function getLocalDatetime() {
  return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const novaEntradaDiario = ref({
  descricao: "",
  fase_projeto: props.servico.fase_projeto || "Na Bancada",
  data_registro: getLocalDatetime(),
});
const fotoDiarioUpload = ref(null);
const carregandoFotoDiario = ref(false);

const fasesPermitidas = [
  "Fila de Espera",
  "Aguardando Peças",
  "Secagem / Cura",
  "Na Bancada",
  "Testes / Setup",
  "Pronto para Entrega",
];

async function carregarDiario() {
  try {
    const { data } = await supabase
      .from("diario_servico")
      .select("*")
      .eq("servico_id", props.servico.id)
      .order("data_registro", { ascending: false });
    diario.value = data || [];
  } catch (e) {
    console.error("Erro ao carregar diário", e);
  }
}

function setFotoDiario(event) {
  fotoDiarioUpload.value = event.target.files[0];
}

async function adicionarEntradaDiario() {
  if (!novaEntradaDiario.value.descricao) {
    return triggerToast(t('os.diario_erro_vazio'), "error");
  }
  carregandoFotoDiario.value = true;
  let urlFotoDiario = null;
  try {
    if (fotoDiarioUpload.value) {
      const arquivoComprimido = await comprimirImagem(
        fotoDiarioUpload.value,
        1200,
        1200,
        0.8,
      );
      const fileName = `${props.servico.id}/diario_${Date.now()}.jpg`;
      await supabase.storage
        .from("fotos-luthieria")
        .upload(fileName, arquivoComprimido);
      urlFotoDiario = supabase.storage
        .from("fotos-luthieria")
        .getPublicUrl(fileName).data.publicUrl;
    }

    const payload = {
      servico_id: props.servico.id,
      descricao: novaEntradaDiario.value.descricao,
      fase_projeto: novaEntradaDiario.value.fase_projeto,
      foto_url: urlFotoDiario,
      data_registro: novaEntradaDiario.value.data_registro
        ? new Date(novaEntradaDiario.value.data_registro).toISOString()
        : new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("diario_servico")
      .insert([payload])
      .select();

    if (error) throw error;

    if (data) {
      diario.value.unshift(data[0]);
      diario.value.sort(
        (a, b) => new Date(b.data_registro) - new Date(a.data_registro),
      );

      // Atualiza a fase no banco de dados
      await supabase
        .from("servicos")
        .update({ fase_projeto: novaEntradaDiario.value.fase_projeto })
        .eq("id", props.servico.id);

      // Avisa o ExecucaoServico.vue (Pai) que a fase mudou!
      emit("faseAtualizada", novaEntradaDiario.value.fase_projeto);

      novaEntradaDiario.value.descricao = "";
      novaEntradaDiario.value.data_registro = getLocalDatetime();
      fotoDiarioUpload.value = null;
      triggerToast(t('os.diario_sucesso'), "success");
    }
  } catch (err) {
    triggerToast(t('os.diario_erro_geral') + err.message, "error");
  } finally {
    carregandoFotoDiario.value = false;
  }
}

onMounted(() => carregarDiario());
</script>

<template>
  <div>
    <div class="card mb-2" v-if="!osFinalizada">
      <h4 style="margin-top: 0">
        <span class="icon-dinamico" style="vertical-align: middle"
          >edit_note</span
        >
        {{ $t('os.diario_nova_anotacao') }}
      </h4>
      <textarea
        v-model="novaEntradaDiario.descricao"
        rows="2"
        :placeholder="$t('os.diario_placeholder')"
      ></textarea>

      <div class="flex-gap-10 mt-1" style="flex-wrap: wrap">
        <input
          type="datetime-local"
          v-model="novaEntradaDiario.data_registro"
          class="flex-1"
          style="min-width: 120px"
          :title="$t('os.diario_data_hora_tooltip')"
        />

        <select
          v-model="novaEntradaDiario.fase_projeto"
          class="flex-1 min-w-140"
        >
          <option v-for="fase in fasesPermitidas" :key="fase" :value="fase">
            {{ fase }}
          </option>
        </select>

        <label
          class="btn-outline"
          style="cursor: pointer; padding: 0 15px; font-size: 0.85rem"
          :title="fotoDiarioUpload ? $t('os.diario_foto_pronta_tooltip') : $t('os.diario_anexar_foto_tooltip')"
        >
          <span
            class="icon-dinamico"
            style="vertical-align: middle; font-size: 1rem"
          >
            {{ fotoDiarioUpload ? "check_circle" : "add_a_photo" }}
          </span>
          {{ fotoDiarioUpload ? $t('os.diario_foto_pronta') : $t('os.diario_juntar_foto') }}
          <input type="file" accept="image/*" @change="setFotoDiario" hidden />
        </label>

        <button type="button"
          class="btn-primary"
          @click="adicionarEntradaDiario"
          :disabled="carregandoFotoDiario"
        >
          {{ carregandoFotoDiario ? $t('os.diario_enviando') : $t('os.diario_salvar') }}
        </button>
      </div>
    </div>

    <div class="card">
      <h4 class="title-section">
        <span class="icon-dinamico" style="vertical-align: middle"
          >history</span
        >
        {{ $t('os.diario_historico') }}
      </h4>
      <div v-if="diario.length === 0" class="text-muted">
        {{ $t('os.diario_nenhuma') }}
      </div>
      <div class="timeline">
        <div v-for="nota in diario" :key="nota.id" class="timeline-item">
          <div class="timeline-date">
            <span class="icon-dinamico" style="font-size: 1rem">event</span>
            {{
              new Date(
                nota.data_registro +
                  (nota.data_registro.includes("T") ? "" : "T12:00:00"),
              ).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
            }}
          </div>
          <div class="timeline-content">
            <span class="badge-fase">{{ nota.fase_projeto }}</span>
            <p>{{ nota.descricao }}</p>
            <a v-if="nota.foto_url" :href="nota.foto_url" target="_blank">
              <img
                :src="nota.foto_url"
                style="
                  max-height: 80px;
                  margin-top: 10px;
                  border-radius: 4px;
                  border: 1px solid var(--border);
                "
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  gap: 15px;
  border-left: 2px solid var(--border);
  margin-left: 10px;
  padding-left: 15px;
}
.timeline-item {
  position: relative;
}
.timeline-item::before {
  content: "";
  position: absolute;
  left: -21px;
  top: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid white;
}
.timeline-date {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: bold;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.timeline-content {
  background: #f8fafc;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.badge-fase {
  display: inline-block;
  background: var(--primary);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  margin-bottom: 5px;
}
</style>
