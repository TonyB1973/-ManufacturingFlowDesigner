import { cloneStandardWorkPlanning, type StandardWorkPlanningPatch } from '../../models/standardWork/StandardWorkPlanning';
import type { CommandExecutionContext } from './ApplicationCommand';
import { ReversibleCommand } from './ApplicationCommand';
import type { CommandHistoryService } from './CommandHistoryService';

export class StandardWorkPlanningCommandFactory {
  public constructor(private readonly history: CommandHistoryService, private readonly context: CommandExecutionContext) {}
  public update(studyId: string, patch: StandardWorkPlanningPatch, description = `Update planning settings for ${studyId}`): boolean {
    const source = this.context.standardWorkPlanning.get(studyId); if (!source) return false;
    const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => !Object.is(source[key as keyof typeof source], value))) as StandardWorkPlanningPatch;
    if (!Object.keys(changed).length) return false;
    const before = cloneStandardWorkPlanning(source); const after = { ...source, ...changed };
    const command = new ReversibleCommand(description, [studyId], 'standardWork',
      ({ standardWorkPlanning }) => { if (!standardWorkPlanning.replace(after)) throw new Error('Planning update was rejected.'); },
      ({ standardWorkPlanning }) => { if (!standardWorkPlanning.replace(before)) throw new Error('Planning update could not be undone.'); });
    try { return this.history.execute(command); } catch { return false; }
  }
}
