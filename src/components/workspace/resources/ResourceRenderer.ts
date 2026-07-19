import type { PlacedResource } from '../../../models/resources/PlacedResource';
import type { ResourceTemplate } from '../../../models/resources/ResourceTemplate';
import type { ResourceStore, ResourceStoreChange } from '../../../services/ResourceStore';
import { RESOURCE_ICON_PATHS } from '../../../ui/resourceIcons';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tag);
}
interface ResourceNode {
  readonly group: SVGGElement;
  readonly body: SVGRectElement;
  readonly accent: SVGRectElement;
  readonly icon: SVGPathElement;
  readonly name: SVGTextElement;
  readonly type: SVGTextElement;
  readonly selection: SVGRectElement;
  readonly selectionLabel: SVGTextElement;
  readonly lockLabel: SVGTextElement;
}

export class ResourceRenderer {
  private readonly nodes = new Map<string, ResourceNode>();
  private readonly templates = new Map<string, ResourceTemplate>();
  private readonly unsubscribe: () => void;

  public constructor(private readonly layer: SVGGElement, private readonly store: ResourceStore) {
    store.getTemplates().forEach((template) => this.templates.set(template.id, template));
    store.getPlacedResources().forEach((resource) => this.addResource(resource));
    this.unsubscribe = store.subscribe(this.handleChange);
  }

  public dispose(): void {
    this.unsubscribe();
    this.layer.replaceChildren();
    this.nodes.clear();
  }

  private readonly handleChange = (change: ResourceStoreChange): void => {
    switch (change.kind) {
      case 'created':
        this.addResource(change.resource);
        this.renderSelectionStates();
        break;
      case 'updated':
        this.renderResource(change.resource);
        break;
      case 'deleted':
        this.nodes.get(change.resourceId)?.group.remove();
        this.nodes.delete(change.resourceId);
        break;
      case 'selection':
        this.renderSelectionStates();
        break;
      case 'template':
        break;
    }
  };

  private addResource(resource: PlacedResource): void {
    const template = this.templates.get(resource.templateId);
    if (!template) return;
    const group = svgElement('g');
    group.classList.add('placed-resource');
    group.dataset.resourceId = resource.id;
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    const body = svgElement('rect');
    body.classList.add('placed-resource__body');
    const accent = svgElement('rect');
    accent.classList.add('placed-resource__accent');
    const icon = svgElement('path');
    icon.classList.add('placed-resource__icon');
    icon.setAttribute('d', RESOURCE_ICON_PATHS[template.icon]);
    const name = svgElement('text');
    name.classList.add('placed-resource__name');
    const type = svgElement('text');
    type.classList.add('placed-resource__type');
    const selection = svgElement('rect');
    selection.classList.add('placed-resource__selection');
    const selectionLabel = svgElement('text');
    selectionLabel.classList.add('placed-resource__selection-label');
    selectionLabel.textContent = 'SELECTED';
    const lockLabel = svgElement('text');
    lockLabel.classList.add('placed-resource__lock-label');
    lockLabel.textContent = 'LOCKED';
    group.append(body, accent, icon, name, type, selection, selectionLabel, lockLabel);
    this.layer.append(group);
    this.nodes.set(resource.id, { group, body, accent, icon, name, type, selection, selectionLabel, lockLabel });
    this.renderResource(resource);
  }

  private renderResource(resource: PlacedResource): void {
    const node = this.nodes.get(resource.id);
    if (!node) return;
    const x = -resource.width / 2;
    const y = -resource.height / 2;
    node.group.setAttribute('transform', `translate(${resource.worldX} ${resource.worldY})`);
    node.group.setAttribute('display', resource.visible ? 'inline' : 'none');
    node.group.setAttribute('aria-label', `${resource.name}, ${resource.resourceType}${resource.locked ? ', locked' : ''}${resource.selected ? ', selected' : ''}`);
    node.group.classList.toggle('placed-resource--selected', resource.selected);
    node.group.classList.toggle('placed-resource--locked', resource.locked);
    for (const rectangle of [node.body, node.selection]) {
      rectangle.setAttribute('x', String(x));
      rectangle.setAttribute('y', String(y));
      rectangle.setAttribute('width', String(resource.width));
      rectangle.setAttribute('height', String(resource.height));
      rectangle.setAttribute('rx', '3');
    }
    node.accent.setAttribute('x', String(x));
    node.accent.setAttribute('y', String(y));
    node.accent.setAttribute('width', '5');
    node.accent.setAttribute('height', String(resource.height));
    node.icon.setAttribute('transform', `translate(${x + 12} ${-12}) scale(0.9)`);
    node.name.setAttribute('x', String(x + 40));
    node.name.setAttribute('y', '-4');
    node.name.textContent = resource.name;
    node.type.setAttribute('x', String(x + 40));
    node.type.setAttribute('y', '15');
    node.type.textContent = resource.resourceType;
    node.selectionLabel.setAttribute('x', String(x + 8));
    node.selectionLabel.setAttribute('y', String(y - 7));
    node.lockLabel.setAttribute('x', String(-x - 8));
    node.lockLabel.setAttribute('y', String(-y - 7));
    node.lockLabel.setAttribute('display', resource.locked ? 'inline' : 'none');
  }

  private renderSelectionStates(): void {
    for (const resource of this.store.getPlacedResources()) this.renderResource(resource);
  }
}
