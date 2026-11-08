import { imageSize } from 'image-size';

export function validateImage(data: Buffer): string {
  if (data.length > 10 * 1024 * 1024) throw new Error('An image exceeds 10 MiB');
  const mime = data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : data[0] === 255 && data[1] === 216 && data[2] === 255 ? 'image/jpeg' : data.toString('ascii',0,4) === 'RIFF' && data.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : '';
  if (!mime) throw new Error('Only PNG, JPEG and WebP images are supported');
  let dimensions: {width?:number;height?:number};
  try { dimensions = imageSize(data); } catch { throw new Error('Invalid or damaged image'); }
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 25_000_000) throw new Error('Image must be no larger than 25 megapixels');
  return mime;
}
