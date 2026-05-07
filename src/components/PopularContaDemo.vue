<script setup>
import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";

const { triggerToast } = useToast();
const loading = ref(false);
const progresso = ref("");

// --- FUNÇÕES AUXILIARES DE DATA E ALEATORIEDADE ---
function dataAleatoria(minDiasAtras, maxDiasAtras) {
  const d = new Date();
  const dias =
    Math.floor(Math.random() * (maxDiasAtras - minDiasAtras + 1)) +
    minDiasAtras;
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

function dataAdicionarDias(dataIso, dias) {
  const d = new Date(dataIso);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- MOTOR DE GERAÇÃO ---
async function gerarDadosDeExemplo() {
  const confirmacao = confirm(
    "ATENÇÃO: Isto vai injetar Configurações, Clientes, Instrumentos, Serviços e Faturamento. Continuar?",
  );
  if (!confirmacao) return;

  loading.value = true;
  triggerToast("A preparar o ecossistema. Por favor aguarde...", "info");

  try {
    // ==========================================
    // 0. CONFIGURAÇÕES DA OFICINA
    // ==========================================
    progresso.value = "A configurar perfil da oficina e identidade visual...";

    const configPayload = {
      nome_luthieria: "Oficina Demo Luthieria",
      documento: "12.345.678/0001-90",
      telefone: "(11) 98888-7777",
      endereco: "Av. da Música, 432 - São Paulo, SP",
      termos_garantia:
        "Garantia de 90 dias para serviços de regulagem. As peças substituídas estão sujeitas à garantia do respectivo fabricante. Instrumentos não retirados em 30 dias após o aviso de conclusão estarão sujeitos a taxa de armazenamento.",
      tipo_impressora: "padrao",
      taxa_pix: 0,
      taxa_dinheiro: 0,
      taxa_credito: 4.99,
      taxa_debito: 1.99,
      cor_primaria: "#0F172A",
      cor_secundaria: "#3B82F6",
      cor_fundo: "#F8FAFC",
      text_color: "#0F172A",
      btn_primary_bg: "#0F172A",
      btn_primary_text: "#ffffff",
      btn_accent_bg: "#3B82F6",
      btn_accent_text: "#ffffff",
      radius_perc: 8,
      fonte_principal: "'Inter', sans-serif",
      estilo_icones: "Material Symbols Outlined",
    };

    const { data: configExistente } = await supabase
      .from("configuracoes")
      .select("id")
      .limit(1);
    if (configExistente && configExistente.length > 0) {
      const { error: errConfig } = await supabase
        .from("configuracoes")
        .update(configPayload)
        .eq("id", configExistente[0].id);
      if (errConfig)
        throw new Error("Erro nas Configurações: " + errConfig.message);
    } else {
      const { error: errConfig } = await supabase
        .from("configuracoes")
        .insert([configPayload]);
      if (errConfig)
        throw new Error("Erro nas Configurações: " + errConfig.message);
    }

    // ==========================================
    // 1. CATÁLOGO
    // ==========================================
    progresso.value = "A criar catálogo de peças e serviços...";

    const { data: insumos, error: errInsumos } = await supabase
      .from("catalogo")
      .insert([
        {
          nome: "Óleo de Limão (ml)",
          tipo: "Insumo",
          preco_padrao: 0,
          custo_padrao: 0.5,
          controla_estoque: true,
          quantidade_estoque: 500,
          estoque_minimo: 50,
        },
        {
          nome: "Solda (g)",
          tipo: "Insumo",
          preco_padrao: 0,
          custo_padrao: 0.2,
          controla_estoque: true,
          quantidade_estoque: 1000,
          estoque_minimo: 200,
        },
        {
          nome: "Fita de Cobre (cm)",
          tipo: "Insumo",
          preco_padrao: 0,
          custo_padrao: 0.1,
          controla_estoque: true,
          quantidade_estoque: 2000,
          estoque_minimo: 500,
        },
      ])
      .select();
    if (errInsumos) throw new Error("Erro nos Insumos: " + errInsumos.message);

    const { data: pecas, error: errPecas } = await supabase
      .from("catalogo")
      .insert([
        {
          nome: "Jogo de Cordas Elixir 0.10",
          tipo: "Peca",
          preco_padrao: 150,
          custo_padrao: 90,
          controla_estoque: true,
          quantidade_estoque: 15,
          estoque_minimo: 5,
        },
        {
          nome: "Jogo de Cordas Ernie Ball 0.09",
          tipo: "Peca",
          preco_padrao: 85,
          custo_padrao: 45,
          controla_estoque: true,
          quantidade_estoque: 4,
          estoque_minimo: 10,
        },
        {
          nome: "Potenciómetro CTS 500k",
          tipo: "Peca",
          preco_padrao: 65,
          custo_padrao: 30,
          controla_estoque: true,
          quantidade_estoque: 20,
          estoque_minimo: 6,
        },
        {
          nome: "Jack Switchcraft",
          tipo: "Peca",
          preco_padrao: 45,
          custo_padrao: 20,
          controla_estoque: true,
          quantidade_estoque: 12,
          estoque_minimo: 4,
        },
      ])
      .select();
    if (errPecas) throw new Error("Erro nas Peças: " + errPecas.message);

    const { data: servicosCat, error: errServicos } = await supabase
      .from("catalogo")
      .insert([
        {
          nome: "Regulagem Geral",
          tipo: "MaoDeObra",
          preco_padrao: 180,
          custo_padrao: 5,
          insumos_consumidos: [
            { insumo_id: insumos[0].id, nome: insumos[0].nome, quantidade: 10 },
          ],
        },
        {
          nome: "Blindagem Cavidade",
          tipo: "MaoDeObra",
          preco_padrao: 250,
          custo_padrao: 20,
          insumos_consumidos: [
            {
              insumo_id: insumos[2].id,
              nome: insumos[2].nome,
              quantidade: 200,
            },
            { insumo_id: insumos[1].id, nome: insumos[1].nome, quantidade: 5 },
          ],
        },
        {
          nome: "Troca de Captadores",
          tipo: "MaoDeObra",
          preco_padrao: 150,
          custo_padrao: 2,
          insumos_consumidos: [
            { insumo_id: insumos[1].id, nome: insumos[1].nome, quantidade: 10 },
          ],
        },
        {
          nome: "Troca de Trastes (Inox)",
          tipo: "MaoDeObra",
          preco_padrao: 850,
          custo_padrao: 150,
        },
      ])
      .select();
    if (errServicos)
      throw new Error("Erro nos Serviços Catalogo: " + errServicos.message);

    // ==========================================
    // 2. CLIENTES
    // ==========================================
    progresso.value = "A cadastrar 10 clientes e 20 instrumentos...";
    const nomesClientes = [
      "João Marcos",
      "Mariana Silva",
      "Carlos Eduardo",
      "Ana Beatriz",
      "Pedro Paulo",
      "Lucas Fernandes",
      "Juliana Costa",
      "Rafael Souza",
      "Camila Rocha",
      "Fernando Almeida",
    ];

    const clientesPayload = nomesClientes.map((nome, i) => ({
      nome,
      telefone: `551199999000${i}`,
      email: `${nome.split(" ")[0].toLowerCase()}@email.com`,
      endereco: `Rua Demo, ${i * 10}, São Paulo - SP`,
    }));
    const { data: clientes, error: errClientes } = await supabase
      .from("clientes")
      .insert(clientesPayload)
      .select();
    if (errClientes)
      throw new Error("Erro nos Clientes: " + errClientes.message);

    // ==========================================
    // 3. INSTRUMENTOS
    // ==========================================
    const marcasGuit = [
      "Fender",
      "Gibson",
      "Ibanez",
      "Tagima",
      "Epiphone",
      "PRS",
    ];
    const marcasBaixo = ["Music Man", "Fender", "Yamaha", "Squier"];
    const marcasViolao = ["Taylor", "Martin", "Yamaha", "Takamine"];

    let instrumentosPayload = [];
    clientes.forEach((cli) => {
      instrumentosPayload.push({
        cliente_id: cli.id,
        tipo: Math.random() > 0.3 ? "Guitarra" : "Baixo",
        marca:
          Math.random() > 0.3
            ? randomItem(marcasGuit)
            : randomItem(marcasBaixo),
        modelo: "Modelo Standard",
        afinacao_padrao: "E Standard",
      });
      instrumentosPayload.push({
        cliente_id: cli.id,
        tipo: Math.random() > 0.5 ? "Violão" : "Guitarra",
        marca:
          Math.random() > 0.5
            ? randomItem(marcasViolao)
            : randomItem(marcasGuit),
        modelo: "Série Especial",
        afinacao_padrao: randomItem(["Drop D", "Eb Standard", "E Standard"]),
      });
    });
    const { data: insts, error: errInsts } = await supabase
      .from("instrumentos")
      .insert(instrumentosPayload)
      .select();
    if (errInsts) throw new Error("Erro nos Instrumentos: " + errInsts.message);

    // ==========================================
    // 4. DESPESAS FIXAS
    // ==========================================
    progresso.value = "A gerar fluxo de caixa e custos operacionais...";
    let despesasPayload = [];
    for (let mes = 0; mes <= 7; mes++) {
      const dataPagamento = dataAleatoria(mes * 30, mes * 30 + 5);
      despesasPayload.push(
        {
          tipo: "Saida",
          valor_bruto: 1200,
          data_pagamento: dataPagamento,
          descricao: "Aluguel Oficina",
          forma_pagamento: "Transferência",
          categoria: "Infraestrutura",
        },
        {
          tipo: "Saida",
          valor_bruto: 150,
          data_pagamento: dataPagamento,
          descricao: "Conta de Luz",
          forma_pagamento: "PIX",
          categoria: "Infraestrutura",
        },
        {
          tipo: "Saida",
          valor_bruto: 100,
          data_pagamento: dataPagamento,
          descricao: "Internet",
          forma_pagamento: "PIX",
          categoria: "Infraestrutura",
        },
      );
    }
    const { error: errDespesas } = await supabase
      .from("transacoes")
      .insert(despesasPayload);
    if (errDespesas)
      throw new Error("Erro nas Despesas: " + errDespesas.message);

    // ==========================================
    // 5. ORDENS DE SERVIÇO & FATURAMENTO
    // ==========================================
    progresso.value = "A simular Ordens de Serviço (Passado e Presente)...";
    let numeroOS = Math.floor(Math.random() * 50000) + 10000;

    for (const inst of insts) {
      // -- O.S. 1: ANTIGA (CRM)
      const entradaAntiga = dataAleatoria(210, 240);
      const concAntiga = dataAdicionarDias(entradaAntiga, 5);

      // REMOVIDO cliente_id AQUI
      const { data: osAntiga, error: errOs1 } = await supabase
        .from("servicos")
        .insert([
          {
            instrumento_id: inst.id,
            numero_os: numeroOS++,
            status: "Entregue",
            fase_projeto: "Entregue",
            tipo_os: "Padrão",
            descricao_cliente: "Regulagem completa e troca de cordas.",
            data_entrada: entradaAntiga,
            data_previsao_entrega: dataAdicionarDias(entradaAntiga, 7),
            data_conclusao: concAntiga,
          },
        ])
        .select();
      if (errOs1) throw new Error("Erro ao criar OS Antiga: " + errOs1.message);

      const pecaCorda = randomItem([pecas[0], pecas[1]]);
      await supabase.from("orcamento_itens").insert([
        {
          servico_id: osAntiga[0].id,
          catalogo_id: servicosCat[0].id,
          descricao: servicosCat[0].nome,
          valor: servicosCat[0].preco_padrao,
          tipo: "Mão de Obra",
        },
        {
          servico_id: osAntiga[0].id,
          catalogo_id: pecaCorda.id,
          descricao: pecaCorda.nome,
          valor: pecaCorda.preco_padrao,
          tipo: "Peça",
        },
      ]);
      await supabase.from("transacoes").insert([
        {
          servico_id: osAntiga[0].id,
          tipo: "Entrada",
          valor_bruto: servicosCat[0].preco_padrao + pecaCorda.preco_padrao,
          data_pagamento: concAntiga,
          forma_pagamento: "PIX",
          descricao: "Pagamento Total",
          categoria: "Serviço",
        },
      ]);

      // -- O.S. 2: ALEATÓRIA
      const isAtiva = Math.random() > 0.7;
      const entradaNova = isAtiva
        ? dataAleatoria(0, 5)
        : dataAleatoria(15, 120);
      const statusNova = isAtiva ? "Aprovado" : "Entregue";
      const faseNova = isAtiva
        ? randomItem(["Na Bancada", "Aguardando Peças", "Fila de Espera"])
        : "Entregue";
      const concNova = isAtiva ? null : dataAdicionarDias(entradaNova, 6);
      const isRetrabalho = !isAtiva && Math.random() > 0.8;

      // REMOVIDO cliente_id AQUI
      const { data: osNova, error: errOs2 } = await supabase
        .from("servicos")
        .insert([
          {
            instrumento_id: inst.id,
            numero_os: numeroOS++,
            status: statusNova,
            fase_projeto: faseNova,
            tipo_os: isRetrabalho ? "Retrabalho" : "Padrão",
            descricao_cliente: isRetrabalho
              ? "Trastejando novamente após a entrega."
              : "Revisão da parte elétrica e blindagem.",
            motivo_retorno: isRetrabalho
              ? "Braço cedeu com a mudança climática."
              : null,
            data_entrada: entradaNova,
            data_previsao_entrega: dataAdicionarDias(entradaNova, 7),
            data_conclusao: concNova,
          },
        ])
        .select();
      if (errOs2)
        throw new Error("Erro ao criar OS Recente: " + errOs2.message);

      if (!isRetrabalho) {
        const srvBlindagem = servicosCat[1];
        const pecaJack = pecas[3];
        const valorTotalNova =
          srvBlindagem.preco_padrao + pecaJack.preco_padrao;

        await supabase.from("orcamento_itens").insert([
          {
            servico_id: osNova[0].id,
            catalogo_id: srvBlindagem.id,
            descricao: srvBlindagem.nome,
            valor: srvBlindagem.preco_padrao,
            tipo: "Mão de Obra",
          },
          {
            servico_id: osNova[0].id,
            catalogo_id: pecaJack.id,
            descricao: pecaJack.nome,
            valor: pecaJack.preco_padrao,
            tipo: "Peça",
          },
        ]);

        if (!isAtiva) {
          await supabase.from("transacoes").insert([
            {
              servico_id: osNova[0].id,
              tipo: "Entrada",
              valor_bruto: valorTotalNova,
              data_pagamento: concNova,
              forma_pagamento: "Cartão de Crédito",
              descricao: "Pagamento Total",
              categoria: "Serviço",
              taxa_taxa: valorTotalNova * 0.0499,
            },
          ]);
        } else {
          await supabase.from("transacoes").insert([
            {
              servico_id: osNova[0].id,
              tipo: "Entrada",
              valor_bruto: valorTotalNova / 2,
              data_pagamento: entradaNova,
              forma_pagamento: "PIX",
              descricao: "Sinal 50%",
              categoria: "Serviço",
              taxa_taxa: 0,
            },
          ]);
        }
      }
    }

    triggerToast(
      "Conta DEMO populada com SUCESSO! O ecossistema está vivo.",
      "success",
    );

    setTimeout(() => {
      window.location.reload(true);
    }, 2500);
  } catch (error) {
    triggerToast(error.message, "error");
    console.error(error);
  } finally {
    loading.value = false;
    progresso.value = "";
  }
}

// --- FUNÇÃO PARA LIMPAR A CONTA ---
async function limparDadosConta() {
  const confirmacao = confirm(
    "ATENÇÃO: Esta ação apagará TODOS os clientes, instrumentos, serviços, financeiro e catálogo da sua oficina! Esta ação é IRREVERSÍVEL. Continuar?"
  );
  if (!confirmacao) return;

  const texto = prompt("Para confirmar a exclusão, digite APAGAR TUDO em maiúsculas:");
  if (texto !== "APAGAR TUDO") {
    triggerToast("Limpeza cancelada. Confirmação incorreta.", "info");
    return;
  }

  loading.value = true;
  progresso.value = "A apagar transações e orçamentos...";

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    // Delete in order to respect potential foreign key constraints
    await supabase.from("transacoes").delete().not("id", "is", null);
    await supabase.from("orcamento_itens").delete().not("id", "is", null);
    
    progresso.value = "A apagar serviços...";
    await supabase.from("servicos").delete().not("id", "is", null);
    
    progresso.value = "A apagar instrumentos...";
    await supabase.from("instrumentos").delete().not("id", "is", null);
    
    progresso.value = "A apagar clientes...";
    await supabase.from("clientes").delete().not("id", "is", null);
    
    progresso.value = "A apagar catálogo...";
    await supabase.from("catalogo").delete().not("id", "is", null);

    triggerToast("Sua conta foi completamente zerada com sucesso!", "success");

    setTimeout(() => {
      window.location.reload(true);
    }, 2000);
  } catch (error) {
    triggerToast("Erro ao limpar: " + error.message, "error");
    console.error(error);
  } finally {
    loading.value = false;
    progresso.value = "";
  }
}
</script>

<template>
  <div
    class="card mb-2"
    style="border: 2px dashed var(--danger); background: #fff5f5"
  >
    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap">
      <div style="flex: 1; min-width: 250px">
        <h3
          style="
            margin: 0;
            color: var(--danger);
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">science</span> Gerador de Conta Demo
          (Avançado)
        </h3>
        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #7f8c8d">
          Uma conta vazia não mostra como o sistema funciona no uso diário. Use
          esse recurso para popular a conta com dados de teste, clientes,
          instrumentos, serviços, transações, etc. <br /><br />
          Atenção: Use isto apenas em contas de teste para demonstração. Injeta
          Identidade Visual, 10 clientes, 20 instrumentos, catálogo com
          consumos, custos fixos e 8 meses de histórico. Use para testes de
          funcionalidade e exibição de gráficos. <br /><br />Após os testes,
          você pode limpar a conta com o botão de limpeza abaixo para começar do zero.
        </p>
        <p
          v-if="progresso"
          style="
            margin-top: 8px;
            color: var(--danger);
            font-weight: bold;
            font-size: 0.85rem;
          "
        >
          <span
            class="icon-dinamico"
            style="
              font-size: 1rem;
              animation: spin 1s linear infinite;
              vertical-align: middle;
            "
            >sync</span
          >
          {{ progresso }}
        </p>
      </div>
      <button type="button"
        class="btn-primary"
        style="background: var(--danger); border: none; min-height: 50px"
        @click="gerarDadosDeExemplo"
        :disabled="loading"
      >
        <span class="icon-dinamico" style="font-size: 1.5rem">{{
          loading && progresso.includes('injetar') ? "hourglass_empty" : "rocket_launch"
        }}</span>
        <span style="font-size: 1.1rem; font-weight: bold">{{
          loading && progresso.includes('injetar') ? "A injetar..." : "Iniciar Simulação"
        }}</span>
      </button>
    </div>
  </div>

  <div
    class="card"
    style="border: 2px solid #ef4444; background: #fef2f2; margin-top: 20px"
  >
    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap">
      <div style="flex: 1; min-width: 250px">
        <h3
          style="
            margin: 0;
            color: #b91c1c;
            display: flex;
            align-items: center;
            gap: 8px;
          "
        >
          <span class="icon-dinamico">delete_sweep</span> Resetar Conta (Começar do Zero)
        </h3>
        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #7f8c8d">
          Utilize esta opção para <strong>apagar todos os dados</strong> (clientes, ordens de serviço, financeiro e catálogo). 
          As suas configurações de visual e logo serão mantidas. 
          Isso é ideal para limpar a oficina após testar o sistema.
        </p>
      </div>
      <button type="button"
        class="btn-primary"
        style="background: #b91c1c; border: none; min-height: 50px"
        @click="limparDadosConta"
        :disabled="loading"
      >
        <span class="icon-dinamico" style="font-size: 1.5rem">{{
          loading && progresso.includes('apagar') ? "hourglass_empty" : "warning"
        }}</span>
        <span style="font-size: 1.1rem; font-weight: bold">{{
          loading && progresso.includes('apagar') ? "A apagar..." : "Apagar Dados"
        }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
