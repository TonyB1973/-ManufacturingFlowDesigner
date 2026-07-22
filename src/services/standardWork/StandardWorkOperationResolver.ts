import type { OperationInstance } from '../../models/operations/OperationInstance';
import type { StandardWorkEntry } from '../../models/standardWork/StandardWork';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';

export interface ResolvedStandardWorkEntry {
  readonly entry: StandardWorkEntry;
  readonly operation: OperationInstance | null;
  readonly operationName: string;
  readonly operationSequence: number | null;
  readonly operationType: string;
  readonly timingCategory: OperationInstance['timingCategory'] | null;
  readonly baseCycleTimeSeconds: number | null;
  readonly effectiveDurationSeconds: number | null;
  readonly assignedResource: string;
}

export class StandardWorkOperationResolver {
  public constructor(private readonly operations: OperationStore, private readonly resources: ResourceStore) {}
  public resolve(entry: StandardWorkEntry): ResolvedStandardWorkEntry {
    const operation = this.operations.getOperation(entry.operationId) ?? null; const resource = operation?.assignedResourceId ? this.resources.getResource(operation.assignedResourceId) : undefined;
    return { entry, operation, operationName: operation?.name ?? 'Missing operation', operationSequence: operation?.sequence ?? null, operationType: operation?.operationType ?? 'Unknown', timingCategory: operation?.timingCategory ?? null, baseCycleTimeSeconds: operation?.cycleTimeSeconds ?? null, effectiveDurationSeconds: operation ? operation.cycleTimeSeconds * entry.occurrences : null, assignedResource: resource ? `${resource.id} — ${resource.name}` : 'Unassigned' };
  }
}
