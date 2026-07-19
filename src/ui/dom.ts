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
  return button;
}

