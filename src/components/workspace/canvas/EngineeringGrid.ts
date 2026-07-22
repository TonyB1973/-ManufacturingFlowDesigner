import type { CanvasState } from '../../../models/canvas/CanvasState';
import type { ViewportSize } from './ViewportTransform';
import type { WorkspaceId } from '../../../models/workspace/Workspace';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tag);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function visibleMinorInterval(zoom: number): number {
  const targetWorldInterval = 14 / zoom;
  const magnitude = 10 ** Math.floor(Math.log10(targetWorldInterval));
  const normalised = targetWorldInterval / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

export class EngineeringGrid {
  public readonly svg = svgElement('svg');
  private readonly minorPattern = svgElement('pattern');
  private readonly majorPattern = svgElement('pattern');
  private readonly gridLayer = svgElement('g');
  private readonly axesLayer = svgElement('g');
  private readonly xAxis = svgElement('line');
  private readonly yAxis = svgElement('line');
  private readonly origin = svgElement('g');
  private readonly futureWorldLayer = svgElement('g');
  private readonly boundaryLayer = svgElement('g');
  private readonly areaLayer = svgElement('g');
  private readonly aisleLayer = svgElement('g');
  private readonly wallLayer = svgElement('g');
  private readonly routeLayer = svgElement('g');
  private readonly resourceLayer = svgElement('g');
  private readonly annotationLayer = svgElement('g');
  private readonly operationLayer = svgElement('g');
  private readonly connectionLayer = svgElement('g');
  private readonly interactionLayer = svgElement('g');
  private resourceVisible = true;

  public constructor() {
    this.svg.classList.add('engineering-canvas');
    this.svg.setAttribute('role', 'group');
    this.svg.setAttribute('aria-label', 'Engineering canvas objects');
    this.svg.setAttribute('preserveAspectRatio', 'none');

    const definitions = svgElement('defs');
    this.minorPattern.id = 'engineering-grid-minor';
    this.majorPattern.id = 'engineering-grid-major';
    this.minorPattern.setAttribute('patternUnits', 'userSpaceOnUse');
    this.majorPattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const minorPath = svgElement('path');
    minorPath.classList.add('grid-line', 'grid-line--minor');
    const majorPath = svgElement('path');
    majorPath.classList.add('grid-line', 'grid-line--major');
    this.minorPattern.append(minorPath);
    this.majorPattern.append(majorPath);
    definitions.append(this.minorPattern, this.majorPattern);

    const background = svgElement('rect');
    background.classList.add('canvas-background');
    background.setAttribute('width', '100%');
    background.setAttribute('height', '100%');

    const minorFill = svgElement('rect');
    minorFill.setAttribute('width', '100%');
    minorFill.setAttribute('height', '100%');
    minorFill.setAttribute('fill', 'url(#engineering-grid-minor)');
    const majorFill = svgElement('rect');
    majorFill.setAttribute('width', '100%');
    majorFill.setAttribute('height', '100%');
    majorFill.setAttribute('fill', 'url(#engineering-grid-major)');
    this.gridLayer.classList.add('canvas-layer', 'canvas-layer--grid');
    this.gridLayer.append(minorFill, majorFill);

    this.axesLayer.classList.add('canvas-layer', 'canvas-layer--axes');
    this.xAxis.classList.add('origin-axis');
    this.yAxis.classList.add('origin-axis');
    this.origin.classList.add('origin-marker');
    const ring = svgElement('circle');
    ring.setAttribute('r', '6');
    const horizontal = svgElement('line');
    horizontal.setAttribute('x1', '-11');
    horizontal.setAttribute('x2', '11');
    const vertical = svgElement('line');
    vertical.setAttribute('y1', '-11');
    vertical.setAttribute('y2', '11');
    this.origin.append(ring, horizontal, vertical);
    this.axesLayer.append(this.xAxis, this.yAxis, this.origin);

    this.connectionLayer.id = 'canvas-connections';
    this.resourceLayer.id = 'canvas-resources';
    this.operationLayer.id = 'canvas-operations';
    this.annotationLayer.id = 'canvas-factory-annotations';
    this.interactionLayer.id = 'canvas-interactions';
    this.futureWorldLayer.id = 'canvas-world-layers';
    this.boundaryLayer.id = 'canvas-factory-boundary'; this.areaLayer.id = 'canvas-factory-areas'; this.aisleLayer.id = 'canvas-factory-aisles'; this.wallLayer.id = 'canvas-factory-walls'; this.routeLayer.id = 'canvas-factory-routes';
    this.futureWorldLayer.append(this.connectionLayer, this.boundaryLayer, this.areaLayer, this.aisleLayer, this.wallLayer, this.routeLayer, this.resourceLayer, this.operationLayer, this.annotationLayer, this.interactionLayer);
    this.svg.append(definitions, background, this.gridLayer, this.axesLayer, this.futureWorldLayer);
  }

  public getObjectLayer(): SVGGElement {
    return this.resourceLayer;
  }

  public getOperationLayer(): SVGGElement { return this.operationLayer; }
  public getConnectionLayer(): SVGGElement { return this.connectionLayer; }
  public getInteractionLayer(): SVGGElement { return this.interactionLayer; }
  public setResourceVisible(visible: boolean): void { this.resourceVisible = visible; if (this.resourceLayer.getAttribute('display') !== 'none' || !visible) this.resourceLayer.setAttribute('display', visible ? 'inline' : 'none'); }
  public getBoundaryLayer(): SVGGElement { return this.boundaryLayer; }
  public getAreaLayer(): SVGGElement { return this.areaLayer; }
  public getAisleLayer(): SVGGElement { return this.aisleLayer; }
  public getWallLayer(): SVGGElement { return this.wallLayer; }
  public getRouteLayer(): SVGGElement { return this.routeLayer; }
  public getAnnotationLayer(): SVGGElement { return this.annotationLayer; }
  public setWorkspace(workspace: WorkspaceId): void {
    const processFlow = workspace === 'processFlow';
    this.resourceLayer.setAttribute('display', processFlow || !this.resourceVisible ? 'none' : 'inline');
    this.operationLayer.setAttribute('display', processFlow ? 'inline' : 'none');
    this.connectionLayer.setAttribute('display', processFlow ? 'inline' : 'none');
    for (const layer of [this.boundaryLayer, this.areaLayer, this.aisleLayer, this.wallLayer, this.routeLayer, this.annotationLayer]) layer.setAttribute('display', processFlow ? 'none' : 'inline');
    this.interactionLayer.setAttribute('display', 'inline');
  }

  public render(state: CanvasState, size: ViewportSize): void {
    this.svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    const minorWorld = visibleMinorInterval(state.zoom);
    const minorPixels = minorWorld * state.zoom;
    const majorPixels = minorPixels * 5;
    this.configurePattern(this.minorPattern, minorPixels, state.panX, state.panY);
    this.configurePattern(this.majorPattern, majorPixels, state.panX, state.panY);
    this.gridLayer.setAttribute('display', state.gridVisible ? 'inline' : 'none');
    this.axesLayer.setAttribute('display', state.originVisible ? 'inline' : 'none');

    this.xAxis.setAttribute('x1', '0');
    this.xAxis.setAttribute('x2', String(size.width));
    this.xAxis.setAttribute('y1', String(state.panY));
    this.xAxis.setAttribute('y2', String(state.panY));
    this.yAxis.setAttribute('x1', String(state.panX));
    this.yAxis.setAttribute('x2', String(state.panX));
    this.yAxis.setAttribute('y1', '0');
    this.yAxis.setAttribute('y2', String(size.height));
    this.origin.setAttribute('transform', `translate(${state.panX} ${state.panY})`);
    this.futureWorldLayer.setAttribute('transform', `translate(${state.panX} ${state.panY}) scale(${state.zoom})`);
  }

  private configurePattern(pattern: SVGPatternElement, spacing: number, panX: number, panY: number): void {
    const roundedSpacing = Math.max(1, spacing);
    pattern.setAttribute('width', String(roundedSpacing));
    pattern.setAttribute('height', String(roundedSpacing));
    pattern.setAttribute('x', String(positiveModulo(panX, roundedSpacing)));
    pattern.setAttribute('y', String(positiveModulo(panY, roundedSpacing)));
    const path = pattern.firstElementChild;
    path?.setAttribute('d', `M 0 0 H ${roundedSpacing} M 0 0 V ${roundedSpacing}`);
  }
}
