import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const { ResourceIdGenerator } = await loadTypeScriptModule('../src/utilities/ResourceIdGenerator.ts');
const { ResourceStore } = await loadTypeScriptModule('../src/services/ResourceStore.ts');
const { SnapService } = await loadTypeScriptModule('../src/services/SnapService.ts');
const { positionFromPointer } = await loadTypeScriptModule('../src/services/ResourcePlacement.ts');
const { screenToWorld, worldToScreen } = await loadTypeScriptModule('../src/components/workspace/canvas/ViewportTransform.ts');
const { estimateSvgTextWidth, fitSvgText } = await loadTypeScriptModule('../src/utilities/SvgTextFit.ts');
const { RESOURCE_TEMPLATES } = await loadTypeScriptModule('../src/core/constants/resourceTemplates.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, received ${actual}`);
}

const template = {
  id: 'TPL-TEST-001',
  name: 'Test CNC',
  description: 'Test resource',
  category: 'Machines',
  resourceType: 'CNC Machine',
  icon: 'cnc',
  defaultWidth: 180,
  defaultHeight: 80,
  tags: ['test'],
  isFavourite: false,
};

assert(RESOURCE_TEMPLATES.length === 13, 'Starter resource library remains complete');
assert(RESOURCE_TEMPLATES.every((item) => item.defaultWidth === 180), 'Every starter resource has a usable default width');
assert(RESOURCE_TEMPLATES.every((item) => item.defaultHeight === 80), 'Every starter resource has a usable default height');

const ids = new ResourceIdGenerator();
assert(ids.next() === 'RES-0001', 'First resource ID is stable');
assert(ids.next() === 'RES-0002', 'Resource IDs are unique and sequential');

const store = new ResourceStore([template], new ResourceIdGenerator());
const placed = store.addResource(template.id, 100, 60);
assert(placed?.id === 'RES-0001', 'Placed resource receives a generated ID');
assert(store.getSelectedResourceId() === placed.id, 'Created resource becomes selected');

assert(store.updateResource(placed.id, { locked: true }), 'Resource can be locked');
assert(!store.moveResource(placed.id, 200, 200), 'Locked resource cannot move');
assert(!store.updateResource(placed.id, { worldX: 200 }), 'Locked resource cannot move through properties');
assert(placed.worldX === 100 && placed.worldY === 60, 'Locked movement does not corrupt coordinates');
assert(store.deleteSelected() === 'locked', 'Locked resource cannot be deleted');
assert(store.getSelectedResourceId() === placed.id, 'Locked delete preserves selection');

assert(store.updateResource(placed.id, { locked: false }), 'Resource can be unlocked');
assert(!store.updateResource(placed.id, { width: 2 }), 'Invalid size is rejected');
assert(placed.width === 180, 'Invalid property input does not corrupt the model');
assert(!store.updateResource(placed.id, { width: 99 }), 'Widths below the engineering minimum are rejected');
assert(!store.updateResource(placed.id, { height: 59 }), 'Heights below the engineering minimum are rejected');
assert(!store.updateResource(placed.id, { worldX: Number.NaN }), 'Non-finite positions are rejected');

const longName = 'Incoming Material Inspection and Verification';
const availableTextWidth = 122;
const fittedName = fitSvgText(longName, availableTextWidth, 11);
assert(fittedName.endsWith('…'), 'Long SVG labels receive an ellipsis');
assert(estimateSvgTextWidth(fittedName, 11) <= availableTextWidth, 'Fitted SVG labels stay inside the available width');
assert(fitSvgText('Operator', availableTextWidth, 11) === 'Operator', 'Complete SVG labels are preserved when they fit');
assert(fitSvgText(longName, 4, 11) === '', 'Very narrow SVG text regions fail safely');

const transform = { panX: 250, panY: 140, zoom: 2, minZoom: 0.1, maxZoom: 4 };
const dropViewport = { x: 650, y: 440 };
const dropWorld = screenToWorld(dropViewport, transform);
close(dropWorld.x, 200, 'Drop X converts to world coordinates');
close(dropWorld.y, 150, 'Drop Y converts to world coordinates');
const roundTrip = worldToScreen(dropWorld, transform);
close(roundTrip.x, dropViewport.x, 'Coordinate X round-trip');
close(roundTrip.y, dropViewport.y, 'Coordinate Y round-trip');

const pointerOffset = { x: 12.5, y: -7.5 };
const moved = positionFromPointer({ x: 240, y: 175 }, pointerOffset);
close(moved.x, 227.5, 'Pointer offset is preserved on X');
close(moved.y, 182.5, 'Pointer offset is preserved on Y');

const snap = new SnapService(20);
const snapped = snap.snapPoint({ x: 227.5, y: 182.5 });
assert(snapped.x === 220 && snapped.y === 180, 'Snapping operates in world coordinates');
const bypassed = snap.snapPoint({ x: 227.5, y: 182.5 }, true);
assert(bypassed.x === 227.5 && bypassed.y === 182.5, 'Alt-style bypass preserves unsnapped coordinates');

assert(store.deleteSelected() === 'deleted', 'Unlocked selected resource can be deleted');
assert(store.getSelectedResourceId() === null, 'Deleting selection clears selectedResourceId');
assert(store.getResourceCount() === 0, 'Deleting removes the resource');
console.log('Resource system checks passed.');
