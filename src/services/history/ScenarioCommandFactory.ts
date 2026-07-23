import type { ManufacturingScenario } from '../../models/scenarios/ManufacturingScenario';
import { ReversibleCommand } from './ApplicationCommand';
import type { CommandExecutionContext } from './ApplicationCommand';
import type { CommandHistoryService } from './CommandHistoryService';

export class ScenarioCommandFactory {
  public constructor(private readonly history: CommandHistoryService, private readonly context: CommandExecutionContext) {}

  public newFromBaseline(): ManufacturingScenario | null {
    const baseline = this.context.project.getBaselineScenario(); let snapshot: ManufacturingScenario | null = null;
    const name = this.nextAlternativeName();
    const command = new ReversibleCommand(() => `Create scenario ${snapshot?.id ?? name}`, () => snapshot ? [snapshot.id, baseline.id] : [baseline.id], 'scenarios',
      ({ project }) => {
        if (snapshot) { if (!project.restoreScenario(snapshot, true)) throw new Error('Scenario could not be restored.'); }
        else { const created = project.createScenarioFrom(baseline.id, name); if (!created) throw new Error('Scenario could not be created.'); snapshot = created; }
      },
      ({ project }) => { if (!snapshot || !project.deleteScenario(snapshot.id)) throw new Error('Scenario creation could not be undone.'); },
    );
    return this.run(command) ? snapshot : null;
  }

  public duplicateCurrent(): ManufacturingScenario | null {
    const source = this.context.project.getActiveScenario(); let snapshot: ManufacturingScenario | null = null;
    const name = this.uniqueName(`${source.name} Copy`);
    const command = new ReversibleCommand(() => `Duplicate scenario ${source.id} as ${snapshot?.id ?? name}`, () => snapshot ? [source.id, snapshot.id] : [source.id], 'scenarios',
      ({ project }) => {
        if (snapshot) { if (!project.restoreScenario(snapshot, true)) throw new Error('Scenario duplicate could not be restored.'); }
        else { const created = project.createScenarioFrom(source.id, name); if (!created) throw new Error('Scenario duplication failed.'); snapshot = created; }
      },
      ({ project }) => { if (!snapshot || !project.deleteScenario(snapshot.id)) throw new Error('Scenario duplication could not be undone.'); },
    );
    return this.run(command) ? snapshot : null;
  }

  public update(id: string, patch: Partial<Pick<ManufacturingScenario, 'name' | 'description' | 'locked'>>, description = `Update scenario ${id}`): boolean {
    const before = this.context.project.getScenario(id); if (!before) return false;
    const after = { ...before, ...patch, name: patch.name?.trim() ?? before.name, modifiedUtc: new Date().toISOString(), state: before.state };
    if (!after.name || after.name.length > 200 || after.description.length > 10000) return false;
    return this.run(new ReversibleCommand(description, [id], 'scenarios',
      ({ project }) => { if (!project.replaceScenario(after)) throw new Error('Scenario update rejected.'); },
      ({ project }) => { if (!project.replaceScenario(before)) throw new Error('Scenario update could not be undone.'); },
    ));
  }

  public setBaseline(id: string): boolean {
    const current = this.context.project.getBaselineScenario(); if (current.id === id || !this.context.project.getScenario(id)) return false;
    return this.run(new ReversibleCommand(`Set ${id} as baseline`, [current.id, id], 'scenarios',
      ({ project }) => { if (!project.setBaselineScenario(id)) throw new Error('Baseline change rejected.'); },
      ({ project }) => { if (!project.setBaselineScenario(current.id)) throw new Error('Baseline change could not be undone.'); },
    ));
  }

  public delete(id: string): boolean {
    const snapshot = this.context.project.getScenario(id); if (!snapshot || snapshot.isBaseline || this.context.project.getScenarios().length <= 1) return false;
    const activeBefore = this.context.project.getActiveScenarioId();
    return this.run(new ReversibleCommand(`Delete scenario ${id}`, [id], 'scenarios',
      ({ project }) => { if (!project.deleteScenario(id)) throw new Error('Scenario deletion rejected.'); },
      ({ project }) => { if (!project.restoreScenario(snapshot, activeBefore === id)) throw new Error('Scenario deletion could not be undone.'); },
    ));
  }

  private nextAlternativeName(): string {
    const names = new Set(this.context.project.getScenarios().map((item) => item.name));
    let index = 1; while (names.has(`Alternative ${index}`)) index += 1; return `Alternative ${index}`;
  }
  private uniqueName(base: string): string {
    const names = new Set(this.context.project.getScenarios().map((item) => item.name)); if (!names.has(base)) return base;
    let index = 2; while (names.has(`${base} ${index}`)) index += 1; return `${base} ${index}`;
  }
  private run(command: ReversibleCommand): boolean { try { return this.history.execute(command); } catch { return false; } }
}
