import type { GeometryPoint } from '../../services/geometry/FactoryFootprintGeometry';

export const FACTORY_ROUTE_TYPES = ['Walking', 'Material', 'Forklift', 'AGV', 'Tugger', 'General'] as const;
export type FactoryRouteType = typeof FACTORY_ROUTE_TYPES[number];

export const FACTORY_ROUTE_DIRECTIONS = ['Forward', 'Reverse', 'Two Way'] as const;
export type FactoryRouteDirection = typeof FACTORY_ROUTE_DIRECTIONS[number];

export const FACTORY_ROUTE_ANCHOR_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type FactoryRouteAnchorSide = typeof FACTORY_ROUTE_ANCHOR_SIDES[number];

export interface ResourceRouteEndpoint {
  readonly kind: 'resource';
  readonly resourceId: string;
  readonly anchorSide: FactoryRouteAnchorSide;
  readonly anchorOffset: number;
}

export interface AreaRouteEndpoint {
  readonly kind: 'area';
  readonly areaId: string;
  readonly anchorSide: FactoryRouteAnchorSide;
  readonly anchorOffset: number;
}

export interface FreeRouteEndpoint {
  readonly kind: 'free';
  readonly point: GeometryPoint;
}

export type FactoryRouteEndpoint = ResourceRouteEndpoint | AreaRouteEndpoint | FreeRouteEndpoint;

export interface FactoryRoute {
  readonly id: string;
  readonly layoutId: string;
  name: string;
  routeType: FactoryRouteType;
  direction: FactoryRouteDirection;
  source: FactoryRouteEndpoint;
  target: FactoryRouteEndpoint;
  waypoints: GeometryPoint[];
  visible: boolean;
  locked: boolean;
  enabled: boolean;
  nominalSpeed: number | null;
  note: string;
}

export type FactoryRoutePatch = Partial<Omit<FactoryRoute, 'id' | 'layoutId'>>;

export function cloneFactoryRouteEndpoint(endpoint: FactoryRouteEndpoint): FactoryRouteEndpoint {
  if (endpoint.kind === 'free') return { kind: 'free', point: { ...endpoint.point } };
  return { ...endpoint };
}

export function cloneFactoryRoute(route: FactoryRoute): FactoryRoute {
  return {
    ...route,
    source: cloneFactoryRouteEndpoint(route.source),
    target: cloneFactoryRouteEndpoint(route.target),
    waypoints: route.waypoints.map((point) => ({ ...point })),
  };
}
