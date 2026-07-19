import type { ResourceIcon } from '../models/resources/ResourceTemplate';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export const RESOURCE_ICON_PATHS: Readonly<Record<ResourceIcon, string>> = {
  cnc: 'M3 5h18v14H3z M7 9h6v6H7z M16 8h2v2h-2z M16 12h2v2h-2z',
  workstation: 'M3 7h18v3H3z M5 10h2v9H5z M17 10h2v9h-2z M9 12h6v5H9z',
  inspection: 'M4 4h12v16H4z M8 9l2 2 4-4 M17 15l4 4',
  handling: 'M3 16h12l3-5h3 M6 16v3 M13 16v3 M5 12h9 M8 8h4',
  operator: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M6 21v-6a6 6 0 0 1 12 0v6',
  walking: 'M13 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M10 21l2-6-3-3 3-3 3 2 3 1 M12 15l5 6',
  buffer: 'M4 5h16v4H4z M4 11h16v4H4z M4 17h16v4H4z',
  tooling: 'M14 4a5 5 0 0 0-4 7L4 17l3 3 6-6a5 5 0 0 0 7-4l-4 1-3-3z',
  document: 'M5 3h10l4 4v14H5z M15 3v5h5 M8 12h8 M8 16h8',
  equipment: 'M4 6h16v12H4z M8 10h8 M8 14h5 M6 18v3 M18 18v3',
};

export function createResourceIcon(icon: ResourceIcon, className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add(className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', RESOURCE_ICON_PATHS[icon]);
  svg.append(path);
  return svg;
}
