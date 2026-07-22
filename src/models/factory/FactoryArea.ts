export const FACTORY_AREA_TYPES = ['Department', 'Work Cell', 'Storage', 'Inspection', 'Assembly', 'Office', 'Utility', 'Restricted', 'Hazard', 'Controlled', 'General'] as const;
export type FactoryAreaType = typeof FACTORY_AREA_TYPES[number];
export const RESOURCE_PLACEMENT_POLICIES = ['Allowed', 'Warning', 'Prohibited'] as const;
export type ResourcePlacementPolicy = typeof RESOURCE_PLACEMENT_POLICIES[number];

export interface FactoryArea {
  readonly id: string;
  readonly layoutId: string;
  name: string;
  areaType: FactoryAreaType;
  worldX: number;
  worldY: number;
  width: number;
  depth: number;
  rotationDegrees: number;
  visible: boolean;
  locked: boolean;
  fillVisible: boolean;
  note: string;
  resourcePlacementPolicy: ResourcePlacementPolicy;
}

export type FactoryAreaPatch = Partial<Omit<FactoryArea, 'id' | 'layoutId'>>;

export function defaultPlacementPolicy(type: FactoryAreaType): ResourcePlacementPolicy {
  if (type === 'Restricted') return 'Prohibited';
  if (type === 'Hazard' || type === 'Controlled') return 'Warning';
  return 'Allowed';
}
