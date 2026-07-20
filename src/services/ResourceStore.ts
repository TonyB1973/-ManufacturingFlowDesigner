import type { PlacedResource, PlacedResourcePatch } from '../models/resources/PlacedResource';
import type { ResourceTemplate } from '../models/resources/ResourceTemplate';
import type { ResourceIdProvider } from '../utilities/ResourceIdGenerator';
import type { SelectionController } from '../models/selection/Selection';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../models/workspace/Workspace';

export const MIN_RESOURCE_WIDTH = 100;
export const MIN_RESOURCE_HEIGHT = 60;

export type ResourceStoreChange =
  | { readonly kind: 'created'; readonly resource: PlacedResource }
  | { readonly kind: 'updated'; readonly resource: PlacedResource }
  | { readonly kind: 'deleted'; readonly resourceId: string }
  | { readonly kind: 'selection'; readonly resourceId: string | null }
  | { readonly kind: 'template'; readonly templateId: string }
  | { readonly kind: 'reset' };

export type ResourceStoreListener = (change: ResourceStoreChange) => void;
export type DeleteResult = 'deleted' | 'locked' | 'none';

class LocalSelectionController implements SelectionController {
  private selection: ReturnType<SelectionController['getSelection']> = { kind: 'none' };
  private readonly listeners = new Set<Parameters<SelectionController['subscribe']>[0]>();
  public getSelection(): ReturnType<SelectionController['getSelection']> { return this.selection; }
  public select(selection: Parameters<SelectionController['select']>[0]): void { this.selection = selection; this.notify(); }
  public clear(): void { this.selection = { kind: 'none' }; this.notify(); }
  public subscribe(listener: Parameters<SelectionController['subscribe']>[0]): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(this.selection); }
}

export class ResourceStore {
  private readonly templateMap: Map<string, ResourceTemplate>;
  private readonly resources = new Map<string, PlacedResource>();
  private readonly listeners = new Set<ResourceStoreListener>();
  private readonly selection: SelectionController;
  private readonly unsubscribeSelection: () => void;

  public constructor(templates: readonly ResourceTemplate[], private readonly idProvider: ResourceIdProvider, selection?: SelectionController) {
    this.templateMap = new Map(templates.map((template) => [template.id, { ...template, tags: [...template.tags] }]));
    this.selection = selection ?? new LocalSelectionController();
    this.unsubscribeSelection = this.selection.subscribe(() => this.syncSelection());
  }

  public getTemplates(): readonly ResourceTemplate[] {
    return [...this.templateMap.values()];
  }

  public getPlacedResources(): readonly PlacedResource[] {
    return [...this.resources.values()];
  }

  public getResource(id: string): PlacedResource | undefined {
    return this.resources.get(id);
  }

  public getTemplate(id: string): ResourceTemplate | undefined { return this.templateMap.get(id); }
  public getAssignableResources(): readonly PlacedResource[] { return this.getPlacedResources().filter((resource) => resource.active && resource.layoutId === DEFAULT_FACTORY_LAYOUT_ID); }

  public getSelectedResource(): PlacedResource | null {
    const selected = this.selection.getSelection();
    return selected.kind === 'resource' ? this.resources.get(selected.id) ?? null : null;
  }

  public getSelectedResourceId(): string | null {
    const selected = this.selection.getSelection();
    return selected.kind === 'resource' ? selected.id : null;
  }

  public getResourceCount(): number {
    return this.resources.size;
  }

  public addResource(templateId: string, worldX: number, worldY: number): PlacedResource | null {
    const template = this.templateMap.get(templateId);
    if (!template || !Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
    const resource: PlacedResource = {
      id: this.idProvider.next(),
      templateId: template.id,
      name: template.name,
      resourceType: template.resourceType,
      layoutId: DEFAULT_FACTORY_LAYOUT_ID,
      worldX,
      worldY,
      width: template.defaultWidth,
      height: template.defaultHeight,
      rotationDegrees: 0,
      active: true,
      selected: false,
      locked: false,
      visible: true,
      capacity: 1,
    };
    this.resources.set(resource.id, resource);
    this.notify({ kind: 'created', resource });
    this.selection.select({ kind: 'resource', id: resource.id });
    return resource;
  }

  public duplicateResource(resourceId: string, offset = 20): PlacedResource | null {
    const original = this.resources.get(resourceId); if (!original) return null;
    const base = original.name.replace(/\s+#\d+$/, ''); const siblings = [...this.resources.values()].filter((resource) => resource.templateId === original.templateId);
    const duplicate: PlacedResource = { ...original, id: this.idProvider.next(), name: `${base} #${siblings.length + 1}`, worldX: original.worldX + offset, worldY: original.worldY + offset, selected: false, locked: false };
    this.resources.set(duplicate.id, duplicate); this.notify({ kind: 'created', resource: duplicate }); this.selection.select({ kind: 'resource', id: duplicate.id }); return duplicate;
  }

  public selectResource(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;
    if (resource.selected) return true;
    this.selection.select({ kind: 'resource', id: resourceId });
    return true;
  }

  public clearSelection(_notify = true): void {
    if (this.selection.getSelection().kind === 'resource') this.selection.clear();
  }

  public moveResource(resourceId: string, worldX: number, worldY: number): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.locked || !Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
    resource.worldX = worldX;
    resource.worldY = worldY;
    this.notify({ kind: 'updated', resource });
    return true;
  }

  public updateResource(resourceId: string, patch: PlacedResourcePatch): boolean {
    const resource = this.resources.get(resourceId);
    const changesPosition = patch.worldX !== undefined || patch.worldY !== undefined;
    if (!resource || (resource.locked && changesPosition) || !this.isValidPatch(patch)) return false;
    Object.assign(resource, patch);
    this.notify({ kind: 'updated', resource });
    return true;
  }

  public deleteSelected(): DeleteResult {
    const resource = this.getSelectedResource();
    if (!resource) return 'none';
    return this.deleteResource(resource.id);
  }

  public deleteResource(resourceId: string): DeleteResult { const resource = this.resources.get(resourceId); if (!resource) return 'none'; if (resource.locked) return 'locked'; this.resources.delete(resourceId); if (this.getSelectedResourceId() === resourceId) this.selection.clear(); this.notify({ kind: 'deleted', resourceId }); return 'deleted'; }

  public toggleFavourite(templateId: string): boolean | null {
    const template = this.templateMap.get(templateId);
    if (!template) return null;
    template.isFavourite = !template.isFavourite;
    this.notify({ kind: 'template', templateId });
    return template.isFavourite;
  }

  public subscribe(listener: ResourceStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public replaceAll(templates: readonly ResourceTemplate[], resources: readonly PlacedResource[], notify = true): void {
    this.templateMap.clear();
    templates.forEach((template) => this.templateMap.set(template.id, { ...template, tags: [...template.tags] }));
    this.resources.clear();
    resources.forEach((resource) => this.resources.set(resource.id, { ...resource, selected: false }));
    if (notify) this.publishReset();
  }

  public publishReset(): void { this.notify({ kind: 'reset' }); }

  public dispose(): void { this.unsubscribeSelection(); }

  private syncSelection(): void {
    const selected = this.selection.getSelection();
    for (const resource of this.resources.values()) resource.selected = selected.kind === 'resource' && selected.id === resource.id;
    this.notify({ kind: 'selection', resourceId: selected.kind === 'resource' ? selected.id : null });
  }

  private isValidPatch(patch: PlacedResourcePatch): boolean {
    if (patch.name !== undefined && patch.name.trim().length === 0) return false;
    for (const value of [patch.worldX, patch.worldY]) {
      if (value !== undefined && !Number.isFinite(value)) return false;
    }
    if (patch.width !== undefined && (!Number.isFinite(patch.width) || patch.width < MIN_RESOURCE_WIDTH)) return false;
    if (patch.height !== undefined && (!Number.isFinite(patch.height) || patch.height < MIN_RESOURCE_HEIGHT)) return false;
    if (patch.rotationDegrees !== undefined && !Number.isFinite(patch.rotationDegrees)) return false;
    if (patch.capacity !== undefined && (!Number.isInteger(patch.capacity) || patch.capacity < 1)) return false;
    if (patch.layoutId !== undefined && !patch.layoutId.trim()) return false;
    return true;
  }

  private notify(change: ResourceStoreChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
