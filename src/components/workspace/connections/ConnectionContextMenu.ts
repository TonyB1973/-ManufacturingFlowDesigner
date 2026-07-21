import { actionButton, element } from '../../../ui/dom';

export interface ConnectionContextActions { readonly onCut: () => void; readonly onCopy: () => void; readonly onPaste: () => void; readonly onDuplicate: () => void; readonly onDelete: () => void; readonly onReverse: () => void; readonly onSelectSource: () => void; readonly onSelectTarget: () => void; }
export interface ConnectionContextMenuController { open(x: number, y: number, connectionId: string, actions: ConnectionContextActions): void; close(): void; dispose(): void; }

export function createConnectionContextMenu(viewport: HTMLElement): ConnectionContextMenuController {
  const menu = element('div', 'connection-context-menu'); menu.setAttribute('role', 'menu'); menu.hidden = true; viewport.append(menu); let activeId: string | null = null;
  const close = (): void => { menu.hidden = true; menu.replaceChildren(); activeId = null; };
  const outside = (event: PointerEvent): void => { if (!menu.hidden && event.target instanceof Node && !menu.contains(event.target)) close(); };
  const keydown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); close(); viewport.focus({ preventScroll: true }); } };
  document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', keydown);
  return {
    open: (x, y, connectionId, actions) => {
      close(); activeId = connectionId; const add = (label: string, action: () => void): void => { const button = actionButton(label, 'connection-context-menu__item'); button.setAttribute('role', 'menuitem'); button.addEventListener('click', () => { if (activeId === connectionId) action(); close(); }); menu.append(button); };
      add('Cut', actions.onCut); add('Copy', actions.onCopy); add('Paste', actions.onPaste); add('Duplicate', actions.onDuplicate); add('Delete Connection', actions.onDelete); add('Reverse Direction', actions.onReverse); add('Select Source Operation', actions.onSelectSource); add('Select Target Operation', actions.onSelectTarget);
      menu.hidden = false; const maxX = Math.max(0, viewport.clientWidth - 205); const maxY = Math.max(0, viewport.clientHeight - 150); menu.style.left = `${Math.min(maxX, Math.max(0, x))}px`; menu.style.top = `${Math.min(maxY, Math.max(0, y))}px`; menu.querySelector<HTMLButtonElement>('button')?.focus();
    },
    close, dispose: () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', keydown); menu.remove(); },
  };
}
