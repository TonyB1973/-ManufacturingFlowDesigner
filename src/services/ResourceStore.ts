import type { PlacedResource, PlacedResourcePatch } from '../models/resources/PlacedResource';
import type { ResourceTemplate } from '../models/resources/ResourceTemplate';
import type { ResourceIdProvider } from '../utilities/ResourceIdGenerator';

export const MIN_RESOURCE_SIZE = 40;

export type ResourceStoreChange =
  | { readonly kind: 'created'; readonly resource: PlacedResource }
  | { readonly kind: 'updated'; readonly resource: PlacedResource }
  | { readonly kind: 'deleted'; readonly resourceId: string }
  | { readonly kind: 'selection'; readonly resourceId: string | null }
  | { readonly kind: 'template'; readonly templateId: string };

export type ResourceStoreListener = (change: ResourceStoreChange) => void;
export type DeleteResult = 'deleted' | 'locked' | 'none';

export class ResourceStore {
  private readonly templateMap: Map<string, ResourceTemplate>;
  private readonly resources = new Map<string, PlacedResource>();
  private readonly listeners = new Set<ResourceStoreListener>();
  private selectedResourceId: string | null = null;

  public constructor(templates: readonly ResourceTemplate[], private readonly idProvider: ResourceIdProvider) {
    this.templateMap = new Map(templates.map((template) => [template.id, { ...template, tags: [...template.tags] }]));
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

  public getSelectedResource(): PlacedResource | null {
    return this.selectedResourceId ? this.resources.get(this.selectedResourceId) ?? null : null;
  }

  public getSelectedResourceId(): string | null {
    return this.selectedResourceId;
  }

  public getResourceCount(): number {
    return this.resources.size;
  }

  public addResource(templateId: string, worldX: number, worldY: number): PlacedResource | null {
    const template = this.templateMap.get(templateId);
    if (!template || !Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
    this.clearSelection(false);
    const resource: PlacedResource = {
      id: this.idProvider.next(),
      templateId: template.id,
      name: template.name,
      resourceType: template.resourceType,
      worldX,
      worldY,
      width: template.defaultWidth,
      height: template.defaultHeight,
      selected: true,
      locked: false,
      visible: true,
    };
    this.resources.set(resource.id, resource);
    this.selectedResourceId = resource.id;
    this.notify({ kind: 'created', resource });
    return resource;
  }

  public selectResource(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;
    if (this.selectedResourceId === resourceId) return true;
    this.clearSelection(false);
    resource.selected = true;
    this.selectedResourceId = resourceId;
    this.notify({ kind: 'selection', resourceId });
    return true;
  }

  public clearSelection(notify = true): void {
    if (!this.selectedResourceId) return;
    const selected = this.resources.get(this.selectedResourceId);
    if (selected) selected.selected = false;
    this.selectedResourceId = null;
    if (notify) this.notify({ kind: 'selection', resourceId: null });
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
    if (!this.selectedResourceId) return 'none';
    const resource = this.resources.get(this.selectedResourceId);
    if (!resource) {
      this.selectedResourceId = null;
      return 'none';
    }
    if (resource.locked) return 'locked';
    const resourceId = resource.id;
    this.resources.delete(resourceId);
    this.selectedResourceId = null;
    this.notify({ kind: 'deleted', resourceId });
    return 'deleted';
  }

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

  private isValidPatch(patch: PlacedResourcePatch): boolean {
    if (patch.name !== undefined && patch.name.trim().length === 0) return false;
    for (const value of [patch.worldX, patch.worldY]) {
      if (value !== undefined && !Number.isFinite(value)) return false;
    }
    for (const value of [patch.width, patch.height]) {
      if (value !== undefined && (!Number.isFinite(value) || value < MIN_RESOURCE_SIZE)) return false;
    }
    return true;
  }

  private notify(change: ResourceStoreChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
