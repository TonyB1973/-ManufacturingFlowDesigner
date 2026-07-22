import type { FactoryAisle, FactoryAislePatch } from '../models/factory/FactoryAisle';
import type { FactoryArea, FactoryAreaPatch } from '../models/factory/FactoryArea';
import { defaultPlacementPolicy } from '../models/factory/FactoryArea';
import type { FactoryLayoutBoundary, FactoryLayoutBoundaryPatch } from '../models/factory/FactoryLayoutBoundary';
import type { FactoryWall, FactoryWallPatch } from '../models/factory/FactoryWall';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../models/workspace/Workspace';
import type { FactoryStructureIdProvider } from '../utilities/FactoryStructureIdGenerator';
import { normalizeAngle } from './ResourceStore';
import { simplifyOrthogonalPolyline, validateOrthogonalPolygon, validateOrthogonalPolyline, wallLength } from './geometry/FactoryStructureGeometry';

export type FactoryStructureKind = 'boundary' | 'wall' | 'area' | 'aisle';
export type FactoryStructureChange = { readonly kind: 'created' | 'updated' | 'deleted' | 'reset'; readonly entityKind?: FactoryStructureKind; readonly id?: string };
export type FactoryStructureListener = (change: FactoryStructureChange) => void;

const cloneBoundary = (value: FactoryLayoutBoundary): FactoryLayoutBoundary => ({ ...value, points: value.points.map((point) => ({ ...point })) });
const cloneWall = (value: FactoryWall): FactoryWall => ({ ...value, start: { ...value.start }, end: { ...value.end } });
const cloneArea = (value: FactoryArea): FactoryArea => ({ ...value });
const cloneAisle = (value: FactoryAisle): FactoryAisle => ({ ...value, points: value.points.map((point) => ({ ...point })) });

export class FactoryStructureStore {
  private readonly boundaries = new Map<string, FactoryLayoutBoundary>();
  private readonly walls = new Map<string, FactoryWall>();
  private readonly areas = new Map<string, FactoryArea>();
  private readonly aisles = new Map<string, FactoryAisle>();
  private readonly listeners = new Set<FactoryStructureListener>();

  public constructor(
    private readonly boundaryIds: FactoryStructureIdProvider,
    private readonly wallIds: FactoryStructureIdProvider,
    private readonly areaIds: FactoryStructureIdProvider,
    private readonly aisleIds: FactoryStructureIdProvider,
  ) {}

  public getBoundaries(): readonly FactoryLayoutBoundary[] { return [...this.boundaries.values()]; }
  public getWalls(): readonly FactoryWall[] { return [...this.walls.values()]; }
  public getAreas(): readonly FactoryArea[] { return [...this.areas.values()]; }
  public getAisles(): readonly FactoryAisle[] { return [...this.aisles.values()]; }
  public getBoundary(id: string): FactoryLayoutBoundary | undefined { return this.boundaries.get(id); }
  public getWall(id: string): FactoryWall | undefined { return this.walls.get(id); }
  public getArea(id: string): FactoryArea | undefined { return this.areas.get(id); }
  public getAisle(id: string): FactoryAisle | undefined { return this.aisles.get(id); }
  public getActiveBoundary(layoutId = DEFAULT_FACTORY_LAYOUT_ID): FactoryLayoutBoundary | null { return this.getBoundaries().find((item) => item.layoutId === layoutId) ?? null; }

  public createBoundary(points: FactoryLayoutBoundary['points'], name = 'Factory Boundary'): FactoryLayoutBoundary | null {
    if (this.getActiveBoundary()) return null;
    const geometry = validateOrthogonalPolygon(points); if (!geometry.valid) return null;
    const boundary: FactoryLayoutBoundary = { id: this.boundaryIds.next(), layoutId: DEFAULT_FACTORY_LAYOUT_ID, name, points: geometry.points.map((point) => ({ ...point })), visible: true, locked: false, fillVisible: true, note: '' };
    return this.restoreBoundary(boundary) ? boundary : null;
  }
  public createWall(start: FactoryWall['start'], end: FactoryWall['end'], thickness = 100): FactoryWall | null {
    const wall: FactoryWall = { id: this.wallIds.next(), layoutId: DEFAULT_FACTORY_LAYOUT_ID, start: { ...start }, end: { ...end }, thickness, name: 'Wall', wallType: 'General', visible: true, locked: false, note: '' };
    return this.restoreWall(wall) ? wall : null;
  }
  public createArea(worldX: number, worldY: number, width: number, depth: number, areaType: FactoryArea['areaType'] = 'General'): FactoryArea | null {
    const area: FactoryArea = { id: this.areaIds.next(), layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: `${areaType} Area`, areaType, worldX, worldY, width, depth, rotationDegrees: 0, visible: true, locked: false, fillVisible: true, note: '', resourcePlacementPolicy: defaultPlacementPolicy(areaType) };
    return this.restoreArea(area) ? area : null;
  }
  public createAisle(points: FactoryAisle['points'], width = 1000): FactoryAisle | null {
    const aisle: FactoryAisle = { id: this.aisleIds.next(), layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Aisle', points: simplifyOrthogonalPolyline(points), width, aisleType: 'General', direction: 'Two Way', visible: true, locked: false, note: '' };
    return this.restoreAisle(aisle) ? aisle : null;
  }

  public restoreBoundary(value: FactoryLayoutBoundary): boolean { const geometry = validateOrthogonalPolygon(value.points); if (this.boundaries.has(value.id) || this.getActiveBoundary(value.layoutId) || !geometry.valid || !this.validCommon(value)) return false; this.boundaries.set(value.id, { ...cloneBoundary(value), points: geometry.points.map((point) => ({ ...point })) }); this.notify('created', 'boundary', value.id); return true; }
  public restoreWall(value: FactoryWall): boolean { if (this.walls.has(value.id) || !this.validCommon(value) || !this.validWall(value)) return false; this.walls.set(value.id, cloneWall(value)); this.notify('created', 'wall', value.id); return true; }
  public restoreArea(value: FactoryArea): boolean { if (this.areas.has(value.id) || !this.validCommon(value) || !this.validArea(value)) return false; this.areas.set(value.id, { ...cloneArea(value), rotationDegrees: normalizeAngle(value.rotationDegrees) }); this.notify('created', 'area', value.id); return true; }
  public restoreAisle(value: FactoryAisle): boolean { const points = simplifyOrthogonalPolyline(value.points); if (this.aisles.has(value.id) || !this.validCommon(value) || !this.validAisle({ ...value, points })) return false; this.aisles.set(value.id, { ...cloneAisle(value), points }); this.notify('created', 'aisle', value.id); return true; }

  public updateBoundary(id: string, patch: FactoryLayoutBoundaryPatch): boolean { const entity = this.boundaries.get(id); if (!entity || (entity.locked && patch.points !== undefined)) return false; const next = { ...cloneBoundary(entity), ...patch, points: (patch.points ?? entity.points).map((point) => ({ ...point })) }; const geometry = validateOrthogonalPolygon(next.points); if (!this.validCommon(next) || !geometry.valid) return false; Object.assign(entity, next, { points: geometry.points.map((point) => ({ ...point })) }); this.notify('updated', 'boundary', id); return true; }
  public updateWall(id: string, patch: FactoryWallPatch): boolean { const entity = this.walls.get(id); if (!entity || (entity.locked && (patch.start || patch.end || patch.thickness !== undefined))) return false; const next = { ...cloneWall(entity), ...patch, start: patch.start ? { ...patch.start } : entity.start, end: patch.end ? { ...patch.end } : entity.end }; if (!this.validCommon(next) || !this.validWall(next)) return false; Object.assign(entity, next); this.notify('updated', 'wall', id); return true; }
  public updateArea(id: string, patch: FactoryAreaPatch): boolean { const entity = this.areas.get(id); const geometric = patch.worldX !== undefined || patch.worldY !== undefined || patch.width !== undefined || patch.depth !== undefined || patch.rotationDegrees !== undefined; if (!entity || (entity.locked && geometric)) return false; const next = { ...entity, ...patch, rotationDegrees: normalizeAngle(patch.rotationDegrees ?? entity.rotationDegrees) }; if (!this.validCommon(next) || !this.validArea(next)) return false; Object.assign(entity, next); this.notify('updated', 'area', id); return true; }
  public updateAisle(id: string, patch: FactoryAislePatch): boolean { const entity = this.aisles.get(id); if (!entity || (entity.locked && (patch.points || patch.width !== undefined))) return false; const next = { ...cloneAisle(entity), ...patch, points: simplifyOrthogonalPolyline(patch.points ?? entity.points) }; if (!this.validCommon(next) || !this.validAisle(next)) return false; Object.assign(entity, next); this.notify('updated', 'aisle', id); return true; }

  public delete(kind: FactoryStructureKind, id: string): boolean {
    const map = kind === 'boundary' ? this.boundaries : kind === 'wall' ? this.walls : kind === 'area' ? this.areas : this.aisles;
    const entity = map.get(id); if (!entity || entity.locked) return false; map.delete(id); this.notify('deleted', kind, id); return true;
  }

  public replaceAll(boundaries: readonly FactoryLayoutBoundary[], walls: readonly FactoryWall[], areas: readonly FactoryArea[], aisles: readonly FactoryAisle[], notify = true): void {
    this.boundaries.clear(); this.walls.clear(); this.areas.clear(); this.aisles.clear();
    boundaries.forEach((item) => this.boundaries.set(item.id, cloneBoundary(item))); walls.forEach((item) => this.walls.set(item.id, cloneWall(item))); areas.forEach((item) => this.areas.set(item.id, cloneArea(item))); aisles.forEach((item) => this.aisles.set(item.id, cloneAisle(item)));
    this.boundaryIds.ensureAfter(boundaries.map((item) => item.id)); this.wallIds.ensureAfter(walls.map((item) => item.id)); this.areaIds.ensureAfter(areas.map((item) => item.id)); this.aisleIds.ensureAfter(aisles.map((item) => item.id)); if (notify) this.publishReset();
  }
  public publishReset(): void { for (const listener of this.listeners) listener({ kind: 'reset' }); }
  public subscribe(listener: FactoryStructureListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private validCommon(value: { readonly id: string; readonly layoutId: string; readonly name: string; readonly note: string; readonly visible: boolean; readonly locked: boolean }): boolean { return Boolean(value.id.trim() && value.layoutId.trim() && value.name.trim()) && value.name.length <= 200 && value.note.length <= 10000 && typeof value.visible === 'boolean' && typeof value.locked === 'boolean'; }
  private validWall(value: FactoryWall): boolean { return Number.isFinite(value.thickness) && value.thickness > 0 && wallLength(value) > 0 && (value.start.x === value.end.x || value.start.y === value.end.y); }
  private validArea(value: FactoryArea): boolean { return [value.worldX, value.worldY, value.width, value.depth, value.rotationDegrees].every(Number.isFinite) && value.width > 0 && value.depth > 0; }
  private validAisle(value: FactoryAisle): boolean { return Number.isFinite(value.width) && value.width > 0 && validateOrthogonalPolyline(value.points).length === 0; }
  private notify(kind: FactoryStructureChange['kind'], entityKind: FactoryStructureKind, id: string): void { for (const listener of this.listeners) listener({ kind, entityKind, id }); }
}

export const factoryStructureSnapshot = (store: FactoryStructureStore) => ({
  boundaries: store.getBoundaries().map(cloneBoundary), walls: store.getWalls().map(cloneWall), areas: store.getAreas().map(cloneArea), aisles: store.getAisles().map(cloneAisle),
});
