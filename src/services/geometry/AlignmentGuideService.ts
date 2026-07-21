import type { GeometryBounds } from './GeometryBounds';

export type GuideAxis = 'x' | 'y';
export type GuideAlignment = 'start' | 'centre' | 'end';
export interface AlignmentGuide { readonly axis: GuideAxis; readonly alignment: GuideAlignment; readonly position: number; readonly from: number; readonly to: number; }
export interface GuideResolution { readonly dx: number; readonly dy: number; readonly matchedX: boolean; readonly matchedY: boolean; readonly guides: readonly AlignmentGuide[]; }

const axisValues = (bounds: GeometryBounds, axis: GuideAxis): readonly { readonly alignment: GuideAlignment; readonly value: number }[] => axis === 'x' ? [{ alignment: 'start', value: bounds.left }, { alignment: 'centre', value: bounds.centreX }, { alignment: 'end', value: bounds.right }] : [{ alignment: 'start', value: bounds.top }, { alignment: 'centre', value: bounds.centreY }, { alignment: 'end', value: bounds.bottom }];

export function resolveAlignmentGuides(moving: GeometryBounds, candidates: readonly GeometryBounds[], tolerance: number): GuideResolution {
  let bestX: { correction: number; guide: AlignmentGuide } | null = null; let bestY: { correction: number; guide: AlignmentGuide } | null = null;
  for (const candidate of candidates) for (const axis of ['x', 'y'] as const) for (const movingValue of axisValues(moving, axis)) for (const candidateValue of axisValues(candidate, axis)) { const correction = candidateValue.value - movingValue.value; if (Math.abs(correction) > tolerance) continue; const guide: AlignmentGuide = axis === 'x' ? { axis, alignment: movingValue.alignment, position: candidateValue.value, from: Math.min(moving.top, candidate.top), to: Math.max(moving.bottom, candidate.bottom) } : { axis, alignment: movingValue.alignment, position: candidateValue.value, from: Math.min(moving.left, candidate.left), to: Math.max(moving.right, candidate.right) }; const current = axis === 'x' ? bestX : bestY; if (!current || Math.abs(correction) < Math.abs(current.correction) || (Math.abs(correction) === Math.abs(current.correction) && movingValue.alignment.localeCompare(current.guide.alignment) < 0)) { if (axis === 'x') bestX = { correction, guide }; else bestY = { correction, guide }; } }
  return { dx: bestX?.correction ?? 0, dy: bestY?.correction ?? 0, matchedX: Boolean(bestX), matchedY: Boolean(bestY), guides: [bestX?.guide, bestY?.guide].filter((item): item is AlignmentGuide => Boolean(item)) };
}
