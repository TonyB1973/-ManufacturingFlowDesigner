export const UI_STATUS_EVENT = 'mfd:status';

export function reportPlaceholder(action: string): void {
  document.dispatchEvent(new CustomEvent<string>(UI_STATUS_EVENT, {
    detail: `${action} is planned for a future sprint.`,
  }));
}

