import type { OperationTemplate, TimingCategory } from '../../models/operations/OperationTemplate';

export const TIMING_CATEGORIES: readonly TimingCategory[] = [
  'Value Added', 'Non-Value Added', 'Required Non-Value Added',
];

export const OPERATION_TEMPLATES: readonly OperationTemplate[] = [
  { id: 'op-cut', name: 'Cut', operationType: 'Fabrication', timingCategory: 'Value Added', category: 'Production', icon: 'CUT', defaultCycleTimeSeconds: 45, tags: ['saw', 'laser', 'profile'] },
  { id: 'op-machine', name: 'Machine', operationType: 'Machining', timingCategory: 'Value Added', category: 'Production', icon: 'CNC', defaultCycleTimeSeconds: 120, tags: ['cnc', 'mill', 'turn'] },
  { id: 'op-weld', name: 'Weld', operationType: 'Fabrication', timingCategory: 'Value Added', category: 'Production', icon: 'WLD', defaultCycleTimeSeconds: 90, tags: ['join', 'fabrication'] },
  { id: 'op-assemble', name: 'Assemble', operationType: 'Assembly', timingCategory: 'Value Added', category: 'Assembly', icon: 'ASM', defaultCycleTimeSeconds: 150, tags: ['fit', 'build'] },
  { id: 'op-inspect', name: 'Inspect', operationType: 'Inspection', timingCategory: 'Required Non-Value Added', category: 'Quality', icon: 'QC', defaultCycleTimeSeconds: 60, tags: ['quality', 'measure'] },
  { id: 'op-test', name: 'Functional Test', operationType: 'Inspection', timingCategory: 'Required Non-Value Added', category: 'Quality', icon: 'TST', defaultCycleTimeSeconds: 90, tags: ['test', 'quality'] },
  { id: 'op-move', name: 'Move Material', operationType: 'Material Handling', timingCategory: 'Non-Value Added', category: 'Material Flow', icon: 'MOV', defaultCycleTimeSeconds: 30, tags: ['transport', 'logistics'] },
  { id: 'op-finish', name: 'Surface Finish', operationType: 'Finishing', timingCategory: 'Value Added', category: 'Finishing', icon: 'FIN', defaultCycleTimeSeconds: 75, tags: ['paint', 'coat', 'deburr'] },
  { id: 'op-pack', name: 'Pack', operationType: 'Packaging', timingCategory: 'Value Added', category: 'Logistics', icon: 'PKG', defaultCycleTimeSeconds: 40, tags: ['package', 'dispatch'] },
  { id: 'op-maintain', name: 'Maintenance', operationType: 'Maintenance', timingCategory: 'Required Non-Value Added', category: 'Support', icon: 'MNT', defaultCycleTimeSeconds: 300, tags: ['service', 'repair'] },
  { id: 'op-store', name: 'Store', operationType: 'Storage', timingCategory: 'Non-Value Added', category: 'Storage', icon: 'STR', defaultCycleTimeSeconds: 10, tags: ['buffer', 'inventory'] },
  { id: 'op-plan', name: 'Production Planning', operationType: 'Administrative', timingCategory: 'Required Non-Value Added', category: 'Planning', icon: 'PLN', defaultCycleTimeSeconds: 180, tags: ['schedule', 'office'] },
];
