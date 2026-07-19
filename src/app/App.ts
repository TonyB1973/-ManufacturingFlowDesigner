import { UI_STATUS_EVENT } from '../core/events/uiEvents';
import { createAppShell } from './AppShell';

export class App {
  private cleanup: (() => void) | null = null;

  public constructor(private readonly root: HTMLElement) {}

  public mount(): void {
    this.unmount();
    const shell = createAppShell();
    this.root.replaceChildren(shell.element);
    const handleStatus = (event: Event): void => {
      const statusEvent = event as CustomEvent<string>;
      shell.statusBar.setMessage(statusEvent.detail);
    };
    document.addEventListener(UI_STATUS_EVENT, handleStatus);
    this.cleanup = () => {
      document.removeEventListener(UI_STATUS_EVENT, handleStatus);
      shell.dispose();
    };
  }

  public unmount(): void {
    this.cleanup?.();
    this.cleanup = null;
  }
}

