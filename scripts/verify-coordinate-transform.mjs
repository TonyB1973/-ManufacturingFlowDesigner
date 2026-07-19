import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourceUrl = new URL('../src/components/workspace/canvas/ViewportTransform.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const { clampZoom, screenToWorld, worldToScreen, zoomAroundPoint } = await import(moduleUrl);

const epsilon = 1e-9;
const close = (actual, expected, label) => {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
};

const state = { panX: 250, panY: 160, zoom: 1.75, minZoom: 0.1, maxZoom: 4 };
const world = { x: 125.35, y: -42.8 };
const screen = worldToScreen(world, state);
close(screen.x, 469.3625, 'world-to-screen X');
close(screen.y, 85.1, 'world-to-screen Y');

const roundTrip = screenToWorld(screen, state);
close(roundTrip.x, world.x, 'round-trip X');
close(roundTrip.y, world.y, 'round-trip Y');

const anchor = { x: 511, y: 297 };
const worldBeforeZoom = screenToWorld(anchor, state);
zoomAroundPoint(state, 3.2, anchor);
const worldAfterZoom = screenToWorld(anchor, state);
close(worldAfterZoom.x, worldBeforeZoom.x, 'cursor-centred zoom X');
close(worldAfterZoom.y, worldBeforeZoom.y, 'cursor-centred zoom Y');

close(clampZoom(0.01, 0.1, 4), 0.1, 'minimum zoom clamp');
close(clampZoom(8, 0.1, 4), 4, 'maximum zoom clamp');
console.log('Coordinate transform checks passed.');

