import { actionButton, element } from '../../ui/dom';

export interface ProjectDialogsController {
  readonly element: HTMLElement;
  confirmDiscard(action: string): Promise<boolean>;
  showError(title: string, message: string): Promise<void>;
  dispose(): void;
}

export function createProjectDialogs(): ProjectDialogsController {
  const host = element('div', 'project-dialog-host');
  let active: HTMLDialogElement | null = null;
  const closeActive = (): void => { active?.close(); active?.remove(); active = null; };

  const confirmDiscard = (action: string): Promise<boolean> => new Promise((resolve) => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeActive(); const dialog = element('dialog', 'project-dialog'); dialog.setAttribute('aria-labelledby', 'unsaved-dialog-title');
    const title = element('h2', '', 'Unsaved project changes'); title.id = 'unsaved-dialog-title';
    const text = element('p', '', `Discard the current changes and ${action}? This cannot be undone.`);
    const actions = element('div', 'project-dialog__actions'); const cancel = actionButton('Cancel', 'secondary-button'); const discard = actionButton('Discard Changes', 'danger-button');
    const finish = (result: boolean): void => { dialog.close(); dialog.remove(); active = null; returnFocus?.focus(); resolve(result); };
    cancel.addEventListener('click', () => finish(false)); discard.addEventListener('click', () => finish(true)); dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });
    actions.append(cancel, discard); dialog.append(title, text, actions); host.append(dialog); active = dialog; dialog.showModal(); cancel.focus();
  });

  const showError = (titleText: string, message: string): Promise<void> => new Promise((resolve) => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeActive(); const dialog = element('dialog', 'project-dialog'); dialog.setAttribute('role', 'alertdialog'); dialog.setAttribute('aria-labelledby', 'project-error-title');
    const title = element('h2', '', titleText); title.id = 'project-error-title'; const text = element('pre', 'project-dialog__message', message); const okay = actionButton('OK', 'primary-button');
    const finish = (): void => { dialog.close(); dialog.remove(); active = null; returnFocus?.focus(); resolve(); }; okay.addEventListener('click', finish); dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
    dialog.append(title, text, okay); host.append(dialog); active = dialog; dialog.showModal(); okay.focus();
  });
  return { element: host, confirmDiscard, showError, dispose: closeActive };
}
