import type { TimingCategory } from '../../models/operations/OperationTemplate';
import type { StandardWorkEntry, StandardWorkStudy } from '../../models/standardWork/StandardWork';
import type { StandardWorkChartBlock, StandardWorkChartDiagnostic, StandardWorkChartResourceLane, StandardWorkChartSchedule } from '../../models/standardWork/StandardWorkChartModels';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';

const categories = new Set<TimingCategory>(['manual', 'automatic', 'walking', 'waiting']);
const epsilon = 1e-9;

export class StandardWorkChartScheduler {
  public constructor(private readonly operations: Pick<OperationStore, 'getOperation'>, private readonly resources: Pick<ResourceStore, 'getResource'>) {}

  public calculate(study: StandardWorkStudy, entries: readonly StandardWorkEntry[]): StandardWorkChartSchedule {
    const diagnostics: StandardWorkChartDiagnostic[] = [];
    const operatorBlocks: StandardWorkChartBlock[] = [];
    const automaticBlocks: StandardWorkChartBlock[] = [];
    const disabledEntryIds = entries.filter((entry) => !entry.enabled).map((entry) => entry.id).sort();
    const ordered = entries.filter((entry) => entry.enabled).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    let operatorCursor = 0;

    for (const entry of ordered) {
      const operation = this.operations.getOperation(entry.operationId);
      if (!operation) {
        diagnostics.push({ severity: 'error', code: 'missing-operation', entryId: entry.id, operationId: entry.operationId, message: `${entry.id} references missing operation ${entry.operationId}.` });
        continue;
      }
      if (!categories.has(operation.timingCategory as TimingCategory)) {
        diagnostics.push({ severity: 'error', code: 'invalid-timing-category', entryId: entry.id, operationId: operation.id, message: `${operation.id} has an invalid timing category.` });
        continue;
      }
      const duration = operation.cycleTimeSeconds * entry.occurrences;
      if (!Number.isFinite(operation.cycleTimeSeconds) || !Number.isFinite(duration) || operation.cycleTimeSeconds < 0 || duration < 0) {
        diagnostics.push({ severity: 'error', code: 'invalid-duration', entryId: entry.id, operationId: operation.id, message: `${operation.id} has an invalid operation duration.` });
        continue;
      }
      if (duration === 0) diagnostics.push({ severity: 'warning', code: 'zero-duration', entryId: entry.id, operationId: operation.id, message: `${entry.id} has zero duration and is displayed as a marker.` });
      if (entry.occurrences > 10_000) diagnostics.push({ severity: 'warning', code: 'high-occurrences', entryId: entry.id, operationId: operation.id, message: `${entry.id} has an unusually high occurrence count (${entry.occurrences}).` });
      const automatic = operation.timingCategory === 'automatic';
      const assignedResourceId = operation.assignedResourceId;
      const laneId = automatic ? assignedResourceId ? `resource:${assignedResourceId}` : 'automatic:unassigned' : 'operator';
      const block: StandardWorkChartBlock = {
        entryId: entry.id, operationId: operation.id, timingCategory: operation.timingCategory,
        startSeconds: operatorCursor, endSeconds: operatorCursor + duration, durationSeconds: duration,
        laneId, order: entry.order, occurrences: entry.occurrences, assignedResourceId,
        enabled: true, stackIndex: 0, overlapsSameResource: false,
      };
      if (automatic) {
        automaticBlocks.push(block);
        if (!assignedResourceId) diagnostics.push({ severity: 'warning', code: 'unassigned-automatic', entryId: entry.id, operationId: operation.id, message: `${operation.id} is Automatic but has no assigned physical resource.` });
        else {
          const resource = this.resources.getResource(assignedResourceId);
          if (!resource) diagnostics.push({ severity: 'error', code: 'missing-resource', entryId: entry.id, operationId: operation.id, resourceId: assignedResourceId, message: `${operation.id} references missing physical resource ${assignedResourceId}.` });
          else if (!resource.active) diagnostics.push({ severity: 'warning', code: 'inactive-resource', entryId: entry.id, operationId: operation.id, resourceId: assignedResourceId, message: `${operation.id} uses inactive resource ${assignedResourceId}.` });
        }
      } else {
        operatorBlocks.push(block);
        operatorCursor += duration;
      }
    }

    const { lanes, blocks, overlapCount } = this.buildResourceLanes(automaticBlocks, diagnostics);
    const latestAutomaticEndSeconds = blocks.reduce((maximum, block) => Math.max(maximum, block.endSeconds), 0);
    const chartCycleSpanSeconds = Math.max(operatorCursor, latestAutomaticEndSeconds);
    const automaticOverrunSeconds = Math.max(0, latestAutomaticEndSeconds - operatorCursor);
    if (!ordered.length) diagnostics.push({ severity: 'warning', code: 'no-enabled-entries', message: `${study.id} has no enabled entries.` });
    if (automaticOverrunSeconds > epsilon) diagnostics.push({ severity: 'information', code: 'automatic-overrun', message: `Automatic processing extends ${automaticOverrunSeconds} seconds beyond the operator sequence.` });
    diagnostics.sort(compareDiagnostics);
    const sum = (category: TimingCategory, values: readonly StandardWorkChartBlock[]): number => values.filter((block) => block.timingCategory === category).reduce((total, block) => total + block.durationSeconds, 0);
    const manualSeconds = sum('manual', operatorBlocks); const walkingSeconds = sum('walking', operatorBlocks); const waitingSeconds = sum('waiting', operatorBlocks); const automaticSeconds = sum('automatic', blocks);
    const errorCount = diagnostics.filter((item) => item.severity === 'error').length; const warningCount = diagnostics.filter((item) => item.severity === 'warning').length;
    return {
      studyId: study.id, operatorBlocks, automaticBlocks: blocks, resourceLanes: lanes, disabledEntryIds,
      operatorEndSeconds: operatorCursor, latestAutomaticEndSeconds, chartCycleSpanSeconds, automaticOverrunSeconds,
      summary: {
        enabledEntryCount: ordered.length, manualSeconds, walkingSeconds, waitingSeconds, automaticSeconds,
        operatorOccupiedSeconds: manualSeconds + walkingSeconds + waitingSeconds,
        operatorProductiveSeconds: manualSeconds + walkingSeconds,
        operatorEndSeconds: operatorCursor, latestAutomaticEndSeconds, automaticOverrunSeconds, chartCycleSpanSeconds,
        automaticLaneCount: lanes.length, potentialOverlapCount: overlapCount,
        zeroTimeEntryCount: [...operatorBlocks, ...blocks].filter((block) => block.durationSeconds === 0).length,
        errorCount, warningCount,
      },
      diagnostics,
    };
  }

  private buildResourceLanes(source: readonly StandardWorkChartBlock[], diagnostics: StandardWorkChartDiagnostic[]): { lanes: StandardWorkChartResourceLane[]; blocks: StandardWorkChartBlock[]; overlapCount: number } {
    const grouped = new Map<string, StandardWorkChartBlock[]>();
    for (const block of source) { const values = grouped.get(block.laneId) ?? []; values.push(block); grouped.set(block.laneId, values); }
    const laneIds = [...grouped.keys()].sort((left, right) => left === 'automatic:unassigned' ? 1 : right === 'automatic:unassigned' ? -1 : left.localeCompare(right));
    const lanes: StandardWorkChartResourceLane[] = []; const blocks: StandardWorkChartBlock[] = []; let overlapCount = 0;
    for (const laneId of laneIds) {
      const values = grouped.get(laneId)!.sort((left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds || left.entryId.localeCompare(right.entryId));
      const overlapping = new Set<string>(); let previousMaximumEnd = Number.NEGATIVE_INFINITY;
      for (const block of values) { if (block.durationSeconds > 0 && previousMaximumEnd > block.startSeconds + epsilon) overlapping.add(block.entryId); if (block.durationSeconds > 0) previousMaximumEnd = Math.max(previousMaximumEnd, block.endSeconds); }
      let nextPositiveStart = Number.POSITIVE_INFINITY;
      for (let index = values.length - 1; index >= 0; index -= 1) { const block = values[index]; if (block.durationSeconds > 0 && nextPositiveStart < block.endSeconds - epsilon) overlapping.add(block.entryId); if (block.durationSeconds > 0) nextPositiveStart = block.startSeconds; }
      const active: Array<{ end: number; stackIndex: number }> = []; const availableStacks: number[] = []; let stackCount = 0;
      for (let index = 0; index < values.length; index += 1) {
        const block = values[index];
        while (active.length && active[0].end <= block.startSeconds + epsilon) { const released = heapPop(active, (item) => item.end)!; heapPush(availableStacks, released.stackIndex, (item) => item); }
        if (block.durationSeconds === 0) { values[index] = { ...block, stackIndex: 0 }; continue; }
        overlapCount += active.length; const stackIndex = availableStacks.length ? heapPop(availableStacks, (item) => item)! : stackCount++;
        heapPush(active, { end: block.endSeconds, stackIndex }, (item) => item.end); values[index] = { ...block, stackIndex };
      }
      if (overlapping.size) {
        const resourceId = values[0]?.assignedResourceId ?? undefined;
        diagnostics.push({ severity: 'warning', code: 'potential-resource-overlap', resourceId, message: `Potential overlapping automatic demand on ${resourceId ?? 'Unassigned Automatic'}. Full capacity validation is deferred to Sprint 3.6.` });
      }
      const decorated = values.map((block) => ({ ...block, overlapsSameResource: overlapping.has(block.entryId) }));
      blocks.push(...decorated);
      const assignedResourceId = decorated[0]?.assignedResourceId ?? null; const resource = assignedResourceId ? this.resources.getResource(assignedResourceId) : undefined;
      lanes.push({ id: laneId, assignedResourceId, label: resource ? `${resource.id} — ${resource.name}` : assignedResourceId ? assignedResourceId : 'Unassigned Automatic', resourceActive: resource ? resource.active : assignedResourceId ? null : null, blocks: decorated, stackCount: Math.max(1, stackCount) });
    }
    return { lanes, blocks, overlapCount };
  }
}

function heapPush<T>(heap: T[], value: T, rank: (item: T) => number): void {
  heap.push(value); let index = heap.length - 1;
  while (index > 0) { const parent = Math.floor((index - 1) / 2); if (rank(heap[parent]) <= rank(heap[index])) break; [heap[parent], heap[index]] = [heap[index], heap[parent]]; index = parent; }
}

function heapPop<T>(heap: T[], rank: (item: T) => number): T | undefined {
  const result = heap[0]; const tail = heap.pop(); if (!heap.length || tail === undefined) return result; heap[0] = tail; let index = 0;
  while (true) { const left = index * 2 + 1; const right = left + 1; let smallest = index; if (left < heap.length && rank(heap[left]) < rank(heap[smallest])) smallest = left; if (right < heap.length && rank(heap[right]) < rank(heap[smallest])) smallest = right; if (smallest === index) break; [heap[index], heap[smallest]] = [heap[smallest], heap[index]]; index = smallest; }
  return result;
}

function compareDiagnostics(left: StandardWorkChartDiagnostic, right: StandardWorkChartDiagnostic): number {
  const rank = { error: 0, warning: 1, information: 2 } as const;
  return rank[left.severity] - rank[right.severity] || left.code.localeCompare(right.code) || (left.entryId ?? '').localeCompare(right.entryId ?? '') || (left.resourceId ?? '').localeCompare(right.resourceId ?? '');
}
