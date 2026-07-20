import type { OperationType, TimingCategory } from './OperationTemplate';

export interface OperationInstance {
  readonly id: string;
  readonly templateId: string;
  name: string;
  operationType: OperationType;
  timingCategory: TimingCategory;
  cycleTimeSeconds: number;
  sequence: number;
  assignedResourceId: string | null;
  notes: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  selected: boolean;
  locked: boolean;
  visible: boolean;
}

export type OperationInstancePatch = Partial<Pick<OperationInstance,
  'name' | 'operationType' | 'timingCategory' | 'cycleTimeSeconds' | 'sequence'
  | 'assignedResourceId' | 'notes' | 'worldX' | 'worldY' | 'width' | 'height'
  | 'locked' | 'visible'
>>;
