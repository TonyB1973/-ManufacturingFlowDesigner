import { reportPlaceholder } from '../../core/events/uiEvents';
import { actionButton, element } from '../../ui/dom';

const treeItems = ['Project', 'Process Flow', 'Factory Layout', 'Standard Work', 'Simulation', 'Documents'];

function resourceSection(title: string, resources: readonly string[]): HTMLDetailsElement {
  const details = element('details', 'resource-section');
  details.open = true;
  details.append(element('summary', '', title));
  const content = element('div', 'resource-section__content');
  for (const resource of resources) {
    const card = element('button', 'resource-card');
    card.type = 'button';
    card.setAttribute('aria-label', `${resource}, future draggable resource`);
    card.append(element('span', 'drag-handle', '⠿'), element('span', '', resource));
    card.addEventListener('click', () => reportPlaceholder(resource));
    content.append(card);
  }
  details.append(content);
  return details;
}

export function createLeftSidebar(): HTMLElement {
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

  const library = element('section', 'panel-section resource-library');
  const libraryTitle = element('div', 'panel-heading-row');
  libraryTitle.append(element('h2', 'panel-heading', 'Resource Library'), element('span', 'count-badge', '3'));
  const search = element('input', 'search-input');
  search.type = 'search';
  search.placeholder = 'Search resources';
  search.setAttribute('aria-label', 'Search resource library');
  const categories = element('div', 'category-chips');
  for (const category of ['All', 'People', 'Equipment']) {
    const chip = actionButton(category, category === 'All' ? 'chip chip--active' : 'chip');
    chip.addEventListener('click', () => reportPlaceholder(`${category} category`));
    categories.append(chip);
  }
  const add = actionButton('+ Add Resource', 'primary-button');
  add.addEventListener('click', () => reportPlaceholder('Add Resource'));
  library.append(libraryTitle, search, categories, resourceSection('People', ['Operator']), resourceSection('Equipment', ['CNC Machine', 'Inspection Bench']), add);
  sidebar.append(explorer, library);
  return sidebar;
}

