// Картинки скриншотов хранятся отдельно от фигур: фигура ссылается на картинку по id.
// Иначе история отмены (JSON всех фигур) копировала бы мегабайты на каждое действие.
const images = new Map();
let lastId = 0;

export function addImage(bitmap) {
  const id = `img${++lastId}`;
  images.set(id, bitmap);
  return id;
}

export const getImage = (id) => images.get(id);
export const imageCount = () => images.size;

// Программа живёт фоном неделями, а кадр 4K весит десятки мегабайт: картинки, на которые
// не ссылается ни холст, ни история отмены, освобождаем.
export function pruneImages(liveIds) {
  for (const [id, bitmap] of images) {
    if (liveIds.has(id)) continue;
    bitmap.close?.();
    images.delete(id);
  }
}
