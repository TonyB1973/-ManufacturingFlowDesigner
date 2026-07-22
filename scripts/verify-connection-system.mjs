import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleCache = new Map();
async function loadTypeScriptModule(relativePath) {
  const url = new URL(relativePath, import.meta.url); const key = url.href; if (moduleCache.has(key)) return import(moduleCache.get(key));
  const source = await readFile(url, 'utf8'); let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const matches = [...compiled.matchAll(/from\s+['"](\.[^'"]+)['"]/g)];
  for (const match of matches) { const specifier = match[1]; const sourceSpecifier = specifier.endsWith('.js') ? specifier.replace(/\.js$/, '.ts') : `${specifier}.ts`; const dependency = new URL(sourceSpecifier, url); const dependencySource = await readFile(dependency, 'utf8'); let dependencyCompiled = ts.transpileModule(dependencySource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText; const nested = [...dependencyCompiled.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]; if (nested.length) throw new Error(`Nested runtime import unsupported in ${dependency.pathname}`); const dataUrl = `data:text/javascript;base64,${Buffer.from(dependencyCompiled).toString('base64')}`; compiled = compiled.replaceAll(`from '${specifier}'`, `from '${dataUrl}'`).replaceAll(`from "${specifier}"`, `from "${dataUrl}"`); }
  const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`; moduleCache.set(key, dataUrl); return import(dataUrl);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function close(actual, expected, message) { assert(Math.abs(actual - expected) < 1e-7, `${message}: expected ${expected}, received ${actual}`); }

const anchors = await loadTypeScriptModule('../src/services/ConnectionAnchors.ts');
const router = await loadTypeScriptModule('../src/services/OrthogonalRouter.ts');
const { ConnectionIdGenerator } = await loadTypeScriptModule('../src/utilities/ConnectionIdGenerator.ts');
const { SelectionStore } = await loadTypeScriptModule('../src/services/SelectionStore.ts');
const { ConnectionStore } = await loadTypeScriptModule('../src/services/ConnectionStore.ts');
const validation = await loadTypeScriptModule('../src/services/ConnectionValidation.ts');

const geometry = { worldX: 100, worldY: 80, width: 200, height: 100 };
assert(anchors.nearestOperationAnchor(geometry, { x: 205, y: 80 }).side === 'right', 'Nearest right side is detected');
assert(anchors.nearestOperationAnchor(geometry, { x: 100, y: 20 }).side === 'top', 'Nearest top side is detected');
const cornerAnchor = anchors.nearestOperationAnchor(geometry, { x: 0, y: 30 }, 20); assert(cornerAnchor.offset >= 0.1, 'Anchor offset is clamped away from corners');
const rightAnchor = { side: 'right', offset: 0.25 }; const beforeResize = anchors.anchorWorldPosition(geometry, rightAnchor); const afterResize = anchors.anchorWorldPosition({ ...geometry, width: 300, height: 200 }, rightAnchor); close(beforeResize.x, 200, 'Anchor world X follows original width'); close(afterResize.x, 250, 'Anchor world X follows resized width'); close(afterResize.y, 30, 'Normalized anchor offset follows resized height');

const horizontal = router.routeOrthogonal({ source: { x: 0, y: 0 }, sourceDirection: { x: 1, y: 0 }, target: { x: 100, y: 0 }, targetDirection: { x: -1, y: 0 }, obstacles: [] }); assert(horizontal.points.length === 2 && horizontal.bends === 0, 'Straight horizontal route has no bends');
const vertical = router.routeOrthogonal({ source: { x: 0, y: 0 }, sourceDirection: { x: 0, y: 1 }, target: { x: 0, y: 100 }, targetDirection: { x: 0, y: -1 }, obstacles: [] }); assert(vertical.points.length === 2, 'Straight vertical route is produced');
const oneBend = router.routeOrthogonal({ source: { x: 0, y: 0 }, sourceDirection: { x: 1, y: 0 }, target: { x: 100, y: 100 }, targetDirection: { x: 0, y: -1 }, obstacles: [] }); assert(oneBend.bends === 1, 'One-bend route is preferred when valid');
const dogleg = router.routeOrthogonal({ source: { x: 0, y: 0 }, sourceDirection: { x: 1, y: 0 }, target: { x: 100, y: 100 }, targetDirection: { x: 1, y: 0 }, obstacles: [] }); assert(dogleg.bends >= 2, 'Dogleg route preserves opposing side requirements');
const avoided = router.routeOrthogonal({ source: { x: 0, y: 0 }, sourceDirection: { x: 1, y: 0 }, target: { x: 100, y: 0 }, targetDirection: { x: -1, y: 0 }, obstacles: [{ left: 40, top: -20, right: 60, bottom: 20 }], clearance: 12 }); assert(avoided.points.length >= 4 && !avoided.fallback, 'Blocking operation produces a clear obstacle-avoiding route');
assert(avoided.points.every((point, index) => index === 0 || point.x === avoided.points[index - 1].x || point.y === avoided.points[index - 1].y), 'Obstacle route contains only orthogonal segments');
const simplified = router.simplifyRoute([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }]); assert(simplified.length === 3, 'Duplicate and collinear points are removed'); assert(router.routeLength(simplified) === 40 && router.routeBendCount(simplified) === 1, 'Route metrics are deterministic');
const fallback = router.routeOrthogonal({ source: { x: 0, y: 0 }, sourceDirection: { x: 1, y: 0 }, target: { x: 100, y: 0 }, targetDirection: { x: -1, y: 0 }, obstacles: [{ left: -20, top: -20, right: 20, bottom: 20 }], clearance: 12 }); assert(fallback.fallback && fallback.points.length >= 2, 'Unsafe geometry returns a visible fallback route warning');

const operation = (id, sequence, x) => ({ id, templateId: 'op-cut', name: id, operationType: 'Fabrication', timingCategory: 'manual', cycleTimeSeconds: 30, sequence, assignedResourceId: null, notes: '', worldX: x, worldY: 0, width: 100, height: 60, selected: false, locked: false, visible: true });
const operationMap = new Map([['OP-A', operation('OP-A', 10, 0)], ['OP-B', operation('OP-B', 20, 200)], ['OP-C', operation('OP-C', 30, 400)], ['OP-D', operation('OP-D', 40, 600)]]);
const selection = new SelectionStore(); const ids = new ConnectionIdGenerator(); assert(ids.next() === 'CON-0001' && ids.next() === 'CON-0002', 'Connection IDs are readable, unique, and sequential');
const routeProvider = (connection) => { const source = operationMap.get(connection.sourceOperationId); const target = operationMap.get(connection.targetOperationId); return { points: [anchors.anchorWorldPosition(source, connection.sourceAnchor), anchors.anchorWorldPosition(target, connection.targetAnchor)], status: 'clear' }; };
const store = new ConnectionStore(new ConnectionIdGenerator(), (id) => operationMap.get(id), routeProvider, selection); const sourceAnchor = { side: 'right', offset: 0.5 }; const targetAnchor = { side: 'left', offset: 0.5 };
assert(store.createConnection('OP-A', 'OP-A', sourceAnchor, targetAnchor).result === 'self', 'Self-connections are rejected'); const created = store.createConnection('OP-A', 'OP-B', sourceAnchor, targetAnchor); assert(created.result === 'created' && created.connection.id === 'CON-0001', 'Valid connection is created with stable ID'); assert(store.createConnection('OP-A', 'OP-B', sourceAnchor, targetAnchor).result === 'duplicate', 'Duplicate Standard connection is rejected');
const reverseBlock = store.createConnection('OP-B', 'OP-A', sourceAnchor, targetAnchor); assert(reverseBlock.result === 'created', 'Reverse-direction connection may be independently created'); assert(store.reverseConnection(created.connection.id) === 'duplicate', 'Reversal rejects a duplicate Standard connection'); store.deleteConnection(reverseBlock.connection.id); assert(store.reverseConnection(created.connection.id) === 'updated', 'Reversal swaps source and target'); assert(created.connection.sourceOperationId === 'OP-B' && created.connection.targetOperationId === 'OP-A', 'Reversal state is correct');
store.updateConnection(created.connection.id, { locked: true }); assert(store.deleteConnection(created.connection.id) === 'locked' && store.reverseConnection(created.connection.id) === 'locked', 'Locked connection cannot be deleted or reversed'); store.updateConnection(created.connection.id, { locked: false });
selection.setWorkspace('factoryLayout'); selection.select({ kind: 'resource', id: 'RES-1' }); assert(selection.getSelection().kind === 'resource', 'Factory Layout resource selection kind is supported'); selection.setWorkspace('processFlow'); selection.select({ kind: 'operation', id: 'OP-A' }); assert(selection.getSelection().kind === 'operation', 'Process Flow operation selection kind is supported'); store.selectConnection(created.connection.id); assert(selection.getSelection().kind === 'connection' && created.connection.selected, 'Connection selection clears other kinds'); selection.clear(); assert(selection.getSelection().kind === 'none', 'None selection kind is supported');
store.deleteForOperation('OP-A'); assert(store.getConnectionCount() === 0, 'Deleting an operation removes attached connections');

const validConnections = [
  { id: 'CON-A', sourceOperationId: 'OP-A', targetOperationId: 'OP-B', sourceAnchor, targetAnchor, routePoints: [{ x: 50, y: 0 }, { x: 150, y: 0 }], label: '', connectionType: 'Standard', selected: false, visible: true, locked: false, routeStatus: 'clear' },
  { id: 'CON-B', sourceOperationId: 'OP-B', targetOperationId: 'OP-C', sourceAnchor, targetAnchor, routePoints: [{ x: 250, y: 0 }, { x: 350, y: 0 }], label: '', connectionType: 'Standard', selected: false, visible: true, locked: false, routeStatus: 'clear' },
];
let result = validation.validateProcessConnections([...operationMap.values()].slice(0, 3), validConnections); assert(result.errors === 0 && result.topology.startOperationIds[0] === 'OP-A' && result.topology.endOperationIds[0] === 'OP-C', 'Start and end candidates are calculated');
const cycleConnections = [...validConnections, { ...validConnections[0], id: 'CON-C', sourceOperationId: 'OP-C', targetOperationId: 'OP-A', routePoints: [{ x: 450, y: 0 }, { x: -50, y: 0 }] }]; result = validation.validateProcessConnections([...operationMap.values()].slice(0, 3), cycleConnections); assert(result.topology.hasCycle && result.issues.some((issue) => issue.code === 'directed-cycle'), 'Directed cycle is detected as a warning');
result = validation.validateProcessConnections([...operationMap.values()], validConnections); assert(result.issues.some((issue) => issue.code === 'disconnected-sections'), 'Disconnected process sections produce a warning');
const backward = [{ ...validConnections[0], id: 'CON-D', sourceOperationId: 'OP-C', targetOperationId: 'OP-B', routePoints: [{ x: 450, y: 0 }, { x: 250, y: 0 }] }]; result = validation.validateProcessConnections([...operationMap.values()].slice(0, 3), backward); assert(result.issues.some((issue) => issue.code === 'backward-flow'), 'Backward sequence flow produces a warning');
const missing = [{ ...validConnections[0], id: 'CON-MISSING', sourceOperationId: 'MISSING', routePoints: [] }]; result = validation.validateProcessConnections([...operationMap.values()].slice(0, 2), missing); assert(result.errors >= 2 && !result.healthy, 'Missing references and invalid routes affect project health');

store.dispose(); console.log('Connection system checks passed.');
