// Клавиши холста (src/core/keymap.js): сочетания, назначение, сохранение — `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { comboFromEvent, resolve, toOverrides, assign, lookup, digitRun } from '../src/core/keymap.js';

const key = (code, mods = {}) => ({ code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

test('клавиши: сочетание по физической клавише, Mod — Ctrl или ⌘', () => {
  assert.equal(comboFromEvent(key('KeyC', { ctrlKey: true, shiftKey: true }), false), 'Mod+Shift+KeyC');
  assert.equal(comboFromEvent(key('KeyC', { metaKey: true, shiftKey: true }), true), 'Mod+Shift+KeyC');
  assert.equal(comboFromEvent(key('KeyC', { ctrlKey: true }), true), 'Ctrl+KeyC', 'Control на macOS — не ⌘');
  assert.equal(comboFromEvent(key('Numpad3', { altKey: true }), false), 'Alt+Digit3', 'цифровой блок — те же цифры');
  assert.equal(comboFromEvent(key('ShiftLeft', { shiftKey: true }), false), null, 'одни модификаторы — ещё не сочетание');
  assert.equal(comboFromEvent(key('KeyS', { metaKey: true }), false), null, 'клавишу Win держит система');
  assert.equal(comboFromEvent(key('F1'), false), 'F1');
});

test('клавиши: сохраняются только отличия, «» — без клавиши', () => {
  const defaults = { undo: ['Mod+KeyZ'], redo: ['Mod+KeyY', 'Mod+Shift+KeyZ'], shot: ['KeyS'] };
  const bindings = resolve(defaults, { shot: 'KeyP', redo: '' });
  assert.deepEqual(bindings, { undo: ['Mod+KeyZ'], redo: [], shot: ['KeyP'] });
  assert.deepEqual(toOverrides(defaults, bindings), { redo: '', shot: 'KeyP' });
  assert.deepEqual(toOverrides(defaults, resolve(defaults, {})), {});
});

test('клавиши: занятое сочетание переходит к новому действию', () => {
  const bindings = { undo: ['Mod+KeyZ'], redo: ['Mod+KeyY', 'Mod+Shift+KeyZ'], shot: ['KeyS'] };
  const { bindings: next, moved } = assign(bindings, 'shot', ['Mod+KeyY']);
  assert.deepEqual(next, { undo: ['Mod+KeyZ'], redo: ['Mod+Shift+KeyZ'], shot: ['Mod+KeyY'] });
  assert.deepEqual(moved, ['redo']);
  assert.equal(lookup(next).get('Mod+KeyY'), 'shot');
  assert.equal(lookup(next).get('KeyS'), undefined);
});

test('клавиши: ряд цифр в памятке одной строкой', () => {
  assert.deepEqual(digitRun(['Alt+Digit1', 'Alt+Digit2', 'Alt+Digit3']), { prefix: ['Alt'], last: 3 });
  assert.deepEqual(digitRun(['Digit1', 'Digit2']), { prefix: [], last: 2 });
  assert.equal(digitRun(['Alt+Digit1', 'Shift+Digit2']), null);
  assert.equal(digitRun(['Alt+Digit1', 'Alt+KeyQ']), null);
  assert.equal(digitRun(['Alt+Digit1']), null);
});
