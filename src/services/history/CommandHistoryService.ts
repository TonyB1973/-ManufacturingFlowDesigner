import type { ApplicationCommand, CommandExecutionContext } from './ApplicationCommand';
import { CompositeCommand } from './ApplicationCommand';

export interface HistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDescription: string | null;
  readonly redoDescription: string | null;
  readonly undoCount: number;
  readonly redoCount: number;
  readonly currentPosition: number;
  readonly savedCheckpoint: number | null;
  readonly atSavedCheckpoint: boolean;
  readonly lastAction: string | null;
}

interface ActiveTransaction { readonly description: string; readonly commands: ApplicationCommand[]; }

export class CommandHistoryService {
  private readonly entries: ApplicationCommand[] = [];
  private readonly listeners = new Set<(state: HistoryState) => void>();
  private position = 0;
  private positionOffset = 0;
  private savedCheckpoint: number | null = 0;
  private transaction: ActiveTransaction | null = null;
  private lastAction: string | null = null;

  public constructor(private readonly context: CommandExecutionContext, private readonly maximumDepth = 200) {
    if (!Number.isInteger(maximumDepth) || maximumDepth < 1) throw new Error('History depth must be a positive integer.');
  }

  public get canUndo(): boolean { return this.position > 0; }
  public get canRedo(): boolean { return this.position < this.entries.length; }
  public get undoDescription(): string | null { return this.entries[this.position - 1]?.description ?? null; }
  public get redoDescription(): string | null { return this.entries[this.position]?.description ?? null; }

  public execute(command: ApplicationCommand): boolean {
    try {
      const scenarioScoped = command.workspace === 'processFlow' || command.workspace === 'factoryLayout' || command.workspace === 'standardWork';
      const project = this.context.project as CommandExecutionContext['project'] | undefined;
      const scenarioAware = typeof project?.getActiveScenarioId === 'function'
        && typeof project?.isActiveScenarioLocked === 'function';
      const scenarioId = scenarioScoped && scenarioAware ? project.getActiveScenarioId() : null;
      if (scenarioScoped && scenarioAware && project.isActiveScenarioLocked()) {
        this.lastAction = `Blocked: ${project.getActiveScenario().name} is locked`; this.notify(); return false;
      }
      command.execute(this.context);
      const recorded = scenarioId ? new ScenarioBoundCommand(command, scenarioId) : command;
      if (this.transaction) this.transaction.commands.push(recorded);
      else this.pushExecuted(recorded);
      return true;
    } catch (error) {
      if (this.transaction) {
        const executed = [...this.transaction.commands].reverse(); this.transaction = null;
        for (const child of executed) child.undo(this.context);
        this.lastAction = 'Transaction rolled back'; this.notify();
      }
      throw error;
    }
  }

  public undo(): string | null {
    if (this.transaction) throw new Error('Cannot undo during a command transaction.');
    const command = this.entries[this.position - 1]; if (!command) return null;
    command.undo(this.context); this.position -= 1; this.lastAction = `Undid: ${command.description}`; this.notify(); return command.description;
  }

  public redo(): string | null {
    if (this.transaction) throw new Error('Cannot redo during a command transaction.');
    const command = this.entries[this.position]; if (!command) return null;
    (command.redo ?? command.execute).call(command, this.context); this.position += 1; this.lastAction = `Redid: ${command.description}`; this.notify(); return command.description;
  }

  public beginTransaction(description: string): void {
    if (this.transaction) throw new Error('Nested command transactions are not supported.');
    if (!description.trim()) throw new Error('Transaction description is required.');
    this.transaction = { description: description.trim(), commands: [] };
  }

  public commitTransaction(): boolean {
    const transaction = this.transaction; if (!transaction) throw new Error('No command transaction is active.');
    this.transaction = null; if (!transaction.commands.length) { this.notify(); return false; }
    this.pushExecuted(new CompositeCommand(transaction.description, transaction.commands)); return true;
  }

  public cancelTransaction(): boolean {
    const transaction = this.transaction; if (!transaction) return false; this.transaction = null;
    for (const command of [...transaction.commands].reverse()) command.undo(this.context);
    this.lastAction = `Cancelled: ${transaction.description}`; this.notify(); return true;
  }

  public clear(): void {
    this.entries.splice(0); this.position = 0; this.positionOffset = 0; this.savedCheckpoint = 0; this.transaction = null; this.lastAction = null; this.notify();
  }

  public markSaved(): void { this.savedCheckpoint = this.absolutePosition(); this.lastAction = 'Saved project checkpoint'; this.notify(); }
  public isAtSavedCheckpoint(): boolean { return this.savedCheckpoint !== null && this.savedCheckpoint === this.absolutePosition(); }
  public getState(): HistoryState {
    return {
      canUndo: this.canUndo, canRedo: this.canRedo,
      undoDescription: this.undoDescription,
      redoDescription: this.redoDescription,
      undoCount: this.position, redoCount: this.entries.length - this.position,
      currentPosition: this.absolutePosition(), savedCheckpoint: this.savedCheckpoint,
      atSavedCheckpoint: this.isAtSavedCheckpoint(), lastAction: this.lastAction,
    };
  }
  public inspect(): Readonly<{ undo: readonly string[]; redo: readonly string[]; savedCheckpoint: number | null; currentPosition: number }> {
    return { undo: this.entries.slice(0, this.position).map((entry) => entry.description), redo: this.entries.slice(this.position).map((entry) => entry.description), savedCheckpoint: this.savedCheckpoint, currentPosition: this.absolutePosition() };
  }
  public subscribe(listener: (state: HistoryState) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private pushExecuted(command: ApplicationCommand): void {
    const current = this.absolutePosition();
    if (this.position < this.entries.length) {
      this.entries.splice(this.position);
      if (this.savedCheckpoint !== null && this.savedCheckpoint > current) this.savedCheckpoint = null;
    }
    this.entries.push(command); this.position += 1;
    const overflow = this.entries.length - this.maximumDepth;
    if (overflow > 0) { this.entries.splice(0, overflow); this.position -= overflow; this.positionOffset += overflow; }
    this.lastAction = command.description; this.notify();
  }
  private absolutePosition(): number { return this.positionOffset + this.position; }
  private notify(): void { const state = this.getState(); for (const listener of this.listeners) listener(state); }
}

class ScenarioBoundCommand implements ApplicationCommand {
  public constructor(private readonly command: ApplicationCommand, private readonly scenarioId: string) {}
  public get id(): string { return this.command.id; }
  public get description(): string { return this.command.description; }
  public get timestamp(): number { return this.command.timestamp; }
  public get affectedEntityIds(): readonly string[] { return this.command.affectedEntityIds; }
  public get workspace(): ApplicationCommand['workspace'] { return this.command.workspace; }
  public execute(context: CommandExecutionContext): void { this.activate(context); this.command.execute(context); }
  public undo(context: CommandExecutionContext): void { this.activate(context); this.command.undo(context); }
  public redo(context: CommandExecutionContext): void { this.activate(context); (this.command.redo ?? this.command.execute).call(this.command, context); }
  private activate(context: CommandExecutionContext): void {
    if (!context.project.activateScenario(this.scenarioId)) throw new Error(`Scenario ${this.scenarioId} is no longer available.`);
  }
}
