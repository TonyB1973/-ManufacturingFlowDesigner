import type { ResourceType } from './ResourceTemplate';
import type { ResourceClearance } from './ResourceClearance';

export interface ResourceInstance {
  readonly id: string;
  readonly templateId: string;
  name: string;
  readonly resourceType: ResourceType;
  layoutId: string;
  worldX: number;
  worldY: number;
  width: number;
  depth: number;
  rotationDegrees: number;
  clearance: ResourceClearance;
  active: boolean;
  visible: boolean;
  locked: boolean;
  selected: boolean;
  capacity: number;
  availabilityCalendarId: string | null;
}

export type ResourceInstancePatch = Partial<Pick<ResourceInstance,
  'name' | 'layoutId' | 'worldX' | 'worldY' | 'width' | 'depth' | 'rotationDegrees' | 'clearance'
  | 'active' | 'visible' | 'locked' | 'capacity'
  | 'availabilityCalendarId'
>>;
