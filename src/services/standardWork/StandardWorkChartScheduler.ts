import type { TimingCategory } from '../../models/operations/OperationTemplate';
import type { StandardWorkEntry, StandardWorkStudy } from '../../models/standardWork/StandardWork';
import type { StandardWorkHandover } from '../../models/standardWork/StandardWorkHandover';
import type { StandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';
import type { StandardWorkChartBlock, StandardWorkChartDiagnostic, StandardWorkChartHandoverLink, StandardWorkChartOperatorLane, StandardWorkChartResourceLane, StandardWorkChartSchedule } from '../../models/standardWork/StandardWorkChartModels';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';
import { calculateOperatorWorkload } from './StandardWorkOperatorWorkloadService';

const categories = new Set<TimingCategory>(['manual', 'automatic', 'walking', 'waiting']);
const epsilon = 1e-9;
type OperatorSource = { getOperators(studyId: string): readonly StandardWorkOperator[] };
type HandoverSource = { getHandovers(studyId: string): readonly StandardWorkHandover[] };

export class StandardWorkChartScheduler {
  public constructor(
    private readonly operations: Pick<OperationStore, 'getOperation'>,
    private readonly resources: Pick<ResourceStore, 'getResource'>,
    private readonly operators?: OperatorSource,
    private readonly handovers?: HandoverSource,
  ) {}

  public calculate(study: StandardWorkStudy, entries: readonly StandardWorkEntry[]): StandardWorkChartSchedule {
    const diagnostics: StandardWorkChartDiagnostic[] = [];
    const operatorBlocks: StandardWorkChartBlock[] = [];
    const automaticBlocks: StandardWorkChartBlock[] = [];
    const disabledEntryIds = entries.filter((entry) => !entry.enabled).map((entry) => entry.id).sort();
    const ordered = entries.filter((entry) => entry.enabled).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    const configuredOperators = this.operators?.getOperators(study.id) ?? [];
    const fallbackOperatorId = configuredOperators[0]?.id ?? ordered[0]?.assignedOperatorId ?? 'SWO-1';
    const laneOperators = configuredOperators.length ? configuredOperators : [{ id: fallbackOperatorId, studyId: study.id, name: 'Operator 1', role: '', displayOrder: 10, active: true, linkedResourceId: null, notes: '' }];
    const operatorById = new Map(laneOperators.map((operator) => [operator.id, operator]));
    const cursors = new Map(laneOperators.map((operator) => [operator.id, 0]));
    const handovers = [...(this.handovers?.getHandovers(study.id) ?? [])].sort((left, right) => left.id.localeCompare(right.id));
    const inbound = new Map<string, StandardWorkHandover[]>();
    for (const handover of handovers.filter((item) => item.enabled)) { const values = inbound.get(handover.toEntryId) ?? []; values.push(handover); inbound.set(handover.toEntryId, values); }
    const scheduled = new Map<string, StandardWorkChartBlock>();

    for (const entry of ordered) {
      const assignedOperatorId = entry.assignedOperatorId || fallbackOperatorId;
      const operator = operatorById.get(assignedOperatorId);
      if (!operator) {
        diagnostics.push({ severity: 'error', code: 'missing-operator', entryId: entry.id, operatorId: assignedOperatorId, message: `${entry.id} references missing operator ${assignedOperatorId}.` });
        continue;
      }
      if (!operator.active) diagnostics.push({ severity: 'warning', code: 'inactive-operator', entryId: entry.id, operatorId: operator.id, message: `${entry.id} is assigned to inactive operator ${operator.id}.` });
      const operation = this.operations.getOperation(entry.operationId);
      if (!operation) { diagnostics.push({ severity: 'error', code: 'missing-operation', entryId: entry.id, operationId: entry.operationId, message: `${entry.id} references missing operation ${entry.operationId}.` }); continue; }
      if (!categories.has(operation.timingCategory as TimingCategory)) { diagnostics.push({ severity: 'error', code: 'invalid-timing-category', entryId: entry.id, operationId: operation.id, message: `${operation.id} has an invalid timing category.` }); continue; }
      const duration = operation.cycleTimeSeconds * entry.occurrences;
      if (!Number.isFinite(operation.cycleTimeSeconds) || !Number.isFinite(duration) || operation.cycleTimeSeconds < 0 || duration < 0) { diagnostics.push({ severity: 'error', code: 'invalid-duration', entryId: entry.id, operationId: operation.id, message: `${operation.id} has an invalid operation duration.` }); continue; }
      if (duration === 0) diagnostics.push({ severity: 'warning', code: 'zero-duration', entryId: entry.id, operationId: operation.id, message: `${entry.id} has zero duration and is displayed as a marker.` });
      if (entry.occurrences > 10_000) diagnostics.push({ severity: 'warning', code: 'high-occurrences', entryId: entry.id, operationId: operation.id, message: `${entry.id} has an unusually high occurrence count (${entry.occurrences}).` });
      let dependencyReleaseSeconds = 0;
      for (const handover of inbound.get(entry.id) ?? []) {
        const source = scheduled.get(handover.fromEntryId);
        if (source) dependencyReleaseSeconds = Math.max(dependencyReleaseSeconds, source.endSeconds);
        else diagnostics.push({ severity: 'error', code: 'unscheduled-handover-source', entryId: entry.id, handoverId: handover.id, message: `${handover.id} has no scheduled source block.` });
      }
      const cursor = cursors.get(operator.id) ?? 0;
      const startSeconds = Math.max(cursor, dependencyReleaseSeconds);
      const automatic = operation.timingCategory === 'automatic';
      const assignedResourceId = operation.assignedResourceId;
      const laneId = automatic ? assignedResourceId ? `resource:${assignedResourceId}` : 'automatic:unassigned' : `operator:${operator.id}`;
      const block: StandardWorkChartBlock = {
        entryId: entry.id, operationId: operation.id, timingCategory: operation.timingCategory,
        startSeconds, endSeconds: startSeconds + duration, durationSeconds: duration,
        laneId, order: entry.order, occurrences: entry.occurrences, assignedResourceId,
        assignedOperatorId: operator.id, operatorId: operator.id, launchOperatorId: operator.id,
        dependencyReleaseSeconds, dependencyIdleSeconds: Math.max(0, dependencyReleaseSeconds - cursor),
        enabled: true, stackIndex: 0, overlapsSameResource: false,
      };
      scheduled.set(entry.id, block);
      if (automatic) {
        automaticBlocks.push(block);
        if (!assignedResourceId) diagnostics.push({ severity: 'warning', code: 'unassigned-automatic', entryId: entry.id, operationId: operation.id, message: `${operation.id} is Automatic but has no assigned physical resource.` });
        else { const resource = this.resources.getResource(assignedResourceId); if (!resource) diagnostics.push({ severity: 'error', code: 'missing-resource', entryId: entry.id, operationId: operation.id, resourceId: assignedResourceId, message: `${operation.id} references missing physical resource ${assignedResourceId}.` }); else if (!resource.active) diagnostics.push({ severity: 'warning', code: 'inactive-resource', entryId: entry.id, operationId: operation.id, resourceId: assignedResourceId, message: `${operation.id} uses inactive resource ${assignedResourceId}.` }); }
      } else {
        operatorBlocks.push(block);
        cursors.set(operator.id, block.endSeconds);
      }
    }

    const handoverLinks: StandardWorkChartHandoverLink[] = [];
    for (const handover of handovers) {
      const source = scheduled.get(handover.fromEntryId); const target = scheduled.get(handover.toEntryId);
      if (!source || !target) continue;
      const sameOperator = source.assignedOperatorId === target.assignedOperatorId;
      if (handover.enabled && sameOperator) diagnostics.push({ severity: 'warning', code: 'same-operator-handover', handoverId: handover.id, entryId: target.entryId, operatorId: target.assignedOperatorId, message: `${handover.id} connects entries assigned to the same operator; it is preserved but adds no cross-operator constraint.` });
      handoverLinks.push({ id: handover.id, handoverId: handover.id, fromEntryId: handover.fromEntryId, toEntryId: handover.toEntryId, enabled: handover.enabled, sameOperator, fromOperatorId: source.assignedOperatorId, toOperatorId: target.assignedOperatorId, releaseSeconds: source.endSeconds, fromTime: source.endSeconds, toTime: target.startSeconds, validationState: handover.enabled ? sameOperator ? 'warning' : 'valid' : 'disabled' });
    }

    const { lanes, blocks, overlapCount } = this.buildResourceLanes(automaticBlocks, diagnostics);
    const operatorEndSeconds = Math.max(0, ...cursors.values());
    const latestAutomaticEndSeconds = blocks.reduce((maximum, block) => Math.max(maximum, block.endSeconds), 0);
    const chartCycleSpanSeconds = Math.max(operatorEndSeconds, latestAutomaticEndSeconds);
    const operatorLanes: StandardWorkChartOperatorLane[] = laneOperators.map((operator) => {
      const blocks = operatorBlocks.filter((block) => block.assignedOperatorId === operator.id);
      const endSeconds = cursors.get(operator.id) ?? 0;
      return { id: `operator:${operator.id}`, operatorId: operator.id, name: operator.name, role: operator.role, active: operator.active, linkedResourceId: operator.linkedResourceId, blocks, workload: calculateOperatorWorkload(operator.id, operatorBlocks, automaticBlocks, endSeconds, chartCycleSpanSeconds) };
    });
    const operatorSummaries = operatorLanes.map((lane) => lane.workload);
    const operatorCursors = Object.fromEntries([...cursors.entries()].sort(([left], [right]) => left.localeCompare(right)));
    const dependencyIdleSeconds = operatorSummaries.reduce((total, item) => total + item.dependencyIdleSeconds, 0);
    const automaticOverrunSeconds = Math.max(0, latestAutomaticEndSeconds - operatorEndSeconds);
    if (!ordered.length) diagnostics.push({ severity: 'warning', code: 'no-enabled-entries', message: `${study.id} has no enabled entries.` });
    if (automaticOverrunSeconds > epsilon) diagnostics.push({ severity: 'information', code: 'automatic-overrun', message: `Automatic processing extends ${automaticOverrunSeconds} seconds beyond the latest operator sequence.` });
    diagnostics.sort(compareDiagnostics);
    const sum = (category: TimingCategory, values: readonly StandardWorkChartBlock[]): number => values.filter((block) => block.timingCategory === category).reduce((total, block) => total + block.durationSeconds, 0);
    const manualSeconds = sum('manual', operatorBlocks); const walkingSeconds = sum('walking', operatorBlocks); const waitingSeconds = sum('waiting', operatorBlocks); const automaticSeconds = sum('automatic', blocks);
    return {
      studyId: study.id, operatorBlocks, operatorLanes, handoverLinks, operatorCursors, operatorSummaries, automaticBlocks: blocks, resourceLanes: lanes, disabledEntryIds,
      operatorEndSeconds, overallOperatorEndSeconds: operatorEndSeconds, latestAutomaticEndSeconds, chartCycleSpanSeconds, automaticOverrunSeconds, dependencyIdleSeconds,
      summary: { enabledEntryCount: ordered.length, manualSeconds, walkingSeconds, waitingSeconds, automaticSeconds, operatorOccupiedSeconds: manualSeconds + walkingSeconds + waitingSeconds, operatorProductiveSeconds: manualSeconds + walkingSeconds, operatorEndSeconds, latestAutomaticEndSeconds, automaticOverrunSeconds, chartCycleSpanSeconds, automaticLaneCount: lanes.length, potentialOverlapCount: overlapCount, zeroTimeEntryCount: [...operatorBlocks, ...blocks].filter((block) => block.durationSeconds === 0).length, errorCount: diagnostics.filter((item) => item.severity === 'error').length, warningCount: diagnostics.filter((item) => item.severity === 'warning').length },
      diagnostics,
    };
  }

  private buildResourceLanes(source: readonly StandardWorkChartBlock[], diagnostics: StandardWorkChartDiagnostic[]): { lanes: StandardWorkChartResourceLane[]; blocks: StandardWorkChartBlock[]; overlapCount: number } {
    const grouped = new Map<string, StandardWorkChartBlock[]>(); for (const block of source) { const values = grouped.get(block.laneId) ?? []; values.push(block); grouped.set(block.laneId, values); }
    const laneIds = [...grouped.keys()].sort((left, right) => left === 'automatic:unassigned' ? 1 : right === 'automatic:unassigned' ? -1 : left.localeCompare(right)); const lanes: StandardWorkChartResourceLane[] = []; const blocks: StandardWorkChartBlock[] = []; let overlapCount = 0;
    for (const laneId of laneIds) {
      const values = grouped.get(laneId)!.sort((left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds || left.entryId.localeCompare(right.entryId)); const overlapping = new Set<string>(); let previousMaximumEnd = Number.NEGATIVE_INFINITY;
      for (const block of values) { if (block.durationSeconds > 0 && previousMaximumEnd > block.startSeconds + epsilon) overlapping.add(block.entryId); if (block.durationSeconds > 0) previousMaximumEnd = Math.max(previousMaximumEnd, block.endSeconds); }
      let nextPositiveStart = Number.POSITIVE_INFINITY; for (let index = values.length - 1; index >= 0; index -= 1) { const block = values[index]; if (block.durationSeconds > 0 && nextPositiveStart < block.endSeconds - epsilon) overlapping.add(block.entryId); if (block.durationSeconds > 0) nextPositiveStart = block.startSeconds; }
      const active: Array<{ end: number; stackIndex: number }> = []; const availableStacks: number[] = []; let stackCount = 0;
      for (let index = 0; index < values.length; index += 1) { const block = values[index]; while (active.length && active[0].end <= block.startSeconds + epsilon) { const released = heapPop(active, (item) => item.end)!; heapPush(availableStacks, released.stackIndex, (item) => item); } if (block.durationSeconds === 0) { values[index] = { ...block, stackIndex: 0 }; continue; } overlapCount += active.length; const stackIndex = availableStacks.length ? heapPop(availableStacks, (item) => item)! : stackCount++; heapPush(active, { end: block.endSeconds, stackIndex }, (item) => item.end); values[index] = { ...block, stackIndex }; }
      if (overlapping.size) { const resourceId = values[0]?.assignedResourceId ?? undefined; diagnostics.push({ severity: 'warning', code: 'potential-resource-overlap', resourceId, message: `Potential overlapping automatic demand on ${resourceId ?? 'Unassigned Automatic'}. Full capacity validation is deferred to Sprint 3.6.` }); }
      const decorated = values.map((block) => ({ ...block, overlapsSameResource: overlapping.has(block.entryId) })); blocks.push(...decorated); const assignedResourceId = decorated[0]?.assignedResourceId ?? null; const resource = assignedResourceId ? this.resources.getResource(assignedResourceId) : undefined;
      lanes.push({ id: laneId, assignedResourceId, label: resource ? `${resource.id} — ${resource.name}` : assignedResourceId ? assignedResourceId : 'Unassigned Automatic', resourceActive: resource ? resource.active : null, blocks: decorated, stackCount: Math.max(1, stackCount) });
    }
    return { lanes, blocks, overlapCount };
  }
}

function heapPush<T>(heap: T[], value: T, rank: (item: T) => number): void { heap.push(value); let index = heap.length - 1; while (index > 0) { const parent = Math.floor((index - 1) / 2); if (rank(heap[parent]) <= rank(heap[index])) break; [heap[parent], heap[index]] = [heap[index], heap[parent]]; index = parent; } }
function heapPop<T>(heap: T[], rank: (item: T) => number): T | undefined { const result = heap[0]; const tail = heap.pop(); if (!heap.length || tail === undefined) return result; heap[0] = tail; let index = 0; while (true) { const left = index * 2 + 1; const right = left + 1; let smallest = index; if (left < heap.length && rank(heap[left]) < rank(heap[smallest])) smallest = left; if (right < heap.length && rank(heap[right]) < rank(heap[smallest])) smallest = right; if (smallest === index) break; [heap[index], heap[smallest]] = [heap[smallest], heap[index]]; index = smallest; } return result; }
function compareDiagnostics(left: StandardWorkChartDiagnostic, right: StandardWorkChartDiagnostic): number { const rank = { error: 0, warning: 1, information: 2 } as const; return rank[left.severity] - rank[right.severity] || left.code.localeCompare(right.code) || (left.entryId ?? '').localeCompare(right.entryId ?? '') || (left.operatorId ?? '').localeCompare(right.operatorId ?? '') || (left.handoverId ?? '').localeCompare(right.handoverId ?? '') || (left.resourceId ?? '').localeCompare(right.resourceId ?? ''); }
