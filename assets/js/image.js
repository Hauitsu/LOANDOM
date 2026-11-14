/* Portraits are stored as-is (no re-encoding, no quality loss).
   The UI renders them at 70% of their natural dimensions, preserving ratio. */

const MAX_BYTES = 650 * 1024; // 650 KB -> ~870k base64 chars, inside the 24-cell budget

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(blob);
  });
}

function measure(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('That file is not a readable image.'));
    img.src = dataUrl;
  });
}

export async function readPortraitFile(blob) {
  if (!blob || !String(blob.type || '').startsWith('image/')) {
    throw new Error('That is not an image.');
  }
  if (blob.size > MAX_BYTES) {
    throw new Error('That image is larger than 650 KB. Use a smaller copy — no compression is applied.');
  }
  const dataUrl = await readAsDataUrl(blob);
  if (dataUrl.length > 950000) {
    throw new Error('That image is too large for the sheet. Use a smaller copy.');
  }
  const { width, height } = await measure(dataUrl);
  return { dataUrl, width, height, bytes: blob.size };
}

export const displayWidthFor = (naturalWidth) => Math.max(1, Math.round(naturalWidth * 0.7));
