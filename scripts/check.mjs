// Проверки интерфейса без сборщика и зависимостей (npm run check):
// синтаксис каждого модуля, что каждый импорт ссылается на существующий экспорт,
// и что все словари локализации содержат одни и те же ключи.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SRC = 'src';
const errors = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.js')) out.push(path);
  }
  return out;
}
const files = walk(SRC);

// 1. Синтаксис: node --check понимает ES-модули только с расширением .mjs.
const tmp = mkdtempSync(join(tmpdir(), 'sketchover-check-'));
try {
  files.forEach((file, i) => {
    const copy = join(tmp, `${i}.mjs`);
    copyFileSync(file, copy);
    try {
      execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' });
    } catch (e) {
      errors.push(`${file}: ${String(e.stderr).split('\n').slice(0, 4).join(' ')}`);
    }
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// 2. Импорты: файл существует, имя экспортируется, импортированное используется.
function exportsOf(file) {
  const text = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:const|let|function|class)\s+(\w+)/g)) names.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) names.add(part.trim().split(/\s+as\s+/).pop());
  }
  if (/export default/.test(text)) names.add('default');
  return names;
}
let imports = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+'([^']+)'/g)) {
    const target = join(dirname(file), m[3]);
    if (!existsSync(target)) {
      errors.push(`${file}: нет файла ${m[3]}`);
      continue;
    }
    const available = exportsOf(target);
    const names = m[1] ? [['default', m[1]]] : m[2].split(',').map((p) => p.trim()).filter(Boolean)
      .map((p) => { const [from, as] = p.split(/\s+as\s+/); return [from, as ?? from]; });
    for (const [name, local] of names) {
      imports++;
      if (!available.has(name)) errors.push(`${file}: ${m[3]} не экспортирует ${name}`);
      const uses = text.match(new RegExp(`\\b${local}\\b`, 'g'))?.length ?? 0;
      if (uses < 2) errors.push(`${file}: ${local} импортирован, но не используется`);
    }
  }
}

// 3. Локализация: у всех словарей те же ключи, что у русского.
const keysOf = (lang) => new Set([...readFileSync(join(SRC, 'i18n', `${lang}.js`), 'utf8').matchAll(/^ {2}'([\w.]+)':/gm)].map((m) => m[1]));
const reference = keysOf('ru');
for (const name of readdirSync(join(SRC, 'i18n'))) {
  const lang = name.replace(/\.js$/, '');
  if (lang === 'index' || lang === 'ru') continue;
  const keys = keysOf(lang);
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  if (missing.length) errors.push(`i18n/${lang}: нет ключей ${missing.join(', ')}`);
  if (extra.length) errors.push(`i18n/${lang}: лишние ключи ${extra.join(', ')}`);
}

console.log(`Модулей: ${files.length}, импортов: ${imports}, ключей локализации: ${reference.size}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Всё в порядке');
