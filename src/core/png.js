// Текстовый чанк внутри PNG: картинка открывается любым просмотрщиком, а в чанке лежит сцена
// для повторной правки (так делает Excalidraw). Чанк iTXt, а не tEXt: tEXt — только Latin-1,
// а в сцене кириллица и другие языки.

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const isPng = (bytes) => bytes.length > 8 && SIGNATURE.every((b, i) => bytes[i] === b);
const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));

// Чанки PNG: { type, data, start, end } по порядку.
function* chunks(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos);
    const end = pos + 12 + length;
    if (end > bytes.length) return;
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    yield { type, data: bytes.subarray(pos + 8, pos + 8 + length), start: pos, end };
    pos = end;
  }
}

// Новый PNG с чанком iTXt `keyword` → `text` (UTF-8) перед IEND.
export function withTextChunk(png, keyword, text) {
  if (!isPng(png)) throw new Error('not a PNG');
  const iend = [...chunks(png)].find((c) => c.type === 'IEND');
  if (!iend) throw new Error('PNG without IEND');
  // keyword \0 | сжатие 0 | метод 0 | язык \0 | перевод ключа \0 | текст
  const data = new Uint8Array([...ascii(keyword), 0, 0, 0, 0, 0, ...new TextEncoder().encode(text)]);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(ascii('iTXt'), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, iend.start));
  out.set(chunk, iend.start);
  out.set(png.subarray(iend.start), iend.start + chunk.length);
  return out;
}

// Текст чанка iTXt с ключом `keyword` (без сжатия) или null.
export function readTextChunk(png, keyword) {
  if (!isPng(png)) return null;
  const key = ascii(`${keyword}\0`);
  for (const c of chunks(png)) {
    if (c.type !== 'iTXt' || !key.every((b, i) => c.data[i] === b)) continue;
    const flags = key.length; // флаг сжатия, затем метод
    if (c.data[flags] !== 0) return null;
    let pos = flags + 2;
    for (let zeros = 0; zeros < 2 && pos < c.data.length; pos++) if (c.data[pos] === 0) zeros++;
    return new TextDecoder().decode(c.data.subarray(pos));
  }
  return null;
}
