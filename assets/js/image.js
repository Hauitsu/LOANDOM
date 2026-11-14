/* Turn a pasted portrait into a data URL that fits in a sheet cell,
   without cropping: the original aspect ratio is preserved and the image is
   never scaled below 25% of its original size unless storage forces it. */

const MIN_SCALE = 0.25;
const MAX_SIDE = 384;
const MAX_CHARS = 45000;

async function loadBitmap(blob) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not a readable image.'));
    };
    img.src = url;
  });
}

export async function toPortraitDataUrl(blob) {
  if (!blob || !String(blob.type || '').startsWith('image/')) {
    throw new Error('That is not an image.');
  }
  const bitmap = await loadBitmap(blob);
  const width = bitmap.width || bitmap.naturalWidth;
  const height = bitmap.height || bitmap.naturalHeight;
  if (!width || !height) throw new Error('That image has no pixels.');

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.imageSmoothingQuality = 'high';

  const draw = (scale, quality) => {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const type = canvas.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    return canvas.toDataURL(type, quality);
  };

  // Keep the aspect ratio. Start at 25% minimum, but cap very large images
  // so a single sheet cell stays under the 50k character limit.
  let scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  scale = Math.max(scale, MIN_SCALE);

  let quality = 0.86;
  let url = draw(scale, quality);

  while (url.length > MAX_CHARS && quality > 0.38) {
    quality -= 0.1;
    url = draw(scale, quality);
  }
  // Last resort for extremely large sources: shrink, still without cropping.
  while (url.length > MAX_CHARS && scale > 0.12) {
    scale *= 0.85;
    url = draw(scale, Math.max(0.45, quality));
  }
  if (url.length > MAX_CHARS) {
    throw new Error('Portrait is too large after compression. Try a smaller crop or a lower-resolution copy.');
  }
  return url;
}
