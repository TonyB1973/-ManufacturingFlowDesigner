import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';
const loadTypeScriptModule = (path) => loadModule(path, import.meta.url);
function assert(condition, message) { if (!condition) throw new Error(message); }

const { OperationIdGenerator } = await loadTypeScriptModule('../src/utilities/OperationIdGenerator.ts');
const { ResourceIdGenerator } = await loadTypeScriptModule('../src/utilities/ResourceIdGenerator.ts');
const { SelectionStore } = await loadTypeScriptModule('../src/services/SelectionStore.ts');
const { OperationStore } = await loadTypeScriptModule('../src/services/OperationStore.ts');
const { ResourceStore } = await loadTypeScriptModule('../src/services/ResourceStore.ts');
const { validateOperations } = await loadTypeScriptModule('../src/services/OperationValidation.ts');
const { operationPositionFromPointer } = await loadTypeScriptModule('../src/services/OperationPlacement.ts');
const { OPERATION_TEMPLATES } = await loadTypeScriptModule('../src/core/constants/operationTemplates.ts');

assert(OPERATION_TEMPLATES.length === 12, 'Starter operation library is complete');
assert(new Set(OPERATION_TEMPLATES.map((template) => template.operationType)).size === 10, 'Operation library covers ten manufacturing types');
const ids = new OperationIdGenerator(); assert(ids.next() === 'operation-0001', 'First operation ID is deterministic'); assert(ids.next() === 'operation-0002', 'Operation IDs are sequential');

const resourceTemplate = { id: 'resource-test', name: 'Test Cell', description: 'Test', category: 'Machines', resourceType: 'CNC Machine', icon: 'cnc', defaultWidth: 180, defaultDepth: 80, tags: [], isFavourite: false };
const selection = new SelectionStore();
const resources = new ResourceStore([resourceTemplate], new ResourceIdGenerator(), selection);
const operations = new OperationStore(OPERATION_TEMPLATES, new OperationIdGenerator(), selection);
const first = operations.addOperation('op-cut', 100, 80); const second = operations.addOperation('op-inspect', 200, 80);
assert(first?.sequence === 10 && second?.sequence === 20, 'New operations receive stable sequence intervals');
assert(selection.getSelection().kind === 'operation' && selection.getSelection().id === second.id, 'Created operation becomes the exclusive typed selection');
selection.setWorkspace('factoryLayout'); const resource = resources.addResource(resourceTemplate.id, 0, 0);
assert(selection.getSelection().kind === 'resource' && !second.selected && resource.selected, 'Selecting a resource clears operation selection');
selection.setWorkspace('processFlow'); operations.selectOperation(first.id); assert(!resource.selected && first.selected, 'Selecting an operation clears resource selection');

assert(operations.updateOperation(first.id, { cycleTimeSeconds: 77.5, assignedResourceId: resource.id }), 'Cycle time and resource assignment update');
assert(first.cycleTimeSeconds === 77.5 && first.assignedResourceId === resource.id, 'Operation properties persist');
assert(!operations.updateOperation(first.id, { cycleTimeSeconds: -1 }), 'Negative cycle time is rejected');
assert(operations.updateOperation(first.id, { cycleTimeSeconds: 0 }) && operations.updateOperation(first.id, { cycleTimeSeconds: 77.5 }), 'Zero cycle time is accepted for warning-based analysis');
assert(!operations.updateOperation(first.id, { sequence: 1.5 }), 'Non-integer sequence is rejected');
assert(first.cycleTimeSeconds === 77.5 && first.sequence === 10, 'Rejected updates do not corrupt state');

operations.updateOperation(second.id, { sequence: 10 });
let validation = validateOperations(operations.getOperations(), (id) => resources.getResource(id));
assert(validation.warnings === 3 && validation.errors === 0, 'Validation reports duplicate sequences and one unassigned resource deterministically');
operations.normalizeSequences(); assert(first.sequence === 10 && second.sequence === 20, 'Normalization restores intervals of ten');
validation = validateOperations(operations.getOperations(), (id) => resources.getResource(id));
assert(validation.warnings === 1 && validation.errors === 0, 'Normalization clears duplicate warnings');

const invalidValidation = validateOperations([{ ...first, name: '', sequence: 0, cycleTimeSeconds: 0, assignedResourceId: 'RES-9999', visible: false }], () => undefined);
assert(invalidValidation.errors === 3, 'Invalid operation fields and broken assignments are deterministic errors');
assert(invalidValidation.warnings === 2, 'Zero-time and hidden operations are deterministic warnings');

selection.setWorkspace('factoryLayout'); resources.selectResource(resource.id); assert(resources.deleteSelected() === 'deleted', 'Assigned resource can be deleted'); operations.handleResourceChange(resource.id, true);
assert(first.assignedResourceId === null, 'Deleting a resource safely clears operation assignment');
const moved = operationPositionFromPointer({ x: 150, y: 120 }, { x: 15, y: -5 }); assert(moved.x === 135 && moved.y === 125, 'Operation drag preserves pointer offset');
selection.setWorkspace('processFlow'); operations.selectOperation(first.id); operations.updateOperation(first.id, { locked: true }); assert(!operations.moveOperation(first.id, 500, 500), 'Locked operation cannot move'); assert(operations.deleteSelected() === 'locked', 'Locked operation cannot be deleted');
operations.updateOperation(first.id, { locked: false }); assert(operations.deleteSelected() === 'deleted', 'Unlocked operation can be deleted');

operations.dispose(); resources.dispose();
console.log('Operation system checks passed.');
