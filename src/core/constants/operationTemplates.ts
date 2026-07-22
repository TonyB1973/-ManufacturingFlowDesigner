import type { OperationTemplate, TimingCategory } from '../../models/operations/OperationTemplate';

export const TIMING_CATEGORIES: readonly TimingCategory[] = [
  'manual', 'automatic', 'walking', 'waiting',
];

export const OPERATION_TEMPLATES: readonly OperationTemplate[] = [
  { id: 'op-cut', name: 'Cut', operationType: 'Fabrication', timingCategory: 'manual', category: 'Production', icon: 'CUT', defaultCycleTimeSeconds: 45, tags: ['saw', 'laser', 'profile'] },
  { id: 'op-machine', name: 'Machine', operationType: 'Machining', timingCategory: 'automatic', category: 'Production', icon: 'CNC', defaultCycleTimeSeconds: 120, tags: ['cnc', 'mill', 'turn'] },
  { id: 'op-weld', name: 'Weld', operationType: 'Fabrication', timingCategory: 'manual', category: 'Production', icon: 'WLD', defaultCycleTimeSeconds: 90, tags: ['join', 'fabrication'] },
  { id: 'op-assemble', name: 'Assemble', operationType: 'Assembly', timingCategory: 'manual', category: 'Assembly', icon: 'ASM', defaultCycleTimeSeconds: 150, tags: ['fit', 'build'] },
  { id: 'op-inspect', name: 'Inspect', operationType: 'Inspection', timingCategory: 'manual', category: 'Quality', icon: 'QC', defaultCycleTimeSeconds: 60, tags: ['quality', 'measure'] },
  { id: 'op-test', name: 'Functional Test', operationType: 'Inspection', timingCategory: 'automatic', category: 'Quality', icon: 'TST', defaultCycleTimeSeconds: 90, tags: ['test', 'quality'] },
  { id: 'op-move', name: 'Move Material', operationType: 'Material Handling', timingCategory: 'walking', category: 'Material Flow', icon: 'MOV', defaultCycleTimeSeconds: 30, tags: ['transport', 'logistics'] },
  { id: 'op-finish', name: 'Surface Finish', operationType: 'Finishing', timingCategory: 'manual', category: 'Finishing', icon: 'FIN', defaultCycleTimeSeconds: 75, tags: ['paint', 'coat', 'deburr'] },
  { id: 'op-pack', name: 'Pack', operationType: 'Packaging', timingCategory: 'manual', category: 'Logistics', icon: 'PKG', defaultCycleTimeSeconds: 40, tags: ['package', 'dispatch'] },
  { id: 'op-maintain', name: 'Maintenance', operationType: 'Maintenance', timingCategory: 'manual', category: 'Support', icon: 'MNT', defaultCycleTimeSeconds: 300, tags: ['service', 'repair'] },
  { id: 'op-store', name: 'Store', operationType: 'Storage', timingCategory: 'waiting', category: 'Storage', icon: 'STR', defaultCycleTimeSeconds: 10, tags: ['buffer', 'inventory'] },
  { id: 'op-plan', name: 'Production Planning', operationType: 'Administrative', timingCategory: 'manual', category: 'Planning', icon: 'PLN', defaultCycleTimeSeconds: 180, tags: ['schedule', 'office'] },
];
