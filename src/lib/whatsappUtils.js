export function abrirWhatsapp(cliente, texto) {
  if (!cliente.telefone) {
    alert("Este cliente não tem telefone registado.");
    return;
  }

  // 1. Limpar o número (remover ( ) - e espaços)
  let numero = cliente.telefone.replace(/\D/g, "");

  // 2. Garantir código do país (Assumindo Brasil 55, se for Portugal use 351)
  // Se o número não começar com 55 (e tiver tamanho de celular BR), adiciona.
  // Ajuste conforme sua região.
  if (numero.length <= 11) {
    numero = "55" + numero;
  }

  // 3. Codificar o texto para URL (troca espaços por %20, etc)
  const textoCodificado = encodeURIComponent(texto);

  // 4. Abrir link
  const url = `https://wa.me/${numero}?text=${textoCodificado}`;
  window.open(url, "_blank");
}
