/**
 * ============================================================================
 * @file        financeiroUtils.js
 * @description Funções puras para cálculos financeiros e de custos da Luthieria
 * ============================================================================
 */

export function calcularCustoEstimado(itensOrcamento, catalogoOriginal) {
  let custoBase = 0;

  itensOrcamento.forEach((item) => {
    if (item.tipo === "Desconto") return;

    const catItem = catalogoOriginal.find((c) => c.nome === item.descricao);
    if (catItem) {
      let custoDesteItem = Number(catItem.custo_padrao) || 0;

      if (
        (catItem.tipo === "MaoDeObra" || catItem.tipo === "Serviço") &&
        catItem.insumos_consumidos?.length > 0
      ) {
        catItem.insumos_consumidos.forEach((ins) => {
          const insRef = catalogoOriginal.find((c) => c.id === ins.insumo_id);
          if (insRef) {
            custoDesteItem +=
              (Number(insRef.custo_padrao) || 0) * Number(ins.quantidade);
          }
        });
      }
      custoBase += custoDesteItem;
    }
  });

  return custoBase;
}

export function calcularTaxaPagamento(valor, metodo, configLuthieria) {
  let percentualTaxa = 0;

  if (metodo === "PIX") percentualTaxa = Number(configLuthieria.taxa_pix) || 0;
  else if (metodo === "Dinheiro")
    percentualTaxa = Number(configLuthieria.taxa_dinheiro) || 0;
  else if (metodo === "Cartão de Crédito")
    percentualTaxa = Number(configLuthieria.taxa_credito) || 0;
  else if (metodo === "Cartão de Débito")
    percentualTaxa = Number(configLuthieria.taxa_debito) || 0;

  return (valor * percentualTaxa) / 100;
}
