import { reportPlaceholder } from '../../core/events/uiEvents';
import { actionButton, element } from '../../ui/dom';

export function createWorkspace(): HTMLElement {
  const workspace = element('main', 'workspace');
  const toolbar = element('div', 'canvas-toolbar');
  toolbar.setAttribute('aria-label', 'Canvas tools');
  for (const tool of ['Select', 'Pan', 'Fit']) {
    const button = actionButton(tool, tool === 'Select' ? 'tool-button tool-button--active' : 'tool-button');
    button.addEventListener('click', () => reportPlaceholder(`${tool} tool`));
    toolbar.append(button);
  }
  toolbar.append(element('span', 'toolbar-spacer'), element('span', 'zoom-display', '100%'));

  const viewport = element('section', 'canvas-viewport');
  viewport.setAttribute('aria-label', 'Manufacturing flow drawing canvas');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('engineering-canvas');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio', 'none');
  const origin = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  origin.setAttribute('class', 'origin-marker');
  origin.innerHTML = '<circle cx="500" cy="500" r="5"/><line x1="500" y1="490" x2="500" y2="510"/><line x1="490" y1="500" x2="510" y2="500"/>';
  svg.append(origin);

  const welcome = element('div', 'welcome-panel');
  welcome.append(element('span', 'welcome-mark', 'MFD'), element('h1', '', 'Create a Manufacturing Flow'), element('p', '', 'Add resources and operations to begin designing the manufacturing process.'));
  const actions = element('div', 'welcome-actions');
  for (const action of ['Add Resource', 'Add Operation', 'Open Project']) {
    const button = actionButton(action, action === 'Add Operation' ? 'primary-button' : 'secondary-button');
    button.addEventListener('click', () => reportPlaceholder(action));
    actions.append(button);
  }
  welcome.append(actions);
  viewport.append(svg, welcome, element('span', 'canvas-coordinates', 'X: 0.000  Y: 0.000'));
  workspace.append(toolbar, viewport);
  return workspace;
}
