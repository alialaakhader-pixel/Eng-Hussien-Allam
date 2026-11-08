// Shrinks a photo in the browser before upload (phones take 4-12 MB photos). Returns a JPEG data URL under ~1.4 MB.
export async function prepareImage(file: File, maxDim = 1600, maxBytes = 1.4 * 1024 * 1024): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !file.type.startsWith('image/')) throw new Error('الملف ده مش صورة.');
  const bmp: ImageBitmap | HTMLImageElement = await (async () => {
    if ('createImageBitmap' in window) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); } catch { /* fall through */ } }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('تعذر قراءة الصورة. جرّب صورة JPG أو PNG.')); im.src = url; });
    } finally { URL.revokeObjectURL(url); }
  })();
  const w0 = 'width' in bmp ? bmp.width : 0, h0 = 'height' in bmp ? bmp.height : 0;
  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * scale)); canvas.height = Math.max(1, Math.round(h0 * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('المتصفح لا يدعم معالجة الصور.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  for (const q of [0.85, 0.75, 0.65, 0.5, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length * 0.75 < maxBytes) return url;
  }
  throw new Error('الصورة كبيرة جداً. قصّها أو صوّرها من مسافة أقرب.');
}
