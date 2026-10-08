// Иконка инструмента: символ или SVG-контур (iconPath, viewBox 0 0 24 24).
// SVG собираем через DOM — innerHTML и inline-стили запрещены CSP.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function toolIcon(tool) {
  if (!tool.iconPath) return document.createTextNode(tool.icon);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill-rule', 'evenodd');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', tool.iconPath);
  svg.append(path);
  return svg;
}
