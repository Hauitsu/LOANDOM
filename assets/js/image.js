/* Turn a pasted portrait into a data URL that fits in a sheet cell.
   Aspect ratio is preserved and the image is stored at 70% of its original
   dimensions; only quality is lowered when the sheet's chunk budget is hit. */

const MIN_SCALE = 0.7;
const MAX_CHARS = 460000;

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

  const scale = MIN_SCALE;
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  canvas.width = targetW;
  canvas.height = targetH;

  const draw = (quality) => {
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const type = canvas.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    return canvas.toDataURL(type, quality);
  };

  let quality = 0.86;
  let url = draw(quality);
  while (url.length > MAX_CHARS && quality > 0.35) {
    quality -= 0.08;
    url = draw(quality);
  }
  if (url.length > MAX_CHARS) {
    throw new Error('Portrait is still too large at 70% size. Use a smaller source image.');
  }
  return url;
}
