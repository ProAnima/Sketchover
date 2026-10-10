"""Прозрачен ли холст: сравнение снимков экрана до и после запуска (для smoke.yml).

Берём середину экрана (без панели сверху и памятки справа) и считаем долю почти чёрных
пикселей. Непрозрачный холст закрашивает всё — доля резко растёт; прозрачный — оставляет
то, что было под ним.

    python smoke-transparency.py before.png after.png [--require]
"""
import sys

from PIL import Image

# Консоль Windows по умолчанию не в UTF-8 — кириллица в выводе уронила бы проверку.
sys.stdout.reconfigure(encoding='utf-8')

BLACK = 40  # сумма каналов RGB — «почти чёрный»


def black_share(path):
    img = Image.open(path).convert('RGB')
    w, h = img.size
    box = img.crop((int(w * 0.05), int(h * 0.2), int(w * 0.65), int(h * 0.85))).resize((200, 120))
    pixels = list(box.getdata())
    return sum(1 for p in pixels if sum(p) < BLACK) / len(pixels)


def main():
    before, after = black_share(sys.argv[1]), black_share(sys.argv[2])
    require = '--require' in sys.argv
    print(f'почти чёрного в середине экрана: до {before:.0%}, после {after:.0%}')
    if before > 0.8:
        print('под холстом и так чёрный экран — прозрачность этим способом не проверить')
        sys.exit(1 if require else 0)
    if after - before > 0.5:
        print('холст НЕ прозрачный: закрыл собой экран')
        sys.exit(1 if require else 0)
    print('холст прозрачный: экран под ним виден')


main()
