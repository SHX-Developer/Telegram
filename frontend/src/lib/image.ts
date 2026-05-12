"use client";

/**
 * Ресайз картинки на клиенте: даунскейл до max NxN с сохранением aspect-ratio,
 * рендер в JPEG с заданным качеством, возврат data URL (base64).
 * Подходит для аватарок: ~10–20КБ для 256×256.
 */
export async function fileToResizedDataUrl(
  file: File,
  options: { maxSize?: number; quality?: number } = {}
): Promise<string> {
  const maxSize = options.maxSize ?? 256;
  const quality = options.quality ?? 0.85;

  if (!file.type.startsWith("image/")) {
    throw new Error("Файл не является изображением");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      i.src = objectUrl;
    });

    const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context недоступен");
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
