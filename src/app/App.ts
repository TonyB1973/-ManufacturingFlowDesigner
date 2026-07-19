import { UI_STATUS_EVENT } from '../core/events/uiEvents';
import { createAppShell } from './AppShell';

export class App {
  public constructor(private readonly root: HTMLElement) {}

  public mount(): void {
    const shell = createAppShell();
    this.root.replaceChildren(shell.element);
    document.addEventListener(UI_STATUS_EVENT, (event: Event) => {
      const statusEvent = event as CustomEvent<string>;
      shell.statusBar.setMessage(statusEvent.detail);
    });
  }
}

