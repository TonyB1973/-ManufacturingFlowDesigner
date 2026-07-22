export const FACTORY_ROUTE_REVEAL_EVENT = 'manufacturing-flow-designer:factory-route-reveal';
export const revealFactoryRoute = (routeId: string): void => { document.dispatchEvent(new CustomEvent(FACTORY_ROUTE_REVEAL_EVENT, { detail: routeId })); };
