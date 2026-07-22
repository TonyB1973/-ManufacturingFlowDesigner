import type { PlacedResource } from '../../../models/resources/PlacedResource';
import type { ResourceTemplate } from '../../../models/resources/ResourceTemplate';
import type { ResourceStore, ResourceStoreChange } from '../../../services/ResourceStore';
import { RESOURCE_ICON_PATHS } from '../../../ui/resourceIcons';
import { estimateSvgTextWidth, fitSvgText } from '../../../utilities/SvgTextFit';
import { validateFactoryLayout } from '../../../services/FactoryLayoutValidation';

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
  readonly clearance: SVGRectElement;
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
  readonly dimensions: SVGTextElement;
  readonly orientation: SVGPathElement;
  readonly warning: SVGTextElement;
}

export class ResourceRenderer {
  private readonly nodes = new Map<string, ResourceNode>();
  private readonly templates = new Map<string, ResourceTemplate>();
  private readonly unsubscribe: () => void;
  private clearanceVisible = true;

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

  public setClearanceVisible(visible: boolean): void { this.clearanceVisible = visible; this.renderSelectionStates(); }

  private readonly handleChange = (change: ResourceStoreChange): void => {
    switch (change.kind) {
      case 'created':
        this.addResource(change.resource);
        this.renderSelectionStates();
        break;
      case 'updated':
        this.renderSelectionStates();
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
      case 'reset':
        this.layer.replaceChildren();
        this.nodes.clear();
        this.templates.clear();
        this.store.getTemplates().forEach((template) => this.templates.set(template.id, template));
        this.store.getPlacedResources().forEach((resource) => this.addResource(resource));
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
    const clearance = svgElement('rect'); clearance.classList.add('placed-resource__clearance');
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
    const dimensions = svgElement('text'); dimensions.classList.add('placed-resource__dimensions');
    const orientation = svgElement('path'); orientation.classList.add('placed-resource__orientation'); orientation.setAttribute('d', 'M -8 -3 L 8 -3 M 8 -3 L 3 -8 M 8 -3 L 3 2');
    const warning = svgElement('text'); warning.classList.add('placed-resource__warning'); warning.textContent = '!';
    content.append(icon, name, type, lockLabel);
    group.append(title, clearance, definitions, body, accent, content, orientation, dimensions, warning, selection, selectionLabel);
    this.layer.append(group);
    this.nodes.set(resource.id, { group, title, clearance, body, accent, content, clipRect, icon, name, type, selection, selectionLabel, lockLabel, dimensions, orientation, warning });
    this.renderResource(resource);
  }

  private renderResource(resource: PlacedResource): void {
    const node = this.nodes.get(resource.id);
    if (!node) return;
    const x = -resource.width / 2;
    const y = -resource.depth / 2;
    const innerWidth = Math.max(0, resource.width - HORIZONTAL_PADDING * 2);
    const innerHeight = Math.max(0, resource.depth - VERTICAL_PADDING * 2);
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
    node.group.setAttribute('transform', `translate(${resource.worldX} ${resource.worldY}) rotate(${resource.rotationDegrees})`);
    node.group.setAttribute('display', resource.visible ? 'inline' : 'none');
    const relatedIssues = validateFactoryLayout(this.store.getPlacedResources()).issues.filter((issue) => issue.resourceIds.includes(resource.id));
    node.group.setAttribute('aria-label', `${resource.id}, ${resource.name}, ${resource.resourceType}, footprint ${resource.width} by ${resource.depth}, rotation ${resource.rotationDegrees} degrees, ${resource.active ? 'active' : 'inactive'}${resource.clearance.enabled ? `, ${resource.clearance.category} clearance enabled` : ''}${resource.locked ? ', locked' : ''}${relatedIssues.length ? `, ${relatedIssues.length} layout issues` : ''}${resource.selected ? ', selected' : ''}`);
    node.title.textContent = `${resource.id} — ${resource.name}\n${resource.width} × ${resource.depth} mm @ ${resource.rotationDegrees}°${relatedIssues.length ? `\n${relatedIssues.map((issue) => issue.message).join('\n')}` : ''}`;
    node.group.classList.toggle('placed-resource--selected', resource.selected);
    node.group.classList.toggle('placed-resource--primary', this.store.getSelectedResourceId() === resource.id);
    node.group.classList.toggle('placed-resource--locked', resource.locked);
    node.group.classList.toggle('placed-resource--inactive', !resource.active);
    node.group.classList.toggle('placed-resource--overlap', relatedIssues.some((issue) => issue.type === 'footprint-overlap'));
    node.group.classList.toggle('placed-resource--clearance-warning', relatedIssues.some((issue) => issue.type !== 'footprint-overlap'));
    for (const rectangle of [node.body, node.selection]) {
      rectangle.setAttribute('x', String(x));
      rectangle.setAttribute('y', String(y));
      rectangle.setAttribute('width', String(resource.width));
      rectangle.setAttribute('height', String(resource.depth));
      rectangle.setAttribute('rx', '3');
    }
    node.accent.setAttribute('x', String(x));
    node.accent.setAttribute('y', String(y));
    node.accent.setAttribute('width', '5');
    node.accent.setAttribute('height', String(resource.depth));
    node.clearance.setAttribute('x', String(x - resource.clearance.left));
    node.clearance.setAttribute('y', String(y - resource.clearance.top));
    node.clearance.setAttribute('width', String(resource.width + resource.clearance.left + resource.clearance.right));
    node.clearance.setAttribute('height', String(resource.depth + resource.clearance.top + resource.clearance.bottom));
    node.clearance.setAttribute('display', this.clearanceVisible && resource.clearance.enabled ? 'inline' : 'none');
    node.clearance.dataset.category = resource.clearance.category;
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
    node.orientation.setAttribute('transform', `translate(0 ${y + 9})`);
    node.dimensions.setAttribute('x', '0'); node.dimensions.setAttribute('y', String(-y + 13)); node.dimensions.setAttribute('text-anchor', 'middle'); node.dimensions.textContent = `${resource.width} × ${resource.depth} mm · ${resource.rotationDegrees}°`;
    node.warning.setAttribute('x', String(-x - 10)); node.warning.setAttribute('y', String(y + 14)); node.warning.setAttribute('display', relatedIssues.length ? 'inline' : 'none');
  }

  private renderSelectionStates(): void {
    for (const resource of this.store.getPlacedResources()) this.renderResource(resource);
  }
}
