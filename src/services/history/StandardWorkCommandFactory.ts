import type { StandardWorkEntry, StandardWorkEntryPatch, StandardWorkStudy, StandardWorkStudyPatch } from '../../models/standardWork/StandardWork';
import { cloneStandardWorkEntry, cloneStandardWorkStudy } from '../../models/standardWork/StandardWork';
import type { CommandExecutionContext } from './ApplicationCommand';
import { ReversibleCommand } from './ApplicationCommand';
import type { CommandHistoryService } from './CommandHistoryService';
import { cloneStandardWorkOperator, type StandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';
import { cloneStandardWorkHandover } from '../../models/standardWork/StandardWorkHandover';

export type AddStandardWorkEntryResult = { readonly kind: 'added' | 'duplicate' | 'invalid'; readonly entry?: StandardWorkEntry };

const same = (a: unknown, b: unknown): boolean => Object.is(a, b);
const now = (): string => new Date().toISOString();

export class StandardWorkCommandFactory {
  public constructor(private readonly history: CommandHistoryService, private readonly context: CommandExecutionContext) {}

  public createStudy(name?: string): StandardWorkStudy | null {
    const id = this.context.standardWork.nextStudyId(); const timestamp = now();
    const study: StandardWorkStudy = { id, name: name?.trim() || `Standard Work Study ${this.context.standardWork.getStudyCount() + 1}`, description: '', productOrProcessName: '', revision: '', active: true, notes: '', createdUtc: timestamp, modifiedUtc: timestamp };
    const operator: StandardWorkOperator = { id: this.context.standardWorkOperators.nextId(), studyId: id, name: 'Operator 1', role: '', displayOrder: 10, active: true, linkedResourceId: null, notes: '' };
    const command = new ReversibleCommand(`Create Standard Work study ${id}`, [id, operator.id], 'standardWork',
      ({ standardWork, standardWorkOperators, standardWorkSelection }) => { if (!standardWork.restoreStudy(study) || !standardWorkOperators.restoreOperator(operator)) throw new Error('Study and default operator could not be created.'); standardWorkSelection.select({ kind: 'standardWorkStudy', id }); },
      ({ standardWork, standardWorkOperators, standardWorkSelection }) => { standardWorkOperators.deleteStudy(id); if (!standardWork.deleteStudy(id)) throw new Error('Study creation could not be undone.'); standardWorkSelection.clear(); });
    return this.run(command) ? cloneStandardWorkStudy(study) : null;
  }

  public updateStudy(id: string, patch: StandardWorkStudyPatch, description = `Update Standard Work study ${id}`): boolean {
    const source = this.context.standardWork.getStudy(id); if (!source) return false;
    const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => !same(source[key as keyof StandardWorkStudy], value))) as StandardWorkStudyPatch;
    delete changed.modifiedUtc; if (!Object.keys(changed).length) return false;
    const after = { ...source, ...changed, modifiedUtc: now() }; const before = cloneStandardWorkStudy(source);
    return this.run(new ReversibleCommand(description, [id], 'standardWork',
      ({ standardWork }) => { if (!standardWork.replaceStudy(after)) throw new Error('Study update was rejected.'); },
      ({ standardWork }) => { if (!standardWork.replaceStudy(before)) throw new Error('Study update could not be undone.'); }));
  }

  public duplicateStudy(id: string): StandardWorkStudy | null {
    const source = this.context.standardWork.getStudy(id); if (!source) return null;
    const timestamp = now(); const study: StandardWorkStudy = { ...source, id: this.context.standardWork.nextStudyId(), name: `${source.name} Copy`, createdUtc: timestamp, modifiedUtc: timestamp };
    const operatorMap = new Map<string, string>(); const operators = this.context.standardWorkOperators.getOperators(id).map((operator) => { const nextId = this.context.standardWorkOperators.nextId(); operatorMap.set(operator.id, nextId); return { ...operator, id: nextId, studyId: study.id }; });
    const entryMap = new Map<string, string>(); const entries = this.context.standardWork.getEntries(id).map((entry) => { const nextId = this.context.standardWork.nextEntryId(); entryMap.set(entry.id, nextId); return { ...entry, id: nextId, studyId: study.id, assignedOperatorId: operatorMap.get(entry.assignedOperatorId)! }; });
    const handovers = this.context.standardWorkHandovers.getHandovers(id).map((handover) => ({ ...handover, id: this.context.standardWorkHandovers.nextId(), studyId: study.id, fromEntryId: entryMap.get(handover.fromEntryId)!, toEntryId: entryMap.get(handover.toEntryId)! }));
    const command = new ReversibleCommand(`Duplicate Standard Work study ${id} as ${study.id}`, [study.id, ...operators.map((item) => item.id), ...entries.map((entry) => entry.id), ...handovers.map((item) => item.id)], 'standardWork',
      ({ standardWork, standardWorkOperators, standardWorkHandovers, standardWorkSelection }) => { if (!standardWork.restoreStudy(study)) throw new Error('Duplicated study could not be restored.'); for (const operator of operators) if (!standardWorkOperators.restoreOperator(operator)) throw new Error('Duplicated operator could not be restored.'); for (const entry of entries) if (!standardWork.restoreEntry(entry)) throw new Error('Duplicated study entry could not be restored.'); for (const handover of handovers) if (!standardWorkHandovers.restoreHandover(handover)) throw new Error('Duplicated handover could not be restored.'); standardWorkSelection.select({ kind: 'standardWorkStudy', id: study.id }); },
      ({ standardWork, standardWorkOperators, standardWorkHandovers, standardWorkSelection }) => { standardWorkHandovers.deleteStudy(study.id); standardWorkOperators.deleteStudy(study.id); if (!standardWork.deleteStudy(study.id)) throw new Error('Study duplication could not be undone.'); standardWorkSelection.select({ kind: 'standardWorkStudy', id }); });
    return this.run(command) ? cloneStandardWorkStudy(study) : null;
  }

  public deleteStudy(id: string): boolean {
    const source = this.context.standardWork.getStudy(id); if (!source) return false; const study = cloneStandardWorkStudy(source); const operators = this.context.standardWorkOperators.getOperators(id).map(cloneStandardWorkOperator); const entries = this.context.standardWork.getEntries(id).map(cloneStandardWorkEntry); const handovers = this.context.standardWorkHandovers.getHandovers(id).map(cloneStandardWorkHandover);
    return this.run(new ReversibleCommand(`Delete Standard Work study ${id}`, [id, ...operators.map((item) => item.id), ...entries.map((entry) => entry.id), ...handovers.map((item) => item.id)], 'standardWork',
      ({ standardWork, standardWorkOperators, standardWorkHandovers, standardWorkSelection }) => { standardWorkHandovers.deleteStudy(id); standardWorkOperators.deleteStudy(id); if (!standardWork.deleteStudy(id)) throw new Error('Study could not be deleted.'); standardWorkSelection.clear(); },
      ({ standardWork, standardWorkOperators, standardWorkHandovers, standardWorkSelection }) => { if (!standardWork.restoreStudy(study)) throw new Error('Study could not be restored.'); for (const operator of operators) if (!standardWorkOperators.restoreOperator(operator)) throw new Error('Study operator could not be restored.'); for (const entry of entries) if (!standardWork.restoreEntry(entry)) throw new Error('Study entry could not be restored.'); for (const handover of handovers) if (!standardWorkHandovers.restoreHandover(handover)) throw new Error('Study handover could not be restored.'); standardWorkSelection.select({ kind: 'standardWorkStudy', id }); }));
  }

  public addOperation(studyId: string, operationId: string): AddStandardWorkEntryResult {
    const duplicate = this.context.standardWork.findEntry(studyId, operationId); if (duplicate) { this.context.standardWorkSelection.select({ kind: 'standardWorkEntry', id: duplicate.id }); return { kind: 'duplicate', entry: cloneStandardWorkEntry(duplicate) }; }
    const primary = this.context.standardWorkOperators.getPrimary(studyId); if (!this.context.standardWork.getStudy(studyId) || !this.context.operations.getOperation(operationId) || !primary) return { kind: 'invalid' };
    const order = (this.context.standardWork.getEntries(studyId).at(-1)?.order ?? 0) + 10;
    const entry: StandardWorkEntry = { id: this.context.standardWork.nextEntryId(), studyId, operationId, assignedOperatorId: primary.id, order, occurrences: 1, enabled: true, notes: '' };
    const command = new ReversibleCommand(`Add ${operationId} to ${studyId}`, [entry.id, studyId, operationId], 'standardWork',
      ({ standardWork, standardWorkSelection }) => { if (!standardWork.restoreEntry(entry)) throw new Error('Study entry could not be added.'); standardWorkSelection.select({ kind: 'standardWorkEntry', id: entry.id }); },
      ({ standardWork, standardWorkSelection }) => { if (!standardWork.deleteEntry(entry.id)) throw new Error('Study entry addition could not be undone.'); standardWorkSelection.select({ kind: 'standardWorkStudy', id: studyId }); });
    return this.run(command) ? { kind: 'added', entry: cloneStandardWorkEntry(entry) } : { kind: 'invalid' };
  }

  public populate(studyId: string): readonly StandardWorkEntry[] {
    const primary = this.context.standardWorkOperators.getPrimary(studyId); if (!this.context.standardWork.getStudy(studyId) || !primary) return [];
    const existing = new Set(this.context.standardWork.getEntries(studyId).map((entry) => entry.operationId)); let order = this.context.standardWork.getEntries(studyId).at(-1)?.order ?? 0;
    const entries = this.context.operations.sortedOperations().filter((operation) => !existing.has(operation.id)).map((operation) => ({ id: this.context.standardWork.nextEntryId(), studyId, operationId: operation.id, assignedOperatorId: primary.id, order: order += 10, occurrences: 1, enabled: true, notes: '' } satisfies StandardWorkEntry));
    if (!entries.length) return [];
    const command = new ReversibleCommand(`Populate ${studyId} from Process Flow`, [studyId, ...entries.flatMap((entry) => [entry.id, entry.operationId])], 'standardWork',
      ({ standardWork, standardWorkSelection }) => { for (const entry of entries) if (!standardWork.restoreEntry(entry)) throw new Error('Study population failed.'); standardWorkSelection.select({ kind: 'standardWorkEntry', id: entries.at(-1)!.id }); },
      ({ standardWork, standardWorkSelection }) => { for (const entry of [...entries].reverse()) if (!standardWork.deleteEntry(entry.id)) throw new Error('Study population could not be undone.'); standardWorkSelection.select({ kind: 'standardWorkStudy', id: studyId }); });
    return this.run(command) ? entries.map(cloneStandardWorkEntry) : [];
  }

  public updateEntry(id: string, patch: StandardWorkEntryPatch, description = `Update Standard Work entry ${id}`): boolean {
    const source = this.context.standardWork.getEntry(id); if (!source) return false; const afterPatch = Object.fromEntries(Object.entries(patch).filter(([key, value]) => !same(source[key as keyof StandardWorkEntry], value))) as StandardWorkEntryPatch; if (!Object.keys(afterPatch).length) return false;
    const before = cloneStandardWorkEntry(source); const after = { ...source, ...afterPatch };
    return this.run(new ReversibleCommand(description, [id, source.studyId, source.operationId], 'standardWork',
      ({ standardWork }) => { if (!standardWork.replaceEntry(after)) throw new Error('Entry update was rejected.'); },
      ({ standardWork }) => { if (!standardWork.replaceEntry(before)) throw new Error('Entry update could not be undone.'); }));
  }

  public removeEntry(id: string): boolean {
    const source = this.context.standardWork.getEntry(id); if (!source) return false; const entry = cloneStandardWorkEntry(source); const handovers = this.context.standardWorkHandovers.getAttached(id).map(cloneStandardWorkHandover);
    return this.run(new ReversibleCommand(`Remove ${entry.operationId} from ${entry.studyId}`, [id, entry.studyId, entry.operationId, ...handovers.map((item) => item.id)], 'standardWork',
      ({ standardWork, standardWorkHandovers, standardWorkSelection }) => { standardWorkHandovers.deleteAttached(id); if (!standardWork.deleteEntry(id)) throw new Error('Entry could not be removed.'); standardWorkSelection.select({ kind: 'standardWorkStudy', id: entry.studyId }); },
      ({ standardWork, standardWorkHandovers, standardWorkSelection }) => { if (!standardWork.restoreEntry(entry)) throw new Error('Entry could not be restored.'); for (const handover of handovers) if (!standardWorkHandovers.restoreHandover(handover)) throw new Error('Attached handover could not be restored.'); standardWorkSelection.select({ kind: 'standardWorkEntry', id }); }));
  }

  public moveUp(id: string): boolean { const entry = this.context.standardWork.getEntry(id); if (!entry) return false; const values = this.context.standardWork.getEntries(entry.studyId); return this.reorder(entry.studyId, values, Math.max(0, values.findIndex((item) => item.id === id) - 1), id); }
  public moveDown(id: string): boolean { const entry = this.context.standardWork.getEntry(id); if (!entry) return false; const values = this.context.standardWork.getEntries(entry.studyId); return this.reorder(entry.studyId, values, Math.min(values.length - 1, values.findIndex((item) => item.id === id) + 1), id); }
  public moveToTop(id: string): boolean { const entry = this.context.standardWork.getEntry(id); return Boolean(entry && this.reorder(entry.studyId, this.context.standardWork.getEntries(entry.studyId), 0, id)); }
  public moveToBottom(id: string): boolean { const entry = this.context.standardWork.getEntry(id); const values = entry ? this.context.standardWork.getEntries(entry.studyId) : []; return Boolean(entry && this.reorder(entry.studyId, values, values.length - 1, id)); }
  public moveBefore(id: string, beforeId: string): boolean { const entry = this.context.standardWork.getEntry(id); if (!entry || id === beforeId) return false; const values = this.context.standardWork.getEntries(entry.studyId); const target = values.findIndex((item) => item.id === beforeId); return target >= 0 && this.reorder(entry.studyId, values, target, id); }

  private reorder(studyId: string, values: readonly StandardWorkEntry[], target: number, id: string): boolean {
    const from = values.findIndex((item) => item.id === id); if (from < 0 || from === target) return false;
    const ordered = values.map(cloneStandardWorkEntry); const [moving] = ordered.splice(from, 1); ordered.splice(target, 0, moving); const before = values.map(cloneStandardWorkEntry); const after = ordered.map((entry, index) => ({ ...entry, order: (index + 1) * 10 }));
    const apply = (items: readonly StandardWorkEntry[], context: CommandExecutionContext): void => { for (const item of items) if (!context.standardWork.replaceEntry(item)) throw new Error('Entry reorder failed.'); context.standardWorkSelection.select({ kind: 'standardWorkEntry', id }); };
    return this.run(new ReversibleCommand(`Reorder Standard Work entry ${id}`, [studyId, ...after.map((item) => item.id)], 'standardWork', (context) => apply(after, context), (context) => apply(before, context)));
  }

  private run(command: ReversibleCommand): boolean { try { return this.history.execute(command); } catch { return false; } }
}
