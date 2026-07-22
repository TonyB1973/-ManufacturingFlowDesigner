export const UI_STATUS_EVENT = 'mfd:status';
export const CANVAS_COMMAND_EVENT = 'mfd:canvas-command';
export const CANCEL_ACTIVE_INTERACTIONS_EVENT = 'mfd:cancel-active-interactions';

export type CanvasCommand = 'zoom-in' | 'zoom-out' | 'actual-size' | 'fit' | 'fit-layout' | 'fit-clearance' | 'toggle-clearance' | 'rotate-left' | 'rotate-right' | 'rotation-reset' | 'grid' | 'origin' | 'focus' | 'snap' | 'delete-selection' | 'clear-selection' | 'add-operation' | 'add-resource' | 'connect' | 'copy' | 'cut' | 'paste' | 'duplicate' | 'select-all' | 'align-left' | 'align-centre-x' | 'align-right' | 'align-top' | 'align-centre-y' | 'align-bottom' | 'distribute-x' | 'distribute-y' | 'equal-gaps-x' | 'equal-gaps-y' | 'match-width' | 'match-height' | 'match-size';

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

