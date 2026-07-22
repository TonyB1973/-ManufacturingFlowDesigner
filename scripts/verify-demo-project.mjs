import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';

const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const { createDemoProject } = await load('../src/services/project/DemoProjectFactory.ts');
const { validateProjectDocument } = await load('../src/services/project/ProjectSchemaValidator.ts');
const { validateOperations } = await load('../src/services/OperationValidation.ts');
const { validateResources } = await load('../src/services/ResourceValidation.ts');
const { validateProcessConnections } = await load('../src/services/ConnectionValidation.ts');
const { validateFactoryStructure } = await load('../src/services/FactoryStructureValidation.ts');
const { validateFactoryRoutes } = await load('../src/services/FactoryRouteValidation.ts');
const { anchorWorldPosition } = await load('../src/services/ConnectionAnchors.ts');
const { ResourceStore } = await load('../src/services/ResourceStore.ts');
const { OperationStore } = await load('../src/services/OperationStore.ts');
const { ConnectionStore } = await load('../src/services/ConnectionStore.ts');
const { FactoryStructureStore } = await load('../src/services/FactoryStructureStore.ts');
const { FactoryRouteStore } = await load('../src/services/FactoryRouteStore.ts');
const { SelectionStore } = await load('../src/services/SelectionStore.ts');
const { ResourceIdGenerator } = await load('../src/utilities/ResourceIdGenerator.ts');
const { OperationIdGenerator } = await load('../src/utilities/OperationIdGenerator.ts');
const { ConnectionIdGenerator } = await load('../src/utilities/ConnectionIdGenerator.ts');
const { FactoryStructureIdGenerator } = await load('../src/utilities/FactoryStructureIdGenerator.ts');
const { FactoryRouteIdGenerator } = await load('../src/utilities/FactoryRouteIdGenerator.ts');

const demo = validateProjectDocument(createDemoProject('2026-07-22T12:00:00.000Z'));
assert(demo.resources.length === 6 && demo.operations.length === 5 && demo.connections.length === 4, 'Demo has the expected linked process and physical resources');
assert(demo.factoryRoutes.length === 5 && demo.layoutBoundaries.length === 1 && demo.aisles.length === 1, 'Demo has the expected factory engineering entities');
assert(demo.operations.every((operation) => operation.assignedResourceId), 'Every demo operation is assigned to a physical resource');

const selection = new SelectionStore();
const resources = new ResourceStore(demo.resourceTemplates, new ResourceIdGenerator(), selection);
const operations = new OperationStore(demo.operationTemplates, new OperationIdGenerator(), selection);
resources.replaceAll(demo.resourceTemplates, demo.resources, false);
operations.replaceAll(demo.operationTemplates, demo.operations, false);
const connections = new ConnectionStore(new ConnectionIdGenerator(), (id) => operations.getOperation(id), (connection) => {
  const source = operations.getOperation(connection.sourceOperationId); const target = operations.getOperation(connection.targetOperationId);
  return source && target ? { points: [anchorWorldPosition(source, connection.sourceAnchor), anchorWorldPosition(target, connection.targetAnchor)], status: 'clear' } : { points: [], status: 'fallback' };
}, selection);
connections.replaceAll(demo.connections, false);
const structure = new FactoryStructureStore(new FactoryStructureIdGenerator('BND'), new FactoryStructureIdGenerator('WALL'), new FactoryStructureIdGenerator('AREA'), new FactoryStructureIdGenerator('AISLE'));
structure.replaceAll(demo.layoutBoundaries, demo.walls, demo.areas, demo.aisles, false);
const routes = new FactoryRouteStore(new FactoryRouteIdGenerator(), { hasResource: (id) => Boolean(resources.getResource(id)), hasArea: (id) => Boolean(structure.getArea(id)) });
routes.replaceAll(demo.factoryRoutes, false);

const operationHealth = validateOperations(operations.getOperations(), (id) => resources.getResource(id), (id) => Boolean(resources.getTemplate(id)));
const resourceHealth = validateResources(resources.getPlacedResources(), resources.getTemplates(), (id) => operations.getAssignmentCount(id));
const connectionHealth = validateProcessConnections(operations.getOperations(), connections.getConnections());
const structureHealth = validateFactoryStructure(resources.getPlacedResources(), structure);
const routeHealth = validateFactoryRoutes({ resources: resources.getPlacedResources(), structure, routes });
assert(operationHealth.errors === 0 && operationHealth.warnings === 0, 'Demo operations form a clean assigned baseline');
assert(resourceHealth.errors === 0 && resourceHealth.warnings === 0, 'Demo resources form a clean physical baseline');
assert(connectionHealth.errors === 0 && connectionHealth.warnings === 0, 'Demo process connections form one clean sequence');
assert(structureHealth.issues.length === 0, 'Demo factory structure has no validation issues');
assert(routeHealth.errors === 0 && routeHealth.warnings === 0, 'Demo routes have no validation issues');

console.log('Demo project verification passed.');
