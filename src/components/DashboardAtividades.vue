<script setup>
/**
 * ============================================================================
 * @file        DashboardAtividades.vue
 * @description Painel principal de indicadores (KPIs). Oferece uma visão
 * rápida sobre o volume de serviços em aberto, entregues e faturamento mensal.
 * @project     LuthierApp
 * ============================================================================
 */

import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import { abrirWhatsapp } from "../lib/whatsappUtils";
import { useToast } from "../composables/useToast"; // <-- Adicionado o Toast para padronizar

const emit = defineEmits(["abrirOS"]);
const { triggerToast } = useToast();

const servicosAbertos = ref([]);
const oportunidadesPosVenda = ref([]);
const loading = ref(true);

// Variaveis do Kanban foram removidas por agora

async function carregarPendencias() {
  loading.value = true;

  const { data, error } = await supabase
    .from("servicos")
    .select(
      `
      *, 
      instrumentos ( marca, modelo, cliente:clientes (nome, telefone) ),
      diario_servico ( descricao, foto_url, data_registro )
    `,
    )
    .neq("status", "Entregue")
    .neq("status", "Finalizado")
    .order("data_previsao_entrega", { ascending: true });

  if (!error && data) {
    servicosAbertos.value = data.map((os) => {
      if (!os.fase_projeto) os.fase_projeto = "Fila de Espera";

      if (os.diario_servico && os.diario_servico.length > 0) {
        os.diario_servico.sort(
          (a, b) => new Date(b.data_registro) - new Date(a.data_registro),
        );
        os.ultima_atualizacao = os.diario_servico[0];
      } else {
        os.ultima_atualizacao = null;
      }
      return os;
    });
  }

  loading.value = false;
  carregarPosVenda();
}

// --- LÓGICA DO PÓS-VENDA (CRM) ---
async function carregarPosVenda() {
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - 6);
  const hoje = new Date().toISOString();

  const { data, error } = await supabase
    .from("servicos")
    .select(
      `*, instrumentos ( marca, modelo, cliente:clientes (nome, telefone) )`,
    )
    .in("status", ["Entregue", "Finalizado"])
    .eq("pos_venda_contatado", false)
    .lte("data_conclusao", dataCorte.toISOString())
    .or(`data_lembrete_pos_venda.is.null,data_lembrete_pos_venda.lte.${hoje}`)
    .order("data_conclusao", { ascending: true })
    .limit(5);

  if (!error && data) oportunidadesPosVenda.value = data;
}

function chamarClientePosVenda(os) {
  const cli = os.instrumentos?.cliente;
  if (!cli || !cli.telefone)
    return triggerToast("Este cliente não tem telefone registado.", "error");

  const msg = `Olá *${cli.nome}*! Tudo bem?\n\nAqui é da Luthieria. Notei que já faz um tempo que entregámos o seu *${os.instrumentos.marca} ${os.instrumentos.modelo}* (O.S. #${os.numero_os}).\n\nComo ele se tem comportado? Se precisar de dar uma revisão ou um ajuste para manter a tocabilidade 100%, é só dizer! 🎸`;
  abrirWhatsapp(cli, msg);
}

async function marcarComoContatado(osId) {
  await supabase
    .from("servicos")
    .update({ pos_venda_contatado: true })
    .eq("id", osId);
  oportunidadesPosVenda.value = oportunidadesPosVenda.value.filter(
    (o) => o.id !== osId,
  );
  triggerToast("O.S. removida da lista de pendências do CRM.", "success");
}

async function adiarPosVenda(osId, dias) {
  const novaDataLembrete = new Date();
  novaDataLembrete.setDate(novaDataLembrete.getDate() + dias);
  await supabase
    .from("servicos")
    .update({ data_lembrete_pos_venda: novaDataLembrete })
    .eq("id", osId);
  oportunidadesPosVenda.value = oportunidadesPosVenda.value.filter(
    (o) => o.id !== osId,
  );
  triggerToast(`Lembrete adiado para daqui a ${dias} dias.`, "info");
}
// ---------------------------------

function corFase(fase) {
  switch (fase) {
    case "Fila de Espera":
      return "var(--text-muted)";
    case "Aguardando Peças":
      return "var(--danger)";
    case "Secagem / Cura":
      return "#6f42c1";
    case "Na Bancada":
      return "var(--primary)";
    case "Testes / Setup":
      return "#17a2b8";
    case "Pronto para Entrega":
      return "var(--success)";
    default:
      return "var(--warning)";
  }
}

function formatarData(dataIso) {
  if (!dataIso) return "--/--";
  const dataSegura = dataIso.includes("T") ? dataIso : dataIso + "T12:00:00";
  return new Date(dataSegura).toLocaleDateString("pt-BR");
}

function formatarDataCurta(dataIso) {
  if (!dataIso) return "";
  return new Date(dataIso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

onMounted(() => carregarPendencias());
</script>

<template>
  <div class="dash-container">
    <div v-if="oportunidadesPosVenda.length > 0" class="crm-box card">
      <div class="crm-header">
        <h3 style="margin: 0; color: #fff">
          💡 Retenção de Clientes (Pós-Venda)
        </h3>
        <span class="badge-crm"
          >{{ oportunidadesPosVenda.length }} Pendentes</span
        >
      </div>
      <p style="margin: 10px 0 15px 0; font-size: 0.9rem; color: #555">
        Estes instrumentos foram entregues há mais de 6 meses. Mande uma
        mensagem para gerar um novo serviço!
      </p>

      <div class="crm-list">
        <div
          v-for="opp in oportunidadesPosVenda"
          :key="opp.id"
          class="crm-item"
        >
          <div class="crm-info">
            <strong style="color: var(--primary); font-size: 1.1rem">{{
              opp.instrumentos?.cliente?.nome
            }}</strong>
            <span style="font-weight: bold; color: var(--text-muted)"
              >{{ opp.instrumentos?.marca }}
              {{ opp.instrumentos?.modelo }}</span
            >
            <small style="color: var(--danger)"
              >Entregue em: {{ formatarData(opp.data_conclusao) }}</small
            >
          </div>

          <div class="crm-actions-container">
            <button
              class="btn-success"
              @click="chamarClientePosVenda(opp)"
              style="
                flex: 1;
                padding: 10px;
                border-radius: 6px;
                font-weight: bold;
                border: none;
                cursor: pointer;
                background: #10b981;
                color: white;
              "
            >
              📱 Chamar no Zap
            </button>
            <div
              class="crm-actions-secundary"
              style="display: flex; gap: 8px; margin-top: 8px"
            >
              <button
                class="btn-icon bg-light"
                @click="adiarPosVenda(opp.id, 15)"
                title="Lembrar daqui a 15 dias"
                style="
                  flex: 1;
                  font-size: 0.85rem;
                  border: 1px solid var(--border);
                  border-radius: 4px;
                "
              >
                ⏰ Adiar 15d
              </button>
              <button
                class="btn-icon bg-light text-success"
                @click="marcarComoContatado(opp.id)"
                title="Marcar como Concluído"
                style="
                  flex: 1;
                  font-size: 0.85rem;
                  border: 1px solid var(--border);
                  border-radius: 4px;
                "
              >
                ✅ Já Falei
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      style="
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid var(--border);
      "
    >
      <h2 style="color: var(--primary); margin: 0">🛠️ Bancada de Trabalho</h2>
    </div>

    <div v-if="loading" class="text-muted text-center" style="padding: 40px">
      A preparar a bancada...
    </div>

    <div v-else-if="servicosAbertos.length === 0" class="card empty-state">
      <p style="font-size: 1.1rem; color: var(--text-muted)">
        🎉 Nenhuma pendência! Tudo entregue ou bancada limpa.
      </p>
    </div>

    <div v-else class="grid-cards">
      <div
        v-for="os in servicosAbertos"
        :key="os.id"
        class="card card-os"
        @click="$emit('abrirOS', os)"
      >
        <div
          class="status-badge"
          :style="{ backgroundColor: corFase(os.fase_projeto) }"
        >
          #{{ os.numero_os }} - {{ os.fase_projeto || os.status }}
        </div>

        <h3 class="modelo">{{ os.instrumentos?.modelo }}</h3>
        <span class="marca">{{ os.instrumentos?.marca }}</span>
        <div class="cliente">👤 {{ os.instrumentos?.cliente?.nome }}</div>

        <p class="desc">
          {{
            os.descricao_cliente?.length > 50
              ? os.descricao_cliente.slice(0, 50) + "..."
              : os.descricao_cliente
          }}
        </p>

        <div v-if="os.ultima_atualizacao" class="ultima-atualizacao">
          <div class="atualizacao-header">
            <small
              >Última anotação ({{
                formatarDataCurta(os.ultima_atualizacao.data_registro)
              }}):</small
            >
          </div>
          <div class="atualizacao-body">
            <img
              v-if="os.ultima_atualizacao.foto_url"
              :src="os.ultima_atualizacao.foto_url"
              class="miniatura-diario"
            />
            <p class="texto-diario">
              {{
                os.ultima_atualizacao.descricao.length > 55
                  ? os.ultima_atualizacao.descricao.slice(0, 55) + "..."
                  : os.ultima_atualizacao.descricao
              }}
            </p>
          </div>
        </div>
        <div v-else style="flex-grow: 1"></div>

        <div class="footer-card">
          <small>Entrada: {{ formatarData(os.data_entrada) }}</small>
          <small
            v-if="os.data_previsao_entrega"
            style="color: var(--danger); font-weight: bold"
          >
            Prazo: {{ formatarData(os.data_previsao_entrega) }}
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash-container {
  margin-bottom: 30px;
}

/* CRM ESTILOS */
.crm-box {
  border: 2px solid var(--accent);
  background: #fffdfa;
  margin-bottom: 30px;
  padding: 0;
  overflow: hidden;
}
.crm-header {
  background: var(--accent);
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.badge-crm {
  background: #fff;
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 0.85rem;
}
.crm-list {
  padding: 0 20px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.crm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border: 1px solid var(--border);
  padding: 15px;
  border-radius: 6px;
  flex-wrap: wrap;
  gap: 15px;
}
.crm-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.crm-actions-container {
  display: flex;
  flex-direction: column;
  min-width: 180px;
}

/* GRID DE CARDS DA BANCADA */
.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.card-os {
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.card-os:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
  border-color: var(--accent);
}
.status-badge {
  position: absolute;
  top: 0;
  right: 0;
  padding: 5px 12px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: bold;
  border-bottom-left-radius: 8px;
  box-shadow: -2px 2px 5px rgba(0, 0, 0, 0.1);
}
.modelo {
  margin: 15px 0 2px 0;
  font-size: 1.2rem;
  color: var(--primary);
}
.marca {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.cliente {
  margin: 12px 0;
  font-size: 0.95rem;
  color: var(--text-main);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  font-weight: 500;
}
.desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
  margin-bottom: 10px;
}

/* MINIATURA DO DIÁRIO */
.ultima-atualizacao {
  background: #fdfdfd;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 15px;
  flex-grow: 1;
}
.atualizacao-header {
  margin-bottom: 5px;
  color: var(--accent);
  font-weight: bold;
}
.atualizacao-body {
  display: flex;
  gap: 10px;
  align-items: center;
}
.miniatura-diario {
  width: 45px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.texto-diario {
  font-size: 0.8rem;
  color: var(--text-main);
  margin: 0;
  line-height: 1.3;
}

.footer-card {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: auto;
  background: var(--bg-body);
  padding: 8px;
  border-radius: 4px;
}
.empty-state {
  text-align: center;
  padding: 40px;
}

@media (max-width: 600px) {
  .crm-item {
    flex-direction: column;
    align-items: flex-start;
  }
  .crm-actions-container {
    width: 100%;
  }
}
</style>
