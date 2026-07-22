import type { CanvasState } from '../../../models/canvas/CanvasState';
import type { FactoryRouteAnchorSide, FactoryRouteEndpoint, FactoryRouteType } from '../../../models/factory/FactoryRoute';
import type { FactoryStructureStore } from '../../../services/FactoryStructureStore';
import type { ResourceStore } from '../../../services/ResourceStore';
import { nearestRectangleAnchor, resolveFactoryRouteEndpoint, resolveRectangleAnchor } from '../../../services/factoryRoutes/FactoryRouteEndpointResolver';
import { nearestAisleCentreline, orthogonalDogleg } from '../../../services/geometry/FactoryRouteGeometry';
import type { GeometryPoint } from '../../../services/geometry/FactoryFootprintGeometry';
import type { FactoryRouteCommandFactory } from '../../../services/history/FactoryRouteCommandFactory';
import type { SnapService } from '../../../services/SnapService';
import { screenToWorld } from '../canvas/ViewportTransform';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] => document.createElementNS(SVG_NAMESPACE, tag);
const pointText = (points: readonly GeometryPoint[]): string => points.map((point) => `${point.x},${point.y}`).join(' ');
const SIDES: readonly FactoryRouteAnchorSide[] = ['top', 'right', 'bottom', 'left'];

export class FactoryRouteDrawController {
  private source: FactoryRouteEndpoint | null = null;
  private sourcePoint: GeometryPoint | null = null;
  private waypoints: GeometryPoint[] = [];
  private hover: GeometryPoint | null = null;
  private readonly unsubscribers: (() => void)[];

  public constructor(private readonly viewport: HTMLElement, private readonly state: CanvasState, private readonly snap: SnapService, private readonly resources: ResourceStore, private readonly structure: FactoryStructureStore, private readonly commands: FactoryRouteCommandFactory, private readonly previewLayer: SVGGElement, private readonly routeType: () => FactoryRouteType, private readonly aisleLayerVisible: () => boolean, private readonly onStatus: (message: string) => void, private readonly selectTool: () => void) {
    viewport.addEventListener('pointerdown', this.pointerDown, true); viewport.addEventListener('pointermove', this.pointerMove, true); viewport.addEventListener('pointercancel', this.pointerCancel, true); document.addEventListener('keydown', this.keyDown); this.unsubscribers = [resources.subscribe(this.refresh), structure.subscribe(this.refresh)];
  }

  public toolChanged(): void { if (this.state.tool !== 'draw-route') this.cancel(false); else { this.onStatus(`${this.routeType()} Route: select source`); this.render(); } }
  public cancel(report = true): void { const active = Boolean(this.source); this.source = null; this.sourcePoint = null; this.waypoints = []; this.hover = null; this.previewLayer.replaceChildren(); if (report && active) this.onStatus('Route drawing cancelled'); }
  public dispose(): void { this.cancel(false); this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.viewport.removeEventListener('pointerdown', this.pointerDown, true); this.viewport.removeEventListener('pointermove', this.pointerMove, true); this.viewport.removeEventListener('pointercancel', this.pointerCancel, true); document.removeEventListener('keydown', this.keyDown); }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (this.state.tool !== 'draw-route' || event.button !== 0 || (event.target as Element | null)?.closest('button,input,textarea,select')) return;
    event.preventDefault(); event.stopImmediatePropagation(); this.viewport.focus({ preventScroll: true });
    const candidate = this.endpointCandidate(event, !event.altKey);
    if (!this.source) { this.source = candidate.endpoint; this.sourcePoint = candidate.point; this.hover = candidate.point; this.onStatus(`${this.routeType()} Route: click next point or select target`); this.render(); return; }
    if (candidate.endpoint.kind !== 'free') { this.finish(candidate.endpoint); return; }
    const point = this.constrain(this.lastPoint(), this.snapPoint(candidate.point, event.altKey), event.shiftKey);
    if (event.detail >= 2) { this.finish({ kind: 'free', point }); return; }
    if (point.x !== this.lastPoint().x || point.y !== this.lastPoint().y) this.waypoints.push(point);
    this.hover = point; this.onStatus(`${this.routeType()} Route: click next point, select target, or press Enter`); this.render();
  };
  private readonly pointerMove = (event: PointerEvent): void => { if (this.state.tool !== 'draw-route') return; const local = this.local(event); const point = this.snapPoint(screenToWorld(local, this.state), event.altKey); this.hover = this.source ? this.constrain(this.lastPoint(), point, event.shiftKey) : point; this.render(); };
  private readonly pointerCancel = (): void => { if (this.state.tool === 'draw-route') this.cancel(true); };
  private readonly keyDown = (event: KeyboardEvent): void => {
    if (this.state.tool !== 'draw-route' || this.typing(event.target)) return;
    if (event.key === 'Escape') { event.preventDefault(); this.cancel(true); this.selectTool(); }
    else if (event.key === 'Backspace' && this.source) { event.preventDefault(); this.waypoints.pop(); this.onStatus(this.waypoints.length ? 'Latest route waypoint removed' : `${this.routeType()} Route: click next point or select target`); this.render(); }
    else if (event.key === 'Enter' && this.source && this.hover) { event.preventDefault(); const target = this.constrain(this.lastPoint(), this.hover); if (target.x === this.lastPoint().x && target.y === this.lastPoint().y) { this.onStatus('Move to a distinct target before finishing'); return; } this.finish({ kind: 'free', point: target }); }
  };
  private readonly refresh = (): void => { if (this.state.tool === 'draw-route') this.render(); };

  private finish(target: FactoryRouteEndpoint): void {
    if (!this.source) return; const route = this.commands.createRoute(this.source, target, this.waypoints, this.routeType());
    if (!route) { this.onStatus('Factory Route is invalid and was not created'); return; }
    this.onStatus(`Route created: ${route.id}`); this.cancel(false); this.selectTool();
  }

  private endpointCandidate(event: PointerEvent, allowSnap: boolean): { readonly endpoint: FactoryRouteEndpoint; readonly point: GeometryPoint } {
    const world = screenToWorld(this.local(event), this.state); const target = event.target as Element | null;
    const port = allowSnap ? target?.closest<SVGElement>('[data-route-anchor-kind]') : null;
    if (port) { const kind = port.dataset.routeAnchorKind; const side = port.dataset.routeAnchorSide as FactoryRouteAnchorSide; const offset = Number(port.dataset.routeAnchorOffset); const id = port.dataset.routeAnchorId!; const endpoint: FactoryRouteEndpoint = kind === 'resource' ? { kind: 'resource', resourceId: id, anchorSide: side, anchorOffset: offset } : { kind: 'area', areaId: id, anchorSide: side, anchorOffset: offset }; return { endpoint, point: resolveFactoryRouteEndpoint(endpoint, { getResource: (value) => this.resources.getResource(value), getArea: (value) => this.structure.getArea(value) })! }; }
    const resourceId = allowSnap ? target?.closest<SVGGElement>('[data-resource-id]')?.dataset.resourceId : undefined; const resource = resourceId ? this.resources.getResource(resourceId) : undefined;
    if (resource?.visible) { const anchor = nearestRectangleAnchor(world, { x: resource.worldX, y: resource.worldY }, resource.width, resource.depth, resource.rotationDegrees); return { endpoint: { kind: 'resource', resourceId: resource.id, anchorSide: anchor.side, anchorOffset: anchor.offset }, point: anchor.point }; }
    const areaId = allowSnap ? target?.closest<SVGGElement>('[data-area-id]')?.dataset.areaId : undefined; const area = areaId ? this.structure.getArea(areaId) : undefined;
    if (area?.visible) { const anchor = nearestRectangleAnchor(world, { x: area.worldX, y: area.worldY }, area.width, area.depth, area.rotationDegrees); return { endpoint: { kind: 'area', areaId: area.id, anchorSide: anchor.side, anchorOffset: anchor.offset }, point: anchor.point }; }
    const point = this.snapPoint(world, !allowSnap); return { endpoint: { kind: 'free', point }, point };
  }

  private snapPoint(point: GeometryPoint, bypass: boolean): GeometryPoint { if (bypass) return point; const aisle = this.aisleLayerVisible() ? nearestAisleCentreline(point, this.structure.getAisles(), 8 / this.state.zoom) : null; if (aisle) return aisle; return this.snap.enabled ? this.snap.snapPoint(point, false) : point; }
  private constrain(start: GeometryPoint, point: GeometryPoint, shift = false): GeometryPoint { const dx = Math.abs(point.x - start.x); const dy = Math.abs(point.y - start.y); return shift || dx >= dy ? { x: point.x, y: start.y } : { x: start.x, y: point.y }; }
  private lastPoint(): GeometryPoint { return this.waypoints.at(-1) ?? this.sourcePoint!; }
  private local(event: PointerEvent): GeometryPoint { const bounds = this.viewport.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; }
  private typing(target: EventTarget | null): boolean { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable; }

  private render(): void {
    this.previewLayer.replaceChildren(); if (this.state.tool !== 'draw-route') return;
    this.renderPorts(); if (!this.sourcePoint) return;
    const previewPoints = [...this.waypoints]; if (this.hover) previewPoints.push(...orthogonalDogleg(this.lastPoint(), this.hover).slice(1));
    const polyline = svg('polyline'); polyline.classList.add('factory-route-preview'); polyline.setAttribute('points', pointText([this.sourcePoint, ...previewPoints])); polyline.setAttribute('fill', 'none'); polyline.setAttribute('vector-effect', 'non-scaling-stroke'); this.previewLayer.append(polyline);
  }
  private renderPorts(): void {
    const radius = 5 / this.state.zoom; const hitRadius = 11 / this.state.zoom;
    const append = (kind: 'resource' | 'area', id: string, centre: GeometryPoint, width: number, depth: number, rotation: number): void => { for (const side of SIDES) { const point = resolveRectangleAnchor(centre, width, depth, rotation, side, 0.5); const hit = svg('circle'); hit.classList.add('factory-route-port-hit'); hit.setAttribute('cx', String(point.x)); hit.setAttribute('cy', String(point.y)); hit.setAttribute('r', String(hitRadius)); hit.dataset.routeAnchorKind = kind; hit.dataset.routeAnchorId = id; hit.dataset.routeAnchorSide = side; hit.dataset.routeAnchorOffset = '0.5'; const marker = svg('circle'); marker.classList.add('factory-route-port'); marker.setAttribute('cx', String(point.x)); marker.setAttribute('cy', String(point.y)); marker.setAttribute('r', String(radius)); marker.setAttribute('pointer-events', 'none'); this.previewLayer.append(hit, marker); } };
    for (const resource of this.resources.getPlacedResources().filter((item) => item.visible)) append('resource', resource.id, { x: resource.worldX, y: resource.worldY }, resource.width, resource.depth, resource.rotationDegrees);
    for (const area of this.structure.getAreas().filter((item) => item.visible)) append('area', area.id, { x: area.worldX, y: area.worldY }, area.width, area.depth, area.rotationDegrees);
  }
}
