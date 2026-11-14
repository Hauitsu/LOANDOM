/* Turn any pasted image into a small square data URL that fits in a sheet cell.
   128×128 WebP is typically 3–8 KB, well under the 45,000-character limit. */

const TARGET = 128;
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

export async function toSquareDataUrl(blob, size = TARGET) {
  if (!blob || !String(blob.type || '').startsWith('image/')) {
    throw new Error('That is not an image.');
  }
  const bitmap = await loadBitmap(blob);
  const width = bitmap.width || bitmap.naturalWidth;
  const height = bitmap.height || bitmap.naturalHeight;
  if (!width || !height) throw new Error('That image has no pixels.');

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.imageSmoothingQuality = 'high';

  const scale = Math.max(size / width, size / height);
  const drawW = width * scale;
  const drawH = height * scale;
  ctx.drawImage(bitmap, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);

  let quality = 0.82;
  let url = canvas.toDataURL('image/webp', quality);
  if (!url.startsWith('data:image/webp')) {
    url = canvas.toDataURL('image/jpeg', quality);
  }
  while (url.length > MAX_CHARS && quality > 0.35) {
    quality -= 0.12;
    url = url.startsWith('data:image/webp')
      ? canvas.toDataURL('image/webp', quality)
      : canvas.toDataURL('image/jpeg', quality);
  }
  if (url.length > MAX_CHARS) {
    throw new Error('Image is still too large after compression. Try a smaller crop.');
  }
  return url;
}
