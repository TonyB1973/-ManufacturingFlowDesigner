import type { GeometryValue } from './GeometryBounds';

export type ResizeHandle = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ResizeMinimums { readonly width: number; readonly height: number; }

export function calculateResizeGeometry(original: GeometryValue, handle: ResizeHandle, pointer: { readonly x: number; readonly y: number }, minimums: ResizeMinimums, preserveAspect = false): GeometryValue {
  const left = original.x - original.width / 2; const right = original.x + original.width / 2; const top = original.y - original.height / 2; const bottom = original.y + original.height / 2;
  let nextLeft = left; let nextRight = right; let nextTop = top; let nextBottom = bottom;
  if (handle.includes('left')) nextLeft = Math.min(pointer.x, right - minimums.width);
  if (handle.includes('right')) nextRight = Math.max(pointer.x, left + minimums.width);
  if (handle.includes('top')) nextTop = Math.min(pointer.y, bottom - minimums.height);
  if (handle.includes('bottom')) nextBottom = Math.max(pointer.y, top + minimums.height);
  if (preserveAspect && handle.includes('-')) {
    const fixedX = handle.includes('left') ? right : left; const fixedY = handle.includes('top') ? bottom : top; const signX = handle.includes('left') ? -1 : 1; const signY = handle.includes('top') ? -1 : 1;
    let width = Math.max(minimums.width, Math.abs((handle.includes('left') ? nextLeft : nextRight) - fixedX)); let height = Math.max(minimums.height, Math.abs((handle.includes('top') ? nextTop : nextBottom) - fixedY)); const ratio = original.width / original.height;
    if (width / original.width >= height / original.height) height = width / ratio; else width = height * ratio;
    const scale = Math.max(1, minimums.width / width, minimums.height / height); width *= scale; height *= scale;
    const movingCornerX = fixedX + signX * width; const movingCornerY = fixedY + signY * height; nextLeft = Math.min(fixedX, movingCornerX); nextRight = Math.max(fixedX, movingCornerX); nextTop = Math.min(fixedY, movingCornerY); nextBottom = Math.max(fixedY, movingCornerY);
  }
  return { x: (nextLeft + nextRight) / 2, y: (nextTop + nextBottom) / 2, width: nextRight - nextLeft, height: nextBottom - nextTop };
}
