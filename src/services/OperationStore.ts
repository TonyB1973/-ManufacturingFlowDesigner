import type { OperationInstance, OperationInstancePatch } from '../models/operations/OperationInstance';
import type { OperationTemplate } from '../models/operations/OperationTemplate';
import type { SelectionController } from '../models/selection/Selection';
import type { OperationIdProvider } from '../utilities/OperationIdGenerator';

export const DEFAULT_OPERATION_WIDTH = 210;
export const DEFAULT_OPERATION_HEIGHT = 100;
export const MIN_OPERATION_WIDTH = 150;
export const MIN_OPERATION_HEIGHT = 82;

export type OperationStoreChange =
  | { readonly kind: 'created'; readonly operation: OperationInstance }
  | { readonly kind: 'updated'; readonly operation: OperationInstance }
  | { readonly kind: 'deleted'; readonly operationId: string }
  | { readonly kind: 'selection'; readonly operationId: string | null }
  | { readonly kind: 'validation' };

export type OperationStoreListener = (change: OperationStoreChange) => void;
export type OperationDeleteResult = 'deleted' | 'locked' | 'none';

class LocalSelectionController implements SelectionController {
  private selection: ReturnType<SelectionController['getSelection']> = { kind: 'none' };
  private readonly listeners = new Set<Parameters<SelectionController['subscribe']>[0]>();
  public getSelection(): ReturnType<SelectionController['getSelection']> { return this.selection; }
  public select(selection: Parameters<SelectionController['select']>[0]): void { this.selection = selection; this.notify(); }
  public clear(): void { this.selection = { kind: 'none' }; this.notify(); }
  public subscribe(listener: Parameters<SelectionController['subscribe']>[0]): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(this.selection); }
}

export class OperationStore {
  private readonly templates: Map<string, OperationTemplate>;
  private readonly operations = new Map<string, OperationInstance>();
  private readonly listeners = new Set<OperationStoreListener>();
  private readonly selection: SelectionController;
  private readonly unsubscribeSelection: () => void;

  public constructor(
    templates: readonly OperationTemplate[],
    private readonly idProvider: OperationIdProvider,
    selection?: SelectionController,
  ) {
    this.templates = new Map(templates.map((template) => [template.id, { ...template, tags: [...template.tags] }]));
    this.selection = selection ?? new LocalSelectionController();
    this.unsubscribeSelection = this.selection.subscribe(() => this.syncSelection());
  }

  public getTemplates(): readonly OperationTemplate[] { return [...this.templates.values()]; }
  public getOperations(): readonly OperationInstance[] { return [...this.operations.values()]; }
  public getOperation(id: string): OperationInstance | undefined { return this.operations.get(id); }
  public getOperationCount(): number { return this.operations.size; }

  public getSelectedOperation(): OperationInstance | null {
    const selected = this.selection.getSelection();
    return selected.kind === 'operation' ? this.operations.get(selected.id) ?? null : null;
  }

  public addOperation(templateId: string, worldX: number, worldY: number): OperationInstance | null {
    const template = this.templates.get(templateId);
    if (!template || !Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
    const operation: OperationInstance = {
      id: this.idProvider.next(), templateId: template.id, name: template.name,
      operationType: template.operationType, timingCategory: template.timingCategory,
      cycleTimeSeconds: template.defaultCycleTimeSeconds, sequence: this.nextSequence(),
      assignedResourceId: null, notes: '', worldX, worldY,
      width: DEFAULT_OPERATION_WIDTH, height: DEFAULT_OPERATION_HEIGHT,
      selected: false, locked: false, visible: true,
    };
    this.operations.set(operation.id, operation);
    this.notify({ kind: 'created', operation });
    this.selection.select({ kind: 'operation', id: operation.id });
    this.notify({ kind: 'validation' });
    return operation;
  }

  public selectOperation(operationId: string): boolean {
    if (!this.operations.has(operationId)) return false;
    this.selection.select({ kind: 'operation', id: operationId });
    return true;
  }

  public moveOperation(operationId: string, worldX: number, worldY: number): boolean {
    const operation = this.operations.get(operationId);
    if (!operation || operation.locked || !Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
    operation.worldX = worldX;
    operation.worldY = worldY;
    this.notify({ kind: 'updated', operation });
    return true;
  }

  public updateOperation(operationId: string, patch: OperationInstancePatch): boolean {
    const operation = this.operations.get(operationId);
    const changesPosition = patch.worldX !== undefined || patch.worldY !== undefined;
    if (!operation || (operation.locked && changesPosition) || !this.isValidPatch(patch)) return false;
    Object.assign(operation, patch);
    this.notify({ kind: 'updated', operation });
    this.notify({ kind: 'validation' });
    return true;
  }

  public deleteSelected(): OperationDeleteResult {
    const operation = this.getSelectedOperation();
    if (!operation) return 'none';
    if (operation.locked) return 'locked';
    this.operations.delete(operation.id);
    this.selection.clear();
    this.notify({ kind: 'deleted', operationId: operation.id });
    this.notify({ kind: 'validation' });
    return 'deleted';
  }

  public normalizeSequences(): void {
    this.sortedOperations().forEach((operation, index) => {
      const sequence = (index + 1) * 10;
      if (operation.sequence === sequence) return;
      operation.sequence = sequence;
      this.notify({ kind: 'updated', operation });
    });
    this.notify({ kind: 'validation' });
  }

  public sortedOperations(): readonly OperationInstance[] {
    return [...this.operations.values()].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  }

  public handleResourceChange(resourceId: string, deleted: boolean): void {
    for (const operation of this.operations.values()) {
      if (operation.assignedResourceId !== resourceId) continue;
      if (deleted) operation.assignedResourceId = null;
      this.notify({ kind: 'updated', operation });
    }
    this.notify({ kind: 'validation' });
  }

  public subscribe(listener: OperationStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispose(): void { this.unsubscribeSelection(); }

  private nextSequence(): number {
    const maximum = Math.max(0, ...[...this.operations.values()].map((operation) => operation.sequence));
    return (Math.floor(maximum / 10) + 1) * 10;
  }

  private syncSelection(): void {
    const selected = this.selection.getSelection();
    for (const operation of this.operations.values()) operation.selected = selected.kind === 'operation' && selected.id === operation.id;
    this.notify({ kind: 'selection', operationId: selected.kind === 'operation' ? selected.id : null });
  }

  private isValidPatch(patch: OperationInstancePatch): boolean {
    if (patch.name !== undefined && patch.name.trim().length === 0) return false;
    if (patch.sequence !== undefined && (!Number.isInteger(patch.sequence) || patch.sequence <= 0)) return false;
    if (patch.cycleTimeSeconds !== undefined && (!Number.isFinite(patch.cycleTimeSeconds) || patch.cycleTimeSeconds <= 0)) return false;
    for (const value of [patch.worldX, patch.worldY]) if (value !== undefined && !Number.isFinite(value)) return false;
    if (patch.width !== undefined && (!Number.isFinite(patch.width) || patch.width < MIN_OPERATION_WIDTH)) return false;
    if (patch.height !== undefined && (!Number.isFinite(patch.height) || patch.height < MIN_OPERATION_HEIGHT)) return false;
    return true;
  }

  private notify(change: OperationStoreChange): void { for (const listener of this.listeners) listener(change); }
}
