// Одна версия на всё приложение — из package.json. Запускается из `npm version`
// (скрипт "version"), чтобы версия крейта в src-tauri совпадала с версией установщиков.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

function setPackageVersion(file, pattern) {
  const text = readFileSync(file, 'utf8');
  const next = text.replace(pattern, (_, head) => `${head}${version}"`);
  if (next === text && !text.includes(`"${version}"`)) throw new Error(`${file}: версия не найдена`);
  writeFileSync(file, next);
}

// Первый `version = "…"` в Cargo.toml — версия пакета [package].
setPackageVersion('src-tauri/Cargo.toml', /^(version = ")[^"]*"/m);
// В Cargo.lock — запись нашего пакета.
setPackageVersion('src-tauri/Cargo.lock', /(name = "sketchover"\nversion = ")[^"]*"/);
console.log(`Версия ${version}`);
