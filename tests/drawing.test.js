// Маркер, исчезающие рисунки — чистая логика (src/core) — `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HOLD_MS, FADE_MS, canFade, fadeAlpha, splitFading } from '../src/core/fade.js';
import { createShape, hit, bounds, move, strokeWidth, setTextMeasurer } from '../src/core/shapes.js';
import { packScene, unpackScene } from '../src/core/scene.js';

setTextMeasurer((_font, text) => text.length * 10);

test('исчезающие: видна HOLD_MS, затем гаснет за FADE_MS', () => {
  assert.equal(fadeAlpha(0, 0), 1);
  assert.equal(fadeAlpha(0, HOLD_MS), 1);
  assert.ok(Math.abs(fadeAlpha(0, HOLD_MS + FADE_MS / 2) - 0.5) < 1e-9);
  assert.equal(fadeAlpha(0, HOLD_MS + FADE_MS), 0);
  assert.equal(fadeAlpha(0, HOLD_MS + FADE_MS * 3), 0, 'не уходит в минус');
});

test('исчезающие: гаснут только новые линии и фигуры жеста', () => {
  const old = { id: 1, type: 'pen' };
  const fresh = [{ id: 2, type: 'marker' }, { id: 3, type: 'arrow' }, { id: 4, type: 'node' }, { id: 5, type: 'image' }];
  const { kept, fading } = splitFading([old, ...fresh], new Set([1]));
  assert.deepEqual(fading.map((s) => s.id), [2, 3]);
  assert.deepEqual(kept.map((s) => s.id), [1, 4, 5], 'старые и блоки со скриншотами остаются');
  assert.equal(canFade({ type: 'text' }), false);
});

test('маркер: шире кисти, попадание и рамка по точкам, двигается целиком', () => {
  const m = createShape('marker', 0, 0);
  m.points.push({ x: 100, y: 0 });
  assert.ok(strokeWidth(m) > m.width * 3, 'выделяет текст, а не рисует линию');
  assert.ok(hit(m, 50, strokeWidth(m) / 2), 'попадание по всей ширине');
  assert.ok(!hit(m, 50, strokeWidth(m) + 20));
  assert.deepEqual(bounds(m), { x: 0, y: 0, w: 100, h: 0 });
  move(m, 10, 5);
  assert.deepEqual(m.points[1], { x: 110, y: 5 });
});

test('маркер: сохраняется в файл и читается обратно', () => {
  const m = { id: 7, type: 'marker', color: '#ffd60a', width: 6, points: [{ x: 1, y: 2 }, { x: 30, y: 2 }] };
  const scene = unpackScene(packScene([m], {}));
  assert.deepEqual(scene.shapes, [m]);
  const broken = unpackScene(packScene([{ ...m, points: [] }], {}));
  assert.deepEqual(broken.shapes, [], 'маркер без точек отбрасывается');
});
