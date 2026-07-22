import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';
const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-7, `${message}: expected ${expected}, received ${actual}`);

const geometry = await load('../src/services/geometry/FactoryStructureGeometry.ts');
const { FactoryStructureIdGenerator } = await load('../src/utilities/FactoryStructureIdGenerator.ts');
const { FactoryStructureStore } = await load('../src/services/FactoryStructureStore.ts');
const { validateFactoryStructure } = await load('../src/services/FactoryStructureValidation.ts');

const rectangle = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }];
const valid = geometry.validateOrthogonalPolygon(rectangle);
assert(valid.valid && valid.points.length === 4, 'A rectangular boundary is valid');
close(geometry.polygonArea(rectangle), 800000, 'Boundary area');
assert(geometry.pointInPolygon({ x: 500, y: 500 }, rectangle), 'Point inside boundary is detected');
assert(!geometry.pointInPolygon({ x: 1200, y: 500 }, rectangle), 'Point outside boundary is detected');
assert(geometry.pointInPolygon({ x: 0, y: 200 }, rectangle), 'Boundary edge touch is included');
assert(!geometry.validateOrthogonalPolygon([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 20 }, { x: 0, y: 0 }]).valid, 'Diagonal boundary edges are rejected');
assert(!geometry.validateOrthogonalPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 50, y: 100 }, { x: 50, y: -50 }, { x: 0, y: -50 }]).valid, 'Self-intersecting boundaries are rejected');
const simplified = geometry.validateOrthogonalPolygon([{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }]);
assert(simplified.valid && simplified.points.length === 4, 'Redundant collinear boundary vertices are simplified');

const ids = ['BND', 'WALL', 'AREA', 'AISLE'].map((prefix) => new FactoryStructureIdGenerator(prefix));
const store = new FactoryStructureStore(...ids);
const boundary = store.createBoundary(rectangle);
assert(boundary?.id === 'BND-0001' && !store.createBoundary(rectangle), 'Only one boundary is created with a stable ID');
const wall = store.createWall({ x: 500, y: 0 }, { x: 500, y: 800 }, 40);
assert(wall?.id === 'WALL-0001', 'Wall receives a typed ID'); close(geometry.wallLength(wall), 800, 'Wall length');
assert(!store.createWall({ x: 0, y: 0 }, { x: 100, y: 100 }, 20), 'Diagonal walls are rejected');
const area = store.createArea(200, 200, 200, 150, 'Restricted');
assert(area?.id === 'AREA-0001' && area.resourcePlacementPolicy === 'Prohibited', 'Restricted areas prohibit resource placement by default');
const aisle = store.createAisle([{ x: 100, y: 600 }, { x: 900, y: 600 }], 80);
assert(aisle?.id === 'AISLE-0001', 'Aisle receives a typed ID'); close(geometry.polylineLength(aisle.points), 800, 'Aisle centre-line length');
assert(!store.createAisle([{ x: 0, y: 0 }, { x: 20, y: 20 }], 50), 'Diagonal aisles are rejected');

const clearance = { enabled: false, left: 0, right: 0, top: 0, bottom: 0, category: 'general', note: '' };
const resource = (id, patch = {}) => ({ id, templateId: 'TPL-1', name: id, resourceType: 'CNC Machine', layoutId: 'factory-layout-default', worldX: 200, worldY: 200, width: 100, depth: 100, rotationDegrees: 0, clearance: { ...clearance }, active: true, visible: true, locked: false, selected: false, capacity: 1, ...patch });
let health = validateFactoryStructure([resource('RES-AREA')], store);
assert(health.issues.some((issue) => issue.type === 'resource-area-policy' && issue.severity === 'error'), 'Restricted area collision is an error');
health = validateFactoryStructure([resource('RES-WALL', { worldX: 500, worldY: 300 })], store);
assert(health.issues.some((issue) => issue.type === 'resource-wall' && issue.severity === 'error'), 'Active resource wall collision is an error');
health = validateFactoryStructure([resource('RES-CLEARANCE', { worldX: 420, worldY: 300, clearance: { ...clearance, enabled: true, right: 50 } })], store);
assert(health.issues.some((issue) => issue.type === 'clearance-wall' && issue.severity === 'warning'), 'Clearance-to-wall collision is a warning');
health = validateFactoryStructure([resource('RES-AISLE', { worldX: 300, worldY: 600 })], store);
assert(health.issues.some((issue) => issue.type === 'aisle-resource' && issue.severity === 'warning'), 'General aisle obstruction is a warning');
store.updateAisle(aisle.id, { aisleType: 'Emergency' });
health = validateFactoryStructure([resource('RES-EMERGENCY', { worldX: 300, worldY: 600 })], store);
assert(health.issues.some((issue) => issue.type === 'aisle-resource' && issue.severity === 'error'), 'Emergency aisle obstruction is an error');
assert(health.boundaryArea === 800000 && health.wallCount === 1 && health.areaCount === 1 && health.aisleCount === 1, 'Factory structure summary is deterministic');

store.replaceAll([], [{ ...wall, id: 'WALL-0099' }], [], [], false);
assert(store.createWall({ x: 0, y: 0 }, { x: 0, y: 100 }, 10)?.id === 'WALL-0100', 'ID generation resumes after restored IDs');
console.log('Factory boundary, wall, area, aisle, validation, and stable-ID checks passed.');
