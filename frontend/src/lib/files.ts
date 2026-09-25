'use client';

/** Limite da API (documents.service MAX_DOCUMENT_BYTES). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPT_UPLOAD = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

export interface PreparedFile {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes: number;
  previewUrl: string | null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Foto de celular tem 4–12 MB: reduz para no máximo 1600 px e JPEG 82% antes
 * de enviar (§21 — "compressão de imagens"). PDF vai como está.
 */
export async function prepareUpload(file: File, maxSide = 1600): Promise<PreparedFile> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('PDF grande demais (máximo de 8 MB).');
    return { fileName: file.name, mimeType: file.type, dataBase64: await blobToBase64(file), sizeBytes: file.size, previewUrl: null };
  }
  if (!file.type.startsWith('image/')) throw new Error('Envie foto (JPG, PNG, WEBP) ou PDF.');

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('Imagem grande demais (máximo de 8 MB).');
    return { fileName: file.name, mimeType: file.type, dataBase64: await blobToBase64(file), sizeBytes: file.size, previewUrl: URL.createObjectURL(file) };
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Não foi possível ler a imagem.');
  const fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return { fileName, mimeType: 'image/jpeg', dataBase64: await blobToBase64(blob), sizeBytes: blob.size, previewUrl: URL.createObjectURL(blob) };
}
