import imageCompression from "browser-image-compression";

/**
 * Comprime e redimensiona imagens para garantir performance e economia de storage.
 * Otimizado para reduzir logos de MBs para KBs.
 */
export async function comprimirImagem(file) {
  // Se não for imagem, retorna o arquivo original
  if (!file.type.startsWith("image/")) return file;

  const options = {
    maxSizeMB: 0.2, // Alvo de 200KB (ideal para fotos de diário)
    maxWidthOrHeight: 1000, // Redimensiona se a foto for gigantesca (4k, etc)
    useWebWorker: true,
    initialQuality: 0.6, // Qualidade inicial de 60%
  };

  // AJUSTE PARA LOGOS: Se o nome do arquivo sugerir um logo ou se você quiser
  // que a compressão seja sempre mais forte, podemos baixar esses valores.
  if (file.size > 2 * 1024 * 1024) {
    // Se for maior que 2MB, apertamos mais
    options.maxSizeMB = 0.1; // Alvo de 100KB
    options.initialQuality = 0.5; // 50% de qualidade
    options.maxWidthOrHeight = 600; // Logos não precisam de mais de 800px de largura
  }

  try {
    const compressedFile = await imageCompression(file, options);
    console.log(
      `Compressão finalizada: de ${(file.size / 1024 / 1024).toFixed(2)}MB para ${(compressedFile.size / 1024).toFixed(0)}KB`,
    );
    return compressedFile;
  } catch (error) {
    console.error("Erro ao comprimir imagem:", error);
    return file; // Em caso de erro, envia a original para não travar o app
  }
}
