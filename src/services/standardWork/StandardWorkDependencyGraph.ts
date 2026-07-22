import type { StandardWorkEntry } from '../../models/standardWork/StandardWork';
import type { StandardWorkHandover } from '../../models/standardWork/StandardWorkHandover';

export interface StandardWorkDependencyIssue { readonly code: string; readonly handoverId?: string; readonly message: string; }

export function validateHandoverGraph(entries: readonly StandardWorkEntry[], handovers: readonly StandardWorkHandover[]): readonly StandardWorkDependencyIssue[] {
  const issues: StandardWorkDependencyIssue[] = []; const entriesById = new Map(entries.map((entry) => [entry.id, entry])); const pairs = new Set<string>();
  for (const handover of [...handovers].sort((a, b) => a.id.localeCompare(b.id))) {
    const source = entriesById.get(handover.fromEntryId); const target = entriesById.get(handover.toEntryId); const pair = `${handover.fromEntryId}\0${handover.toEntryId}`;
    if (!source) issues.push({ code: 'missing-source', handoverId: handover.id, message: `${handover.id} references missing source entry ${handover.fromEntryId}.` });
    if (!target) issues.push({ code: 'missing-target', handoverId: handover.id, message: `${handover.id} references missing target entry ${handover.toEntryId}.` });
    if (source && source.studyId !== handover.studyId || target && target.studyId !== handover.studyId) issues.push({ code: 'cross-study', handoverId: handover.id, message: `${handover.id} crosses Standard Work study boundaries.` });
    if (handover.fromEntryId === handover.toEntryId) issues.push({ code: 'self-reference', handoverId: handover.id, message: `${handover.id} cannot reference one entry twice.` });
    if (pairs.has(pair)) issues.push({ code: 'duplicate', handoverId: handover.id, message: `${handover.id} duplicates an existing handover.` }); pairs.add(pair);
    if (source && target && (source.order > target.order || source.order === target.order && source.id.localeCompare(target.id) >= 0)) issues.push({ code: 'backward', handoverId: handover.id, message: `${handover.id} must point to a later study entry.` });
  }
  const adjacency = new Map<string, string[]>(); for (const handover of handovers) { const values = adjacency.get(handover.fromEntryId) ?? []; values.push(handover.toEntryId); adjacency.set(handover.fromEntryId, values); }
  for (const values of adjacency.values()) values.sort(); const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): boolean => { const current = state.get(id) ?? 0; if (current === 1) return true; if (current === 2) return false; state.set(id, 1); for (const next of adjacency.get(id) ?? []) if (visit(next)) return true; state.set(id, 2); return false; };
  if ([...entriesById.keys()].sort().some(visit)) issues.push({ code: 'cycle', message: 'Standard Work handovers contain a dependency cycle.' });
  return issues;
}

export function inboundHandovers(handovers: readonly StandardWorkHandover[]): ReadonlyMap<string, readonly StandardWorkHandover[]> {
  const result = new Map<string, StandardWorkHandover[]>();
  for (const handover of handovers) { const values = result.get(handover.toEntryId) ?? []; values.push(handover); result.set(handover.toEntryId, values); }
  for (const values of result.values()) values.sort((a, b) => a.id.localeCompare(b.id)); return result;
}
