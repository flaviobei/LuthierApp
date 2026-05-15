<script setup>
/**
 * ============================================================================
 * @file        Configuracoes.vue
 * @description Central de identidade visual e dados fiscais da oficina.
 * ATUALIZAÇÃO: Seções reorganizadas e estilizadas com padrão de cores (Cards).
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import { comprimirImagem } from "../lib/imageUtils";
import { adminService } from "../services/adminService";
import { useI18n } from "vue-i18n";

const { triggerToast } = useToast();
const { t } = useI18n();

const form = ref({
  nome_luthieria: "",
  documento: "",
  telefone: "",
  endereco: "",
  termos_garantia: "",
  logo_url: "",
  estilo_icones: "Material Symbols Outlined",

  // Tipo de Impressão (Novo)
  tipo_impressora: "padrao",

  // Cores Gerais
  cor_primaria: "#2c3e50",
  cor_secundaria: "#d35400",
  cor_fundo: "#f4f6f8",
  text_color: "#333333",

  // Cores de Botões
  btn_primary_bg: "#2c3e50",
  btn_primary_text: "#ffffff",
  btn_accent_bg: "#d35400",
  btn_accent_text: "#ffffff",

  // Formatos
  fonte_principal: "Inter, sans-serif",
  radius_perc: 12,

  // Taxas
  taxa_pix: 0,
  taxa_dinheiro: 0,
  taxa_credito: 0,
  taxa_debito: 0,
});

const configId = ref(null);
const loading = ref(false);
const carregandoFoto = ref(false);

async function carregarConfiguracoes() {
  const data = await adminService.buscarConfiguracoes();
  if (data) {
    form.value = { ...form.value, ...data };
    configId.value = data.id;
    aplicarTemaPreview();
  }
}

function aplicarTemaPreview() {
  const root = document.documentElement;
  // Gerais e Ícones
  root.style.setProperty("--primary", form.value.cor_primaria);
  root.style.setProperty("--accent", form.value.cor_secundaria);
  root.style.setProperty("--bg-body", form.value.cor_fundo);
  root.style.setProperty("--text-main", form.value.text_color);
  root.style.setProperty("--icon-family", `"${form.value.estilo_icones}"`);

  // Botões
  root.style.setProperty("--btn-primary-bg", form.value.btn_primary_bg);
  root.style.setProperty("--btn-primary-text", form.value.btn_primary_text);
  root.style.setProperty("--btn-accent-bg", form.value.btn_accent_bg);
  root.style.setProperty("--btn-accent-text", form.value.btn_accent_text);

  // Bordas e Fonte
  root.style.setProperty("--radius", `${form.value.radius_perc}px`);
  root.style.setProperty(
    "--radius-sm",
    `${Math.max(4, form.value.radius_perc - 4)}px`,
  );
  document.body.style.fontFamily = form.value.fonte_principal;
}

async function salvarConfiguracoes() {
  loading.value = true;

  try {
    const dadosParaSalvar = { ...form.value };
    const data = await adminService.salvarConfiguracoes(
      configId.value,
      dadosParaSalvar,
    );

    if (data && data.length > 0) {
      configId.value = data[0].id;
    }
    triggerToast(t('config.sucesso_salvar'), "success");
  } catch (error) {
    triggerToast(t('config.erro_salvar') + error.message, "error");
  } finally {
    loading.value = false;
  }
}

// LISTA DE TEMAS PRÉ-DEFINIDOS (Substituindo emojis por ícones do Material)
const temasPresets = [
  {
    nome: t('config.tema_corp'),
    icone: "business",
    cor_primaria: "#1E3A8A",
    cor_secundaria: "#10B981",
    cor_fundo: "#F4F6F8",
    text_color: "#333333",
    btn_primary_bg: "#1E3A8A",
    btn_primary_text: "#ffffff",
    btn_accent_bg: "#10B981",
    btn_accent_text: "#ffffff",
    radius_perc: 8,
    fonte_principal: "'Inter', sans-serif",
    estilo_icones: "Material Symbols Outlined",
  },
  {
    nome: t('config.tema_classic'),
    icone: "music_note",
    cor_primaria: "#5C3A21",
    cor_secundaria: "#D27D2D",
    cor_fundo: "#F9F6F0",
    text_color: "#2C1E16",
    btn_primary_bg: "#5C3A21",
    btn_primary_text: "#ffffff",
    btn_accent_bg: "#D27D2D",
    btn_accent_text: "#ffffff",
    radius_perc: 6,
    fonte_principal: "Georgia, serif",
    estilo_icones: "Material Symbols Sharp",
  },
  {
    nome: t('config.tema_rock'),
    icone: "bolt",
    cor_primaria: "#18181B",
    cor_secundaria: "#E11D48",
    cor_fundo: "#E5E7EB",
    text_color: "#18181B",
    btn_primary_bg: "#18181B",
    btn_primary_text: "#ffffff",
    btn_accent_bg: "#E11D48",
    btn_accent_text: "#ffffff",
    radius_perc: 4,
    fonte_principal: "'Montserrat', sans-serif",
    estilo_icones: "Material Symbols Sharp",
  },
  {
    nome: t('config.tema_acustic'),
    icone: "eco",
    cor_primaria: "#4F7942",
    cor_secundaria: "#D97750",
    cor_fundo: "#F9FAEB",
    text_color: "#2A3B28",
    btn_primary_bg: "#4F7942",
    btn_primary_text: "#ffffff",
    btn_accent_bg: "#D97750",
    btn_accent_text: "#ffffff",
    radius_perc: 16,
    fonte_principal: "'Inter', sans-serif",
    estilo_icones: "Material Symbols Rounded",
  },
  {
    nome: t('config.tema_tech'),
    icone: "tune",
    cor_primaria: "#0F172A",
    cor_secundaria: "#3B82F6",
    cor_fundo: "#F8FAFC",
    text_color: "#0F172A",
    btn_primary_bg: "#0F172A",
    btn_primary_text: "#ffffff",
    btn_accent_bg: "#3B82F6",
    btn_accent_text: "#ffffff",
    radius_perc: 20,
    fonte_principal: "'Roboto', sans-serif",
    estilo_icones: "Material Symbols Outlined",
  },
];

function aplicarPreset(tema) {
  Object.keys(tema).forEach((key) => {
    if (key !== "nome" && key !== "icone") form.value[key] = tema[key];
  });
  aplicarTemaPreview();
  triggerToast(t('config.tema_aplicado', { tema: tema.nome }), "info");
}

async function uploadLogo(event) {
  const arquivoOriginal = event.target.files[0];
  if (!arquivoOriginal) return;
  carregandoFoto.value = true;

  try {
    const arquivoComprimido = await comprimirImagem(
      arquivoOriginal,
      800,
      800,
      0.85,
    );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id || "luthier";
    const fileName = `${userId}/logo_${Date.now()}`;

    const { error } = await supabase.storage
      .from("fotos-luthieria")
      .upload(fileName, arquivoComprimido);
    if (error) throw error;

    const { data } = supabase.storage
      .from("fotos-luthieria")
      .getPublicUrl(fileName);
    form.value.logo_url = data.publicUrl;
    triggerToast(t('config.logo_sucesso'), "success");
  } catch (err) {
    triggerToast(t('config.logo_erro') + err.message, "error");
  } finally {
    carregandoFoto.value = false;
  }
}

function removerLogo() {
  form.value.logo_url = null;
  triggerToast(t('config.logo_removida'), "info");
}

onMounted(() => carregarConfiguracoes());
</script>

<template>
  <div class="card">
    <h3
      class="title-section"
      style="margin-top: 0; display: flex; align-items: center; gap: 8px"
    >
      <span class="icon-dinamico">settings</span> {{ $t('config.titulo') }}
    </h3>

    <div
      class="box mb-2"
      style="border-left: 4px solid var(--primary); background-color: #f0f9ff"
    >
      <h4
        style="
          margin-top: 0;
          color: #0284c7;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">store</span> {{ $t('config.dados_oficina') }}
      </h4>
      <div class="form-group">
        <label>{{ $t('config.label_nome') }}</label>
        <input
          v-model="form.nome_luthieria"
          :placeholder="$t('config.placeholder_nome')"
        />
      </div>
      <div class="grid-2-cols mb-1">
        <div>
          <label>{{ $t('config.label_doc') }}</label>
          <input v-model="form.documento" placeholder="00.000.000/0001-00" />
        </div>
        <div>
          <label>{{ $t('config.label_whatsapp') }}</label>
          <input v-model="form.telefone" placeholder="(11) 99999-9999" />
        </div>
      </div>
      <div class="form-group">
        <label>{{ $t('config.label_endereco') }}</label>
        <input
          v-model="form.endereco"
          :placeholder="$t('config.placeholder_endereco')"
        />
      </div>
      <div class="form-group">
        <label>{{ $t('config.label_garantia') }}</label>
        <textarea v-model="form.termos_garantia" rows="3"></textarea>
      </div>
    </div>

    <div
      class="box mb-2"
      style="border-left: 4px solid var(--success); background-color: #f0fdf4"
    >
      <h4
        style="
          margin-top: 0;
          color: #15803d;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">payments</span> {{ $t('config.titulo_taxas') }}
      </h4>
      <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 15px">
        {{ $t('config.desc_taxas') }}
      </p>
      <div
        class="grid-2-cols"
        style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))"
      >
        <div>
          <label>{{ $t('config.taxa_pix') }}</label>
          <input type="number" step="0.01" v-model="form.taxa_pix" />
        </div>
        <div>
          <label>{{ $t('config.taxa_dinheiro') }}</label>
          <input type="number" step="0.01" v-model="form.taxa_dinheiro" />
        </div>
        <div>
          <label>{{ $t('config.taxa_credito') }}</label>
          <input type="number" step="0.01" v-model="form.taxa_credito" />
        </div>
        <div>
          <label>{{ $t('config.taxa_debito') }}</label>
          <input type="number" step="0.01" v-model="form.taxa_debito" />
        </div>
      </div>
    </div>

    <div
      class="box mb-2"
      style="border-left: 4px solid var(--primary); background-color: #eef2ff"
    >
      <h4
        style="
          margin-top: 0;
          color: #4338ca;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">print</span> {{ $t('config.titulo_impressao') }}
      </h4>
      <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 15px">
        {{ $t('config.desc_impressao') }}
      </p>

      <div class="form-group">
        <label>{{ $t('config.label_formato') }}</label>
        <select v-model="form.tipo_impressora" style="max-width: 400px">
          <option value="padrao">{{ $t('config.formato_a4') }}</option>
          <option value="termica_80mm">
            {{ $t('config.formato_80mm') }}
          </option>
          <option value="termica_58mm">
            {{ $t('config.formato_58mm') }}
          </option>
        </select>
      </div>
    </div>

    <div
      class="box mb-2"
      style="border-left: 4px solid var(--primary); background-color: #f1f5f9"
    >
      <h4
        style="
          margin-top: 0;
          color: var(--primary);
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">brush</span> {{ $t('config.titulo_visual') }}
      </h4>
      <div class="flex-gap-15" style="align-items: flex-start; flex-wrap: wrap">
        <div style="flex: 1; min-width: 250px">
          <label>{{ $t('config.label_logo') }}</label>
          <div style="display: flex; gap: 15px; align-items: center">
            <div
              style="
                width: 80px;
                height: 80px;
                border: 1px dashed var(--border);
                border-radius: var(--radius-sm);
                display: flex;
                justify-content: center;
                align-items: center;
                background: #fff;
              "
            >
              <img
                v-if="form.logo_url"
                :src="form.logo_url"
                style="max-width: 100%; max-height: 100%; object-fit: contain"
              />
              <span
                v-else
                class="text-muted"
                style="font-size: 0.8rem; text-align: center"
                v-html="$t('config.sem_logo')"
              ></span>
            </div>
            <div>
              <label
                class="btn-outline"
                style="
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  margin-bottom: 5px;
                  font-size: 0.85rem;
                  padding: 6px 12px;
                  background: white;
                "
              >
                <span class="icon-dinamico" style="font-size: 1.1rem">
                  {{
                    carregandoFoto ? "hourglass_empty" : "add_photo_alternate"
                  }}
                </span>
                {{ carregandoFoto ? $t('config.enviando') : $t('config.alterar_logo') }}
                <input
                  type="file"
                  accept="image/*"
                  @change="uploadLogo"
                  hidden
                  :disabled="carregandoFoto"
                /> </label
              ><br />
              <button type="button"
                v-if="form.logo_url"
                class="btn-icon text-danger"
                @click="removerLogo"
                style="
                  font-size: 0.85rem;
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  padding: 4px 8px;
                  background: none;
                  border: none;
                  cursor: pointer;
                "
              >
                <span class="icon-dinamico" style="font-size: 1rem"
                  >delete</span
                >
                {{ $t('config.btn_remover') }}
              </button>
            </div>
          </div>
        </div>

        <div style="flex: 2; min-width: 300px">
          <div class="grid-2-cols mb-1">
            <div>
              <label>{{ $t('config.cor_primaria') }}</label>
              <div class="color-picker-group">
                <input
                  type="color"
                  v-model="form.cor_primaria"
                  @input="aplicarTemaPreview"
                />
                <input
                  type="text"
                  v-model="form.cor_primaria"
                  @input="aplicarTemaPreview"
                />
              </div>
            </div>
            <div>
              <label>{{ $t('config.cor_secundaria') }}</label>
              <div class="color-picker-group">
                <input
                  type="color"
                  v-model="form.cor_secundaria"
                  @input="aplicarTemaPreview"
                />
                <input
                  type="text"
                  v-model="form.cor_secundaria"
                  @input="aplicarTemaPreview"
                />
              </div>
            </div>
          </div>

          <div class="grid-2-cols">
            <div>
              <label>{{ $t('config.cor_fundo') }}</label>
              <div class="color-picker-group">
                <input
                  type="color"
                  v-model="form.cor_fundo"
                  @input="aplicarTemaPreview"
                />
                <input
                  type="text"
                  v-model="form.cor_fundo"
                  @input="aplicarTemaPreview"
                />
              </div>
            </div>
            <div>
              <label>{{ $t('config.cor_texto') }}</label>
              <div class="color-picker-group">
                <input
                  type="color"
                  v-model="form.text_color"
                  @input="aplicarTemaPreview"
                />
                <input
                  type="text"
                  v-model="form.text_color"
                  @input="aplicarTemaPreview"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="box mb-2"
      style="border-left: 4px solid var(--accent); background-color: #fdf4ff"
    >
      <h4
        style="
          margin-top: 0;
          color: #c026d3;
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">palette</span> {{ $t('config.titulo_temas') }}
      </h4>
      <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 15px">
        {{ $t('config.desc_temas') }}
      </p>

      <div
        style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px"
      >
        <button type="button"
          v-for="tema in temasPresets"
          :key="tema.nome"
          @click="aplicarPreset(tema)"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 120px;
            padding: 15px 10px;
            background: white;
            border: 1px solid var(--border);
            border-radius: 8px;
            cursor: pointer;
            transition: 0.2s;
          "
          onmouseover="
            this.style.borderColor = 'var(--primary)';
            this.style.transform = 'translateY(-2px)';
          "
          onmouseout="
            this.style.borderColor = 'var(--border)';
            this.style.transform = 'none';
          "
        >
          <div
            style="
              display: flex;
              gap: 2px;
              margin-bottom: 10px;
              border-radius: 4px;
              overflow: hidden;
              border: 1px solid #eee;
            "
          >
            <div
              :style="{
                width: '20px',
                height: '20px',
                background: tema.cor_primaria,
              }"
            ></div>
            <div
              :style="{
                width: '20px',
                height: '20px',
                background: tema.cor_secundaria,
              }"
            ></div>
            <div
              :style="{
                width: '20px',
                height: '20px',
                background: tema.cor_fundo,
              }"
            ></div>
          </div>
          <span
            class="icon-dinamico"
            style="
              font-size: 1.5rem;
              margin-bottom: 5px;
              color: var(--text-muted);
            "
            >{{ tema.icone }}</span
          >
          <span
            style="
              font-size: 0.75rem;
              font-weight: bold;
              color: var(--text-main);
              text-align: center;
            "
            >{{ tema.nome }}</span
          >
        </button>
      </div>
    </div>

    <div
      class="box mb-2"
      style="border-left: 4px solid var(--accent); background-color: #fff7ed"
    >
      <h4
        style="
          margin-top: 0;
          color: var(--accent);
          display: flex;
          align-items: center;
          gap: 8px;
        "
      >
        <span class="icon-dinamico">touch_app</span> {{ $t('config.titulo_botoes') }}
      </h4>

      <div class="grid-2-cols mb-2">
        <div class="config-card">
          <label>{{ $t('config.btn_principal') }}</label>
          <div class="grid-2-cols">
            <div>
              <small>{{ $t('config.fundo') }}</small>
              <input
                type="color"
                v-model="form.btn_primary_bg"
                @input="aplicarTemaPreview"
                class="w-full h-30"
              />
            </div>
            <div>
              <small>{{ $t('config.texto') }}</small>
              <input
                type="color"
                v-model="form.btn_primary_text"
                @input="aplicarTemaPreview"
                class="w-full h-30"
              />
            </div>
          </div>
        </div>
        <div class="config-card">
          <label>{{ $t('config.btn_destaque') }}</label>
          <div class="grid-2-cols">
            <div>
              <small>{{ $t('config.fundo') }}</small>
              <input
                type="color"
                v-model="form.btn_accent_bg"
                @input="aplicarTemaPreview"
                class="w-full h-30"
              />
            </div>
            <div>
              <small>{{ $t('config.texto') }}</small>
              <input
                type="color"
                v-model="form.btn_accent_text"
                @input="aplicarTemaPreview"
                class="w-full h-30"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2-cols">
        <div>
          <label>{{ $t('config.arredondamento') }} {{ form.radius_perc }}px</label>
          <input
            type="range"
            min="0"
            max="24"
            v-model.number="form.radius_perc"
            @input="aplicarTemaPreview"
            class="w-full"
          />
          <div class="flex-between text-muted" style="font-size: 0.75rem">
            <span>{{ $t('config.quadrado') }}</span><span>{{ $t('config.redondo') }}</span>
          </div>
        </div>

        <div class="grid-2-cols">
          <div>
            <label>{{ $t('config.fonte_sistema') }}</label>
            <select v-model="form.fonte_principal" @change="aplicarTemaPreview">
              <option value="'Inter', sans-serif">{{ $t('config.fonte_inter') }}</option>
              <option value="'Roboto', sans-serif">{{ $t('config.fonte_roboto') }}</option>
              <option value="'Montserrat', sans-serif">
                {{ $t('config.fonte_montserrat') }}
              </option>
              <option value="'Courier New', monospace">
                {{ $t('config.fonte_courier') }}
              </option>
              <option value="Georgia, serif">{{ $t('config.fonte_georgia') }}</option>
            </select>
          </div>
          <div>
            <label>{{ $t('config.estilo_icones') }}</label>
            <select v-model="form.estilo_icones" @change="aplicarTemaPreview">
              <option value="Material Symbols Outlined">
                {{ $t('config.icones_outlined') }}
              </option>
              <option value="Material Symbols Rounded">
                {{ $t('config.icones_rounded') }}
              </option>
              <option value="Material Symbols Sharp">
                {{ $t('config.icones_sharp') }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <button type="button"
      class="btn-primary"
      @click="salvarConfiguracoes"
      :disabled="loading"
      style="
        width: 100%;
        padding: 12px;
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      "
    >
      <span class="icon-dinamico" style="font-size: 1.2rem">
        {{ loading ? "hourglass_empty" : "save" }}
      </span>
      {{ loading ? $t('config.btn_guardando') : $t('config.btn_salvar') }}
    </button>
  </div>
</template>

<style scoped>
.grid-2-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}
.color-picker-group {
  display: flex;
  gap: 5px;
  align-items: center;
}
.color-picker-group input[type="color"] {
  height: 44px;
  padding: 2px;
  cursor: pointer;
  width: 60px;
}
.color-picker-group input[type="text"] {
  flex: 1;
}
.config-card {
  background: white;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.h-30 {
  height: 35px !important;
  min-height: 35px !important;
  padding: 0 !important;
}
input[type="range"] {
  height: auto;
  min-height: auto;
  padding: 10px 0;
}
</style>
