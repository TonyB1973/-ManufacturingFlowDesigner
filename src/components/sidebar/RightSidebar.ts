import { element } from '../../ui/dom';

function section(title: string, content: HTMLElement, open = true): HTMLDetailsElement {
  const details = element('details', 'inspector-section');
  details.open = open;
  details.append(element('summary', '', title), content);
  return details;
}

export function createRightSidebar(): HTMLElement {
  const sidebar = element('aside', 'sidebar sidebar--right');
  sidebar.setAttribute('aria-label', 'Inspector panels');

  const properties = element('div', 'empty-inspector');
  properties.append(element('strong', '', 'No selection'), element('p', '', 'Select an operation, resource or connection to view and edit its properties.'));

  const selection = element('div', 'summary-grid');
  selection.append(element('span', '', 'Selected items'), element('strong', '', '0'), element('span', '', 'Object type'), element('span', '', '—'));

  const validation = element('div', 'validation-summary');
  validation.append(element('div', 'validation-healthy', '● Project healthy'));
  const metrics = element('div', 'validation-metrics');
  metrics.append(element('span', '', '0 Errors'), element('span', '', '0 Warnings'));
  validation.append(metrics);

  sidebar.append(section('Properties', properties), section('Selection Summary', selection), section('Validation Summary', validation));
  return sidebar;
}

