import type { LinearDimensionKind } from '../../models/factory/FactoryAnnotation';
import type { GeometryPoint } from '../geometry/FactoryFootprintGeometry';

export interface TemporaryMeasurementValues { readonly aligned: number; readonly horizontal: number; readonly vertical: number; readonly angleDegrees: number; }
export interface LinearDimensionGeometry { readonly start: GeometryPoint; readonly end: GeometryPoint; readonly dimensionStart: GeometryPoint; readonly dimensionEnd: GeometryPoint; readonly extensionStart: readonly [GeometryPoint, GeometryPoint]; readonly extensionEnd: readonly [GeometryPoint, GeometryPoint]; readonly textPoint: GeometryPoint; readonly textRotation: number; readonly value: number; readonly outsideArrows: boolean; }

export function measurementValues(start: GeometryPoint, end: GeometryPoint): TemporaryMeasurementValues {
  const dx = end.x - start.x; const dy = end.y - start.y; const raw = Math.atan2(dy, dx) * 180 / Math.PI;
  return { aligned: Math.hypot(dx, dy), horizontal: Math.abs(dx), vertical: Math.abs(dy), angleDegrees: ((raw % 360) + 360) % 360 };
}

export function dimensionValue(kind: LinearDimensionKind, start: GeometryPoint, end: GeometryPoint): number { const values = measurementValues(start, end); return kind === 'Horizontal' ? values.horizontal : kind === 'Vertical' ? values.vertical : values.aligned; }

export function linearDimensionGeometry(kind: LinearDimensionKind, start: GeometryPoint, end: GeometryPoint, offset: number, textPosition = 0.5, estimatedTextWidth = 0): LinearDimensionGeometry | null {
  const value = dimensionValue(kind, start, end); if (!Number.isFinite(value) || value <= 1e-9 || !Number.isFinite(offset)) return null;
  let unit: GeometryPoint; let normal: GeometryPoint;
  if (kind === 'Horizontal') { unit = { x: end.x >= start.x ? 1 : -1, y: 0 }; normal = { x: 0, y: 1 }; }
  else if (kind === 'Vertical') { unit = { x: 0, y: end.y >= start.y ? 1 : -1 }; normal = { x: 1, y: 0 }; }
  else { unit = { x: (end.x - start.x) / value, y: (end.y - start.y) / value }; normal = { x: -unit.y, y: unit.x }; }
  const dimensionStart = kind === 'Horizontal' ? { x: start.x, y: start.y + offset } : kind === 'Vertical' ? { x: start.x + offset, y: start.y } : { x: start.x + normal.x * offset, y: start.y + normal.y * offset };
  const dimensionEnd = kind === 'Horizontal' ? { x: end.x, y: start.y + offset } : kind === 'Vertical' ? { x: start.x + offset, y: end.y } : { x: end.x + normal.x * offset, y: end.y + normal.y * offset };
  const position = Math.max(0, Math.min(1, textPosition)); const textPoint = { x: dimensionStart.x + (dimensionEnd.x - dimensionStart.x) * position, y: dimensionStart.y + (dimensionEnd.y - dimensionStart.y) * position };
  let textRotation = kind === 'Vertical' ? 0 : Math.atan2(unit.y, unit.x) * 180 / Math.PI; if (textRotation > 90 || textRotation < -90) textRotation += 180;
  return { start: { ...start }, end: { ...end }, dimensionStart, dimensionEnd, extensionStart: [{ ...start }, dimensionStart], extensionEnd: [{ ...end }, dimensionEnd], textPoint, textRotation, value, outsideArrows: value < estimatedTextWidth + 28 };
}

export function defaultDimensionOffset(kind: LinearDimensionKind, start: GeometryPoint, end: GeometryPoint, amount: number): number {
  if (kind === 'Horizontal') return end.y >= start.y ? -Math.abs(amount) : Math.abs(amount);
  if (kind === 'Vertical') return end.x >= start.x ? -Math.abs(amount) : Math.abs(amount);
  return Math.abs(amount);
}
