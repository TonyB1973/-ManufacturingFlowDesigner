import type { PlacedResource } from '../../../models/resources/PlacedResource';
import type { ResourceTemplate } from '../../../models/resources/ResourceTemplate';
import type { ResourceStore, ResourceStoreChange } from '../../../services/ResourceStore';
import { RESOURCE_ICON_PATHS } from '../../../ui/resourceIcons';
import { estimateSvgTextWidth, fitSvgText } from '../../../utilities/SvgTextFit';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const HORIZONTAL_PADDING = 10;
const VERTICAL_PADDING = 8;
const ICON_REGION_WIDTH = 30;
const ICON_TEXT_GAP = 8;
const ICON_SIZE = 24;
const NAME_FONT_SIZE = 11;
const TYPE_FONT_SIZE = 9;
const LOCK_INDICATOR_WIDTH = 38;
const TYPE_LINE_MINIMUM_HEIGHT = 34;

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tag);
}

function fitTextNode(element: SVGTextElement, text: string, availableWidth: number, fontSize: number): string {
  const fitted = fitSvgText(text, availableWidth, fontSize, (candidate) => {
    element.textContent = candidate;
    if (typeof element.getComputedTextLength !== 'function') return estimateSvgTextWidth(candidate, fontSize);
    const measured = element.getComputedTextLength();
    return measured > 0 ? measured : estimateSvgTextWidth(candidate, fontSize);
  });
  element.textContent = fitted;
  return fitted;
}

interface ResourceNode {
  readonly group: SVGGElement;
  readonly title: SVGTitleElement;
  readonly body: SVGRectElement;
  readonly accent: SVGRectElement;
  readonly content: SVGGElement;
  readonly clipRect: SVGRectElement;
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
    const title = svgElement('title');
    const definitions = svgElement('defs');
    const clipPath = svgElement('clipPath');
    const clipRect = svgElement('rect');
    const clipId = `resource-content-clip-${resource.id}`;
    clipPath.id = clipId;
    clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
    clipPath.append(clipRect);
    definitions.append(clipPath);
    const body = svgElement('rect');
    body.classList.add('placed-resource__body');
    const accent = svgElement('rect');
    accent.classList.add('placed-resource__accent');
    const content = svgElement('g');
    content.classList.add('placed-resource__content');
    content.setAttribute('clip-path', `url(#${clipId})`);
    const icon = svgElement('path');
    icon.classList.add('placed-resource__icon');
    icon.setAttribute('d', RESOURCE_ICON_PATHS[template.icon]);
    const name = svgElement('text');
    name.classList.add('placed-resource__name');
    name.setAttribute('font-family', 'Segoe UI, sans-serif');
    name.setAttribute('font-size', String(NAME_FONT_SIZE));
    name.setAttribute('font-weight', '600');
    const type = svgElement('text');
    type.classList.add('placed-resource__type');
    type.setAttribute('font-family', 'Segoe UI, sans-serif');
    type.setAttribute('font-size', String(TYPE_FONT_SIZE));
    const selection = svgElement('rect');
    selection.classList.add('placed-resource__selection');
    const selectionLabel = svgElement('text');
    selectionLabel.classList.add('placed-resource__selection-label');
    selectionLabel.textContent = 'SELECTED';
    const lockLabel = svgElement('text');
    lockLabel.classList.add('placed-resource__lock-label');
    lockLabel.textContent = 'LOCKED';
    content.append(icon, name, type, lockLabel);
    group.append(title, definitions, body, accent, content, selection, selectionLabel);
    this.layer.append(group);
    this.nodes.set(resource.id, { group, title, body, accent, content, clipRect, icon, name, type, selection, selectionLabel, lockLabel });
    this.renderResource(resource);
  }

  private renderResource(resource: PlacedResource): void {
    const node = this.nodes.get(resource.id);
    if (!node) return;
    const x = -resource.width / 2;
    const y = -resource.height / 2;
    const innerWidth = Math.max(0, resource.width - HORIZONTAL_PADDING * 2);
    const innerHeight = Math.max(0, resource.height - VERTICAL_PADDING * 2);
    const textX = x + HORIZONTAL_PADDING + ICON_REGION_WIDTH + ICON_TEXT_GAP;
    const availableNameWidth = Math.max(0, resource.width
      - HORIZONTAL_PADDING
      - ICON_REGION_WIDTH
      - ICON_TEXT_GAP
      - HORIZONTAL_PADDING);
    const availableTypeWidth = Math.max(0, availableNameWidth - (resource.locked ? LOCK_INDICATOR_WIDTH : 0));
    const fittedName = fitTextNode(node.name, resource.name, availableNameWidth, NAME_FONT_SIZE);
    const fittedType = fitTextNode(node.type, resource.resourceType, availableTypeWidth, TYPE_FONT_SIZE);
    const showType = innerHeight >= TYPE_LINE_MINIMUM_HEIGHT
      && availableTypeWidth >= estimateSvgTextWidth('…', TYPE_FONT_SIZE)
      && fittedType.length > 0;
    const nameBaseline = showType ? -4 : 4;
    node.group.setAttribute('transform', `translate(${resource.worldX} ${resource.worldY})`);
    node.group.setAttribute('display', resource.visible ? 'inline' : 'none');
    node.group.setAttribute('aria-label', `${resource.name}, ${resource.resourceType}${resource.locked ? ', locked' : ''}${resource.selected ? ', selected' : ''}`);
    node.title.textContent = resource.name;
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
    node.clipRect.setAttribute('x', String(x + HORIZONTAL_PADDING));
    node.clipRect.setAttribute('y', String(y + VERTICAL_PADDING));
    node.clipRect.setAttribute('width', String(innerWidth));
    node.clipRect.setAttribute('height', String(innerHeight));
    const iconX = x + HORIZONTAL_PADDING + (ICON_REGION_WIDTH - ICON_SIZE) / 2;
    node.icon.setAttribute('transform', `translate(${iconX} ${-ICON_SIZE / 2}) scale(${ICON_SIZE / 24})`);
    node.name.setAttribute('x', String(textX));
    node.name.setAttribute('y', String(nameBaseline));
    node.name.dataset.availableWidth = String(availableNameWidth);
    node.name.textContent = fittedName;
    node.type.setAttribute('x', String(textX));
    node.type.setAttribute('y', String(nameBaseline + 16));
    node.type.setAttribute('display', showType ? 'inline' : 'none');
    node.type.dataset.availableWidth = String(availableTypeWidth);
    node.type.textContent = fittedType;
    node.selectionLabel.setAttribute('x', String(x + 8));
    node.selectionLabel.setAttribute('y', String(y - 7));
    node.lockLabel.setAttribute('x', String(-x - HORIZONTAL_PADDING));
    node.lockLabel.setAttribute('y', String(-y - VERTICAL_PADDING - 1));
    node.lockLabel.setAttribute('display', resource.locked ? 'inline' : 'none');
  }

  private renderSelectionStates(): void {
    for (const resource of this.store.getPlacedResources()) this.renderResource(resource);
  }
}
