"use client";

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

/** Лимит на размер файла перед отправкой как data URL. */
export const MAX_FILE_BYTES = 8_000_000;

export interface ReadFilePayload {
  dataUrl: string;
  name: string;
  mime: string;
  size: number;
}

export async function readFileForUpload(file: File): Promise<ReadFilePayload> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Файл слишком большой (макс. ${Math.round(MAX_FILE_BYTES / 1_000_000)} MB)`);
  }
  const dataUrl = await fileToDataUrl(file);
  return {
    dataUrl,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
}
