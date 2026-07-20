export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

export interface OperationAnchor {
  readonly side: AnchorSide;
  readonly offset: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export type ConnectionType = 'Standard' | 'Rework' | 'Alternate' | 'Information';
export type RouteStatus = 'clear' | 'fallback';

export interface ProcessConnection {
  readonly id: string;
  sourceOperationId: string;
  targetOperationId: string;
  sourceAnchor: OperationAnchor;
  targetAnchor: OperationAnchor;
  routePoints: WorldPoint[];
  label: string;
  connectionType: ConnectionType;
  selected: boolean;
  visible: boolean;
  locked: boolean;
  routeStatus: RouteStatus;
}

export type ProcessConnectionPatch = Partial<Pick<ProcessConnection,
  'sourceAnchor' | 'targetAnchor' | 'label' | 'connectionType' | 'visible' | 'locked'
>>;
