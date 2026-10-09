// Скриншот области: снимок экрана под холстом → выделение мышью → картинка на холсте.
import { state } from '../core/state.js';
import { addImage, imageCount, pruneImages } from '../core/images.js';
import { createImageShape } from '../core/shapes.js';
import { commit, referencedImageIds } from '../core/history.js';
import { t } from '../i18n/index.js';
import { api } from './api.js';
import { finishEdit } from './editor.js';
import { setMode } from './mode.js';
import { showToast, hideToast } from './toast.js';

const layer = document.querySelector('#shot');
const ctx = layer.getContext('2d');
const MIN_SIZE = 8;

let busy = false;
let onPlaced = () => {};

export function initScreenshot({ placed }) {
  onPlaced = placed;
}

export async function takeScreenshot() {
  if (busy) return;
  busy = true;
  finishEdit();
  if (state.mode !== 'draw') setMode('draw');
  try {
    const frame = await grab();
    const region = await selectRegion(frame);
    if (region) await place(frame, region);
    frame.close();
  } catch (e) {
    console.error(e);
    showToast(t('shot.failed'));
  } finally {
    busy = false;
  }
}

// Ответ Rust: ширина и высота (u32 LE), затем пиксели RGBA.
async function grab() {
  const buf = await api.captureScreen();
  const view = new DataView(buf);
  const w = view.getUint32(0, true);
  const h = view.getUint32(4, true);
  return createImageBitmap(new ImageData(new Uint8ClampedArray(buf, 8, w * h * 4), w, h));
}

function selectRegion(frame) {
  return new Promise((resolve) => {
    const dpr = window.devicePixelRatio || 1;
    layer.width = Math.round(innerWidth * dpr);
    layer.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = frame.width / innerWidth;
    const sy = frame.height / innerHeight;
    let start = null;
    let rect = null;

    // Замороженный экран затемнён, выделенная область — без затемнения.
    const paint = () => {
      ctx.drawImage(frame, 0, 0, innerWidth, innerHeight);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      if (!rect || !rect.w || !rect.h) return;
      ctx.drawImage(frame, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = '#0a84ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      layer.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e) => {
      if (!start) return;
      rect = {
        x: Math.min(start.x, e.clientX), y: Math.min(start.y, e.clientY),
        w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y),
      };
      paint();
    };
    const onUp = () => finish(rect && rect.w >= MIN_SIZE && rect.h >= MIN_SIZE ? rect : null);
    // Пока выделяем, клавиши не должны переключать инструменты; Esc — отмена.
    const onKey = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.key === 'Escape') finish(null);
    };

    function finish(result) {
      layer.removeEventListener('pointerdown', onDown);
      layer.removeEventListener('pointermove', onMove);
      layer.removeEventListener('pointerup', onUp);
      removeEventListener('keydown', onKey, true);
      layer.hidden = true;
      document.body.classList.remove('shooting');
      hideToast();
      resolve(result);
    }

    layer.addEventListener('pointerdown', onDown);
    layer.addEventListener('pointermove', onMove);
    layer.addEventListener('pointerup', onUp);
    addEventListener('keydown', onKey, true);
    document.body.classList.add('shooting');
    layer.hidden = false;
    paint();
    showToast(t('shot.hint'), { sticky: true });
  });
}

async function place(frame, rect) {
  const sx = frame.width / innerWidth;
  const sy = frame.height / innerHeight;
  // Картинка — в пикселях экрана (чётко на любом масштабе), фигура — в CSS-пикселях.
  const crop = await createImageBitmap(frame,
    Math.round(rect.x * sx), Math.round(rect.y * sy), Math.round(rect.w * sx), Math.round(rect.h * sy));
  // Перед новой картинкой освобождаем те, что уже нигде не нужны (удалены и ушли из истории).
  if (imageCount()) pruneImages(referencedImageIds());
  const shape = createImageShape(addImage(crop), rect.x, rect.y, rect.w, rect.h);
  state.shapes.push(shape);
  commit();
  onPlaced(shape);
}
