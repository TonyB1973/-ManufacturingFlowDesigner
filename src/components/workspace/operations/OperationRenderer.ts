import type { OperationInstance } from '../../../models/operations/OperationInstance';
import type { OperationStore, OperationStoreChange } from '../../../services/OperationStore';
import { validateOperations } from '../../../services/OperationValidation';
import type { ResourceStore } from '../../../services/ResourceStore';
import { estimateSvgTextWidth, fitSvgText } from '../../../utilities/SvgTextFit';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] { return document.createElementNS(SVG_NAMESPACE, tag); }
function fit(node: SVGTextElement, text: string, width: number, size: number): void {
  node.textContent = fitSvgText(text, width, size, (candidate) => { node.textContent = candidate; const measured = node.getComputedTextLength?.() ?? 0; return measured || estimateSvgTextWidth(candidate, size); });
}
interface NodeParts { group: SVGGElement; title: SVGTitleElement; body: SVGRectElement; header: SVGRectElement; accent: SVGRectElement; selection: SVGRectElement; sequence: SVGTextElement; cycle: SVGTextElement; name: SVGTextElement; detail: SVGTextElement; assignment: SVGTextElement; timing: SVGTextElement; warning: SVGTextElement; lock: SVGTextElement; }

export class OperationRenderer {
  private readonly nodes = new Map<string, NodeParts>(); private readonly unsubscribe: () => void; private readonly unsubscribeResources: () => void;
  public constructor(private readonly layer: SVGGElement, private readonly store: OperationStore, private readonly resources: ResourceStore) {
    store.getOperations().forEach((operation) => this.add(operation)); this.unsubscribe = store.subscribe(this.change);
    this.unsubscribeResources = resources.subscribe(() => this.renderAll());
  }
  public dispose(): void { this.unsubscribe(); this.unsubscribeResources(); this.layer.replaceChildren(); this.nodes.clear(); }
  private readonly change = (change: OperationStoreChange): void => {
    if (change.kind === 'created') this.add(change.operation);
    else if (change.kind === 'updated') this.render(change.operation);
    else if (change.kind === 'deleted') { this.nodes.get(change.operationId)?.group.remove(); this.nodes.delete(change.operationId); }
    else this.renderAll();
  };
  private add(operation: OperationInstance): void {
    const group = svg('g'); group.classList.add('placed-operation'); group.dataset.operationId = operation.id; group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
    const title = svg('title'); const body = svg('rect'); body.classList.add('placed-operation__body'); const header = svg('rect'); header.classList.add('placed-operation__header');
    const accent = svg('rect'); accent.classList.add('placed-operation__accent'); const selection = svg('rect'); selection.classList.add('placed-operation__selection');
    const sequence = svg('text'); sequence.classList.add('placed-operation__sequence'); const cycle = svg('text'); cycle.classList.add('placed-operation__cycle');
    const name = svg('text'); name.classList.add('placed-operation__name'); const detail = svg('text'); detail.classList.add('placed-operation__detail');
    const assignment = svg('text'); assignment.classList.add('placed-operation__assignment'); const timing = svg('text'); timing.classList.add('placed-operation__timing');
    const warning = svg('text'); warning.classList.add('placed-operation__warning'); warning.textContent = '⚠'; const lock = svg('text'); lock.classList.add('placed-operation__lock'); lock.textContent = 'LOCKED';
    group.append(title, body, header, accent, sequence, cycle, name, detail, assignment, timing, warning, lock, selection); layerAppend(this.layer, group);
    this.nodes.set(operation.id, { group, title, body, header, accent, selection, sequence, cycle, name, detail, assignment, timing, warning, lock }); this.render(operation);
  }
  private render(operation: OperationInstance): void {
    const node = this.nodes.get(operation.id); if (!node) return; const x = -operation.width / 2; const y = -operation.height / 2; const headerHeight = 26;
    node.group.setAttribute('transform', `translate(${operation.worldX} ${operation.worldY})`); node.group.setAttribute('display', operation.visible ? 'inline' : 'none');
    node.group.classList.toggle('placed-operation--selected', operation.selected); node.group.classList.toggle('placed-operation--locked', operation.locked);
    node.group.setAttribute('aria-label', `Operation ${operation.sequence}, ${operation.name}, ${operation.operationType}${operation.selected ? ', selected' : ''}${operation.locked ? ', locked' : ''}`); node.title.textContent = `${operation.name} — OP ${operation.sequence}`;
    for (const rectangle of [node.body, node.selection]) { rectangle.setAttribute('x', String(x)); rectangle.setAttribute('y', String(y)); rectangle.setAttribute('width', String(operation.width)); rectangle.setAttribute('height', String(operation.height)); rectangle.setAttribute('rx', '5'); }
    node.header.setAttribute('x', String(x)); node.header.setAttribute('y', String(y)); node.header.setAttribute('width', String(operation.width)); node.header.setAttribute('height', String(headerHeight)); node.header.setAttribute('rx', '5');
    node.accent.setAttribute('x', String(x)); node.accent.setAttribute('y', String(y)); node.accent.setAttribute('width', '5'); node.accent.setAttribute('height', String(operation.height));
    node.sequence.setAttribute('x', String(x + 12)); node.sequence.setAttribute('y', String(y + 18)); node.sequence.textContent = `OP ${operation.sequence}`;
    node.cycle.setAttribute('x', String(-x - 10)); node.cycle.setAttribute('y', String(y + 18)); node.cycle.textContent = `CT ${operation.cycleTimeSeconds}s`;
    node.name.setAttribute('x', String(x + 12)); node.name.setAttribute('y', String(y + 46)); fit(node.name, operation.name, operation.width - 24, 13);
    node.detail.setAttribute('x', String(x + 12)); node.detail.setAttribute('y', String(y + 63)); fit(node.detail, operation.operationType, operation.width - 24, 10);
    const assigned = operation.assignedResourceId ? this.resources.getResource(operation.assignedResourceId)?.name ?? 'Missing resource' : 'Unassigned';
    node.assignment.setAttribute('x', String(x + 12)); node.assignment.setAttribute('y', String(-y - 10)); fit(node.assignment, `Resource: ${assigned}`, operation.width - 88, 9);
    node.timing.setAttribute('x', String(-x - 10)); node.timing.setAttribute('y', String(-y - 10)); node.timing.textContent = operation.timingCategory === 'Value Added' ? 'VA' : operation.timingCategory === 'Non-Value Added' ? 'NVA' : 'RNVA';
    const issues = validateOperations(this.store.getOperations(), (id) => this.resources.getResource(id), (id) => Boolean(this.resources.getTemplate(id))).issues.filter((issue) => issue.operationId === operation.id);
    node.warning.setAttribute('x', String(x + 55)); node.warning.setAttribute('y', String(y + 18)); node.warning.setAttribute('display', issues.length ? 'inline' : 'none'); node.warning.setAttribute('aria-label', issues.map((issue) => issue.message).join(' '));
    node.lock.setAttribute('x', String(-x - 54)); node.lock.setAttribute('y', String(y - 6)); node.lock.setAttribute('display', operation.locked ? 'inline' : 'none');
  }
  private renderAll(): void { this.store.getOperations().forEach((operation) => this.render(operation)); }
}

function layerAppend(layer: SVGGElement, group: SVGGElement): void { layer.append(group); }
