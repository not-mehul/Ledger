// Downscales picked photos to JPEG before they're stored.

export interface ProcessedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export const FULL_SIZE = 1600;
export const THUMB_SIZE = 480;

async function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<ProcessedImage> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

/** Returns a full-size and a thumbnail JPEG, honouring EXIF orientation. */
export async function processPhoto(file: Blob): Promise<{ full: ProcessedImage; thumb: ProcessedImage }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return {
      full: await encode(bitmap, FULL_SIZE, 0.84),
      thumb: await encode(bitmap, THUMB_SIZE, 0.78),
    };
  } finally {
    bitmap.close();
  }
}
