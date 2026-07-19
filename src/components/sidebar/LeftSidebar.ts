import { reportPlaceholder } from '../../core/events/uiEvents';
import type { ResourceStore } from '../../services/ResourceStore';
import { actionButton, element } from '../../ui/dom';
import { createResourceLibrary } from './ResourceLibrary';

const treeItems = ['Project', 'Process Flow', 'Factory Layout', 'Standard Work', 'Simulation', 'Documents'];

export interface LeftSidebarController {
  readonly element: HTMLElement;
  dispose(): void;
}

export function createLeftSidebar(store: ResourceStore): LeftSidebarController {
  const sidebar = element('aside', 'sidebar sidebar--left');
  sidebar.setAttribute('aria-label', 'Project and resource panels');
  const explorer = element('section', 'panel-section');
  explorer.append(element('h2', 'panel-heading', 'Project Explorer'));
  const tree = element('nav', 'project-tree');
  tree.setAttribute('aria-label', 'Project explorer');
  const list = element('ul');
  treeItems.forEach((item, index) => {
    const entry = element('li', index === 0 ? 'project-tree__root' : '');
    const button = actionButton(`${index === 0 ? '▾' : '◇'}  ${item}`, 'tree-item');
    button.addEventListener('click', () => reportPlaceholder(item));
    entry.append(button);
    list.append(entry);
  });
  tree.append(list);
  explorer.append(tree);
  const library = createResourceLibrary(store);
  sidebar.append(explorer, library.element);
  return { element: sidebar, dispose: library.dispose };
}

