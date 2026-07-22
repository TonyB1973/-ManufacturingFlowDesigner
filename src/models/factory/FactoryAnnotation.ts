import type { FactoryRouteAnchorSide } from './FactoryRoute';
import type { GeometryPoint } from '../../services/geometry/FactoryFootprintGeometry';

export const FACTORY_ANNOTATION_LAYERS = ['Dimensions', 'Coordinates', 'Notes', 'General'] as const;
export type FactoryAnnotationLayer = typeof FACTORY_ANNOTATION_LAYERS[number];
export const LINEAR_DIMENSION_KINDS = ['Horizontal', 'Vertical', 'Aligned'] as const;
export type LinearDimensionKind = typeof LINEAR_DIMENSION_KINDS[number];
export const RECTANGLE_ANNOTATION_FEATURES = ['centre', 'topLeft', 'topCentre', 'topRight', 'rightCentre', 'bottomRight', 'bottomCentre', 'bottomLeft', 'leftCentre', 'perimeter'] as const;
export type RectangleAnnotationFeature = typeof RECTANGLE_ANNOTATION_FEATURES[number];

export interface FreePointAnnotationAnchor { readonly kind: 'free'; readonly point: GeometryPoint; }
export interface ResourceAnnotationAnchor { readonly kind: 'resource'; readonly resourceId: string; readonly feature: RectangleAnnotationFeature; readonly side?: FactoryRouteAnchorSide; readonly offset?: number; }
export interface BoundaryAnnotationAnchor { readonly kind: 'boundary'; readonly boundaryId: string; readonly feature: 'vertex' | 'edge'; readonly index: number; readonly offset?: number; }
export interface WallAnnotationAnchor { readonly kind: 'wall'; readonly wallId: string; readonly feature: 'start' | 'centre' | 'end' | 'edge'; readonly offset?: number; }
export interface AreaAnnotationAnchor { readonly kind: 'area'; readonly areaId: string; readonly feature: RectangleAnnotationFeature; readonly side?: FactoryRouteAnchorSide; readonly offset?: number; }
export interface AisleAnnotationAnchor { readonly kind: 'aisle'; readonly aisleId: string; readonly feature: 'vertex' | 'segment'; readonly index: number; readonly offset?: number; }
export interface FactoryRouteAnnotationAnchor { readonly kind: 'factoryRoute'; readonly factoryRouteId: string; readonly feature: 'source' | 'target' | 'waypoint' | 'segment'; readonly index?: number; readonly offset?: number; }

export type AnnotationAnchor = FreePointAnnotationAnchor | ResourceAnnotationAnchor | BoundaryAnnotationAnchor | WallAnnotationAnchor | AreaAnnotationAnchor | AisleAnnotationAnchor | FactoryRouteAnnotationAnchor;

interface FactoryAnnotationBase {
  readonly id: string;
  readonly layoutId: string;
  visible: boolean;
  locked: boolean;
  layer: FactoryAnnotationLayer;
  note: string;
  readonly createdUtc: string;
}

export interface LinearDimensionAnnotation extends FactoryAnnotationBase {
  readonly annotationType: 'linearDimension';
  dimensionKind: LinearDimensionKind;
  startAnchor: AnnotationAnchor;
  endAnchor: AnnotationAnchor;
  offset: number;
  textPosition: number;
  textOverride: string;
  prefix: string;
  suffix: string;
  showUnit: boolean;
  precisionOverride: number | null;
}

export interface CoordinateAnnotation extends FactoryAnnotationBase {
  readonly annotationType: 'coordinate';
  anchor: AnnotationAnchor;
  labelOffset: GeometryPoint;
  showX: boolean;
  showY: boolean;
  prefix: string;
  suffix: string;
  precisionOverride: number | null;
}

export interface TextAnnotation extends FactoryAnnotationBase {
  readonly annotationType: 'text';
  worldPosition: GeometryPoint;
  text: string;
  textSize: number;
  textAlign: 'left' | 'centre' | 'right';
  rotationDegrees: number;
  backgroundEnabled: boolean;
  borderEnabled: boolean;
}

export const LEADER_ARROW_STYLES = ['open', 'filled', 'dot', 'none'] as const;
export type LeaderArrowStyle = typeof LEADER_ARROW_STYLES[number];
export interface LeaderAnnotation extends FactoryAnnotationBase {
  readonly annotationType: 'leader';
  anchor: AnnotationAnchor;
  elbowPoints: GeometryPoint[];
  textPosition: GeometryPoint;
  text: string;
  textSize: number;
  arrowStyle: LeaderArrowStyle;
}

export type FactoryAnnotation = LinearDimensionAnnotation | CoordinateAnnotation | TextAnnotation | LeaderAnnotation;
type AnnotationPatch<T> = Partial<Omit<T, 'id' | 'layoutId' | 'annotationType' | 'createdUtc'>>;
export type FactoryAnnotationPatch = AnnotationPatch<LinearDimensionAnnotation> | AnnotationPatch<CoordinateAnnotation> | AnnotationPatch<TextAnnotation> | AnnotationPatch<LeaderAnnotation>;

export function cloneAnnotationAnchor(anchor: AnnotationAnchor): AnnotationAnchor {
  return anchor.kind === 'free' ? { kind: 'free', point: { ...anchor.point } } : { ...anchor };
}

export function cloneFactoryAnnotation(annotation: FactoryAnnotation): FactoryAnnotation {
  if (annotation.annotationType === 'linearDimension') return { ...annotation, startAnchor: cloneAnnotationAnchor(annotation.startAnchor), endAnchor: cloneAnnotationAnchor(annotation.endAnchor) };
  if (annotation.annotationType === 'coordinate') return { ...annotation, anchor: cloneAnnotationAnchor(annotation.anchor), labelOffset: { ...annotation.labelOffset } };
  if (annotation.annotationType === 'text') return { ...annotation, worldPosition: { ...annotation.worldPosition } };
  return { ...annotation, anchor: cloneAnnotationAnchor(annotation.anchor), elbowPoints: annotation.elbowPoints.map((point) => ({ ...point })), textPosition: { ...annotation.textPosition } };
}

export function annotationAnchors(annotation: FactoryAnnotation): readonly AnnotationAnchor[] {
  if (annotation.annotationType === 'linearDimension') return [annotation.startAnchor, annotation.endAnchor];
  if (annotation.annotationType === 'coordinate' || annotation.annotationType === 'leader') return [annotation.anchor];
  return [];
}

export function annotationReferences(anchor: AnnotationAnchor, kind: 'resource' | 'boundary' | 'wall' | 'area' | 'aisle' | 'factoryRoute', id: string): boolean {
  if (anchor.kind !== kind) return false;
  if (kind === 'resource' && anchor.kind === 'resource') return anchor.resourceId === id;
  if (kind === 'boundary' && anchor.kind === 'boundary') return anchor.boundaryId === id;
  if (kind === 'wall' && anchor.kind === 'wall') return anchor.wallId === id;
  if (kind === 'area' && anchor.kind === 'area') return anchor.areaId === id;
  if (kind === 'aisle' && anchor.kind === 'aisle') return anchor.aisleId === id;
  return anchor.kind === 'factoryRoute' && anchor.factoryRouteId === id;
}
