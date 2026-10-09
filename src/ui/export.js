// Холст как картинка: в буфер обмена (вставить в чат созвона) и в файл PNG со сценой внутри —
// открывается любым просмотрщиком и снова редактируется в Sketchover.
import { state, reserveIds } from '../core/state.js';
import { bounds } from '../core/shapes.js';
import { commit } from '../core/history.js';
import { addImage, getImage } from '../core/images.js';
import { withTextChunk, readTextChunk } from '../core/png.js';
import { packScene, unpackScene, SCENE_KEY } from '../core/scene.js';
import { t } from '../i18n/index.js';
import { api } from './api.js';
import { render } from './canvas.js';
import { finishEdit } from './editor.js';
import { drawShape } from './shapes-draw.js';
import { showToast } from './toast.js';

// Поля вокруг рисунка: толщина линий, наконечники стрелок, тени скриншотов.
const MARGIN = 24;

function sceneBox(shapes) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const s of shapes) {
    const b = bounds(s);
    const pad = MARGIN + (s.width || 0) * 3;
    x1 = Math.min(x1, b.x - pad);
    y1 = Math.min(y1, b.y - pad);
    x2 = Math.max(x2, b.x + b.w + pad);
    y2 = Math.max(y2, b.y + b.h + pad);
  }
  return shapes.length ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
}

// Рисунок без фона (прозрачный PNG) в разрешении экрана — чётко и на HiDPI.
function renderScene() {
  const box = sceneBox(state.shapes);
  if (!box) return null;
  const scale = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(box.w * scale);
  canvas.height = Math.ceil(box.h * scale);
  const c = canvas.getContext('2d');
  c.scale(scale, scale);
  c.translate(-box.x, -box.y);
  for (const s of state.shapes) drawShape(c, s);
  return canvas;
}

const toPngBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png');
});
const toPngBytes = async (canvas) => new Uint8Array(await (await toPngBlob(canvas)).arrayBuffer());

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
const fromBase64 = (text) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

async function imageToBase64(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return toBase64(await toPngBytes(canvas));
}

function defaultFileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `Sketchover ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}.png`;
}

export async function copyImage() {
  finishEdit();
  const canvas = renderScene();
  if (!canvas) {
    showToast(t('file.empty'));
    return;
  }
  try {
    // Через Rust, а не Web Clipboard API: тот зависит от фокуса и «жеста пользователя»
    // и по-разному ведёт себя в WebView разных систем.
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    await api.copyImage(new Uint8Array(data.buffer), canvas.width, canvas.height);
    showToast(t('file.copied'));
  } catch (e) {
    console.error(e);
    showToast(t('file.copyFailed'));
  }
}

export async function saveScene() {
  finishEdit();
  const canvas = renderScene();
  if (!canvas) {
    showToast(t('file.empty'));
    return;
  }
  try {
    const images = {};
    for (const s of state.shapes) {
      const bitmap = s.type === 'image' && !images[s.imageId] && getImage(s.imageId);
      if (bitmap) images[s.imageId] = await imageToBase64(bitmap);
    }
    const png = withTextChunk(await toPngBytes(canvas), SCENE_KEY, packScene(state.shapes, images));
    const name = await api.savePng(png, defaultFileName());
    if (name) showToast(t('file.saved', { name }));
  } catch (e) {
    console.error(e);
    showToast(t('file.failed'));
  }
}

// Картинки сцены → в хранилище; скриншот, чью картинку не удалось прочитать, выкидываем.
async function loadImages(shapes, images) {
  const ids = new Map();
  for (const s of shapes) {
    if (s.type !== 'image' || ids.has(s.imageId)) continue;
    try {
      const blob = new Blob([fromBase64(images[s.imageId])], { type: 'image/png' });
      ids.set(s.imageId, addImage(await createImageBitmap(blob)));
    } catch {
      ids.set(s.imageId, null);
    }
  }
  return shapes.filter((s) => {
    if (s.type !== 'image') return true;
    s.imageId = ids.get(s.imageId);
    return Boolean(s.imageId);
  });
}

// Открытый файл заменяет холст; прежний возвращается через Ctrl+Z.
export async function openScene() {
  finishEdit();
  try {
    const bytes = new Uint8Array(await api.openPng());
    if (!bytes.length) return; // диалог закрыли
    const json = readTextChunk(bytes, SCENE_KEY);
    const scene = json && unpackScene(json);
    if (!scene) {
      showToast(t('file.notScene'));
      return;
    }
    state.shapes = await loadImages(scene.shapes, scene.images);
    state.sel = null;
    reserveIds(Math.max(0, ...state.shapes.map((s) => s.id)));
    commit();
    render();
    showToast(t('file.opened'));
  } catch (e) {
    console.error(e);
    showToast(t('file.failed'));
  }
}
