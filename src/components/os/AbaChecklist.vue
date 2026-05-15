<script setup>
/**
 * ============================================================================
 * @file        AbaChecklist.vue
 * @description Sub-componente responsável pela aba de Checklist e Evidências.
 * ============================================================================
 */
import { ref, computed, onMounted } from "vue";
import { supabase } from "../../lib/supabaseClient";
import { comprimirImagem } from "../../lib/imageUtils";
import { useToast } from "../../composables/useToast";
import { useI18n } from "vue-i18n";

const props = defineProps({
  servico: Object,
  osFinalizada: Boolean,
});

const emit = defineEmits(["observacaoSalva"]);
const { triggerToast } = useToast();
const { t } = useI18n();

const checklistItens = ref([]);
const fotosChecklist = ref([]);
const carregandoFoto = ref(false);
const idFotoConfirmar = ref(null);
const obsChecklistLocal = ref(props.servico.obs_checklist || "");

async function carregarChecklist() {
  try {
    const { data: itensOS, error: errOS } = await supabase
      .from("checklist")
      .select("*")
      .eq("servico_id", props.servico.id)
      .order("id", { ascending: true });
    if (errOS) throw errOS;

    if (itensOS && itensOS.length > 0) {
      checklistItens.value = itensOS;
      return;
    }

    const { data: padrao, error: errPadrao } = await supabase
      .from("checklist_padrao")
      .select("*");
    if (errPadrao) throw errPadrao;

    if (padrao && padrao.length > 0) {
      const novosItens = padrao.map((p) => ({
        servico_id: props.servico.id,
        etapa: p.tipo || "Geral",
        area: p.item_nome || "Item sem nome",
        condicao: "Pendente",
        observacao: "",
      }));
      const { data: inseridos, error: errInsert } = await supabase
        .from("checklist")
        .insert(novosItens)
        .select();
      if (errInsert) throw errInsert;
      checklistItens.value = inseridos || [];
    } else {
      checklistItens.value = [];
    }
  } catch (error) {
    triggerToast(t('os.checklist_erro_carregar') + error.message, "error");
  }
}

// NOVA FUNÇÃO: Sincroniza regras novas sem apagar as antigas
async function sincronizarChecklist() {
  try {
    triggerToast(t('os.checklist_verificar_regras'), "info");

    // 1. Puxa o padrão atual do painel Admin
    const { data: padrao, error: errPadrao } = await supabase
      .from("checklist_padrao")
      .select("*");
    if (errPadrao) throw errPadrao;

    if (!padrao || padrao.length === 0) {
      return triggerToast(
        t('os.checklist_sem_regras_padrao'),
        "warning",
      );
    }

    // 2. Descobre o que falta nesta O.S. comparando os nomes das áreas
    const areasAtuais = checklistItens.value.map((i) => i.area);
    const novosItens = padrao
      .filter((p) => !areasAtuais.includes(p.item_nome))
      .map((p) => ({
        servico_id: props.servico.id,
        etapa: p.tipo || "Geral",
        area: p.item_nome || "Item sem nome",
        condicao: "Pendente",
        observacao: "",
      }));

    // 3. Se não houver nada novo, avisa e para
    if (novosItens.length === 0) {
      return triggerToast(
        t('os.checklist_atualizado'),
        "success",
      );
    }

    // 4. Insere apenas os itens em falta no banco
    const { data: inseridos, error: errInsert } = await supabase
      .from("checklist")
      .insert(novosItens)
      .select();
    if (errInsert) throw errInsert;

    // 5. Atualiza a tela instantaneamente
    checklistItens.value = [...checklistItens.value, ...inseridos];
    triggerToast(
      t('os.checklist_novas_regras', { qtd: novosItens.length }),
      "success",
    );
  } catch (error) {
    triggerToast(t('os.checklist_erro_sincronizar') + error.message, "error");
  }
}

async function atualizarStatusChecklist(item, statusOpcao) {
  try {
    const { error } = await supabase
      .from("checklist")
      .update({ condicao: statusOpcao })
      .eq("id", item.id);
    if (error) throw error;
    item.condicao = statusOpcao;
  } catch (err) {
    triggerToast(t('os.checklist_erro_atualizar') + err.message, "error");
  }
}

const checklistsAgrupados = computed(() => {
  const grupos = {};
  checklistItens.value.forEach((item) => {
    const etapaNome = item.etapa || "Geral";
    if (!grupos[etapaNome]) grupos[etapaNome] = [];
    grupos[etapaNome].push(item);
  });

  return Object.keys(grupos)
    .sort()
    .map((etapa) => ({ etapa, itens: grupos[etapa] }));
});

async function carregarFotosChecklist() {
  try {
    const { data, error } = await supabase
      .from("checklist_fotos")
      .select("*")
      .eq("servico_id", props.servico.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    fotosChecklist.value = data || [];
  } catch (err) {
    console.error(err);
  }
}

async function uploadFotoChecklist(event) {
  const arquivoOriginal = event.target.files[0];
  if (!arquivoOriginal) return;
  carregandoFoto.value = true;
  try {
    const arquivoComprimido = await comprimirImagem(
      arquivoOriginal,
      1200,
      1200,
      0.8,
    );
    const fileName = `${props.servico.id}/checklist_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("fotos-luthieria")
      .upload(fileName, arquivoComprimido);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("fotos-luthieria")
      .getPublicUrl(fileName);

    const { data: insertData, error: dbError } = await supabase
      .from("checklist_fotos")
      .insert([{ servico_id: props.servico.id, foto_url: urlData.publicUrl }])
      .select();
    if (dbError) throw dbError;

    if (insertData) fotosChecklist.value.unshift(insertData[0]);
    triggerToast(t('os.checklist_foto_anexada'), "success");
  } catch (err) {
    triggerToast(t('os.checklist_erro_gravar_foto') + err.message, "error");
  } finally {
    carregandoFoto.value = false;
  }
}

async function deletarFoto(id) {
  if (idFotoConfirmar.value === id) {
    try {
      const { error } = await supabase
        .from("checklist_fotos")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fotosChecklist.value = fotosChecklist.value.filter((f) => f.id !== id);
      idFotoConfirmar.value = null;
    } catch (err) {
      triggerToast(t('os.checklist_erro_excluir') + err.message, "error");
    }
  } else {
    idFotoConfirmar.value = id;
    setTimeout(() => {
      if (idFotoConfirmar.value === id) idFotoConfirmar.value = null;
    }, 3000);
  }
}

async function salvarObservacoes() {
  try {
    const { error } = await supabase
      .from("servicos")
      .update({ obs_checklist: obsChecklistLocal.value })
      .eq("id", props.servico.id);
    if (error) throw error;
    triggerToast(t('os.checklist_obs_salvas'), "success");
    emit("observacaoSalva", obsChecklistLocal.value);
  } catch (err) {
    triggerToast(t('os.checklist_erro_salvar_obs') + err.message, "error");
  }
}

onMounted(() => {
  carregarChecklist();
  carregarFotosChecklist();
});
</script>

<template>
  <div>
    <div
      class="flex-between mb-2"
      v-if="!osFinalizada && checklistsAgrupados.length > 0"
    >
      <span class="text-muted" style="font-size: 0.85rem">
        {{ $t('os.checklist_inspecao_abertura') }}
      </span>
      <button type="button"
        class="btn-outline"
        style="padding: 4px 10px; font-size: 0.8rem"
        @click="sincronizarChecklist"
        title="Busca novas regras adicionadas no Painel Admin"
      >
        <span
          class="icon-dinamico"
          style="font-size: 1.1rem; vertical-align: middle"
          >sync</span
        >
        {{ $t('os.checklist_sincronizar_regras') }}
      </button>
    </div>

    <div
      v-if="checklistsAgrupados.length === 0"
      class="card mb-2 text-muted text-center py-5"
    >
      <span
        class="icon-dinamico"
        style="font-size: 3rem; color: var(--text-muted)"
        >sentiment_dissatisfied</span
      ><br />
      {{ $t('os.checklist_nenhuma_regra') }}<br />
      <small>{{ $t('os.checklist_configure_regras') }}</small><br /><br />
      <button type="button"
        v-if="!osFinalizada"
        class="btn-outline"
        @click="sincronizarChecklist"
      >
        <span class="icon-dinamico">sync</span> {{ $t('os.checklist_tentar_sincronizar') }}
      </button>
    </div>

    <div class="checklists-grid mb-2">
      <div
        v-for="grupo in checklistsAgrupados"
        :key="grupo.etapa"
        class="card"
        style="margin-bottom: 0"
      >
        <h4
          class="title-section"
          style="margin-top: 0; font-size: 1rem; color: var(--text-main)"
        >
          <span class="icon-dinamico" style="vertical-align: middle"
            >checklist</span
          >
          {{ grupo.etapa }}
        </h4>

        <div v-for="item in grupo.itens" :key="item.id" class="compact-row">
          <span class="item-name">{{ item.area }}</span>
          <div class="item-actions">
            <button type="button"
              class="btn-check"
              :class="{ active: item.condicao === '✅ Sim' }"
              @click="!osFinalizada && atualizarStatusChecklist(item, '✅ Sim')"
              :disabled="osFinalizada"
              :title="$t('os.checklist_sim_ok')"
            >
              <span class="icon-dinamico" style="font-size: 1.1rem">check</span>
            </button>
            <button type="button"
              class="btn-close"
              :class="{ active: item.condicao === '❌ Não' }"
              @click="!osFinalizada && atualizarStatusChecklist(item, '❌ Não')"
              :disabled="osFinalizada"
              :title="$t('os.checklist_nao_defeito')"
            >
              <span class="icon-dinamico" style="font-size: 1.1rem">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="card mb-2"
      style="background: #f8fafc; border: 1px solid var(--border)"
    >
      <h4
        style="
          margin-top: 0;
          font-size: 1rem;
          color: var(--text-main);
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">notes</span> {{ $t('os.checklist_observacoes') }}
      </h4>
      <textarea
        v-model="obsChecklistLocal"
        rows="3"
        :placeholder="$t('os.checklist_placeholder')"
        :disabled="osFinalizada"
        style="width: 100%"
      ></textarea>
      <button type="button"
        v-if="!osFinalizada"
        class="btn-primary"
        @click="salvarObservacoes"
        style="
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 0.85rem;
        "
      >
        <span class="icon-dinamico" style="font-size: 1.1rem">save</span> {{ $t('os.checklist_salvar_obs') }}
      </button>
    </div>

    <div class="card">
      <div class="flex-between mb-1">
        <h4 style="margin: 0; font-size: 1rem">
          <span class="icon-dinamico" style="vertical-align: middle"
            >photo_library</span
          >
          {{ $t('os.checklist_evidencias') }}
        </h4>
        <label
          v-if="!osFinalizada"
          class="btn-outline"
          style="cursor: pointer; font-size: 0.8rem; padding: 5px 10px"
        >
          <span
            class="icon-dinamico"
            style="font-size: 1rem; vertical-align: bottom"
            >add_a_photo</span
          >
          {{ carregandoFoto ? $t('os.checklist_aguarde') : $t('os.checklist_anexar') }}
          <input
            type="file"
            accept="image/*"
            @change="uploadFotoChecklist"
            hidden
            :disabled="carregandoFoto"
          />
        </label>
      </div>
      <div class="galeria-fotos">
        <div
          v-if="fotosChecklist.length === 0"
          class="text-muted text-center w-full"
          style="font-size: 0.85rem"
        >
          {{ $t('os.checklist_nenhuma_foto') }}
        </div>
        <div v-for="foto in fotosChecklist" :key="foto.id" class="foto-card">
          <a :href="foto.foto_url" target="_blank"
            ><img :src="foto.foto_url" class="img-preview"
          /></a>
          <button type="button"
            v-if="!osFinalizada"
            class="btn-delete-confirm w-full"
            @click="deletarFoto(foto.id)"
            :class="{ confirming: idFotoConfirmar === foto.id }"
          >
            {{ idFotoConfirmar === foto.id ? $t('os.checklist_confirma') : $t('geral.excluir') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checklists-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  align-items: flex-start;
}
.compact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border);
}
.compact-row:last-child {
  border-bottom: none;
}
.item-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}
.item-actions {
  display: flex;
  gap: 4px;
}
.btn-check,
.btn-close {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}
.btn-check:hover:not(:disabled) {
  border-color: #10b981;
  color: #10b981;
}
.btn-check.active {
  background: #dcfce7;
  border-color: #10b981;
  color: #166534;
}
.btn-close:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
}
.btn-close.active {
  background: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}
.btn-check:disabled,
.btn-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.galeria-fotos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  margin-top: 15px;
}
.foto-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.img-preview {
  width: 100%;
  height: 120px;
  object-fit: cover;
}
.btn-delete-confirm {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
  font-family: inherit;
}
.btn-delete-confirm.confirming {
  background: #dc2626;
  color: white;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
@media (max-width: 768px) {
  .checklists-grid {
    grid-template-columns: 1fr;
  }
}
</style>
