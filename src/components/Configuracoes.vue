<script setup>
/**
 * ============================================================================
 * @file        Configuracoes.vue
 * @description Central de identidade visual e dados fiscais da oficina.
 * Define o logo, endereço, termos de garantia e taxas de recebimento.
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
  cor_primaria: "#2c3e50",
  cor_secundaria: "#d35400",
  cor_fundo: "#f4f6f8",
  fonte_principal: "Inter, sans-serif",
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
  document.documentElement.style.setProperty(
    "--primary",
    form.value.cor_primaria,
  );
  document.documentElement.style.setProperty(
    "--accent",
    form.value.cor_secundaria,
  );
  document.documentElement.style.setProperty("--bg-body", form.value.cor_fundo);
  document.body.style.fontFamily = form.value.fonte_principal;
}

async function salvarConfiguracoes() {
  loading.value = true;
  let erroSalvamento = null;

  const dadosParaSalvar = {
    nome_luthieria: form.value.nome_luthieria,
    documento: form.value.documento,
    telefone: form.value.telefone,
    endereco: form.value.endereco,
    termos_garantia: form.value.termos_garantia,
    logo_url: form.value.logo_url,
    cor_primaria: form.value.cor_primaria,
    cor_secundaria: form.value.cor_secundaria,
    cor_fundo: form.value.cor_fundo,
    fonte_principal: form.value.fonte_principal,
    taxa_pix: form.value.taxa_pix || 0,
    taxa_dinheiro: form.value.taxa_dinheiro || 0,
    taxa_credito: form.value.taxa_credito || 0,
    taxa_debito: form.value.taxa_debito || 0,
  };

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

  // AQUI A MUDANÇA MÁGICA DOS ALERTAS PARA O TOAST!
  if (!erroSalvamento) {
    triggerToast("As configurações da oficina foram guardadas!", "success");
  } else {
    triggerToast("Falha ao salvar: " + erroSalvamento.message, "error");
  }
}

async function uploadLogo(event) {
  const arquivoOriginal = event.target.files[0];
  if (!arquivoOriginal) return;
  carregandoFoto.value = true;

  try {
    // Comprime o Logo (tamanho máx 800px)
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

    if (error) {
      triggerToast("Erro a enviar a logomarca: " + error.message, "error");
    } else {
      const { data } = supabase.storage
        .from("fotos-luthieria")
        .getPublicUrl(fileName);
      form.value.logo_url = data.publicUrl;
      triggerToast("Logomarca carregada com sucesso!", "success");
    }
  } catch (err) {
    triggerToast("Erro ao processar imagem.", "error");
  } finally {
    carregandoFoto.value = false;
  }
}

function removerLogo() {
  form.value.logo_url = null;
  triggerToast("Logomarca removida. Lembre-se de salvar.", "info");
}

onMounted(() => carregarConfiguracoes());
</script>

<template>
  <div class="card">
    <h3 class="title-section" style="margin-top: 0">
      ⚙️ Configurações da Oficina (White-label)
    </h3>

    <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px">
      <div class="box" style="flex: 1; min-width: 250px">
        <h4 style="margin-top: 0; color: var(--primary)">Identidade Visual</h4>
        <div style="display: flex; gap: 15px; align-items: center">
          <div
            style="
              width: 80px;
              height: 80px;
              border: 1px dashed var(--border);
              border-radius: 8px;
              display: flex;
              justify-content: center;
              align-items: center;
              overflow: hidden;
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
              />
            </label>
            <br />
            <button
              v-if="form.logo_url"
              class="btn-icon text-danger"
              @click="removerLogo"
              style="font-size: 0.85rem"
            >
              🗑️ Remover Logo
            </button>
          </div>
        </div>
      </div>

      <div
        class="box"
        style="flex: 2; min-width: 300px; border: 2px solid var(--primary)"
      >
        <h4 style="margin-top: 0; color: var(--primary)">
          Cores e Tipografia (Preview Real)
        </h4>
        <div
          style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px"
        >
          <div style="flex: 1; display: flex; flex-direction: column">
            <label>Cor Primária (Topo e Botões)</label>
            <div style="display: flex; gap: 5px; align-items: center">
              <input
                type="color"
                v-model="form.cor_primaria"
                @input="aplicarTemaPreview"
                style="height: 40px; padding: 2px; cursor: pointer; width: 50px"
              />
              <input
                type="text"
                v-model="form.cor_primaria"
                @input="aplicarTemaPreview"
                style="flex: 1"
              />
            </div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column">
            <label>Cor Secundária (Avisos / Destaques)</label>
            <div style="display: flex; gap: 5px; align-items: center">
              <input
                type="color"
                v-model="form.cor_secundaria"
                @input="aplicarTemaPreview"
                style="height: 40px; padding: 2px; cursor: pointer; width: 50px"
              />
              <input
                type="text"
                v-model="form.cor_secundaria"
                @input="aplicarTemaPreview"
                style="flex: 1"
              />
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap">
          <div style="flex: 1; display: flex; flex-direction: column">
            <label>Cor de Fundo da Tela</label>
            <div style="display: flex; gap: 5px; align-items: center">
              <input
                type="color"
                v-model="form.cor_fundo"
                @input="aplicarTemaPreview"
                style="height: 40px; padding: 2px; cursor: pointer; width: 50px"
              />
              <input
                type="text"
                v-model="form.cor_fundo"
                @input="aplicarTemaPreview"
                style="flex: 1"
              />
            </div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column">
            <label>Estilo de Fonte do Sistema</label>
            <select
              v-model="form.fonte_principal"
              @change="aplicarTemaPreview"
              style="height: 40px"
            >
              <option value="'Inter', sans-serif">
                Inter (Padrão e Limpa)
              </option>
              <option value="'Roboto', sans-serif">Roboto (Clássico)</option>
              <option value="'Montserrat', sans-serif">
                Montserrat (Moderna e Redonda)
              </option>
              <option value="'Courier New', monospace">
                Courier (Estilo Máquina de Escrever)
              </option>
              <option value="Georgia, serif">Georgia (Elegante)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div
      class="box"
      style="
        margin-bottom: 20px;
        border-left: 4px solid var(--success);
        background-color: #f8fff9;
      "
    >
      <h4 style="margin-top: 0; color: var(--success)">
        💰 Taxas de Recebimento (%)
      </h4>
      <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 15px">
        Configure a % cobrada pelas suas maquininhas de cartão ou bancos. Isso
        fará com que o sistema calcule automaticamente o seu lucro líquido real
        no encerramento da Ordem de Serviço.
      </p>

      <div style="display: flex; gap: 15px; flex-wrap: wrap">
        <div style="flex: 1; min-width: 120px">
          <label>PIX (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            v-model="form.taxa_pix"
            placeholder="Ex: 0"
          />
        </div>
        <div style="flex: 1; min-width: 120px">
          <label>Dinheiro (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            v-model="form.taxa_dinheiro"
            placeholder="Ex: 0"
          />
        </div>
        <div style="flex: 1; min-width: 120px">
          <label>Cartão de Crédito (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            v-model="form.taxa_credito"
            placeholder="Ex: 4.99"
          />
        </div>
        <div style="flex: 1; min-width: 120px">
          <label>Cartão de Débito (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            v-model="form.taxa_debito"
            placeholder="Ex: 1.99"
          />
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>Nome da Luthieria / Profissional:</label>
      <input
        v-model="form.nome_luthieria"
        placeholder="Ex: Flávio Bei - Luthier"
      />
    </div>

    <div style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap">
      <div style="flex: 1">
        <label>Documento (CNPJ/CPF):</label>
        <input v-model="form.documento" placeholder="00.000.000/0001-00" />
      </div>
      <div style="flex: 1">
        <label>Telefone / WhatsApp:</label>
        <input v-model="form.telefone" placeholder="(11) 99999-9999" />
      </div>
    </div>

    <div class="form-group">
      <label>Endereço Completo (Aparecerá nos recibos):</label>
      <input
        v-model="form.endereco"
        placeholder="Rua das Cordas, 123 - São Paulo, SP"
      />
    </div>

    <div class="form-group">
      <label>Termos e Condições / Garantia Padrão:</label>
      <textarea
        v-model="form.termos_garantia"
        rows="4"
        placeholder="Regras de garantia, prazos de recolha do instrumento, etc."
      ></textarea>
    </div>

    <button
      class="btn-primary"
      @click="salvarConfiguracoes"
      :disabled="loading"
      style="width: 100%; padding: 12px; font-size: 1.1rem"
    >
      {{ loading ? "⏳ A guardar..." : "💾 Salvar Configurações e Taxas" }}
    </button>
  </div>
</template>
