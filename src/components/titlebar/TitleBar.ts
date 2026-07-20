import { element } from '../../ui/dom';

export interface TitleBarController { readonly element: HTMLElement; setHealth(errors: number, warnings: number): void; }

export function createTitleBar(): TitleBarController {
  const bar = element('header', 'titlebar'); const identity = element('div', 'titlebar__identity');
  const mark = element('span', 'app-mark', 'M'); mark.setAttribute('aria-hidden', 'true'); identity.append(mark, element('strong', 'titlebar__title', 'Manufacturing Flow Designer'));
  const project = element('div', 'titlebar__project'); project.append(element('span', 'eyebrow', 'CURRENT PROJECT'), element('span', '', 'Untitled Project'));
  const health = element('div', 'health health--healthy'); health.setAttribute('role', 'status'); const healthText = element('span', '', 'Project healthy'); health.append(element('span', 'health__dot'), healthText);
  const actions = element('div', 'window-actions'); ['—', '□', '×'].forEach((symbol) => { const item = element('span', '', symbol); item.setAttribute('aria-hidden', 'true'); actions.append(item); });
  bar.append(identity, project, health, actions);
  return { element: bar, setHealth: (errors, warnings) => {
    health.classList.toggle('health--healthy', errors === 0 && warnings === 0); health.classList.toggle('health--warning', errors === 0 && warnings > 0); health.classList.toggle('health--error', errors > 0);
    healthText.textContent = errors ? `${errors} project error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} project warning${warnings === 1 ? '' : 's'}` : 'Project healthy';
  } };
}
