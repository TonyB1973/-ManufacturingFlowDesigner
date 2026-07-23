import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';

const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const rejects = (action, message) => { try { action(); } catch { return; } throw new Error(message); };

const { createDemoProject } = await load('../src/services/project/DemoProjectFactory.ts');
const { deserializeProject } = await load('../src/services/project/ProjectDeserializer.ts');
const { validateProjectDocument } = await load('../src/services/project/ProjectSchemaValidator.ts');
const { serializeProject } = await load('../src/services/project/ProjectSerializer.ts');
const { ScenarioEntityComparisonService } = await load('../src/services/scenarios/ScenarioEntityComparisonService.ts');
const { validateScenario, validateScenarioCollection } = await load('../src/services/scenarios/ScenarioValidationService.ts');
const { ResourceStore } = await load('../src/services/ResourceStore.ts');
const { OperationStore } = await load('../src/services/OperationStore.ts');
const { ConnectionStore } = await load('../src/services/ConnectionStore.ts');
const { FactoryStructureStore } = await load('../src/services/FactoryStructureStore.ts');
const { FactoryRouteStore } = await load('../src/services/FactoryRouteStore.ts');
const { FactoryAnnotationStore } = await load('../src/services/FactoryAnnotationStore.ts');
const { WorkspaceStore } = await load('../src/services/WorkspaceStore.ts');
const { SelectionStore } = await load('../src/services/SelectionStore.ts');
const { StandardWorkSelectionStore } = await load('../src/services/standardWork/StandardWorkSelectionStore.ts');
const { AvailabilitySelectionStore } = await load('../src/services/availability/AvailabilitySelectionStore.ts');
const { ResourceIdGenerator } = await load('../src/utilities/ResourceIdGenerator.ts');
const { OperationIdGenerator } = await load('../src/utilities/OperationIdGenerator.ts');
const { ConnectionIdGenerator } = await load('../src/utilities/ConnectionIdGenerator.ts');
const { FactoryStructureIdGenerator } = await load('../src/utilities/FactoryStructureIdGenerator.ts');
const { FactoryRouteIdGenerator } = await load('../src/utilities/FactoryRouteIdGenerator.ts');
const { FactoryAnnotationIdGenerator } = await load('../src/utilities/FactoryAnnotationIdGenerator.ts');
const { ProjectSessionService } = await load('../src/services/project/ProjectSessionService.ts');
const { CommandHistoryService } = await load('../src/services/history/CommandHistoryService.ts');
const { CommandFactory } = await load('../src/services/history/CommandFactory.ts');
const { ScenarioCommandFactory } = await load('../src/services/history/ScenarioCommandFactory.ts');

const selection = new SelectionStore();
const standardWorkSelection = new StandardWorkSelectionStore();
const availabilitySelection = new AvailabilitySelectionStore();
const resourceIds = new ResourceIdGenerator(); const operationIds = new OperationIdGenerator(); const connectionIds = new ConnectionIdGenerator();
const wallIds = new FactoryStructureIdGenerator('WALL'); const areaIds = new FactoryStructureIdGenerator('AREA'); const aisleIds = new FactoryStructureIdGenerator('AISLE');
const routeIds = new FactoryRouteIdGenerator(); const annotationIds = new FactoryAnnotationIdGenerator();
const resources = new ResourceStore([], resourceIds, selection); const operations = new OperationStore([], operationIds, selection); const workspaces = new WorkspaceStore();
const connections = new ConnectionStore(connectionIds, (id) => operations.getOperation(id), () => ({ points: [], status: 'clear' }), selection);
const structure = new FactoryStructureStore(new FactoryStructureIdGenerator('BND'), wallIds, areaIds, aisleIds);
const routes = new FactoryRouteStore(routeIds, { hasResource: (id) => Boolean(resources.getResource(id)), hasArea: (id) => Boolean(structure.getArea(id)) });
const annotations = new FactoryAnnotationStore(annotationIds);
const project = new ProjectSessionService(resources, operations, connections, structure, routes, annotations, workspaces, selection, resourceIds, operationIds, connectionIds, routeIds, annotationIds, undefined, standardWorkSelection, availabilitySelection);
assert(project.getScenarios().length === 1 && project.getActiveScenario().id === 'SCN-0001' && project.getActiveScenario().isBaseline, 'A fresh application session starts with an active baseline before the UI renders');
const context = { resources, operations, connections, structure, routes, annotations, standardWork: project.standardWork, standardWorkOperators: project.standardWorkOperators, standardWorkHandovers: project.standardWorkHandovers, standardWorkPlanning: project.standardWorkPlanning, standardWorkSelection, availability: project.availability, availabilitySelection, project, selection };
const history = new CommandHistoryService(context, 100); project.attachHistory(history);
const commands = new CommandFactory(history, context); const scenarioCommands = new ScenarioCommandFactory(history, context);

const demo = validateProjectDocument(createDemoProject('2026-07-23T08:00:00.000Z'));
project.openProject(demo, 'scenario-demo.mflow');
assert(project.getScenarios().length === 1 && project.getBaselineScenario().id === 'SCN-0001' && project.getActiveScenarioId() === 'SCN-0001', 'New-format demo opens with one active baseline scenario');
assert(validateScenarioCollection(project.getScenarios(), project.getActiveScenarioId()).length === 0, 'Scenario collection has exactly one valid baseline and active scenario');

const baseline = project.getBaselineScenario(); const firstOperation = baseline.state.operations[0]; const baselineViewport = baseline.state.workspaces.processFlow;
const alternative = scenarioCommands.newFromBaseline();
assert(alternative?.id === 'SCN-0002' && project.getActiveScenarioId() === alternative.id && alternative.sourceScenarioId === baseline.id, 'New from Baseline creates and activates a stable scenario ID with lineage');
assert(alternative.state.operations[0].id === firstOperation.id && alternative.state.resources[0].id === baseline.state.resources[0].id, 'Scenario cloning preserves entity IDs for deterministic comparison');
assert(alternative.state !== baseline.state && alternative.state.operations !== baseline.state.operations, 'Scenario cloning deep-copies scenario-owned state');

workspaces.updateViewport('processFlow', { panX: 987, zoom: 1.75 });
assert(project.activateScenario(baseline.id) && workspaces.getViewport('processFlow').panX === baselineViewport.panX, 'Activating the baseline restores its own Process Flow viewport');
assert(project.activateScenario(alternative.id) && workspaces.getViewport('processFlow').panX === 987, 'Returning to an alternative restores its independent Process Flow viewport');

history.clear(); history.markSaved();
const originalCycle = operations.getOperation(firstOperation.id).cycleTimeSeconds;
assert(commands.updateOperation(firstOperation.id, { cycleTimeSeconds: originalCycle + 11 }), 'Scenario-owned operation edit executes through command history');
assert(project.activateScenario(baseline.id) && operations.getOperation(firstOperation.id).cycleTimeSeconds === originalCycle, 'Baseline data is isolated from alternative edits');
assert(history.undo() && project.getActiveScenarioId() === alternative.id && operations.getOperation(firstOperation.id).cycleTimeSeconds === originalCycle, 'Global Undo activates the command-owning scenario and restores its state');
assert(history.redo() && project.getActiveScenarioId() === alternative.id && operations.getOperation(firstOperation.id).cycleTimeSeconds === originalCycle + 11, 'Global Redo returns to the owning scenario and reapplies the edit');

assert(scenarioCommands.update(alternative.id, { locked: true }, 'Lock alternative'), 'Scenario lock is an undoable scenario command');
const historyCount = history.getState().undoCount;
assert(!commands.updateOperation(firstOperation.id, { cycleTimeSeconds: originalCycle + 22 }) && history.getState().undoCount === historyCount, 'A locked scenario rejects scenario-scoped mutation without adding history');
assert(scenarioCommands.update(alternative.id, { locked: false }, 'Unlock alternative'), 'Locked scenarios remain unlockable through scenario management');

const comparisonService = new ScenarioEntityComparisonService();
const comparisonContext = { availability: project.availability, settings: project.getSettings() };
const comparison = comparisonService.compare(project.getBaselineScenario(), project.getScenario(alternative.id), project.getScenarioRevision(baseline.id), project.getScenarioRevision(alternative.id), comparisonContext);
assert(comparison.modifiedCount >= 1 && comparison.changes.some((change) => change.entityType === 'operations' && change.entityId === firstOperation.id && change.changedFields.includes('cycleTimeSeconds')), 'Baseline comparison reports stable-ID field changes');
assert(comparison.metrics.find((metric) => metric.key === 'cycle-time').delta === 11, 'Engineering metrics report the expected cycle-time delta');
assert(comparison.metrics.find((metric) => metric.key === 'availability-shortfalls').status === 'notAvailable', 'Unavailable engineering metrics remain explicitly unavailable rather than being coerced to zero');
assert(['chart-cycle', 'takt', 'nominal-capacity', 'route-distance', 'footprint-ratio', 'health-errors', 'missing-effective-calendars'].every((key) => comparison.metrics.some((metric) => metric.key === key)), 'Comparison includes Process Flow, Factory Layout, Standard Work, availability, and health metrics');
assert(comparisonService.compare(project.getBaselineScenario(), project.getScenario(alternative.id), project.getScenarioRevision(baseline.id), project.getScenarioRevision(alternative.id), comparisonContext) === comparison, 'Unchanged scenario and shared-library revisions reuse the derived comparison cache');

const duplicate = scenarioCommands.duplicateCurrent(); const duplicateId = duplicate?.id;
assert(duplicateId === 'SCN-0003' && duplicate.sourceScenarioId === alternative.id, 'Duplicate Current preserves lineage and allocates the next stable scenario ID');
history.undo(); assert(!project.getScenario(duplicateId), 'Undoing scenario duplication removes only the duplicate');
history.redo(); assert(project.getScenario(duplicateId)?.id === duplicateId, 'Redoing scenario duplication restores the same stable scenario ID');
assert(scenarioCommands.setBaseline(duplicateId) && project.getBaselineScenario().id === duplicateId, 'Set Baseline changes only the baseline designation');
history.undo(); assert(project.getBaselineScenario().id === baseline.id, 'Undo restores the prior baseline designation without copying state');
assert(scenarioCommands.delete(duplicateId) && !project.getScenario(duplicateId), 'Non-baseline scenarios can be deleted');
history.undo(); assert(project.getScenario(duplicateId)?.id === duplicateId, 'Undo restores a deleted scenario with its exact ID and state');

const calendarImpact = project.getCalendarReferences('CAL-0001');
assert(calendarImpact.scenarios.length === 3 && calendarImpact.total > calendarImpact.scenarios[0].total, 'Shared calendar impact includes references from every scenario');
const scenarioSnapshots = project.getScenarios(); const cleared = project.replaceCalendarReferences('CAL-0001', null);
assert(cleared > 0 && project.getCalendarReferences('CAL-0001').scenarios.length === 0, 'Shared calendar reference replacement updates every scenario');
for (const snapshot of scenarioSnapshots) project.replaceScenario(snapshot);
assert(project.getCalendarReferences('CAL-0001').total === calendarImpact.total, 'Scenario snapshots restore cross-scenario shared-library references exactly');

const activeHealth = validateScenario(project.getActiveScenario(), project.availability.getCalendars(), project.getSettings());
assert(activeHealth.errors === 0, 'Scenario health validation resolves shared calendars and scenario-owned references');

const output = serializeProject({ metadata: project.getMetadata(), settings: project.getSettings(), scenarios: project.getScenarios(), activeScenarioId: project.getActiveScenarioId(), resources, operations, connections, structure, routes, annotations, standardWork: project.standardWork, standardWorkOperators: project.standardWorkOperators, standardWorkHandovers: project.standardWorkHandovers, standardWorkPlanning: project.standardWorkPlanning, availability: project.availability, workspaces });
assert(output.document.schemaVersion === '2.0.0' && output.document.scenarios.length === 3 && !('resources' in output.document), 'Persistence writes one 2.0 project envelope without duplicated top-level scenario data');
const roundTrip = deserializeProject(output.text).document;
assert(roundTrip.activeScenarioId === output.document.activeScenarioId && roundTrip.scenarios.map((item) => item.id).join(',') === output.document.scenarios.map((item) => item.id).join(','), 'Scenario identity and active selection survive save/open round trip');

const legacyState = demo.scenarios[0].state; const { activeScenarioId: _legacyActive, scenarios: _legacyScenarios, ...legacyShared } = demo;
const legacyDocument = { ...legacyShared, ...legacyState, schemaVersion: '1.9.0', applicationVersion: '1.1.0' };
const migrated = deserializeProject(JSON.stringify(legacyDocument));
assert(migrated.migratedFrom === '1.9.0' && migrated.document.scenarios.length === 1 && migrated.document.scenarios[0].isBaseline && migrated.document.scenarios[0].state.operations[0].id === legacyState.operations[0].id, 'Schema 1.9 migrates into one baseline while preserving IDs and data');

const twoBaselines = structuredClone(output.document); twoBaselines.scenarios[1].isBaseline = true;
rejects(() => validateProjectDocument(twoBaselines), 'Files with more than one baseline are rejected');
const missingActive = { ...structuredClone(output.document), activeScenarioId: 'SCN-9999' };
rejects(() => validateProjectDocument(missingActive), 'Files with a missing active scenario are rejected');
const brokenReference = structuredClone(output.document); brokenReference.scenarios[1].state.connections[0].targetOperationId = 'missing-operation';
rejects(() => validateProjectDocument(brokenReference), 'Files with broken references in an inactive scenario are rejected');

project.dispose(); connections.dispose(); operations.dispose(); resources.dispose();
console.log('Scenario creation, isolation, locking, history, comparison, shared-library impact, persistence, migration, and validation checks passed.');
