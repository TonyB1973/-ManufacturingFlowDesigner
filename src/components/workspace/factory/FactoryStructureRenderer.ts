import type { SelectionController } from '../../../models/selection/Selection';
import type { FactoryStructureStore } from '../../../services/FactoryStructureStore';
import { wallRectangle } from '../../../services/geometry/FactoryStructureGeometry';
import { estimateSvgTextWidth } from '../../../utilities/SvgTextFit';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] => document.createElementNS(SVG_NAMESPACE, tag);
const points = (values: readonly { readonly x: number; readonly y: number }[]): string => values.map((point) => `${point.x},${point.y}`).join(' ');

export interface FactoryLayerVisibility { boundary: boolean; floorFill: boolean; walls: boolean; areas: boolean; aisles: boolean; labels: boolean; resources: boolean; }

export class FactoryStructureRenderer {
  private visibility: FactoryLayerVisibility = { boundary: true, floorFill: true, walls: true, areas: true, aisles: true, labels: true, resources: true };
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly boundaryLayer: SVGGElement,
    private readonly areaLayer: SVGGElement,
    private readonly aisleLayer: SVGGElement,
    private readonly wallLayer: SVGGElement,
    private readonly store: FactoryStructureStore,
    private readonly selection: SelectionController,
  ) { this.unsubscribers = [store.subscribe(() => this.render()), selection.subscribe(() => this.render())]; this.render(); }

  public setVisibility(patch: Partial<FactoryLayerVisibility>): void { this.visibility = { ...this.visibility, ...patch }; this.render(); }
  public getVisibility(): FactoryLayerVisibility { return { ...this.visibility }; }
  public dispose(): void { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.boundaryLayer.replaceChildren(); this.areaLayer.replaceChildren(); this.aisleLayer.replaceChildren(); this.wallLayer.replaceChildren(); }

  private render(): void {
    this.boundaryLayer.replaceChildren(); this.areaLayer.replaceChildren(); this.aisleLayer.replaceChildren(); this.wallLayer.replaceChildren();
    if (this.visibility.boundary) for (const boundary of this.store.getBoundaries().filter((item) => item.visible)) {
      const polygon = svg('polygon'); polygon.setAttribute('points', points(boundary.points)); polygon.classList.add('factory-boundary'); polygon.classList.toggle('factory-boundary--selected', this.selection.contains({ kind: 'boundary', id: boundary.id })); polygon.setAttribute('fill', boundary.fillVisible && this.visibility.floorFill ? 'var(--factory-floor-fill)' : 'none'); polygon.dataset.boundaryId = boundary.id; polygon.setAttribute('tabindex', '0'); polygon.setAttribute('role', 'button'); polygon.setAttribute('aria-label', `${boundary.name}, factory boundary${boundary.locked ? ', locked' : ''}`); polygon.append(this.title(`${boundary.id} — ${boundary.name}`)); this.bindSelection(polygon, { kind: 'boundary', id: boundary.id }); this.boundaryLayer.append(polygon);
    }
    if (this.visibility.areas) for (const area of this.store.getAreas().filter((item) => item.visible)) {
      const group = svg('g'); group.classList.add('factory-area', `factory-area--${area.areaType.toLowerCase().replaceAll(' ', '-')}`); group.classList.toggle('factory-structure--selected', this.selection.contains({ kind: 'area', id: area.id })); group.setAttribute('transform', `translate(${area.worldX} ${area.worldY}) rotate(${area.rotationDegrees})`); group.dataset.areaId = area.id; group.setAttribute('tabindex', '0'); group.setAttribute('role', 'button'); group.setAttribute('aria-label', `${area.name}, ${area.areaType} area, resource placement ${area.resourcePlacementPolicy}`); const rectangle = svg('rect'); rectangle.setAttribute('x', String(-area.width / 2)); rectangle.setAttribute('y', String(-area.depth / 2)); rectangle.setAttribute('width', String(area.width)); rectangle.setAttribute('height', String(area.depth)); rectangle.setAttribute('fill', area.fillVisible ? '' : 'none'); group.append(rectangle, this.title(`${area.id} — ${area.name} — ${area.areaType}`)); if (this.visibility.labels) group.append(this.labelBadge(`${area.name} · ${area.areaType}`, -area.width / 2 + 14, -area.depth / 2 + 22)); this.bindSelection(group, { kind: 'area', id: area.id }); this.areaLayer.append(group);
    }
    if (this.visibility.aisles) for (const aisle of this.store.getAisles().filter((item) => item.visible)) {
      const group = svg('g'); group.classList.add('factory-aisle', `factory-aisle--${aisle.aisleType.toLowerCase()}`); group.classList.toggle('factory-structure--selected', this.selection.contains({ kind: 'aisle', id: aisle.id })); group.dataset.aisleId = aisle.id; group.setAttribute('tabindex', '0'); group.setAttribute('role', 'button'); group.setAttribute('aria-label', `${aisle.name}, ${aisle.aisleType} aisle, ${aisle.width} units wide, ${aisle.direction}`); const corridor = svg('polyline'); corridor.setAttribute('points', points(aisle.points)); corridor.setAttribute('stroke-width', String(aisle.width)); corridor.setAttribute('fill', 'none'); corridor.classList.add('factory-aisle__corridor'); const centre = svg('polyline'); centre.setAttribute('points', points(aisle.points)); centre.setAttribute('fill', 'none'); centre.classList.add('factory-aisle__centreline'); group.append(corridor, centre, this.title(`${aisle.id} — ${aisle.name} — ${aisle.width} wide`)); if (this.visibility.labels && aisle.points.length) group.append(this.labelBadge(`${aisle.name} · ${aisle.width}`, aisle.points[0].x, aisle.points[0].y - aisle.width / 2 - 12)); this.bindSelection(group, { kind: 'aisle', id: aisle.id }); this.aisleLayer.append(group);
    }
    if (this.visibility.walls) for (const wall of this.store.getWalls().filter((item) => item.visible)) {
      const polygon = svg('polygon'); polygon.setAttribute('points', points(wallRectangle(wall))); polygon.classList.add('factory-wall', `factory-wall--${wall.wallType.toLowerCase().replaceAll(' ', '-')}`); polygon.classList.toggle('factory-structure--selected', this.selection.contains({ kind: 'wall', id: wall.id })); polygon.dataset.wallId = wall.id; polygon.setAttribute('tabindex', '0'); polygon.setAttribute('role', 'button'); polygon.setAttribute('aria-label', `${wall.name}, ${wall.wallType} wall, ${wall.thickness} units thick${wall.locked ? ', locked' : ''}`); polygon.append(this.title(`${wall.id} — ${wall.name} — ${wall.wallType}`)); this.bindSelection(polygon, { kind: 'wall', id: wall.id }); this.wallLayer.append(polygon);
    }
  }

  private bindSelection(node: SVGElement, item: { readonly kind: 'boundary' | 'wall' | 'area' | 'aisle'; readonly id: string }): void { const choose = (event: Event): void => { const pointer = event as PointerEvent; if (pointer.ctrlKey || pointer.metaKey) this.selection.toggle(item); else if (pointer.shiftKey) this.selection.add(item); else this.selection.select(item); event.stopPropagation(); }; node.addEventListener('pointerdown', choose); node.addEventListener('keydown', (event) => { if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') { event.preventDefault(); choose(event); } }); }
  private labelBadge(value: string, x: number, y: number): SVGGElement { const group = svg('g'); group.classList.add('factory-structure-label-group'); const width = estimateSvgTextWidth(value, 13) + 12; const background = svg('rect'); background.classList.add('factory-structure-label-background'); background.setAttribute('x', String(x - 6)); background.setAttribute('y', String(y - 13)); background.setAttribute('width', String(width)); background.setAttribute('height', '18'); background.setAttribute('rx', '3'); const label = svg('text'); label.textContent = value; label.setAttribute('x', String(x)); label.setAttribute('y', String(y)); label.classList.add('factory-structure-label'); group.append(background, label); return group; }
  private title(value: string): SVGTitleElement { const title = svg('title'); title.textContent = value; return title; }
}
