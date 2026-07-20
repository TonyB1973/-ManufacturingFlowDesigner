export const RESOURCE_DRAG_STARTED_EVENT = 'mfd:resource-template-drag-started';
export const RESOURCE_DRAG_MOVED_EVENT = 'mfd:resource-template-drag-moved';
export const RESOURCE_DRAG_ENDED_EVENT = 'mfd:resource-template-drag-ended';
export const RESOURCE_KEYBOARD_PLACE_EVENT = 'mfd:resource-template-keyboard-place';
export const RESOURCE_REVEAL_EVENT = 'mfd:resource-reveal';

export interface ResourceDragDetail {
  readonly templateId: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly altKey: boolean;
  readonly cancelled?: boolean;
}

export function dispatchResourceDrag(type: string, detail: ResourceDragDetail): void {
  document.dispatchEvent(new CustomEvent<ResourceDragDetail>(type, { detail }));
}

export function requestKeyboardResourcePlacement(templateId: string): void {
  document.dispatchEvent(new CustomEvent<string>(RESOURCE_KEYBOARD_PLACE_EVENT, { detail: templateId }));
}

export function revealResource(resourceId: string): void { document.dispatchEvent(new CustomEvent<string>(RESOURCE_REVEAL_EVENT, { detail: resourceId })); }
