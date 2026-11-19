/* Portraits are stored as-is (no re-encoding, no quality loss).
   The character modal renders them at 50%; the roster tooltip uses a fixed
   compact frame, both preserving the original aspect ratio. */

const MAX_BYTES = 9 * 1024 * 1024; // originals go to Google Drive, not a sheet cell

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
    throw new Error('That image is larger than 9 MB');
  }
  const dataUrl = await readAsDataUrl(blob);
  const { width, height } = await measure(dataUrl);
  return { dataUrl, width, height, bytes: blob.size };
}

export const displayWidthFor = (naturalWidth, ratio = 0.5) =>
  Math.max(1, Math.round(naturalWidth * ratio));
