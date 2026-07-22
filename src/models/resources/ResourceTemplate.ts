export const RESOURCE_CATEGORIES = [
  'Machines',
  'Manual Process',
  'Quality',
  'People',
  'Material Handling',
  'Documentation',
  'General',
] as const;

export type ResourceCategory = typeof RESOURCE_CATEGORIES[number];

export type ResourceType =
  | 'CNC Machine'
  | 'Manual Workstation'
  | 'Inspection'
  | 'Load / Unload'
  | 'Operator'
  | 'Walking'
  | 'Material Buffer'
  | 'Tooling'
  | 'Document'
  | 'Generic Equipment';

export type ResourceIcon = 'cnc' | 'workstation' | 'inspection' | 'handling' | 'operator' | 'walking' | 'buffer' | 'tooling' | 'document' | 'equipment';

export interface ResourceTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ResourceCategory;
  readonly resourceType: ResourceType;
  readonly icon: ResourceIcon;
  readonly defaultWidth: number;
  readonly defaultDepth: number;
  readonly tags: readonly string[];
  isFavourite: boolean;
}
