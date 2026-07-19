import type { ResourceType } from './ResourceTemplate';

export interface PlacedResource {
  readonly id: string;
  readonly templateId: string;
  name: string;
  readonly resourceType: ResourceType;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  selected: boolean;
  locked: boolean;
  visible: boolean;
}

export type PlacedResourcePatch = Partial<Pick<PlacedResource,
  'name' | 'worldX' | 'worldY' | 'width' | 'height' | 'locked' | 'visible'
>>;
