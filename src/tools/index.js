import { createSelectTool } from './select-tool.js';
import { createShapeTool } from './shape-tool.js';
import { createTextTool } from './text-tool.js';
import { createLaserTool } from './laser-tool.js';
import { createEraserTool } from './eraser-tool.js';

// Маркер: скошенный наконечник и полоса под ним.
const MARKER = 'M14.6 3.2 20.8 9.4 11 19.2H7.6l-2.8-2.8V13zM7 13.9v1.8l1.3 1.3h1.8zM3 20.5h9V22H3z';

// host — { render(), edit(shape) }: то, что инструменты берут у UI, не импортируя его.
// label — ключ локализации, key — клавиша по умолчанию (e.code). Порядок = порядок кнопок на панели.
// Новый инструмент — одна строка.
export function createTools(host) {
  return [
    // Курсор мыши, а не символ ↖ — тот легко спутать со стрелкой.
    createSelectTool({ id: 'select', iconPath: 'M5 2.5v16.6l4.2-4 2.8 6.4 2.7-1.2-2.8-6.3 5.9-.3z', label: 'tool.select', key: 'Digit1' }, host),
    createShapeTool({ id: 'pen', icon: '✎', label: 'tool.pen', key: 'Digit2' }, host),
    // Маркер — рядом с кистью, но клавиша буквой: у остальных инструментов цифры не сдвигаются.
    createShapeTool({ id: 'marker', iconPath: MARKER, label: 'tool.marker', key: 'KeyM' }, host),
    createShapeTool({ id: 'line', icon: '╱', label: 'tool.line', key: 'Digit3' }, host),
    createShapeTool({ id: 'arrow', icon: '➜', label: 'tool.arrow', key: 'Digit4' }, host),
    createShapeTool({ id: 'rect', icon: '▭', label: 'tool.rect', key: 'Digit5' }, host),
    createShapeTool({ id: 'ellipse', icon: '◯', label: 'tool.ellipse', key: 'Digit6' }, host),
    createShapeTool({ id: 'node', icon: '▣', label: 'tool.node', key: 'Digit7' }, host),
    createTextTool({ id: 'text', icon: 'T', label: 'tool.text', key: 'Digit8' }, host),
    createLaserTool({ id: 'laser', icon: '◉', label: 'tool.laser', key: 'Digit9' }, host),
    createEraserTool({ id: 'eraser', icon: '⌫', label: 'tool.eraser', key: 'Digit0' }, host),
  ];
}
