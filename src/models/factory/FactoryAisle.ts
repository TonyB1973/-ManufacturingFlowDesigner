import type { GeometryPoint } from '../../services/geometry/FactoryFootprintGeometry';

export const FACTORY_AISLE_TYPES = ['Pedestrian', 'Material', 'Forklift', 'Shared', 'Emergency', 'General'] as const;
export const FACTORY_AISLE_DIRECTIONS = ['Two Way', 'Forward', 'Reverse'] as const;
export type FactoryAisleType = typeof FACTORY_AISLE_TYPES[number];
export type FactoryAisleDirection = typeof FACTORY_AISLE_DIRECTIONS[number];

export interface FactoryAisle {
  readonly id: string;
  readonly layoutId: string;
  name: string;
  points: GeometryPoint[];
  width: number;
  aisleType: FactoryAisleType;
  direction: FactoryAisleDirection;
  visible: boolean;
  locked: boolean;
  note: string;
}

export type FactoryAislePatch = Partial<Omit<FactoryAisle, 'id' | 'layoutId'>>;
