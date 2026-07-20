import type { ResourceType } from './ResourceTemplate';

export interface ResourceInstance {
  readonly id: string;
  readonly templateId: string;
  name: string;
  readonly resourceType: ResourceType;
  layoutId: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  rotationDegrees: number;
  active: boolean;
  visible: boolean;
  locked: boolean;
  selected: boolean;
  capacity: number;
}

export type ResourceInstancePatch = Partial<Pick<ResourceInstance,
  'name' | 'layoutId' | 'worldX' | 'worldY' | 'width' | 'height' | 'rotationDegrees'
  | 'active' | 'visible' | 'locked' | 'capacity'
>>;
