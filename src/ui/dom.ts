import { actionIconFor } from './ActionIcon';

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function actionButton(label: string, className = 'command-button'): HTMLButtonElement {
  const button = element('button', className, label);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  if (button.classList.contains('command-button')) {
    const icon = actionIconFor(label);
    button.dataset.icon = icon.glyph;
    button.dataset.iconName = icon.name;
  }
  return button;
}

