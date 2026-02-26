/**
 * ============================================================================
 * @file        imageUtils.js
 * @description Utilitário para redimensionar e comprimir imagens no cliente (navegador)
 * antes de fazer o upload, poupando armazenamento e dados móveis.
 * ============================================================================
 */

export function comprimirImagem(
  file,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8,
) {
  return new Promise((resolve, reject) => {
    // Se não for uma imagem, devolve o ficheiro original intacto
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcula a nova dimensão mantendo a proporção da imagem
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Cria um canvas invisível para redesenhar a imagem menor
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Mantém PNGs como PNGs para não perder o fundo transparente (ex: Logos)
        // O resto (fotos da câmara) converte para JPEG comprimido
        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

        // Aplica a compressão
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File([blob], file.name, {
                type: mimeType,
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              reject(new Error("Erro ao comprimir imagem."));
            }
          },
          mimeType,
          quality,
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
