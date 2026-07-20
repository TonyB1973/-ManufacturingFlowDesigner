import type { CommandHistoryService, HistoryState } from './CommandHistoryService';

export interface HistoryCommands {
  undo(): boolean;
  redo(): boolean;
  getState(): HistoryState;
  subscribe(listener: (state: HistoryState) => void): () => void;
}

function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

export class HistoryController implements HistoryCommands {
  public constructor(private readonly history: CommandHistoryService, private readonly application: HTMLElement, private readonly cancelInteractions: () => void, private readonly onStatus: (message: string) => void) {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  public undo(): boolean {
    if (!this.history.getState().canUndo) { this.onStatus('Nothing to undo'); return false; }
    this.cancelInteractions(); const description = this.history.undo(); if (!description) return false; this.onStatus(`Undid: ${description}`); return true;
  }
  public redo(): boolean {
    if (!this.history.getState().canRedo) { this.onStatus('Nothing to redo'); return false; }
    this.cancelInteractions(); const description = this.history.redo(); if (!description) return false; this.onStatus(`Redid: ${description}`); return true;
  }
  public getState(): HistoryState { return this.history.getState(); }
  public subscribe(listener: (state: HistoryState) => void): () => void { return this.history.subscribe(listener); }
  public dispose(): void { document.removeEventListener('keydown', this.handleKeyDown); }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditingTarget(event.target) || !this.application.contains(document.activeElement)) return;
    const modifier = event.ctrlKey || event.metaKey; if (!modifier || event.altKey) return; const key = event.key.toLowerCase();
    const redo = key === 'y' || (key === 'z' && event.shiftKey); const undo = key === 'z' && !event.shiftKey; if (!undo && !redo) return;
    const handled = redo ? this.redo() : this.undo(); if (handled) event.preventDefault();
  };
}
