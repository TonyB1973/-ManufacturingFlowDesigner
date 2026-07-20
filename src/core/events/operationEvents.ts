export const OPERATION_DRAG_STARTED_EVENT = 'mfd:operation-template-drag-started';
export const OPERATION_DRAG_MOVED_EVENT = 'mfd:operation-template-drag-moved';
export const OPERATION_DRAG_ENDED_EVENT = 'mfd:operation-template-drag-ended';
export const OPERATION_KEYBOARD_PLACE_EVENT = 'mfd:operation-template-keyboard-place';
export const OPERATION_REVEAL_EVENT = 'mfd:operation-reveal';

export interface OperationDragDetail {
  readonly templateId: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly altKey: boolean;
  readonly cancelled?: boolean;
}

export function dispatchOperationDrag(type: string, detail: OperationDragDetail): void {
  document.dispatchEvent(new CustomEvent<OperationDragDetail>(type, { detail }));
}

export function requestKeyboardOperationPlacement(templateId: string): void {
  document.dispatchEvent(new CustomEvent<string>(OPERATION_KEYBOARD_PLACE_EVENT, { detail: templateId }));
}

export function revealOperation(operationId: string): void {
  document.dispatchEvent(new CustomEvent<string>(OPERATION_REVEAL_EVENT, { detail: operationId }));
}
