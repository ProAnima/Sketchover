// Тесты чистой логики (src/core): без DOM, Tauri и зависимостей — `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../src/core/state.js';
import { parseLines, parseInline } from '../src/core/markdown.js';
import { rectEdge, distToSegment } from '../src/core/geometry.js';
import { commit, undo, redo, version, referencedImageIds } from '../src/core/history.js';
import { addImage, getImage, imageCount, pruneImages } from '../src/core/images.js';
import {
  setTextMeasurer, createShape, createImageShape, hit, bounds, resolveLine, removeShape,
  attachAt, toLocal, toWorld, handles, textSize,
} from '../src/core/shapes.js';

// Ширина текста — 10 px на символ: детерминированно, без canvas.
setTextMeasurer((_font, text) => text.length * 10);

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const reset = () => { state.shapes = []; state.sel = null; };

test('markdown: заголовки, списки и стили', () => {
  const [h1, h2, li, ol, plain] = parseLines('# Заголовок\n## План **срочно**\n- пункт `код`\n3) третий\nобычный *курсив*');
  assert.equal(h1.scale, 1.6);
  assert.equal(h1.bold, true);
  assert.deepEqual(h2.runs, [{ text: 'План ' }, { text: 'срочно', bold: true }]);
  assert.equal(li.prefix, '• ');
  assert.deepEqual(li.runs[1], { text: 'код', code: true });
  assert.equal(ol.prefix, '3. ');
  assert.deepEqual(plain.runs[1], { text: 'курсив', italic: true });
});

test('markdown: арифметика и одиночные звёздочки — не курсив', () => {
  assert.deepEqual(parseInline('2 * 3 * 4 = 24'), [{ text: '2 * 3 * 4 = 24' }]);
  assert.deepEqual(parseInline('цена 5*'), [{ text: 'цена 5*' }]);
  assert.deepEqual(parseInline('~~старое~~ новое'), [{ text: 'старое', strike: true }, { text: ' новое' }]);
});

test('markdown: пустые строки сохраняют высоту текста', () => {
  const s = { size: 20, text: 'a\n\nb' };
  assert.equal(parseLines(s.text).length, 3);
  close(textSize(s).h, 3 * 20 * 1.25);
});

test('геометрия: расстояние до отрезка и точка на границе', () => {
  close(distToSegment(5, 5, 0, 0, 10, 0), 5);
  close(distToSegment(-3, 4, 0, 0, 10, 0), 5);
  const edge = rectEdge({ x: 0, y: 0, w: 100, h: 50 }, 300, 25);
  close(edge.x, 100);
  close(edge.y, 25);
});

test('история: отмена, повтор и версия', () => {
  reset();
  commit();
  const v0 = version();
  state.shapes.push(createShape('rect', 0, 0));
  commit();
  assert.equal(version(), v0 + 1);
  commit(); // без изменений — версия не растёт
  assert.equal(version(), v0 + 1);
  assert.equal(undo(), true);
  assert.equal(state.shapes.length, 0);
  assert.equal(redo(), true);
  assert.equal(state.shapes.length, 1);
  assert.equal(redo(), false);
});

test('поворот: перевод точки туда и обратно', () => {
  const s = { x: 0, y: 0, w: 100, h: 50, rotation: Math.PI / 2 };
  const w = toWorld(s, 100, 50);
  const back = toLocal(s, w.x, w.y);
  close(back.x, 100);
  close(back.y, 50);
});

test('скриншот: попадание и рамка учитывают поворот', () => {
  reset();
  const img = createImageShape('img-test', 0, 0, 100, 20);
  img.rotation = Math.PI / 2; // вертикальная полоса 20×100 с центром (50, 10)
  assert.equal(hit(img, 50, 50), true);
  assert.equal(hit(img, 90, 10), false);
  const b = bounds(img);
  close(b.w, 20);
  close(b.h, 100);
  assert.ok(handles(img).rotate, 'у скриншота есть ручка поворота');
  assert.equal(handles(createShape('rect', 0, 0)).rotate, null, 'у прямоугольника — нет');
});

test('стрелка цепляется к блоку и отцепляется при его удалении', () => {
  reset();
  const node = createShape('node', 0, 0);
  Object.assign(node, { w: 100, h: 50 });
  state.shapes.push(node);
  assert.equal(attachAt(50, 25), node);
  const arrow = createShape('arrow', 0, 0);
  Object.assign(arrow, { x2: 300, y2: 25, from: node.id });
  state.shapes.push(arrow);
  const line = resolveLine(arrow);
  close(line.x1, 100); // начало — на правой границе блока, а не в центре
  close(line.y1, 25);
  removeShape(node);
  assert.equal(arrow.from, null);
  close(arrow.x1, 100); // конец остаётся там, где был
});

test('картинки: освобождаются только те, на которые никто не ссылается', () => {
  reset();
  const closed = [];
  const bitmap = (name) => ({ close: () => closed.push(name) });
  const kept = addImage(bitmap('kept'));
  const dropped = addImage(bitmap('dropped'));
  state.shapes.push(createImageShape(kept, 0, 0, 10, 10));
  commit();
  const live = referencedImageIds();
  assert.equal(live.has(kept), true);
  assert.equal(live.has(dropped), false);
  pruneImages(live);
  assert.ok(getImage(kept));
  assert.equal(getImage(dropped), undefined);
  assert.deepEqual(closed, ['dropped']);
  assert.equal(imageCount(), 1);
});
