export type OperationType =
  | 'Machining'
  | 'Fabrication'
  | 'Assembly'
  | 'Inspection'
  | 'Material Handling'
  | 'Finishing'
  | 'Packaging'
  | 'Maintenance'
  | 'Storage'
  | 'Administrative';

export type OperationCategory =
  | 'Production'
  | 'Quality'
  | 'Logistics'
  | 'Support'
  | 'Finishing'
  | 'Assembly'
  | 'Material Flow'
  | 'Storage'
  | 'Planning';

export type TimingCategory = 'Value Added' | 'Non-Value Added' | 'Required Non-Value Added';

export interface OperationTemplate {
  readonly id: string;
  readonly name: string;
  readonly operationType: OperationType;
  readonly timingCategory: TimingCategory;
  readonly category: OperationCategory;
  readonly icon: string;
  readonly defaultCycleTimeSeconds: number;
  readonly tags: readonly string[];
}
