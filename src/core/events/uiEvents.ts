export const UI_STATUS_EVENT = 'mfd:status';
export const CANVAS_COMMAND_EVENT = 'mfd:canvas-command';

export type CanvasCommand = 'zoom-in' | 'zoom-out' | 'actual-size' | 'fit' | 'grid' | 'origin' | 'focus' | 'snap' | 'delete-selection' | 'clear-selection' | 'add-operation' | 'add-resource' | 'connect';

export function reportPlaceholder(action: string): void {
  document.dispatchEvent(new CustomEvent<string>(UI_STATUS_EVENT, {
    detail: `${action} is planned for a future sprint.`,
  }));
}

export function reportStatus(message: string): void {
  document.dispatchEvent(new CustomEvent<string>(UI_STATUS_EVENT, { detail: message }));
}

export function dispatchCanvasCommand(command: CanvasCommand): void {
  document.dispatchEvent(new CustomEvent<CanvasCommand>(CANVAS_COMMAND_EVENT, { detail: command }));
}

