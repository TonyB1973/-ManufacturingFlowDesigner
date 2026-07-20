import type { ProcessConnection, WorldPoint } from '../../../models/connections/ProcessConnection';
import type { OperationStore } from '../../../services/OperationStore';
import type { ConnectionStore, ConnectionStoreChange } from '../../../services/ConnectionStore';
import { anchorWorldPosition } from '../../../services/ConnectionAnchors';
import { routeLength } from '../../../services/OrthogonalRouter';
import { estimateSvgTextWidth, fitSvgText } from '../../../utilities/SvgTextFit';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] { return document.createElementNS(SVG_NAMESPACE, tag); }
function pathData(points: readonly WorldPoint[]): string { return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '); }

interface ConnectionNode { readonly group: SVGGElement; readonly title: SVGTitleElement; readonly selection: SVGPathElement; readonly route: SVGPathElement; readonly hit: SVGPathElement; readonly labelGroup: SVGGElement; readonly labelBackground: SVGRectElement; readonly label: SVGTextElement; readonly warning: SVGTextElement; readonly sourcePort: SVGCircleElement; readonly targetPort: SVGCircleElement; }

export class ConnectionRenderer {
  private readonly nodes = new Map<string, ConnectionNode>(); private readonly unsubscribe: () => void;
  public constructor(private readonly layer: SVGGElement, private readonly store: ConnectionStore, private readonly operations: OperationStore) {
    this.installMarker(); store.getConnections().forEach((connection) => this.add(connection)); this.unsubscribe = store.subscribe(this.change);
  }
  public dispose(): void { this.unsubscribe(); this.layer.replaceChildren(); this.nodes.clear(); }
  private installMarker(): void {
    const definitions = svg('defs'); const marker = svg('marker'); marker.id = 'process-arrowhead'; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7'); marker.setAttribute('orient', 'auto-start-reverse'); marker.setAttribute('markerUnits', 'strokeWidth');
    const arrow = svg('path'); arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); arrow.classList.add('process-arrowhead'); marker.append(arrow); definitions.append(marker); this.layer.append(definitions);
  }
  private readonly change = (change: ConnectionStoreChange): void => {
    if (change.kind === 'reset') { this.layer.replaceChildren(); this.nodes.clear(); this.installMarker(); this.store.getConnections().forEach((connection) => this.add(connection)); }
    else if (change.kind === 'created') this.add(change.connection);
    else if (change.kind === 'updated') this.render(change.connection);
    else if (change.kind === 'deleted') { this.nodes.get(change.connectionId)?.group.remove(); this.nodes.delete(change.connectionId); }
    else this.store.getConnections().forEach((connection) => this.render(connection));
  };
  private add(connection: ProcessConnection): void {
    const group = svg('g'); group.classList.add('process-connection'); group.dataset.connectionId = connection.id; group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
    const title = svg('title'); const selection = svg('path'); selection.classList.add('process-connection__selection'); const route = svg('path'); route.classList.add('process-connection__route'); route.setAttribute('marker-end', 'url(#process-arrowhead)');
    const hit = svg('path'); hit.classList.add('process-connection__hit'); hit.dataset.connectionId = connection.id;
    const labelGroup = svg('g'); labelGroup.classList.add('process-connection__label-group'); const labelBackground = svg('rect'); labelBackground.classList.add('process-connection__label-background'); const label = svg('text'); label.classList.add('process-connection__label'); labelGroup.append(labelBackground, label);
    const warning = svg('text'); warning.classList.add('process-connection__warning'); warning.textContent = '⚠'; const sourcePort = svg('circle'); sourcePort.classList.add('process-connection__anchor'); const targetPort = svg('circle'); targetPort.classList.add('process-connection__anchor');
    group.append(title, selection, route, hit, labelGroup, warning, sourcePort, targetPort); this.layer.append(group); this.nodes.set(connection.id, { group, title, selection, route, hit, labelGroup, labelBackground, label, warning, sourcePort, targetPort }); this.render(connection);
  }
  private render(connection: ProcessConnection): void {
    const node = this.nodes.get(connection.id); if (!node) return; const source = this.operations.getOperation(connection.sourceOperationId); const target = this.operations.getOperation(connection.targetOperationId);
    const sourceName = source ? `OP ${source.sequence} ${source.name}` : connection.sourceOperationId; const targetName = target ? `OP ${target.sequence} ${target.name}` : connection.targetOperationId; const d = pathData(connection.routePoints);
    node.group.setAttribute('display', connection.visible ? 'inline' : 'none'); node.group.setAttribute('aria-label', `${connection.id}, ${sourceName} to ${targetName}${connection.routeStatus === 'fallback' ? ', routing warning' : ''}${connection.locked ? ', locked' : ''}`);
    node.group.classList.toggle('process-connection--selected', connection.selected); node.group.classList.toggle('process-connection--warning', connection.routeStatus === 'fallback'); node.group.classList.toggle('process-connection--locked', connection.locked); node.group.classList.toggle('process-connection--delete-target', false); node.group.dataset.connectionType = connection.connectionType;
    node.title.textContent = `${connection.id}: ${sourceName} → ${targetName}${connection.label ? ` — ${connection.label}` : ''}`; [node.selection, node.route, node.hit].forEach((path) => path.setAttribute('d', d));
    const midpoint = routeMidpoint(connection.routePoints); const fitted = fitSvgText(connection.label, 120, 9, (text) => estimateSvgTextWidth(text, 9)); node.label.textContent = fitted; node.label.setAttribute('x', String(midpoint.x)); node.label.setAttribute('y', String(midpoint.y + 3));
    const width = Math.max(24, estimateSvgTextWidth(fitted, 9) + 12); node.labelBackground.setAttribute('x', String(midpoint.x - width / 2)); node.labelBackground.setAttribute('y', String(midpoint.y - 9)); node.labelBackground.setAttribute('width', String(width)); node.labelBackground.setAttribute('height', '16'); node.labelBackground.setAttribute('rx', '3'); node.labelGroup.setAttribute('display', connection.label ? 'inline' : 'none');
    node.warning.setAttribute('x', String(midpoint.x + (connection.label ? width / 2 + 5 : 0))); node.warning.setAttribute('y', String(midpoint.y - 7)); node.warning.setAttribute('display', connection.routeStatus === 'fallback' ? 'inline' : 'none'); node.warning.setAttribute('aria-label', 'Routing warning: fallback route used');
    if (source) setCircle(node.sourcePort, anchorWorldPosition(source, connection.sourceAnchor), connection.selected); if (target) setCircle(node.targetPort, anchorWorldPosition(target, connection.targetAnchor), connection.selected);
  }
}

function setCircle(circle: SVGCircleElement, point: WorldPoint, visible: boolean): void { circle.setAttribute('cx', String(point.x)); circle.setAttribute('cy', String(point.y)); circle.setAttribute('r', '5'); circle.setAttribute('display', visible ? 'inline' : 'none'); }
function routeMidpoint(points: readonly WorldPoint[]): WorldPoint {
  if (!points.length) return { x: 0, y: 0 }; const total = routeLength(points); let traversed = 0;
  for (let index = 1; index < points.length; index += 1) { const start = points[index - 1]; const end = points[index]; const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y); if (traversed + length >= total / 2) { const ratio = length ? (total / 2 - traversed) / length : 0; return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }; } traversed += length; }
  return points[points.length - 1];
}
