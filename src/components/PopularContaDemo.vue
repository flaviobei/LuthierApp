<script setup>
import { ref } from "vue";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../composables/useToast";
import { useI18n } from "vue-i18n";

const { triggerToast } = useToast();
const { t } = useI18n();
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
  const confirmacao = confirm(t('ferramentas.alert_injetar'));
  if (!confirmacao) return;

  loading.value = true;
  triggerToast(t('ferramentas.toast_preparando'), "info");

  try {
    // ==========================================
    // 0. CONFIGURAÇÕES DA OFICINA
    // ==========================================
    progresso.value = t('ferramentas.prog_config');

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
    progresso.value = t('ferramentas.prog_cat');

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
          nome: "Potenciômetro CTS 500k",
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
    progresso.value = t('ferramentas.prog_cli');
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
    progresso.value = t('ferramentas.prog_fin');
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
    progresso.value = t('ferramentas.prog_os');
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

    // ==========================================
    // 6. FATURAMENTO PARADO E LISTA DE COMPRAS
    // ==========================================
    progresso.value = t('ferramentas.prog_faturamento');

    // O.S. Atrasada 30 dias
    const data30 = dataAleatoria(30, 31);
    const { data: os30 } = await supabase
      .from("servicos")
      .insert([
        {
          instrumento_id: insts[0].id,
          numero_os: numeroOS++,
          status: "Aprovado",
          fase_projeto: "Pronto para Entrega",
          tipo_os: "Padrão",
          descricao_cliente:
            "Retífica de trastes (Pronto, aguardando retirada há 30 dias).",
          data_entrada: dataAleatoria(40, 45),
          data_previsao_entrega: dataAleatoria(32, 35),
          data_conclusao: data30,
        },
      ])
      .select();

    if (os30 && os30.length > 0) {
      await supabase.from("orcamento_itens").insert([
        {
          servico_id: os30[0].id,
          catalogo_id: servicosCat[3].id,
          descricao: servicosCat[3].nome,
          valor: servicosCat[3].preco_padrao,
          tipo: "Mão de Obra",
        },
      ]);
    }

    // O.S. Atrasada 65 dias
    const data65 = dataAleatoria(65, 66);
    const { data: os65 } = await supabase
      .from("servicos")
      .insert([
        {
          instrumento_id: insts[1].id,
          numero_os: numeroOS++,
          status: "Aprovado",
          fase_projeto: "Pronto para Entrega",
          tipo_os: "Padrão",
          descricao_cliente:
            "Blindagem e Elétrica (Pronto, aguardando retirada há 65 dias).",
          data_entrada: dataAleatoria(75, 80),
          data_previsao_entrega: dataAleatoria(67, 70),
          data_conclusao: data65,
        },
      ])
      .select();

    if (os65 && os65.length > 0) {
      await supabase.from("orcamento_itens").insert([
        {
          servico_id: os65[0].id,
          catalogo_id: servicosCat[1].id,
          descricao: servicosCat[1].nome,
          valor: servicosCat[1].preco_padrao,
          tipo: "Mão de Obra",
        },
      ]);
    }

    // LISTA DE COMPRAS
    await supabase.from("lista_compras").insert([
      {
        nome: "Tupia de Coluna  Makita",
        foto_url:
          "https://www.dutramaquinas.com.br/shared/img/produto/alta/248917_tupia_de_coluna_900_watts_para_pinca_de_1_4_m3601b.webp",
        valor: 935.0,
        link: "https://www.dutramaquinas.com.br/p/tupia-de-coluna-900-watts-para-pinca-de-1-4-m3601b-m3601b-220v",
        tipo: "wish",
        nivel_necessidade: 9,
        justificativa: "Tupia queimou.",
      },
      {
        nome: "Prensa de Trastes",
        foto_url:
          "https://i0.wp.com/www.mestreluthier.com.br/wp-content/uploads/2025/06/265.jpg",
        valor: 722.0,
        link: "https://www.mestreluthier.com.br/produto/prensa-de-trastes-fret-press-caul-ao-mestre-luthier",
        tipo: "wish",
        nivel_necessidade: 5,
        justificativa: "Agiliza muito o trabalho de trastejamento.",
      },
      {
        nome: "Lixa D'água Grão 2000 (Pacote 50)",
        foto_url: "",
        valor: 85.0,
        tipo: "need",
        nivel_necessidade: 9,
        justificativa:
          "Estoque quase zerado. Uso diário no polimento de verniz.",
      },
      {
        nome: "Óleo de Limão Dunlop 65",
        foto_url: "",
        valor: 65.0,
        tipo: "need",
        nivel_necessidade: 10,
        justificativa: "Acabou! Comprar urgente para as próximas regulagens.",
      },
    ]);

    // ==========================================
    // 8. CHECKLIST PADRÃO
    // ==========================================
    progresso.value = t('ferramentas.prog_checklist');
    await supabase.from("checklist_padrao").insert([
      {
        tipo: "Chegada",
        item_nome: "Estado da Pintura / Verniz",
        opcao_positiva: "✅ Intacto",
        opcao_negativa: "❌ Com Marcas",
      },
      {
        tipo: "Chegada",
        item_nome: "Parte Elétrica Funcionando?",
        opcao_positiva: "✅ Sim",
        opcao_negativa: "❌ Ruídos/Falhas",
      },
      {
        tipo: "Chegada",
        item_nome: "Tarrachas e Ferragens",
        opcao_positiva: "✅ OK",
        opcao_negativa: "❌ Oxidadas",
      },
      {
        tipo: "Saída",
        item_nome: "Limpeza Geral e Polimento",
        opcao_positiva: "✅ Brilhando",
        opcao_negativa: "❌ Refazer",
      },
      {
        tipo: "Saída",
        item_nome: "Afinação Estável?",
        opcao_positiva: "✅ Segurando",
        opcao_negativa: "❌ Caindo",
      },
      {
        tipo: "Saída",
        item_nome: "Testado em todas as casas?",
        opcao_positiva: "✅ Aprovado",
        opcao_negativa: "❌ Reprovar",
      },
    ]);

    triggerToast(
      t('ferramentas.toast_sucesso_demo'),
      "success",
    );

    setTimeout(() => {
      localStorage.setItem("luthierapp_resume_tour_after_demo", "4");
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
  const confirmacao = confirm(t('ferramentas.alert_resetar'));
  if (!confirmacao) return;

  const texto = prompt(t('ferramentas.prompt_apagar'));
  if (texto !== "APAGAR TUDO") {
    triggerToast(t('ferramentas.toast_cancelado'), "info");
    return;
  }

  loading.value = true;
  progresso.value = t('ferramentas.prog_apaga_trans');

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    // Delete in order to respect potential foreign key constraints
    await supabase.from("transacoes").delete().not("id", "is", null);
    await supabase.from("orcamento_itens").delete().not("id", "is", null);

    progresso.value = t('ferramentas.prog_apaga_os');
    await supabase.from("servicos").delete().not("id", "is", null);

    progresso.value = t('ferramentas.prog_apaga_inst');
    await supabase.from("instrumentos").delete().not("id", "is", null);

    progresso.value = t('ferramentas.prog_apaga_cli');
    await supabase.from("clientes").delete().not("id", "is", null);

    progresso.value = t('ferramentas.prog_apaga_extra');
    await supabase.from("catalogo").delete().not("id", "is", null);
    await supabase.from("lista_compras").delete().not("id", "is", null);
    await supabase.from("checklist_padrao").delete().not("id", "is", null);

    triggerToast(t('ferramentas.toast_sucesso_reset'), "success");

    setTimeout(() => {
      window.location.reload(true);
    }, 2000);
  } catch (error) {
    triggerToast(t('ferramentas.erro_limpar') + error.message, "error");
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
          <span class="icon-dinamico">science</span> {{ $t('ferramentas.titulo_demo') }}
        </h3>
        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #7f8c8d" v-html="$t('ferramentas.desc_demo')"></p>
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
      <button
        type="button"
        id="btn-iniciar-simulacao"
        class="btn-primary"
        style="background: var(--danger); border: none; min-height: 50px"
        @click="gerarDadosDeExemplo"
        :disabled="loading"
      >
        <span class="icon-dinamico" style="font-size: 1.5rem">{{
          loading && progresso.includes("injetar")
            ? "hourglass_empty"
            : "rocket_launch"
        }}</span>
        <span style="font-size: 1.1rem; font-weight: bold">{{
          loading && progresso.includes("injetar")
            ? $t('ferramentas.btn_injetando')
            : $t('ferramentas.btn_iniciar')
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
          <span class="icon-dinamico">delete_sweep</span> {{ $t('ferramentas.titulo_reset') }}
        </h3>
        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #7f8c8d" v-html="$t('ferramentas.desc_reset')"></p>
      </div>
      <button
        type="button"
        class="btn-primary"
        style="background: #b91c1c; border: none; min-height: 50px"
        @click="limparDadosConta"
        :disabled="loading"
      >
        <span class="icon-dinamico" style="font-size: 1.5rem">{{
          loading && progresso.includes("apagar")
            ? "hourglass_empty"
            : "warning"
        }}</span>
        <span style="font-size: 1.1rem; font-weight: bold">{{
          loading && progresso.includes("apagar")
            ? $t('ferramentas.btn_limpando')
            : $t('ferramentas.btn_resetar')
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
