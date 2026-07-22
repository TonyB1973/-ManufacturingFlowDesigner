import { cloneFactoryRoute, cloneFactoryRouteEndpoint, type FactoryRoute, type FactoryRouteEndpoint, type FactoryRoutePatch, type FactoryRouteType } from '../../models/factory/FactoryRoute';
import type { SelectionItem } from '../../models/selection/Selection';
import type { GeometryPoint } from '../geometry/FactoryFootprintGeometry';
import type { CommandExecutionContext } from './ApplicationCommand';
import { ReversibleCommand } from './ApplicationCommand';
import { cloneFactoryAnnotation } from '../../models/factory/FactoryAnnotation';
import type { CommandHistoryService } from './CommandHistoryService';

const same = (left: unknown, right: unknown): boolean => Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);
const changedPatch = (route: FactoryRoute, patch: FactoryRoutePatch): FactoryRoutePatch => Object.fromEntries(Object.entries(patch).filter(([key, value]) => !same(route[key as keyof FactoryRoute], value))) as FactoryRoutePatch;

export class FactoryRouteCommandFactory {
  public constructor(private readonly history: CommandHistoryService, private readonly context: CommandExecutionContext) {}

  public createRoute(source: FactoryRouteEndpoint, target: FactoryRouteEndpoint, waypoints: readonly GeometryPoint[], routeType: FactoryRouteType): FactoryRoute | null {
    let snapshot: FactoryRoute | null = null;
    const command = new ReversibleCommand(() => `Create ${routeType} route ${snapshot?.id ?? ''}`.trim(), () => snapshot ? [snapshot.id] : [], 'factoryLayout',
      ({ routes, selection }) => { if (!snapshot) { const created = routes.createRoute(source, target, waypoints, routeType); if (!created) throw new Error('FactoryRoute could not be created.'); snapshot = cloneFactoryRoute(created); } else if (!routes.restoreRoute(snapshot)) throw new Error('FactoryRoute could not be restored.'); selection.select({ kind: 'factoryRoute', id: snapshot.id }); },
      ({ routes, selection }) => { if (!snapshot || !routes.deleteRoute(snapshot.id)) throw new Error('FactoryRoute creation could not be undone.'); selection.clear(); });
    return this.run(command) ? snapshot : null;
  }

  public updateRoute(id: string, patch: FactoryRoutePatch, description = `Edit route ${id}`): boolean {
    const route = this.context.routes.getRoute(id); if (!route) return false; const after = changedPatch(route, patch); if (!Object.keys(after).length) return false;
    const before: FactoryRoutePatch = {};
    for (const key of Object.keys(after) as (keyof FactoryRoutePatch)[]) {
      const value = route[key as keyof FactoryRoute];
      (before as Record<string, unknown>)[key] = key === 'source' || key === 'target' ? cloneFactoryRouteEndpoint(value as FactoryRouteEndpoint) : key === 'waypoints' ? route.waypoints.map((point) => ({ ...point })) : value;
    }
    return this.run(new ReversibleCommand(description, [id], 'factoryLayout', ({ routes }) => { if (!routes.updateRoute(id, after)) throw new Error('FactoryRoute update was rejected.'); }, ({ routes }) => { if (!routes.updateRoute(id, before)) throw new Error('FactoryRoute update could not be undone.'); }));
  }

  public reverseRoute(id: string): boolean {
    const route = this.context.routes.getRoute(id); if (!route || route.locked) return false;
    const after: FactoryRoutePatch = { source: cloneFactoryRouteEndpoint(route.target), target: cloneFactoryRouteEndpoint(route.source), waypoints: [...route.waypoints].reverse().map((point) => ({ ...point })), direction: route.direction === 'Forward' ? 'Reverse' : route.direction === 'Reverse' ? 'Forward' : 'Two Way' };
    return this.updateRoute(id, after, `Reverse route ${id}`);
  }

  public deleteRoute(id: string): boolean { return this.deleteRoutes([id], `Delete route ${id}`); }

  public deleteRoutes(ids: readonly string[], description = 'Delete routes'): boolean {
    const snapshots = ids.map((id) => this.context.routes.getRoute(id)).filter((route): route is FactoryRoute => Boolean(route && !route.locked)).map(cloneFactoryRoute); if (!snapshots.length) return false;
    const refs: SelectionItem[] = snapshots.map((route) => ({ kind: 'factoryRoute', id: route.id }));
    const annotations = snapshots.flatMap((route) => this.context.annotations.getAttached('factoryRoute', route.id)).filter((value, index, all) => all.findIndex((candidate) => candidate.id === value.id) === index).map(cloneFactoryAnnotation);
    return this.run(new ReversibleCommand(description, [...snapshots.map((route) => route.id), ...annotations.map((annotation) => annotation.id)], 'factoryLayout',
      ({ routes, annotations: store, selection }) => { for (const annotation of annotations) store.deleteAnnotation(annotation.id, true); for (const route of snapshots) if (!routes.deleteRoute(route.id)) throw new Error(`FactoryRoute ${route.id} could not be deleted.`); selection.clear(); },
      ({ routes, annotations: store, selection }) => { for (const route of snapshots) if (!routes.restoreRoute(route)) throw new Error(`FactoryRoute ${route.id} could not be restored.`); for (const annotation of annotations) if (!store.restoreAnnotation(annotation)) throw new Error(`Annotation ${annotation.id} could not be restored.`); selection.set(refs, refs.at(-1)); }));
  }

  public insertRoutes(routes: readonly FactoryRoute[], description = 'Paste factory routes'): boolean {
    const snapshots = routes.map(cloneFactoryRoute); if (!snapshots.length) return false; const refs: SelectionItem[] = snapshots.map((route) => ({ kind: 'factoryRoute', id: route.id }));
    return this.run(new ReversibleCommand(description, snapshots.map((route) => route.id), 'factoryLayout',
      ({ routes: store, selection }) => { for (const route of snapshots) if (!store.restoreRoute(route)) throw new Error(`FactoryRoute ${route.id} could not be inserted.`); selection.set(refs, refs.at(-1)); },
      ({ routes: store, selection }) => { for (const route of [...snapshots].reverse()) if (!store.deleteRoute(route.id)) throw new Error(`FactoryRoute ${route.id} could not be removed.`); selection.clear(); }));
  }

  public updateRoutes(ids: readonly string[], patch: FactoryRoutePatch, description: string): boolean {
    const routes = ids.map((id) => this.context.routes.getRoute(id)).filter((route): route is FactoryRoute => Boolean(route));
    const changes = routes.map((route) => ({ id: route.id, before: cloneFactoryRoute(route), after: { ...cloneFactoryRoute(route), ...patch } as FactoryRoute })).filter((change) => !same(change.before, change.after)); if (!changes.length) return false;
    return this.run(new ReversibleCommand(description, changes.map((change) => change.id), 'factoryLayout',
      ({ routes: store }) => { for (const change of changes) if (!store.updateRoute(change.id, patch)) throw new Error(`FactoryRoute ${change.id} could not be updated.`); },
      ({ routes: store }) => { for (const change of changes) if (!store.updateRoute(change.id, change.before)) throw new Error(`FactoryRoute ${change.id} could not be restored.`); }));
  }

  private run(command: ReversibleCommand): boolean { try { return this.history.execute(command); } catch { return false; } }
}
