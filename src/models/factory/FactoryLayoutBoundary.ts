import type { GeometryPoint } from '../../services/geometry/FactoryFootprintGeometry';

export interface FactoryLayoutBoundary {
  readonly id: string;
  readonly layoutId: string;
  name: string;
  points: GeometryPoint[];
  visible: boolean;
  locked: boolean;
  fillVisible: boolean;
  note: string;
}

export type FactoryLayoutBoundaryPatch = Partial<Omit<FactoryLayoutBoundary, 'id' | 'layoutId'>>;
