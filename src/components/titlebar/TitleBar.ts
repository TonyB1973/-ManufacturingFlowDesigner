import { element } from '../../ui/dom';

export function createTitleBar(): HTMLElement {
  const bar = element('header', 'titlebar');
  const identity = element('div', 'titlebar__identity');
  const mark = element('span', 'app-mark', 'M');
  mark.setAttribute('aria-hidden', 'true');
  identity.append(mark, element('strong', 'titlebar__title', 'Manufacturing Flow Designer'));

  const project = element('div', 'titlebar__project');
  project.append(element('span', 'eyebrow', 'CURRENT PROJECT'), element('span', '', 'Untitled Project'));

  const health = element('div', 'health health--healthy');
  health.setAttribute('role', 'status');
  health.append(element('span', 'health__dot'), element('span', '', 'Project healthy'));

  const actions = element('div', 'window-actions');
  for (const symbol of ['—', '□', '×']) {
    const item = element('span', '', symbol);
    item.setAttribute('aria-hidden', 'true');
    actions.append(item);
  }
  bar.append(identity, project, health, actions);
  return bar;
}

