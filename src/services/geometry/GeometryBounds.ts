import type { SelectionItem } from '../../models/selection/Selection';

export interface GeometrySnapshot {
  readonly id: string;
  readonly kind: 'operation' | 'resource';
  readonly ref: SelectionItem;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly locked: boolean;
  readonly visible: boolean;
}

export interface GeometryBounds { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number; readonly centreX: number; readonly centreY: number; readonly width: number; readonly height: number; }
export interface GeometryValue { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface GeometryChange { readonly id: string; readonly kind: 'operation' | 'resource'; readonly before: GeometryValue; readonly after: GeometryValue; }

export const geometryValue = (node: GeometrySnapshot): GeometryValue => ({ x: node.x, y: node.y, width: node.width, height: node.height });
export const boundsOf = (value: Pick<GeometryValue, 'x' | 'y' | 'width' | 'height'>): GeometryBounds => ({ left: value.x - value.width / 2, right: value.x + value.width / 2, top: value.y - value.height / 2, bottom: value.y + value.height / 2, centreX: value.x, centreY: value.y, width: value.width, height: value.height });
export const aggregateBounds = (nodes: readonly Pick<GeometrySnapshot, 'x' | 'y' | 'width' | 'height'>[]): GeometryBounds | null => {
  if (!nodes.length) return null; const bounds = nodes.map(boundsOf); const left = Math.min(...bounds.map((item) => item.left)); const right = Math.max(...bounds.map((item) => item.right)); const top = Math.min(...bounds.map((item) => item.top)); const bottom = Math.max(...bounds.map((item) => item.bottom));
  return { left, right, top, bottom, centreX: (left + right) / 2, centreY: (top + bottom) / 2, width: right - left, height: bottom - top };
};
export const translateBounds = (bounds: GeometryBounds, dx: number, dy: number): GeometryBounds => ({ ...bounds, left: bounds.left + dx, right: bounds.right + dx, top: bounds.top + dy, bottom: bounds.bottom + dy, centreX: bounds.centreX + dx, centreY: bounds.centreY + dy });
export const sameGeometry = (left: GeometryValue, right: GeometryValue): boolean => left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
