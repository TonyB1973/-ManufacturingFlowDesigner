import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';
const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const rejects = (action, message) => { try { action(); } catch { return; } throw new Error(message); };

const { validateProjectDocument } = await load('../src/services/project/ProjectSchemaValidator.ts');
const { deserializeProject } = await load('../src/services/project/ProjectDeserializer.ts');
const { serializeProject } = await load('../src/services/project/ProjectSerializer.ts');
const { ProjectMigrationService } = await load('../src/services/project/ProjectMigrationService.ts');
const { ResourceStore } = await load('../src/services/ResourceStore.ts');
const { OperationStore } = await load('../src/services/OperationStore.ts');
const { ConnectionStore } = await load('../src/services/ConnectionStore.ts');
const { WorkspaceStore } = await load('../src/services/WorkspaceStore.ts');
const { SelectionStore } = await load('../src/services/SelectionStore.ts');
const { ResourceIdGenerator } = await load('../src/utilities/ResourceIdGenerator.ts');
const { OperationIdGenerator } = await load('../src/utilities/OperationIdGenerator.ts');
const { ConnectionIdGenerator } = await load('../src/utilities/ConnectionIdGenerator.ts');
const { ProjectSessionService } = await load('../src/services/project/ProjectSessionService.ts');
const { DirtyStateService } = await load('../src/services/project/DirtyStateService.ts');
const { safeFileName } = await load('../src/services/project/ProjectFileService.ts');

const resourceTemplate = { id: 'TPL-CNC-001', name: 'Machine', description: 'Machine', category: 'Machines', resourceType: 'CNC Machine', icon: 'cnc', defaultWidth: 180, defaultHeight: 80, tags: ['cnc'], isFavourite: true };
const operationTemplate = { id: 'op-cut', name: 'Cut', operationType: 'Fabrication', timingCategory: 'Value Added', category: 'Production', icon: 'CUT', defaultCycleTimeSeconds: 45, tags: ['cut'] };
const resource = { id: 'RES-0042', templateId: resourceTemplate.id, name: 'Machine 42', resourceType: 'CNC Machine', layoutId: 'factory-layout-default', worldX: 340.25, worldY: -15, width: 180, height: 80, rotationDegrees: 90, active: true, visible: true, locked: false, capacity: 1 };
const resourceTwo = { ...resource, id: 'RES-0043', name: 'Machine 43', worldX: 600, locked: true };
const inspection = { ...resource, id: 'RES-0044', name: 'Inspection Resource', worldX: 820, visible: false };
const operationA = { id: 'operation-0071', templateId: operationTemplate.id, name: 'Cut A', operationType: 'Fabrication', timingCategory: 'Value Added', cycleTimeSeconds: 45, sequence: 10, assignedResourceId: resource.id, notes: 'First', worldX: 100, worldY: 200, width: 210, height: 100, locked: false, visible: true };
const operationB = { ...operationA, id: 'operation-0072', name: 'Cut B', sequence: 20, assignedResourceId: null, worldX: 500 };
const operationC = { ...operationA, id: 'operation-0073', name: 'Inspect', sequence: 30, assignedResourceId: inspection.id, worldX: 800, visible: false };
const operationD = { ...operationA, id: 'operation-0074', name: 'Finish', sequence: 40, assignedResourceId: resourceTwo.id, worldX: 1100, locked: true };
const connection = { id: 'CON-0099', sourceOperationId: operationA.id, targetOperationId: operationB.id, sourceAnchor: { side: 'right', offset: 0.5 }, targetAnchor: { side: 'left', offset: 0.5 }, label: 'Transfer', connectionType: 'Standard', visible: true, locked: false };
const connectionTwo = { ...connection, id: 'CON-0100', sourceOperationId: operationB.id, targetOperationId: operationC.id, label: 'Inspect', connectionType: 'Information' };
const connectionThree = { ...connection, id: 'CON-0101', sourceOperationId: operationC.id, targetOperationId: operationD.id, label: 'Finish', locked: true };
const viewport = { panX: 5, panY: -10, zoom: 1.25, gridVisible: true, originVisible: false, snapEnabled: true };
const fixture = { format: 'ManufacturingFlowDesigner', schemaVersion: '1.0.0', applicationVersion: '0.2.0', project: { id: 'PRJ-0047', name: 'Persistence Test', description: 'Round trip', author: 'Engineer', company: 'Factory', createdUtc: '2026-01-01T00:00:00.000Z', modifiedUtc: '2026-01-02T00:00:00.000Z' }, resourceTemplates: [resourceTemplate], operationTemplates: [operationTemplate], resources: [resource, resourceTwo, inspection], operations: [operationA, operationB, operationC, operationD], connections: [connection, connectionTwo, connectionThree], workspaces: { active: 'factoryLayout', processFlow: viewport, factoryLayout: { ...viewport, panX: -500, zoom: 0.75 } }, settings: { gridBaseInterval: 20, routingClearance: 16, unitSystem: 'metric', displayPrecision: 2 } };

const valid = validateProjectDocument(structuredClone(fixture));
assert(valid.project.id === 'PRJ-0047' && valid.resources.length === 3 && valid.operations.length === 4 && valid.connections.length === 3, 'Valid representative document loads');
const parsed = deserializeProject(`${JSON.stringify(fixture, null, 2)}\n`);
assert(parsed.document.workspaces.active === 'factoryLayout', 'Active workspace round trips');
assert(parsed.document.workspaces.processFlow.zoom === 1.25 && parsed.document.workspaces.factoryLayout.zoom === 0.75, 'Independent viewports round trip');

const selection = new SelectionStore(); const resourceIds = new ResourceIdGenerator(); const operationIds = new OperationIdGenerator(); const connectionIds = new ConnectionIdGenerator();
const resources = new ResourceStore([], resourceIds, selection); const operations = new OperationStore([], operationIds, selection); const workspaces = new WorkspaceStore();
const connections = new ConnectionStore(connectionIds, (id) => operations.getOperation(id), () => ({ points: [{ x: 1, y: 2 }, { x: 3, y: 2 }], status: 'clear' }), selection);
const session = new ProjectSessionService(resources, operations, connections, workspaces, selection, resourceIds, operationIds, connectionIds);
session.openProject(valid, 'fixture.mflow');
assert(!session.isDirty(), 'Opening a project starts clean');
assert(connections.getConnection('CON-0099').routePoints.length === 2, 'Connection routes are derived once on load');
selection.select({ kind: 'operation', id: operationA.id }); assert(!session.isDirty(), 'Selection does not dirty a project');
operations.updateOperation(operationA.id, { notes: 'Changed' }); assert(session.isDirty(), 'Persistent model edits set dirty state');
const output = serializeProject({ metadata: session.getMetadata(), settings: session.getSettings(), resources, operations, connections, workspaces }, '2026-01-03T00:00:00.000Z');
assert(!output.text.includes('"selected"') && !output.text.includes('"routePoints"') && !output.text.includes('"routeStatus"'), 'Transient selection and derived route cache are excluded');
assert(output.document.project.modifiedUtc === '2026-01-03T00:00:00.000Z', 'Save snapshot updates modified time');
assert(output.document.project.createdUtc === fixture.project.createdUtc && output.document.project.id === fixture.project.id, 'Save preserves project creation time and stable identity');
assert(output.document.resources[0].worldX === 340.25 && output.document.operations[0].assignedResourceId === resource.id, 'Coordinates and physical assignments serialize');
session.markSaved(output.document.project, 'renamed.mflow'); assert(!session.isDirty() && session.getState().fileName === 'renamed.mflow', 'Successful save marks clean and records filename');
const stateBeforeFailedOpen = session.getState(); rejects(() => deserializeProject('{not valid'), 'Failed candidate must reject'); assert(session.getState().metadata.id === stateBeforeFailedOpen.metadata.id && resources.getResourceCount() === 3, 'Failed open candidate leaves the active project unchanged');
assert(resourceIds.next() === 'RES-0045' && operationIds.next() === 'operation-0075' && connectionIds.next() === 'CON-0102', 'ID generators resume after loaded identifiers');
assert(safeFileName('My Factory: Study') === 'My-Factory-Study.mflow', 'Suggested filenames are portable and use .mflow');

rejects(() => deserializeProject('{bad json'), 'Malformed JSON is rejected');
const invalidCases = [
  ['wrong format', { ...fixture, format: 'Other' }],
  ['missing schema', { ...fixture, schemaVersion: undefined }],
  ['missing project metadata', { ...fixture, project: undefined }],
  ['duplicate resource id', { ...fixture, resources: [resource, { ...resource }] }],
  ['duplicate operation id', { ...fixture, operations: [operationA, { ...operationA }] }],
  ['duplicate connection id', { ...fixture, connections: [connection, { ...connection }] }],
  ['missing template ref', { ...fixture, resources: [{ ...resource, templateId: 'missing' }] }],
  ['template assignment', { ...fixture, operations: [{ ...operationA, assignedResourceId: resourceTemplate.id }, operationB, operationC, operationD] }],
  ['missing connection endpoint', { ...fixture, connections: [{ ...connection, targetOperationId: 'missing' }] }],
  ['self connection', { ...fixture, connections: [{ ...connection, targetOperationId: operationA.id }] }],
  ['invalid anchor', { ...fixture, connections: [{ ...connection, sourceAnchor: { side: 'centre', offset: 2 } }] }],
  ['non-finite geometry', { ...fixture, resources: [{ ...resource, worldX: Number.POSITIVE_INFINITY }] }],
  ['invalid dimensions', { ...fixture, operations: [{ ...operationA, width: 0 }, operationB, operationC, operationD] }],
  ['invalid capacity', { ...fixture, resources: [{ ...resource, capacity: 0 }, resourceTwo, inspection] }],
  ['array limit', { ...fixture, connections: Array.from({ length: 20001 }, (_, index) => ({ ...connection, id: `CON-X-${index}`, connectionType: 'Information' })) }],
];
for (const [label, candidate] of invalidCases) rejects(() => validateProjectDocument(candidate), `${label} must be rejected`);
assert(validateProjectDocument({ ...fixture, workspaces: { ...fixture.workspaces, processFlow: { ...viewport, zoom: 999 } } }).workspaces.processFlow.zoom === 4, 'Unsafe finite zoom is clamped');
assert(validateProjectDocument({ ...fixture, workspaces: { active: 'processFlow' } }).workspaces.factoryLayout.zoom === 1, 'Missing optional viewport state uses defaults');
rejects(() => validateProjectDocument(JSON.parse('{"format":"ManufacturingFlowDesigner","schemaVersion":"1.0.0","__proto__":{}}')), 'Prototype-pollution keys are rejected');
rejects(() => deserializeProject(JSON.stringify({ ...fixture, schemaVersion: '2.0.0' })), 'Newer major schemas are rejected');
rejects(() => deserializeProject(JSON.stringify({ ...fixture, schemaVersion: '0.8.0' })), 'Unknown older schemas are rejected without an explicit migration');

const migrations = new ProjectMigrationService(); migrations.register('0.9.0', '1.0.0', (document) => ({ ...document, settings: fixture.settings }));
const migrated = deserializeProject(JSON.stringify({ ...fixture, schemaVersion: '0.9.0', settings: undefined }), migrations);
assert(migrated.migratedFrom === '0.9.0' && migrated.document.schemaVersion === '1.0.0', 'Registered older schema migrations are applied');

session.newProject('2026-02-01T00:00:00.000Z'); assert(!session.isDirty() && resources.getResourceCount() === 0 && operations.getOperationCount() === 0 && connections.getConnectionCount() === 0 && workspaces.getActive() === 'processFlow', 'New project is clean and resets all domain and workspace state');
const emptyOutput = serializeProject({ metadata: session.getMetadata(), settings: session.getSettings(), resources, operations, connections, workspaces }); assert(emptyOutput.document.resources.length === 0 && emptyOutput.document.operations.length === 0 && emptyOutput.document.connections.length === 0, 'Empty project serializes completely');
const cancelledSaveState = new DirtyStateService(); cancelledSaveState.markDirty(); assert(cancelledSaveState.isDirty(), 'A cancelled output leaves dirty state unchanged until explicitly marked clean');
session.dispose(); connections.dispose(); operations.dispose(); resources.dispose();
console.log('Project persistence checks passed.');
