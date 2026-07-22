import type { SelectionController } from '../../../models/selection/Selection';
import type { FactoryRouteStore } from '../../../services/FactoryRouteStore';
import type { FactoryStructureStore } from '../../../services/FactoryStructureStore';
import type { ResourceStore } from '../../../services/ResourceStore';
import { validateFactoryRoutes } from '../../../services/FactoryRouteValidation';
import { factoryRouteDistance, resolveFactoryRoutePolyline } from '../../../services/geometry/FactoryRouteGeometry';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] => document.createElementNS(SVG_NAMESPACE, tag);
const points = (values: readonly { readonly x: number; readonly y: number }[]): string => values.map((point) => `${point.x},${point.y}`).join(' ');

export interface FactoryRouteLayerVisibility { routes: boolean; labels: boolean; arrows: boolean; }

export class FactoryRouteRenderer {
  private visibility: FactoryRouteLayerVisibility = { routes: true, labels: true, arrows: true };
  private readonly unsubscribers: (() => void)[];

  public constructor(private readonly layer: SVGGElement, private readonly routes: FactoryRouteStore, private readonly resources: ResourceStore, private readonly structure: FactoryStructureStore, private readonly selection: SelectionController) {
    this.unsubscribers = [routes.subscribe(() => this.render()), resources.subscribe(() => this.render()), structure.subscribe(() => this.render()), selection.subscribe(() => this.render())]; this.render();
  }

  public getVisibility(): FactoryRouteLayerVisibility { return { ...this.visibility }; }
  public setVisibility(patch: Partial<FactoryRouteLayerVisibility>): void { this.visibility = { ...this.visibility, ...patch }; this.render(); }
  public dispose(): void { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.layer.replaceChildren(); }

  private render(): void {
    this.layer.replaceChildren(); if (!this.visibility.routes) return;
    const definitions = svg('defs'); definitions.append(this.marker('factory-route-arrow-forward', false), this.marker('factory-route-arrow-reverse', true)); this.layer.append(definitions);
    const resolver = { getResource: (id: string) => this.resources.getResource(id), getArea: (id: string) => this.structure.getArea(id) };
    const validation = validateFactoryRoutes({ resources: this.resources.getPlacedResources(), structure: this.structure, routes: this.routes });
    for (const route of this.routes.getRoutes().filter((item) => item.visible)) {
      const resolved = resolveFactoryRoutePolyline(route, resolver); if (resolved.length < 2) continue;
      const relatedIssues = validation.issues.filter((issue) => issue.routeId === route.id);
      const group = svg('g'); group.classList.add('factory-route', `factory-route--${route.routeType.toLowerCase()}`); group.classList.toggle('factory-route--selected', this.selection.contains({ kind: 'factoryRoute', id: route.id })); group.classList.toggle('factory-route--locked', route.locked); group.classList.toggle('factory-route--disabled', !route.enabled); group.classList.toggle('factory-route--error', relatedIssues.some((issue) => issue.severity === 'error')); group.classList.toggle('factory-route--warning', relatedIssues.some((issue) => issue.severity === 'warning')); group.dataset.factoryRouteId = route.id; group.setAttribute('tabindex', '0'); group.setAttribute('role', 'button'); group.setAttribute('aria-label', `${route.id}, ${route.name}, ${route.routeType} route, ${route.direction}, ${factoryRouteDistance(route, resolver).toFixed(1)} project units${route.locked ? ', locked' : ''}${relatedIssues.length ? `, ${relatedIssues.length} validation issues` : ''}`);
      const hit = svg('polyline'); hit.classList.add('factory-route__hit'); hit.setAttribute('points', points(resolved)); hit.setAttribute('fill', 'none');
      const line = svg('polyline'); line.classList.add('factory-route__line'); line.setAttribute('points', points(resolved)); line.setAttribute('fill', 'none'); line.setAttribute('vector-effect', 'non-scaling-stroke');
      if (this.visibility.arrows) { if (route.direction === 'Forward' || route.direction === 'Two Way') line.setAttribute('marker-end', 'url(#factory-route-arrow-forward)'); if (route.direction === 'Reverse' || route.direction === 'Two Way') line.setAttribute('marker-start', 'url(#factory-route-arrow-reverse)'); }
      const start = svg('circle'); start.classList.add('factory-route__endpoint', 'factory-route__endpoint--source'); start.setAttribute('cx', String(resolved[0].x)); start.setAttribute('cy', String(resolved[0].y)); start.setAttribute('r', '6'); start.setAttribute('vector-effect', 'non-scaling-stroke');
      const end = svg('rect'); end.classList.add('factory-route__endpoint', 'factory-route__endpoint--target'); end.setAttribute('x', String(resolved.at(-1)!.x - 5)); end.setAttribute('y', String(resolved.at(-1)!.y - 5)); end.setAttribute('width', '10'); end.setAttribute('height', '10'); end.setAttribute('vector-effect', 'non-scaling-stroke');
      const title = svg('title'); title.textContent = `${route.id} — ${route.name} — ${route.routeType} — ${route.direction}\nDistance: ${factoryRouteDistance(route, resolver).toFixed(1)} project units${relatedIssues.length ? `\n${relatedIssues.map((issue) => issue.message).join('\n')}` : ''}`;
      group.append(hit, line, start, end, title);
      if (this.visibility.labels) { const centre = resolved[Math.floor(resolved.length / 2)]; const label = svg('text'); label.classList.add('factory-route__label'); label.setAttribute('x', String(centre.x)); label.setAttribute('y', String(centre.y - 10)); label.setAttribute('text-anchor', 'middle'); label.textContent = `${route.id} · ${route.routeType} · ${factoryRouteDistance(route, resolver).toFixed(0)}`; group.append(label); }
      if (relatedIssues.length) { const marker = svg('text'); marker.classList.add('factory-route__issue'); marker.setAttribute('x', String(resolved[Math.floor(resolved.length / 2)].x)); marker.setAttribute('y', String(resolved[Math.floor(resolved.length / 2)].y + 18)); marker.textContent = relatedIssues.some((issue) => issue.severity === 'error') ? '⛔' : '⚠'; group.append(marker); }
      const choose = (event: Event): void => { const pointer = event as PointerEvent; const ref = { kind: 'factoryRoute' as const, id: route.id }; if (pointer.ctrlKey || pointer.metaKey) this.selection.toggle(ref); else if (pointer.shiftKey) this.selection.add(ref); else this.selection.select(ref); event.stopPropagation(); };
      group.addEventListener('pointerdown', choose); group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(event); } }); this.layer.append(group);
    }
  }

  private marker(id: string, reverse: boolean): SVGMarkerElement { const marker = svg('marker'); marker.id = id; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', reverse ? '2' : '8'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7'); marker.setAttribute('orient', reverse ? 'auto-start-reverse' : 'auto'); marker.setAttribute('markerUnits', 'strokeWidth'); const path = svg('path'); path.setAttribute('d', reverse ? 'M 10 0 L 0 5 L 10 10 z' : 'M 0 0 L 10 5 L 0 10 z'); path.classList.add('factory-route__arrow'); marker.append(path); return marker; }
}
