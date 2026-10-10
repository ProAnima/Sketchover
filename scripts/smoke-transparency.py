"""Прозрачен ли холст: сравнение снимков экрана до и после запуска (для smoke.yml).

Берём середину экрана (без панели сверху и памятки справа) и считаем долю пикселей, которые
заметно изменились. Непрозрачный холст закрашивает всё своим цветом — меняется почти всё;
прозрачный оставляет видимым то, что было под ним.

    python smoke-transparency.py before.png after.png [--require]
"""
import sys

from PIL import Image

# Консоль Windows по умолчанию не в UTF-8 — кириллица в выводе уронила бы проверку.
sys.stdout.reconfigure(encoding='utf-8')

CHANGED = 60  # сумма разниц каналов RGB — «пиксель заметно изменился»
UNIFORM = 0.95  # доля одинаковых пикселей, при которой экран «однотонный»


def center(path):
    img = Image.open(path).convert('RGB')
    w, h = img.size
    # Сырые байты, а не getdata(): тот устарел, а замена есть только в новых Pillow (в apt — старый).
    raw = img.crop((int(w * 0.05), int(h * 0.2), int(w * 0.65), int(h * 0.85))).resize((200, 120)).tobytes()
    return [tuple(raw[i:i + 3]) for i in range(0, len(raw), 3)]


def main():
    before, after = center(sys.argv[1]), center(sys.argv[2])
    require = '--require' in sys.argv
    changed = sum(1 for a, b in zip(before, after) if sum(abs(x - y) for x, y in zip(a, b)) > CHANGED) / len(before)
    top = max(set(before), key=before.count)
    uniform = before.count(top) / len(before)
    print(f'изменилось в середине экрана: {changed:.0%}')
    if changed > 0.5:
        print('холст НЕ прозрачный: закрыл собой экран')
        sys.exit(1 if require else 0)
    if uniform > UNIFORM and top == (0, 0, 0):
        # Непрозрачный чёрный холст на чёрном столе ничего бы не изменил — такой замер ничего не доказывает.
        print('под холстом чёрный однотонный экран — прозрачность этим способом не проверить')
        sys.exit(1 if require else 0)
    print('холст прозрачный: экран под ним виден')


main()
