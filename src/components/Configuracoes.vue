<script setup>
/**
 * ============================================================================
 * @file        Configuracoes.vue
 * @description Central de identidade visual e dados fiscais da oficina.
 * Atualizado com configuração de formato de impressora.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import { comprimirImagem } from "../lib/imageUtils";

const { triggerToast } = useToast();

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
  const { data } = await supabase
    .from("configuracoes")
    .select("*")
    .maybeSingle();
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
  let erroSalvamento = null;

  const dadosParaSalvar = { ...form.value };

  if (configId.value) {
    const { error } = await supabase
      .from("configuracoes")
      .update(dadosParaSalvar)
      .eq("id", configId.value);
    erroSalvamento = error;
  } else {
    const { data, error } = await supabase
      .from("configuracoes")
      .insert([dadosParaSalvar])
      .select();
    erroSalvamento = error;
    if (data && data.length > 0) configId.value = data[0].id;
  }

  loading.value = false;

  if (!erroSalvamento) {
    triggerToast("Configurações da oficina guardadas!", "success");
  } else {
    triggerToast("Falha ao salvar: " + erroSalvamento.message, "error");
  }
}

// LISTA DE TEMAS PRÉ-DEFINIDOS
const temasPresets = [
  {
    nome: "Padrão Corporativo",
    icone: "🏢",
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
    nome: "Oficina Clássica",
    icone: "🎸",
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
    nome: "Rock de Garagem",
    icone: "⚡",
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
    nome: "Luthier Acústico",
    icone: "🌿",
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
    nome: "Estúdio Tech",
    icone: "🎛️",
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
  triggerToast(`Tema "${tema.nome}" aplicado! Lembre-se de guardar.`, "info");
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
    triggerToast("Logomarca carregada!", "success");
  } catch (err) {
    triggerToast("Erro ao processar imagem: " + err.message, "error");
  } finally {
    carregandoFoto.value = false;
  }
}

function removerLogo() {
  form.value.logo_url = null;
  triggerToast("Logomarca removida.", "info");
}

onMounted(() => carregarConfiguracoes());
</script>

<template>
  <div class="card">
    <h3 class="title-section" style="margin-top: 0">
      ⚙️ Configurações da Oficina
    </h3>

    <div
      class="box mb-2"
      style="background-color: #f8fafc; border: 1px dashed var(--border)"
    >
      <h4 style="margin-top: 0; color: var(--text-main)">🎨 Temas</h4>
      <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 15px">
        Escolha um tema ou personalize as cores manualmente abaixo.
      </p>

      <div
        style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px"
      >
        <button
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
          <span style="font-size: 1.5rem; margin-bottom: 5px">{{
            tema.icone
          }}</span>
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

    <div class="box mb-2" style="border-left: 4px solid var(--primary)">
      <h4 style="margin-top: 0; color: var(--primary)">Identidade Visual</h4>
      <div class="flex-gap-15" style="align-items: flex-start; flex-wrap: wrap">
        <div style="flex: 1; min-width: 250px">
          <label>Logotipo da Oficina</label>
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
                >Sem<br />Logo</span
              >
            </div>
            <div>
              <label
                class="btn-outline"
                style="
                  cursor: pointer;
                  display: inline-block;
                  margin-bottom: 5px;
                  font-size: 0.85rem;
                  padding: 6px 12px;
                "
              >
                {{ carregandoFoto ? "⏳ A enviar..." : "📷 Alterar Logo" }}
                <input
                  type="file"
                  accept="image/*"
                  @change="uploadLogo"
                  hidden
                  :disabled="carregandoFoto"
                /> </label
              ><br />
              <button
                v-if="form.logo_url"
                class="btn-icon text-danger"
                @click="removerLogo"
                style="font-size: 0.85rem"
              >
                🗑️ Remover
              </button>
            </div>
          </div>
        </div>

        <div style="flex: 2; min-width: 300px">
          <div class="grid-2-cols mb-1">
            <div>
              <label>Cor Primária (Topo e Abas)</label>
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
              <label>Cor Secundária (Destaques)</label>
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
              <label>Cor de Fundo da Tela</label>
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
              <label>Cor do Texto Principal</label>
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
      style="border-left: 4px solid var(--accent); background-color: #fffaf5"
    >
      <h4 style="margin-top: 0; color: var(--accent)">Botões & Interface</h4>

      <div class="grid-2-cols mb-2">
        <div class="config-card">
          <label>Botão Principal (Ex: Salvar)</label>
          <div class="grid-2-cols">
            <div>
              <small>Fundo:</small
              ><input
                type="color"
                v-model="form.btn_primary_bg"
                @input="aplicarTemaPreview"
                class="w-full h-30"
              />
            </div>
            <div>
              <small>Texto:</small
              ><input
                type="color"
                v-model="form.btn_primary_text"
                @input="aplicarTemaPreview"
                class="w-full h-30"
              />
            </div>
          </div>
        </div>
        <div class="config-card">
          <label>Botão Destaque (Ex: Ações Rápidas)</label>
          <div class="grid-2-cols">
            <div>
              <small>Fundo:</small
              ><input
                type="color"
                v-model="form.btn_accent_bg"
                @input="aplicarTemaPreview"
                class="w-full h-30"
              />
            </div>
            <div>
              <small>Texto:</small
              ><input
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
          <label>Arredondamento da Interface: {{ form.radius_perc }}px</label>
          <input
            type="range"
            min="0"
            max="24"
            v-model.number="form.radius_perc"
            @input="aplicarTemaPreview"
            class="w-full"
          />
          <div class="flex-between text-muted" style="font-size: 0.75rem">
            <span>Quadrado (0px)</span><span>Redondo (24px)</span>
          </div>
        </div>

        <div class="grid-2-cols">
          <div>
            <label>Fonte do Sistema</label>
            <select v-model="form.fonte_principal" @change="aplicarTemaPreview">
              <option value="'Inter', sans-serif">Inter (Moderna)</option>
              <option value="'Roboto', sans-serif">Roboto (Clássica)</option>
              <option value="'Montserrat', sans-serif">
                Montserrat (Redonda)
              </option>
              <option value="'Courier New', monospace">
                Courier (Máquina)
              </option>
              <option value="Georgia, serif">Georgia (Elegante)</option>
            </select>
          </div>
          <div>
            <label>Estilo dos Ícones</label>
            <select v-model="form.estilo_icones" @change="aplicarTemaPreview">
              <option value="Material Symbols Outlined">
                Outlined (Linhas Finas)
              </option>
              <option value="Material Symbols Rounded">
                Rounded (Redondos)
              </option>
              <option value="Material Symbols Sharp">
                Sharp (Retos/Duros)
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="box mb-2">
      <h4 style="margin-top: 0">Dados da Oficina</h4>
      <div class="form-group">
        <label>Nome da Luthieria:</label
        ><input
          v-model="form.nome_luthieria"
          placeholder="Ex: Flávio Bei - Luthier"
        />
      </div>
      <div class="grid-2-cols mb-1">
        <div>
          <label>Documento (CNPJ/CPF):</label
          ><input v-model="form.documento" placeholder="00.000.000/0001-00" />
        </div>
        <div>
          <label>WhatsApp:</label
          ><input v-model="form.telefone" placeholder="(11) 99999-9999" />
        </div>
      </div>
      <div class="form-group">
        <label>Endereço Completo:</label
        ><input
          v-model="form.endereco"
          placeholder="Rua das Cordas, 123 - São Paulo, SP"
        />
      </div>
      <div class="form-group">
        <label>Termos de Garantia Padrão:</label
        ><textarea v-model="form.termos_garantia" rows="3"></textarea>
      </div>
    </div>

    <div
      class="box mb-2"
      style="border-left: 4px solid #6366f1; background-color: #f5f7ff"
    >
      <h4 style="margin-top: 0; color: #4f46e5">
        🖨️ Impressão de Recibos / Orçamentos
      </h4>
      <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 15px">
        Esta configuração altera o formato visual do recibo gerado direto do
        sistema. Outros relatórios continuarão gerando PDFs e planilhas
        normalmente.
      </p>

      <div class="form-group">
        <label>Formato do Recibo Direto:</label>
        <select v-model="form.tipo_impressora" style="max-width: 400px">
          <option value="padrao">📄 Folha A4 (Impressora Convencional)</option>
          <option value="termica_80mm">
            🧾 Bobina 80mm (Impressora Térmica Larga)
          </option>
          <option value="termica_58mm">
            🧾 Bobina 58mm (Impressora Térmica Estreita)
          </option>
        </select>
      </div>
    </div>

    <div
      class="box mb-2"
      style="border-left: 4px solid var(--success); background-color: #f8fff9"
    >
      <h4 style="margin-top: 0; color: var(--success)">
        💰 Taxas de Recebimento (%)
      </h4>
      <div
        class="grid-2-cols"
        style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))"
      >
        <div>
          <label>PIX</label
          ><input type="number" step="0.01" v-model="form.taxa_pix" />
        </div>
        <div>
          <label>Dinheiro</label
          ><input type="number" step="0.01" v-model="form.taxa_dinheiro" />
        </div>
        <div>
          <label>Crédito</label
          ><input type="number" step="0.01" v-model="form.taxa_credito" />
        </div>
        <div>
          <label>Débito</label
          ><input type="number" step="0.01" v-model="form.taxa_debito" />
        </div>
      </div>
    </div>

    <button
      class="btn-primary"
      @click="salvarConfiguracoes"
      :disabled="loading"
      style="width: 100%; padding: 12px; font-size: 1.1rem"
    >
      {{ loading ? "⏳ A guardar..." : "💾 Salvar Configurações Gerais" }}
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
