import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';
const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const rejects = (action, message) => { try { action(); } catch { return; } throw new Error(message); };
const baselineState = (document) => document.scenarios.find((scenario) => scenario.isBaseline).state;

const { validateProjectDocument } = await load('../src/services/project/ProjectSchemaValidator.ts');
const { deserializeProject } = await load('../src/services/project/ProjectDeserializer.ts');
const { serializeProject } = await load('../src/services/project/ProjectSerializer.ts');
const { ProjectMigrationService } = await load('../src/services/project/ProjectMigrationService.ts');
const { ResourceStore } = await load('../src/services/ResourceStore.ts');
const { OperationStore } = await load('../src/services/OperationStore.ts');
const { ConnectionStore } = await load('../src/services/ConnectionStore.ts');
const { WorkspaceStore } = await load('../src/services/WorkspaceStore.ts');
const { FactoryStructureStore } = await load('../src/services/FactoryStructureStore.ts');
const { FactoryStructureIdGenerator } = await load('../src/utilities/FactoryStructureIdGenerator.ts');
const { FactoryRouteStore } = await load('../src/services/FactoryRouteStore.ts');
const { FactoryRouteIdGenerator } = await load('../src/utilities/FactoryRouteIdGenerator.ts');
const { FactoryAnnotationStore } = await load('../src/services/FactoryAnnotationStore.ts');
const { FactoryAnnotationIdGenerator } = await load('../src/utilities/FactoryAnnotationIdGenerator.ts');
const { SelectionStore } = await load('../src/services/SelectionStore.ts');
const { ResourceIdGenerator } = await load('../src/utilities/ResourceIdGenerator.ts');
const { OperationIdGenerator } = await load('../src/utilities/OperationIdGenerator.ts');
const { ConnectionIdGenerator } = await load('../src/utilities/ConnectionIdGenerator.ts');
const { ProjectSessionService } = await load('../src/services/project/ProjectSessionService.ts');
const { DirtyStateService } = await load('../src/services/project/DirtyStateService.ts');
const { safeFileName } = await load('../src/services/project/ProjectFileService.ts');

const resourceTemplate = { id: 'TPL-CNC-001', name: 'Machine', description: 'Machine', category: 'Machines', resourceType: 'CNC Machine', icon: 'cnc', defaultWidth: 180, defaultDepth: 80, tags: ['cnc'], isFavourite: true };
const operationTemplate = { id: 'op-cut', name: 'Cut', operationType: 'Fabrication', timingCategory: 'manual', category: 'Production', icon: 'CUT', defaultCycleTimeSeconds: 45, tags: ['cut'] };
const resource = { id: 'RES-0042', templateId: resourceTemplate.id, name: 'Machine 42', resourceType: 'CNC Machine', layoutId: 'factory-layout-default', worldX: 340.25, worldY: -15, width: 180, depth: 80, rotationDegrees: 90, clearance: { enabled: true, left: 10, right: 20, top: 30, bottom: 40, category: 'maintenance', note: 'Service access' }, active: true, visible: true, locked: false, capacity: 1 };
const resourceTwo = { ...resource, id: 'RES-0043', name: 'Machine 43', worldX: 600, locked: true };
const inspection = { ...resource, id: 'RES-0044', name: 'Inspection Resource', worldX: 820, visible: false };
const operationA = { id: 'operation-0071', templateId: operationTemplate.id, name: 'Cut A', operationType: 'Fabrication', timingCategory: 'manual', cycleTimeSeconds: 45, sequence: 10, assignedResourceId: resource.id, notes: 'First', worldX: 100, worldY: 200, width: 210, height: 100, locked: false, visible: true };
const operationB = { ...operationA, id: 'operation-0072', name: 'Cut B', sequence: 20, assignedResourceId: null, worldX: 500 };
const operationC = { ...operationA, id: 'operation-0073', name: 'Inspect', sequence: 30, assignedResourceId: inspection.id, worldX: 800, visible: false };
const operationD = { ...operationA, id: 'operation-0074', name: 'Finish', sequence: 40, assignedResourceId: resourceTwo.id, worldX: 1100, locked: true };
const connection = { id: 'CON-0099', sourceOperationId: operationA.id, targetOperationId: operationB.id, sourceAnchor: { side: 'right', offset: 0.5 }, targetAnchor: { side: 'left', offset: 0.5 }, label: 'Transfer', connectionType: 'Standard', visible: true, locked: false };
const connectionTwo = { ...connection, id: 'CON-0100', sourceOperationId: operationB.id, targetOperationId: operationC.id, label: 'Inspect', connectionType: 'Information' };
const connectionThree = { ...connection, id: 'CON-0101', sourceOperationId: operationC.id, targetOperationId: operationD.id, label: 'Finish', locked: true };
const viewport = { panX: 5, panY: -10, zoom: 1.25, gridVisible: true, originVisible: false, snapEnabled: true };
const boundary = { id: 'BND-0042', layoutId: 'factory-layout-default', name: 'Main floor', points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1200 }, { x: 0, y: 1200 }], visible: true, locked: false, fillVisible: true, note: 'Authoritative extent' };
const wall = { id: 'WALL-0042', layoutId: 'factory-layout-default', name: 'Partition', start: { x: 1000, y: 0 }, end: { x: 1000, y: 500 }, thickness: 50, wallType: 'Partition', visible: true, locked: false, note: '' };
const area = { id: 'AREA-0042', layoutId: 'factory-layout-default', name: 'Restricted test zone', areaType: 'Restricted', worldX: 1500, worldY: 800, width: 300, depth: 200, rotationDegrees: 0, visible: true, locked: false, fillVisible: true, note: '', resourcePlacementPolicy: 'Prohibited' };
const aisle = { id: 'AISLE-0042', layoutId: 'factory-layout-default', name: 'Emergency route', points: [{ x: 100, y: 1000 }, { x: 1900, y: 1000 }], width: 100, aisleType: 'Emergency', direction: 'Two Way', visible: true, locked: false, note: '' };
const factoryRoute = { id: 'FRT-0042', layoutId: 'factory-layout-default', name: 'Material delivery', routeType: 'Material', direction: 'Forward', source: { kind: 'resource', resourceId: resource.id, anchorSide: 'right', anchorOffset: 0.5 }, target: { kind: 'area', areaId: area.id, anchorSide: 'left', anchorOffset: 0.5 }, waypoints: [{ x: 800, y: 200 }, { x: 800, y: 800 }], visible: true, locked: false, enabled: true, nominalSpeed: 1200, note: 'Test route' };
const fixture = { format: 'ManufacturingFlowDesigner', schemaVersion: '1.6.0', applicationVersion: '0.8.0', project: { id: 'PRJ-0047', name: 'Persistence Test', description: 'Round trip', author: 'Engineer', company: 'Factory', createdUtc: '2026-01-01T00:00:00.000Z', modifiedUtc: '2026-01-02T00:00:00.000Z' }, resourceTemplates: [resourceTemplate], operationTemplates: [operationTemplate], resources: [resource, resourceTwo, inspection], operations: [operationA, operationB, operationC, operationD], connections: [connection, connectionTwo, connectionThree], layoutBoundaries: [boundary], walls: [wall], areas: [area], aisles: [aisle], factoryRoutes: [factoryRoute], factoryAnnotations: [], standardWorkStudies: [{ id: 'SW-0042', name: 'Persistence Study', description: '', productOrProcessName: 'Part A', revision: 'A', active: true, notes: '', createdUtc: '2026-01-01T00:00:00.000Z', modifiedUtc: '2026-01-02T00:00:00.000Z' }], standardWorkEntries: [{ id: 'SWE-0042', studyId: 'SW-0042', operationId: operationA.id, order: 10, occurrences: 2, enabled: true, notes: '' }], workspaces: { active: 'factoryLayout', processFlow: viewport, factoryLayout: { ...viewport, panX: -500, zoom: 0.75 } }, settings: { gridBaseInterval: 20, routingClearance: 16, unitSystem: 'metric', displayPrecision: 2, units: { modelLengthUnit: 'mm', displayLengthUnit: 'mm', displayPrecision: 2, showTrailingZeros: true }, dimensionTextScale: 1, annotationTextSize: 16, defaultDimensionOffset: 40, defaultDimensionLayer: 'Dimensions', standardWork: { timeFormat: 'seconds', chart: { intervalMode: 'automatic', fixedMajorIntervalSeconds: 10, minorSubdivisions: 5, showMinorGrid: true, showOperationIds: true, showOperationNames: true, showDurations: true, showStartEndValues: false, showAutomaticLaunchMarkers: true, showLaneIds: true, showAutomaticLanes: true, showDisabledEntries: false, laneDensity: 'comfortable' } } } };

const schemaOneSix = structuredClone(fixture);
fixture.schemaVersion = '1.7.0'; fixture.applicationVersion = '0.9.0'; fixture.standardWorkOperators = [{ id: 'SWO-0042', studyId: 'SW-0042', name: 'Operator 1', role: '', displayOrder: 10, active: true, linkedResourceId: null, notes: '' }]; fixture.standardWorkEntries[0].assignedOperatorId = 'SWO-0042'; fixture.standardWorkHandovers = []; fixture.settings.standardWork.chart = { ...fixture.settings.standardWork.chart, showOperatorIds: true, showOperatorRoles: true, showOperatorTotals: true, showHandoverLinks: true, showDisabledHandovers: false, showDependencyIdle: true, operatorLaneDensity: 'comfortable', handoverRoutingStyle: 'orthogonal' };
const schemaOneSeven = structuredClone(fixture);
fixture.schemaVersion = '1.8.0'; fixture.applicationVersion = '1.0.0'; fixture.standardWorkPlanning = [{ studyId: 'SW-0042', periodName: 'Shift', scheduledProductionTimeSeconds: 28800, plannedBreakTimeSeconds: 1800, plannedDowntimeSeconds: 0, requiredOutputUnits: 300, active: true, notes: 'Planning test' }]; fixture.settings.standardWork.chart = { ...fixture.settings.standardWork.chart, showTaktLine: true, showTaktValue: true, shadeBeyondTakt: true, includeTaktInFit: true, workBalanceViewMode: 'categoryStack', showWorkBalanceValues: true, showWorkBalancePercentages: true, workBalanceDensity: 'comfortable', showCapacitySummary: true };
const schemaOneEight = structuredClone(fixture);
fixture.schemaVersion = '1.9.0'; fixture.applicationVersion = '1.1.0'; fixture.resources = fixture.resources.map((item) => ({ ...item, availabilityCalendarId: null })); fixture.standardWorkOperators = fixture.standardWorkOperators.map((item) => ({ ...item, availabilityCalendarId: null })); fixture.standardWorkPlanning = fixture.standardWorkPlanning.map((item) => ({ ...item, availabilityMode: 'manual', planningCalendarId: null, periodStartDate: null, periodEndDate: null })); fixture.shiftDefinitions = []; fixture.shiftBreaks = []; fixture.availabilityCalendars = []; fixture.calendarExceptions = []; fixture.settings.defaultAvailabilityCalendarId = null;
const migratedOneSix = deserializeProject(JSON.stringify(schemaOneSix)); const migratedOneSixState = baselineState(migratedOneSix.document); assert(migratedOneSix.migratedFrom === '1.6.0' && migratedOneSix.document.schemaVersion === '2.0.0' && migratedOneSixState.standardWorkOperators.length === 1 && migratedOneSixState.standardWorkPlanning.length === 1 && !migratedOneSixState.standardWorkPlanning[0].active && migratedOneSixState.standardWorkEntries[0].assignedOperatorId === migratedOneSixState.standardWorkOperators[0].id, 'Schema 1.6 projects gain deterministic default operators, assignments, inactive planning, availability defaults, and a baseline scenario');
const migratedOneSeven = deserializeProject(JSON.stringify(schemaOneSeven)); const migratedOneSevenState = baselineState(migratedOneSeven.document); assert(migratedOneSeven.migratedFrom === '1.7.0' && migratedOneSeven.document.schemaVersion === '2.0.0' && migratedOneSevenState.standardWorkPlanning.length === 1 && migratedOneSevenState.standardWorkPlanning[0].scheduledProductionTimeSeconds === 28800 && !migratedOneSevenState.standardWorkPlanning[0].active, 'Schema 1.7 projects gain one inactive default planning record per study and migrate into a baseline scenario');
const migratedOneEight = deserializeProject(JSON.stringify(schemaOneEight)); const migratedOneEightState = baselineState(migratedOneEight.document); assert(migratedOneEight.migratedFrom === '1.8.0' && migratedOneEight.document.schemaVersion === '2.0.0' && migratedOneEightState.standardWorkPlanning[0].availabilityMode === 'manual' && migratedOneEightState.standardWorkPlanning[0].scheduledProductionTimeSeconds === 28800 && migratedOneEight.document.availabilityCalendars.length === 0 && migratedOneEight.document.settings.defaultAvailabilityCalendarId === null, 'Schema 1.8 projects preserve manual planning and gain empty shared availability collections without invented calendars');
const valid = deserializeProject(JSON.stringify(fixture)).document; const validState = baselineState(valid);
assert(valid.project.id === 'PRJ-0047' && valid.scenarios.length === 1 && validState.resources.length === 3 && validState.operations.length === 4 && validState.connections.length === 3 && validState.layoutBoundaries.length === 1 && validState.walls.length === 1 && validState.areas.length === 1 && validState.aisles.length === 1, 'Valid representative document migrates into one baseline scenario');
const parsed = deserializeProject(`${JSON.stringify(fixture, null, 2)}\n`);
assert(baselineState(parsed.document).workspaces.active === 'factoryLayout', 'Active workspace round trips inside the scenario');
assert(baselineState(parsed.document).workspaces.processFlow.zoom === 1.25 && baselineState(parsed.document).workspaces.factoryLayout.zoom === 0.75, 'Independent scenario viewports round trip');
const { layoutBoundaries: _oldBoundaries, walls: _oldWalls, areas: _oldAreas, aisles: _oldAisles, factoryRoutes: _oldRoutes, ...schemaOneOne } = structuredClone(fixture); const migratedOneOne = deserializeProject(JSON.stringify({ ...schemaOneOne, schemaVersion: '1.1.0', applicationVersion: '0.3.0' })); assert(migratedOneOne.migratedFrom === '1.1.0' && baselineState(migratedOneOne.document).layoutBoundaries.length === 0 && baselineState(migratedOneOne.document).factoryRoutes.length === 0, 'Schema 1.1 projects migrate explicitly through structure, routes, and scenarios');
const legacyFixture = { ...schemaOneOne, schemaVersion: '1.0.0', applicationVersion: '0.2.0', resourceTemplates: fixture.resourceTemplates.map(({ defaultDepth, ...template }) => ({ ...template, defaultHeight: defaultDepth })), resources: fixture.resources.map(({ depth, clearance, ...item }) => ({ ...item, height: depth, rotationDegrees: item.id === 'RES-0042' ? -90 : undefined })) };
const legacy = deserializeProject(JSON.stringify(legacyFixture)); const legacyState = baselineState(legacy.document); assert(legacy.migratedFrom === '1.0.0' && legacy.document.schemaVersion === '2.0.0', 'Schema 1.0 projects migrate explicitly through 2.0'); assert(legacyState.resources[0].depth === 80 && legacyState.resources[0].rotationDegrees === 270 && legacyState.resources[0].clearance.category === 'general', 'Migration preserves footprint geometry and adds normalized rotation and clearance defaults'); assert(legacyState.operations[0].height === 100, 'Migration does not alter operation height');

const selection = new SelectionStore(); const resourceIds = new ResourceIdGenerator(); const operationIds = new OperationIdGenerator(); const connectionIds = new ConnectionIdGenerator();
const resources = new ResourceStore([], resourceIds, selection); const operations = new OperationStore([], operationIds, selection); const workspaces = new WorkspaceStore();
const connections = new ConnectionStore(connectionIds, (id) => operations.getOperation(id), () => ({ points: [{ x: 1, y: 2 }, { x: 3, y: 2 }], status: 'clear' }), selection);
const structure = new FactoryStructureStore(new FactoryStructureIdGenerator('BND'), new FactoryStructureIdGenerator('WALL'), new FactoryStructureIdGenerator('AREA'), new FactoryStructureIdGenerator('AISLE'));
const routeIds = new FactoryRouteIdGenerator(); const routes = new FactoryRouteStore(routeIds, { hasResource: (id) => Boolean(resources.getResource(id)), hasArea: (id) => Boolean(structure.getArea(id)) });
const annotationIds = new FactoryAnnotationIdGenerator(); const annotations = new FactoryAnnotationStore(annotationIds);
const session = new ProjectSessionService(resources, operations, connections, structure, routes, annotations, workspaces, selection, resourceIds, operationIds, connectionIds, routeIds, annotationIds);
session.openProject(valid, 'fixture.mflow');
assert(!session.isDirty(), 'Opening a project starts clean');
assert(connections.getConnection('CON-0099').routePoints.length === 2, 'Connection routes are derived once on load');
selection.select({ kind: 'operation', id: operationA.id }); assert(!session.isDirty(), 'Selection does not dirty a project');
operations.updateOperation(operationA.id, { notes: 'Changed' }); assert(session.isDirty(), 'Persistent model edits set dirty state');
const output = serializeProject({ metadata: session.getMetadata(), settings: session.getSettings(), scenarios: session.getScenarios(), activeScenarioId: session.getActiveScenarioId(), resources, operations, connections, structure, routes, annotations, standardWork: session.standardWork, standardWorkOperators: session.standardWorkOperators, standardWorkHandovers: session.standardWorkHandovers, standardWorkPlanning: session.standardWorkPlanning, availability: session.availability, workspaces }, '2026-01-03T00:00:00.000Z'); const outputState = baselineState(output.document);
assert(!output.text.includes('"selected"') && !output.text.includes('"routePoints"') && !output.text.includes('"routeStatus"'), 'Transient selection and derived route cache are excluded');
assert(output.document.project.modifiedUtc === '2026-01-03T00:00:00.000Z', 'Save snapshot updates modified time');
assert(output.document.project.createdUtc === fixture.project.createdUtc && output.document.project.id === fixture.project.id, 'Save preserves project creation time and stable identity');
assert(outputState.resources[0].worldX === 340.25 && outputState.operations[0].assignedResourceId === resource.id, 'Coordinates and physical assignments serialize in the scenario');
assert(outputState.layoutBoundaries[0].id === boundary.id && outputState.walls[0].thickness === wall.thickness && outputState.areas[0].resourcePlacementPolicy === 'Prohibited' && outputState.aisles[0].points.length === 2, 'Boundary, wall, area, and aisle round trip with stable IDs');
session.markSaved(output.document.project, 'renamed.mflow'); assert(!session.isDirty() && session.getState().fileName === 'renamed.mflow', 'Successful save marks clean and records filename');
const stateBeforeFailedOpen = session.getState(); rejects(() => deserializeProject('{not valid'), 'Failed candidate must reject'); assert(session.getState().metadata.id === stateBeforeFailedOpen.metadata.id && resources.getResourceCount() === 3, 'Failed open candidate leaves the active project unchanged');
assert(resourceIds.next() === 'RES-0045' && operationIds.next() === 'operation-0075' && connectionIds.next() === 'CON-0102', 'ID generators resume after loaded identifiers');
assert(safeFileName('My Factory: Study') === 'My-Factory-Study.mflow', 'Suggested filenames are portable and use .mflow');

rejects(() => deserializeProject('{bad json'), 'Malformed JSON is rejected');
const withState = (patch) => ({ ...structuredClone(valid), scenarios: [{ ...valid.scenarios[0], state: { ...structuredClone(validState), ...patch } }] });
const invalidCases = [
  ['wrong format', { ...valid, format: 'Other' }],
  ['missing schema', { ...valid, schemaVersion: undefined }],
  ['missing project metadata', { ...valid, project: undefined }],
  ['duplicate resource id', withState({ resources: [resource, { ...resource }] })],
  ['duplicate operation id', withState({ operations: [operationA, { ...operationA }] })],
  ['duplicate connection id', withState({ connections: [connection, { ...connection }] })],
  ['cross-entity duplicate id', withState({ walls: [{ ...wall, id: resource.id }] })],
  ['missing template ref', withState({ resources: [{ ...resource, templateId: 'missing' }] })],
  ['template assignment', withState({ operations: [{ ...operationA, assignedResourceId: resourceTemplate.id }, operationB, operationC, operationD] })],
  ['missing connection endpoint', withState({ connections: [{ ...connection, targetOperationId: 'missing' }] })],
  ['self connection', withState({ connections: [{ ...connection, targetOperationId: operationA.id }] })],
  ['invalid anchor', withState({ connections: [{ ...connection, sourceAnchor: { side: 'centre', offset: 2 } }] })],
  ['non-finite geometry', withState({ resources: [{ ...resource, worldX: Number.POSITIVE_INFINITY }] })],
  ['invalid dimensions', withState({ operations: [{ ...operationA, width: 0 }, operationB, operationC, operationD] })],
  ['invalid capacity', withState({ resources: [{ ...resource, capacity: 0 }, resourceTwo, inspection] })],
  ['array limit', withState({ connections: Array.from({ length: 20001 }, (_, index) => ({ ...connection, id: `CON-X-${index}`, connectionType: 'Information' })) })],
];
for (const [label, candidate] of invalidCases) rejects(() => validateProjectDocument(candidate), `${label} must be rejected`);
assert(baselineState(validateProjectDocument(withState({ workspaces: { ...validState.workspaces, processFlow: { ...viewport, zoom: 999 } } }))).workspaces.processFlow.zoom === 4, 'Unsafe finite zoom is clamped');
assert(baselineState(validateProjectDocument(withState({ workspaces: { active: 'processFlow' } }))).workspaces.factoryLayout.zoom === 1, 'Missing optional viewport state uses defaults');
rejects(() => validateProjectDocument(JSON.parse('{"format":"ManufacturingFlowDesigner","schemaVersion":"1.2.0","__proto__":{}}')), 'Prototype-pollution keys are rejected');
rejects(() => deserializeProject(JSON.stringify({ ...valid, schemaVersion: '3.0.0' })), 'Newer major schemas are rejected');
rejects(() => deserializeProject(JSON.stringify({ ...fixture, schemaVersion: '0.8.0' })), 'Unknown older schemas are rejected without an explicit migration');

const migrations = new ProjectMigrationService(); migrations.register('0.9.0', '1.0.0', (document) => ({ ...legacyFixture, ...document, resourceTemplates: legacyFixture.resourceTemplates, resources: legacyFixture.resources, settings: fixture.settings }));
const migrated = deserializeProject(JSON.stringify({ ...legacyFixture, schemaVersion: '0.9.0', settings: undefined }), migrations);
assert(migrated.migratedFrom === '0.9.0' && migrated.document.schemaVersion === '2.0.0', 'Registered older schema migrations chain into the current schema');

session.newProject('2026-02-01T00:00:00.000Z'); assert(!session.isDirty() && resources.getResourceCount() === 0 && operations.getOperationCount() === 0 && connections.getConnectionCount() === 0 && workspaces.getActive() === 'processFlow', 'New project is clean and resets all domain and workspace state');
const emptyOutput = serializeProject({ metadata: session.getMetadata(), settings: session.getSettings(), scenarios: session.getScenarios(), activeScenarioId: session.getActiveScenarioId(), resources, operations, connections, structure, routes, annotations, standardWork: session.standardWork, standardWorkOperators: session.standardWorkOperators, standardWorkHandovers: session.standardWorkHandovers, standardWorkPlanning: session.standardWorkPlanning, availability: session.availability, workspaces }); const emptyState = baselineState(emptyOutput.document); assert(emptyState.resources.length === 0 && emptyState.operations.length === 0 && emptyState.connections.length === 0 && emptyState.walls.length === 0 && emptyState.factoryRoutes.length === 0 && emptyState.factoryAnnotations.length === 0 && emptyState.standardWorkEntries.length === 0 && emptyOutput.document.shiftDefinitions.length === 0 && emptyOutput.document.availabilityCalendars.length === 0, 'Empty baseline project serializes completely');
const cancelledSaveState = new DirtyStateService(); cancelledSaveState.markDirty(); assert(cancelledSaveState.isDirty(), 'A cancelled output leaves dirty state unchanged until explicitly marked clean');
session.dispose(); connections.dispose(); operations.dispose(); resources.dispose();
console.log('Project persistence checks passed.');
