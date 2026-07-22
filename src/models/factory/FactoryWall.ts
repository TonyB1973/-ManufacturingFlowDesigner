import type { GeometryPoint } from '../../services/geometry/FactoryFootprintGeometry';

export const FACTORY_WALL_TYPES = ['Structural', 'Partition', 'Safety Barrier', 'Fence', 'General'] as const;
export type FactoryWallType = typeof FACTORY_WALL_TYPES[number];

export interface FactoryWall {
  readonly id: string;
  readonly layoutId: string;
  start: GeometryPoint;
  end: GeometryPoint;
  thickness: number;
  name: string;
  wallType: FactoryWallType;
  visible: boolean;
  locked: boolean;
  note: string;
}

export type FactoryWallPatch = Partial<Omit<FactoryWall, 'id' | 'layoutId'>>;
