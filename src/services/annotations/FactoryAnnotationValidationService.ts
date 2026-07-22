import { FACTORY_ANNOTATION_LAYERS, LEADER_ARROW_STYLES, LINEAR_DIMENSION_KINDS, type FactoryAnnotation } from '../../models/factory/FactoryAnnotation';
import type { FactoryAnnotationStore } from '../FactoryAnnotationStore';
import type { AnnotationAnchorResolver } from './AnnotationAnchorResolver';
import { dimensionValue } from './LinearDimensionGeometry';

export interface FactoryAnnotationIssue { readonly annotationId: string; readonly severity: 'error' | 'warning'; readonly message: string; }
export interface FactoryAnnotationValidation { readonly total: number; readonly errors: number; readonly warnings: number; readonly issues: readonly FactoryAnnotationIssue[]; }

export function validateFactoryAnnotations(store: FactoryAnnotationStore, resolver: AnnotationAnchorResolver): FactoryAnnotationValidation {
  const issues: FactoryAnnotationIssue[] = []; const seen = new Set<string>();
  const add = (annotation: FactoryAnnotation, severity: FactoryAnnotationIssue['severity'], message: string): void => { issues.push({ annotationId: annotation.id, severity, message }); };
  for (const annotation of store.getAnnotations()) {
    if (seen.has(annotation.id)) add(annotation, 'error', 'Annotation ID is duplicated.'); seen.add(annotation.id);
    if (!/^ANN-\d+$/.test(annotation.id) || !FACTORY_ANNOTATION_LAYERS.includes(annotation.layer)) add(annotation, 'error', 'Annotation identity or layer is invalid.');
    if (annotation.note.length > 10000) add(annotation, 'error', 'Annotation note exceeds the safety limit.');
    if (annotation.annotationType === 'linearDimension') {
      const start = resolver.resolve(annotation.startAnchor, annotation.layoutId); const end = resolver.resolve(annotation.endAnchor, annotation.layoutId);
      if (!LINEAR_DIMENSION_KINDS.includes(annotation.dimensionKind) || !start.point || !end.point) add(annotation, 'error', start.error ?? end.error ?? 'Dimension anchors are invalid.');
      else if (dimensionValue(annotation.dimensionKind, start.point, end.point) <= 1e-9) add(annotation, 'error', 'Dimension has zero length.');
      if (!Number.isFinite(annotation.offset) || !Number.isFinite(annotation.textPosition)) add(annotation, 'error', 'Dimension geometry is not finite.');
      if (annotation.precisionOverride !== null && (!Number.isInteger(annotation.precisionOverride) || annotation.precisionOverride < 0 || annotation.precisionOverride > 6)) add(annotation, 'error', 'Dimension precision override must be 0 to 6.');
      if (annotation.textOverride.trim()) add(annotation, 'warning', 'Dimension text override hides the calculated value.');
    } else if (annotation.annotationType === 'coordinate') {
      const anchor = resolver.resolve(annotation.anchor, annotation.layoutId); if (!anchor.point) add(annotation, 'error', anchor.error ?? 'Coordinate anchor is invalid.');
      if (!annotation.showX && !annotation.showY) add(annotation, 'error', 'Coordinate marker must show X or Y.');
      if (!Number.isFinite(annotation.labelOffset.x) || !Number.isFinite(annotation.labelOffset.y)) add(annotation, 'error', 'Coordinate label offset is not finite.');
    } else if (annotation.annotationType === 'text') {
      if (!annotation.text.trim()) add(annotation, 'warning', 'Text annotation is empty.'); if (annotation.text.length > 20000 || !Number.isFinite(annotation.textSize) || annotation.textSize < 4 || annotation.textSize > 200) add(annotation, 'error', 'Text annotation exceeds a safety limit.');
    } else {
      const anchor = resolver.resolve(annotation.anchor, annotation.layoutId); if (!anchor.point) add(annotation, 'error', anchor.error ?? 'Leader anchor is invalid.');
      if (!annotation.text.trim() || annotation.text.length > 20000 || annotation.elbowPoints.length > 1000 || !LEADER_ARROW_STYLES.includes(annotation.arrowStyle)) add(annotation, 'error', 'Leader text or geometry is invalid.');
    }
  }
  return { total: store.getCount(), errors: issues.filter((issue) => issue.severity === 'error').length, warnings: issues.filter((issue) => issue.severity === 'warning').length, issues };
}
