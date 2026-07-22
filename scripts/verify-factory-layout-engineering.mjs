import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';
const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-7, `${message}: expected ${expected}, received ${actual}`);

const geometry = await load('../src/services/geometry/FactoryFootprintGeometry.ts');
const { validateFactoryLayout } = await load('../src/services/FactoryLayoutValidation.ts');

const clearance = (patch = {}) => ({ enabled: false, left: 0, right: 0, top: 0, bottom: 0, category: 'general', note: '', ...patch });
const resource = (id, patch = {}) => ({ id, templateId: 'TPL-1', name: id, resourceType: 'CNC Machine', layoutId: 'factory-layout-default', worldX: 0, worldY: 0, width: 100, depth: 60, rotationDegrees: 0, clearance: clearance(), active: true, visible: true, locked: false, selected: false, capacity: 1, ...patch });

const corners = geometry.footprintPolygon(resource('RES-0001', { rotationDegrees: 90 }));
close(corners[0].x, 30, '90 degree rotation transforms the first corner X'); close(corners[0].y, -50, '90 degree rotation transforms the first corner Y');
const aabb = geometry.polygonAabb(corners); close(aabb.maxX - aabb.minX, 60, 'Rotated AABB width'); close(aabb.maxY - aabb.minY, 100, 'Rotated AABB depth');

const asymmetric = resource('RES-0002', { worldX: 10, worldY: 20, rotationDegrees: 90, clearance: clearance({ enabled: true, left: 10, right: 30, top: 5, bottom: 15, category: 'maintenance' }) });
const clearanceBounds = geometry.polygonAabb(geometry.clearancePolygon(asymmetric)); close(clearanceBounds.maxX - clearanceBounds.minX, 80, 'Rotated asymmetric clearance AABB width'); close(clearanceBounds.maxY - clearanceBounds.minY, 140, 'Rotated asymmetric clearance AABB depth');

const touching = [resource('RES-0010'), resource('RES-0011', { worldX: 100 })];
assert(validateFactoryLayout(touching).issues.length === 0, 'Touching footprint edges do not count as overlap');
const overlapping = validateFactoryLayout([resource('RES-0020'), resource('RES-0021', { worldX: 99 })]);
assert(overlapping.issues.filter((issue) => issue.type === 'footprint-overlap').length === 1, 'Positive footprint penetration creates one unordered-pair error');
const rotatedOverlap = validateFactoryLayout([resource('RES-0030', { rotationDegrees: 45 }), resource('RES-0031', { worldX: 60, rotationDegrees: -25 })]);
assert(rotatedOverlap.issues.some((issue) => issue.type === 'footprint-overlap'), 'SAT detects rotated footprint overlap');
const clearanceOnly = validateFactoryLayout([resource('RES-0040', { clearance: clearance({ enabled: true, right: 50 }) }), resource('RES-0041', { worldX: 130 })]);
assert(clearanceOnly.issues.some((issue) => issue.type === 'clearance-footprint') && !clearanceOnly.issues.some((issue) => issue.type === 'footprint-overlap'), 'Clearance-to-footprint is a separate warning');
const clearancePair = validateFactoryLayout([resource('RES-0050', { worldX: -80, clearance: clearance({ enabled: true, right: 50 }) }), resource('RES-0051', { worldX: 80, clearance: clearance({ enabled: true, left: 50 }) })]);
assert(clearancePair.issues.some((issue) => issue.type === 'clearance-overlap'), 'Clearance-to-clearance overlap is classified independently');
assert(validateFactoryLayout([resource('RES-0060'), resource('RES-0061', { worldX: 10, visible: false })]).issues.length === 0, 'Hidden resources are excluded from overlap checks');
assert(!validateFactoryLayout([resource('RES-0070', { active: false }), resource('RES-0071', { worldX: 10 })]).issues.some((issue) => issue.type === 'footprint-overlap'), 'Inactive resources do not create hard footprint errors');
const summary = validateFactoryLayout([resource('RES-0080'), resource('RES-0081', { worldX: 200, width: 200, depth: 100, clearance: clearance({ enabled: true, left: 10 }) })]);
assert(summary.total === 2 && summary.active === 2 && summary.clearanceEnabled === 1 && summary.footprintArea === 26000, 'Layout summary reports counts and active footprint area'); assert(summary.footprintExtents && summary.clearanceExtents, 'Layout summary reports footprint and clearance extents');

console.log('Factory footprint, rotation, clearance, overlap, and summary checks passed.');
