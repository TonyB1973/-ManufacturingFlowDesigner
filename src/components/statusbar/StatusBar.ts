import { element } from '../../ui/dom';

export interface StatusBarController {
  readonly element: HTMLElement;
  setMessage(message: string): void;
}

export function createStatusBar(): StatusBarController {
  const bar = element('footer', 'statusbar');
  const message = element('span', 'statusbar__message', 'Ready');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  bar.append(message);
  for (const text of ['Untitled Project', '100%', 'Grid: On', 'X: 0.000', 'Y: 0.000', 'Selected: 0', 'Foundation Build']) {
    bar.append(element('span', '', text));
  }
  return { element: bar, setMessage: (text: string) => { message.textContent = text; } };
}

