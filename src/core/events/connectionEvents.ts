export const CONNECTION_REVEAL_EVENT = 'mfd:connection-reveal';
export function revealConnection(connectionId: string): void { document.dispatchEvent(new CustomEvent<string>(CONNECTION_REVEAL_EVENT, { detail: connectionId })); }
