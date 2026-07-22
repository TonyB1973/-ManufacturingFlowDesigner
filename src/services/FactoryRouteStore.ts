import { FACTORY_ROUTE_ANCHOR_SIDES, FACTORY_ROUTE_DIRECTIONS, FACTORY_ROUTE_TYPES, cloneFactoryRoute, cloneFactoryRouteEndpoint, type FactoryRoute, type FactoryRouteEndpoint, type FactoryRoutePatch, type FactoryRouteType } from '../models/factory/FactoryRoute';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../models/workspace/Workspace';
import type { FactoryRouteIdProvider } from '../utilities/FactoryRouteIdGenerator';
import type { GeometryPoint } from './geometry/FactoryFootprintGeometry';
import { simplifyOrthogonalPolyline, validateOrthogonalPolyline } from './geometry/FactoryStructureGeometry';

export type FactoryRouteChange = { readonly kind: 'created' | 'updated' | 'deleted' | 'reset'; readonly id?: string };
export type FactoryRouteListener = (change: FactoryRouteChange) => void;

export interface FactoryRouteReferenceSource { hasResource(id: string): boolean; hasArea(id: string): boolean; }

export class FactoryRouteStore {
  private readonly routes = new Map<string, FactoryRoute>();
  private readonly listeners = new Set<FactoryRouteListener>();

  public constructor(private readonly ids: FactoryRouteIdProvider, private readonly references: FactoryRouteReferenceSource) {}

  public getRoutes(): readonly FactoryRoute[] { return [...this.routes.values()]; }
  public getRoute(id: string): FactoryRoute | undefined { return this.routes.get(id); }
  public getCount(): number { return this.routes.size; }
  public getRoutesForResource(resourceId: string): readonly FactoryRoute[] { return this.getRoutes().filter((route) => (route.source.kind === 'resource' && route.source.resourceId === resourceId) || (route.target.kind === 'resource' && route.target.resourceId === resourceId)); }
  public getRoutesForArea(areaId: string): readonly FactoryRoute[] { return this.getRoutes().filter((route) => (route.source.kind === 'area' && route.source.areaId === areaId) || (route.target.kind === 'area' && route.target.areaId === areaId)); }

  public createRoute(source: FactoryRouteEndpoint, target: FactoryRouteEndpoint, waypoints: readonly GeometryPoint[], routeType: FactoryRouteType = 'Walking'): FactoryRoute | null {
    const route: FactoryRoute = { id: this.ids.next(), layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: `${routeType} Route`, routeType, direction: 'Forward', source: cloneFactoryRouteEndpoint(source), target: cloneFactoryRouteEndpoint(target), waypoints: simplifyOrthogonalPolyline(waypoints), visible: true, locked: false, enabled: true, nominalSpeed: null, note: '' };
    return this.restoreRoute(route) ? cloneFactoryRoute(route) : null;
  }

  public restoreRoute(value: FactoryRoute): boolean {
    const route = cloneFactoryRoute(value);
    if (this.routes.has(route.id) || !this.valid(route)) return false;
    this.routes.set(route.id, route); this.notify('created', route.id); return true;
  }

  public updateRoute(id: string, patch: FactoryRoutePatch): boolean {
    const current = this.routes.get(id); if (!current) return false;
    const geometric = patch.source !== undefined || patch.target !== undefined || patch.waypoints !== undefined;
    if (current.locked && (geometric || patch.direction !== undefined || patch.routeType !== undefined || patch.visible !== undefined || patch.enabled !== undefined)) return false;
    const next: FactoryRoute = { ...cloneFactoryRoute(current), ...patch, source: cloneFactoryRouteEndpoint(patch.source ?? current.source), target: cloneFactoryRouteEndpoint(patch.target ?? current.target), waypoints: simplifyOrthogonalPolyline(patch.waypoints ?? current.waypoints) };
    if (!this.valid(next)) return false;
    this.routes.set(id, next); this.notify('updated', id); return true;
  }

  public reverseRoute(id: string): boolean {
    const route = this.routes.get(id); if (!route || route.locked) return false;
    const nextDirection = route.direction === 'Forward' ? 'Reverse' : route.direction === 'Reverse' ? 'Forward' : 'Two Way';
    return this.updateRoute(id, { source: route.target, target: route.source, waypoints: [...route.waypoints].reverse(), direction: nextDirection });
  }

  public deleteRoute(id: string): boolean { const route = this.routes.get(id); if (!route || route.locked) return false; this.routes.delete(id); this.notify('deleted', id); return true; }
  public deleteAttachedToResource(resourceId: string): readonly FactoryRoute[] { return this.deleteAttached(this.getRoutesForResource(resourceId)); }
  public deleteAttachedToArea(areaId: string): readonly FactoryRoute[] { return this.deleteAttached(this.getRoutesForArea(areaId)); }

  public replaceAll(routes: readonly FactoryRoute[], notify = true): void { this.routes.clear(); for (const route of routes) this.routes.set(route.id, cloneFactoryRoute(route)); this.ids.ensureAfter(routes.map((route) => route.id)); if (notify) this.publishReset(); }
  public publishReset(): void { for (const listener of this.listeners) listener({ kind: 'reset' }); }
  public subscribe(listener: FactoryRouteListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private deleteAttached(routes: readonly FactoryRoute[]): readonly FactoryRoute[] { const removed = routes.map(cloneFactoryRoute); for (const route of routes) { this.routes.delete(route.id); this.notify('deleted', route.id); } return removed; }
  private valid(route: FactoryRoute): boolean {
    return /^FRT-\d+$/.test(route.id) && route.layoutId === DEFAULT_FACTORY_LAYOUT_ID && route.name.trim().length > 0 && route.name.length <= 200 && route.note.length <= 10000
      && FACTORY_ROUTE_TYPES.includes(route.routeType) && FACTORY_ROUTE_DIRECTIONS.includes(route.direction)
      && this.validEndpoint(route.source) && this.validEndpoint(route.target)
      && route.waypoints.length <= 10000 && route.waypoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) && validateOrthogonalPolyline(route.waypoints).filter((issue) => issue !== 'At least two points are required.').length === 0
      && typeof route.visible === 'boolean' && typeof route.locked === 'boolean' && typeof route.enabled === 'boolean'
      && (route.nominalSpeed === null || Number.isFinite(route.nominalSpeed) && route.nominalSpeed > 0);
  }
  private validEndpoint(endpoint: FactoryRouteEndpoint): boolean {
    if (endpoint.kind === 'free') return Number.isFinite(endpoint.point.x) && Number.isFinite(endpoint.point.y);
    if (!FACTORY_ROUTE_ANCHOR_SIDES.includes(endpoint.anchorSide) || !Number.isFinite(endpoint.anchorOffset) || endpoint.anchorOffset < 0 || endpoint.anchorOffset > 1) return false;
    return endpoint.kind === 'resource' ? this.references.hasResource(endpoint.resourceId) : this.references.hasArea(endpoint.areaId);
  }
  private notify(kind: FactoryRouteChange['kind'], id: string): void { for (const listener of this.listeners) listener({ kind, id }); }
}

export const factoryRouteSnapshot = (store: FactoryRouteStore): readonly FactoryRoute[] => store.getRoutes().map(cloneFactoryRoute);
