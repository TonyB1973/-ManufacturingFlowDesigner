export const CLEARANCE_CATEGORIES = [
  'operational',
  'maintenance',
  'safety',
  'loading',
  'access',
  'general',
] as const;

export type ClearanceCategory = typeof CLEARANCE_CATEGORIES[number];

export interface ResourceClearance {
  enabled: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
  category: ClearanceCategory;
  note: string;
}

export const DEFAULT_RESOURCE_CLEARANCE: Readonly<ResourceClearance> = {
  enabled: false,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  category: 'general',
  note: '',
};

export const createDefaultClearance = (): ResourceClearance => ({ ...DEFAULT_RESOURCE_CLEARANCE });
export const cloneClearance = (clearance: ResourceClearance): ResourceClearance => ({ ...clearance });
