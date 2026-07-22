import { FACTORY_ANNOTATION_LAYERS, cloneFactoryAnnotation, annotationAnchors, annotationReferences, type FactoryAnnotation, type FactoryAnnotationPatch } from '../models/factory/FactoryAnnotation';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../models/workspace/Workspace';
import type { FactoryAnnotationIdProvider } from '../utilities/FactoryAnnotationIdGenerator';

export type FactoryAnnotationChange = { readonly kind: 'created' | 'updated' | 'deleted' | 'reset'; readonly id?: string };
export type FactoryAnnotationListener = (change: FactoryAnnotationChange) => void;

export class FactoryAnnotationStore {
  private readonly annotations = new Map<string, FactoryAnnotation>();
  private readonly listeners = new Set<FactoryAnnotationListener>();
  public constructor(private readonly ids: FactoryAnnotationIdProvider) {}
  public nextId(): string { return this.ids.next(); }
  public getAnnotations(): readonly FactoryAnnotation[] { return [...this.annotations.values()]; }
  public getAnnotation(id: string): FactoryAnnotation | undefined { return this.annotations.get(id); }
  public getCount(): number { return this.annotations.size; }
  public getAttached(kind: 'resource' | 'boundary' | 'wall' | 'area' | 'aisle' | 'factoryRoute', id: string): readonly FactoryAnnotation[] { return this.getAnnotations().filter((annotation) => annotationAnchors(annotation).some((anchor) => annotationReferences(anchor, kind, id))); }
  public restoreAnnotation(value: FactoryAnnotation): boolean { const annotation = cloneFactoryAnnotation(value); if (this.annotations.has(annotation.id) || !this.valid(annotation)) return false; this.annotations.set(annotation.id, annotation); this.notify('created', annotation.id); return true; }
  public updateAnnotation(id: string, patch: FactoryAnnotationPatch): boolean { const current = this.annotations.get(id); if (!current || current.locked && !this.lockedPatchAllowed(patch)) return false; const next = { ...cloneFactoryAnnotation(current), ...patch } as FactoryAnnotation; if (!this.valid(next)) return false; this.annotations.set(id, cloneFactoryAnnotation(next)); this.notify('updated', id); return true; }
  public deleteAnnotation(id: string, includeLocked = false): boolean { const value = this.annotations.get(id); if (!value || value.locked && !includeLocked) return false; this.annotations.delete(id); this.notify('deleted', id); return true; }
  public replaceAll(values: readonly FactoryAnnotation[], notify = true): void { this.annotations.clear(); for (const value of values) this.annotations.set(value.id, cloneFactoryAnnotation(value)); this.ids.ensureAfter(values.map((value) => value.id)); if (notify) this.publishReset(); }
  public publishReset(): void { for (const listener of this.listeners) listener({ kind: 'reset' }); }
  public subscribe(listener: FactoryAnnotationListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private valid(value: FactoryAnnotation): boolean { return /^ANN-\d+$/.test(value.id) && value.layoutId === DEFAULT_FACTORY_LAYOUT_ID && FACTORY_ANNOTATION_LAYERS.includes(value.layer) && typeof value.visible === 'boolean' && typeof value.locked === 'boolean' && value.note.length <= 10000 && Number.isFinite(Date.parse(value.createdUtc)); }
  private lockedPatchAllowed(patch: FactoryAnnotationPatch): boolean { return Object.keys(patch).every((key) => key === 'visible' || key === 'locked'); }
  private notify(kind: FactoryAnnotationChange['kind'], id: string): void { for (const listener of this.listeners) listener({ kind, id }); }
}

export const factoryAnnotationSnapshot = (store: FactoryAnnotationStore): readonly FactoryAnnotation[] => store.getAnnotations().map(cloneFactoryAnnotation);
