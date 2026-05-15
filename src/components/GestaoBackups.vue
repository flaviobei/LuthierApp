<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import { useI18n } from "vue-i18n";

const { triggerToast } = useToast();
const { t } = useI18n();
const backups = ref([]);
const loading = ref(true);

// Carrega a lista de arquivos e limpa os que passarem do limite de 5
async function carregarELimparBackups() {
  loading.value = true;
  try {
    // 1. Puxa os ficheiros ordenados do mais recente para o mais antigo
    const { data, error } = await supabase.storage.from("backups").list("", {
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) throw error;

    // Filtra possíveis arquivos fantasma do sistema (como '.emptyFolderPlaceholder')
    let lista = data.filter((b) => b.name.endsWith(".sql"));

    // 2. LÓGICA DE RETENÇÃO (Mantém apenas os 15 últimos)
    if (lista.length > 15) {
      const arquivosParaApagar = lista.slice(15).map((b) => b.name);

      const { error: errDelete } = await supabase.storage
        .from("backups")
        .remove(arquivosParaApagar);

      if (!errDelete) {
        triggerToast(
          t('admin_backups.toast_limpeza'),
          "info",
        );
        lista = lista.slice(0, 15); // Atualiza a lista da tela para mostrar só os 15
      }
    }

    backups.value = lista;
  } catch (err) {
    triggerToast(t('admin_backups.erro_gerir') + err.message, "error");
  } finally {
    loading.value = false;
  }
}

async function baixarBackup(nomeArquivo) {
  triggerToast(t('admin_backups.toast_download'), "info");
  try {
    const { data, error } = await supabase.storage
      .from("backups")
      .download(nomeArquivo);
    if (error) throw error;

    // Cria um link temporário para forçar o download no navegador
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    triggerToast(t('admin_backups.erro_download') + err.message, "error");
  }
}

// Formatar o tamanho do arquivo para MB
function formatarTamanho(bytes) {
  if (!bytes) return "0 Bytes";
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(2) + " MB";
}

onMounted(carregarELimparBackups);
</script>

<template>
  <div class="card">
    <div class="flex-between mb-2">
      <h3 class="title-section" style="margin: 0; color: var(--text-main)">
        <span class="icon-dinamico" style="vertical-align: middle"
          >cloud_done</span
        >
        {{ $t('admin_backups.titulo') }}
      </h3>
      <button type="button"
        class="btn-outline"
        @click="carregarELimparBackups"
        :title="$t('admin_backups.btn_atualizar')"
      >
        <span class="icon-dinamico">refresh</span>
      </button>
    </div>

    <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 20px" v-html="$t('admin_backups.desc')"></p>

    <div v-if="loading" class="text-center py-5">
      <div class="loader-simple" style="margin: 0 auto"></div>
      <p class="mt-2 text-muted">{{ $t('admin_backups.lendo_cofre') }}</p>
    </div>

    <div v-else-if="backups.length === 0" class="text-center text-muted py-5">
      {{ $t('admin_backups.nenhum_backup') }}
    </div>

    <div v-else class="tabela-container">
      <table class="tabela-dados">
        <thead>
          <tr>
            <th>{{ $t('admin_backups.col_nome') }}</th>
            <th>{{ $t('admin_backups.col_data') }}</th>
            <th>{{ $t('admin_backups.col_tamanho') }}</th>
            <th class="text-center">{{ $t('admin_backups.col_acao') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="backup in backups" :key="backup.id">
            <td
              style="
                font-family: monospace;
                font-weight: bold;
                color: var(--primary);
              "
            >
              {{ backup.name }}
            </td>
            <td>{{ new Date(backup.created_at).toLocaleString() }}</td>
            <td>{{ formatarTamanho(backup.metadata?.size) }}</td>
            <td class="text-center">
              <button type="button"
                class="btn-accent"
                style="padding: 6px 12px"
                @click="baixarBackup(backup.name)"
              >
                <span
                  class="icon-dinamico"
                  style="font-size: 1.1rem; vertical-align: middle"
                  >download</span
                >
                {{ $t('admin_backups.btn_baixar') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.tabela-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.tabela-dados {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}
.tabela-dados th,
.tabela-dados td {
  padding: 12px 15px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.tabela-dados th {
  background-color: #f8fafc;
  font-weight: bold;
  color: var(--text-main);
}
</style>
