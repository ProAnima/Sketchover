import { createSelectTool } from './select-tool.js';
import { createShapeTool } from './shape-tool.js';
import { createTextTool } from './text-tool.js';
import { createLaserTool } from './laser-tool.js';
import { createEraserTool } from './eraser-tool.js';

// host — { render(), edit(shape) }: то, что инструменты берут у UI, не импортируя его.
// label — ключ локализации. Порядок = порядок кнопок на панели и клавиши 1…9, 0. Новый инструмент — одна строка.
export function createTools(host) {
  return [
    // Курсор мыши, а не символ ↖ — тот легко спутать со стрелкой.
    createSelectTool({ id: 'select', iconPath: 'M5 2.5v16.6l4.2-4 2.8 6.4 2.7-1.2-2.8-6.3 5.9-.3z', label: 'tool.select' }, host),
    createShapeTool({ id: 'pen', icon: '✎', label: 'tool.pen' }, host),
    createShapeTool({ id: 'line', icon: '╱', label: 'tool.line' }, host),
    createShapeTool({ id: 'arrow', icon: '➜', label: 'tool.arrow' }, host),
    createShapeTool({ id: 'rect', icon: '▭', label: 'tool.rect' }, host),
    createShapeTool({ id: 'ellipse', icon: '◯', label: 'tool.ellipse' }, host),
    createShapeTool({ id: 'node', icon: '▣', label: 'tool.node' }, host),
    createTextTool({ id: 'text', icon: 'T', label: 'tool.text' }, host),
    createLaserTool({ id: 'laser', icon: '◉', label: 'tool.laser' }, host),
    createEraserTool({ id: 'eraser', icon: '⌫', label: 'tool.eraser' }, host),
  ];
}
