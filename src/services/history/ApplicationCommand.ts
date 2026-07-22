import type { ConnectionStore } from '../ConnectionStore';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';
import type { SelectionController } from '../../models/selection/Selection';
import type { WorkspaceId } from '../../models/workspace/Workspace';
import type { ProjectSessionService } from '../project/ProjectSessionService';
import type { FactoryStructureStore } from '../FactoryStructureStore';

export interface CommandExecutionContext {
  readonly resources: ResourceStore;
  readonly operations: OperationStore;
  readonly connections: ConnectionStore;
  readonly structure: FactoryStructureStore;
  readonly project: ProjectSessionService;
  readonly selection: SelectionController;
}

export interface ApplicationCommand {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  readonly affectedEntityIds: readonly string[];
  readonly workspace?: WorkspaceId;
  execute(context: CommandExecutionContext): void;
  undo(context: CommandExecutionContext): void;
  redo?(context: CommandExecutionContext): void;
}

let commandSequence = 0;

export class ReversibleCommand implements ApplicationCommand {
  public readonly id = `CMD-${String(++commandSequence).padStart(6, '0')}`;
  public readonly timestamp = Date.now();

  public constructor(
    private readonly descriptionProvider: string | (() => string),
    private readonly affectedIdsProvider: readonly string[] | (() => readonly string[]),
    public readonly workspace: WorkspaceId | undefined,
    private readonly executeAction: (context: CommandExecutionContext) => void,
    private readonly undoAction: (context: CommandExecutionContext) => void,
  ) {}

  public get description(): string { return typeof this.descriptionProvider === 'string' ? this.descriptionProvider : this.descriptionProvider(); }
  public get affectedEntityIds(): readonly string[] { return typeof this.affectedIdsProvider === 'function' ? this.affectedIdsProvider() : this.affectedIdsProvider; }
  public execute(context: CommandExecutionContext): void { this.executeAction(context); }
  public undo(context: CommandExecutionContext): void { this.undoAction(context); }
  public redo(context: CommandExecutionContext): void { this.executeAction(context); }
}

export class CompositeCommand implements ApplicationCommand {
  public readonly id = `CMD-${String(++commandSequence).padStart(6, '0')}`;
  public readonly timestamp = Date.now();
  public readonly affectedEntityIds: readonly string[];
  public readonly workspace: WorkspaceId | undefined;

  public constructor(public readonly description: string, private readonly commands: readonly ApplicationCommand[]) {
    this.affectedEntityIds = [...new Set(commands.flatMap((command) => command.affectedEntityIds))];
    const workspaces = new Set(commands.map((command) => command.workspace).filter((value): value is WorkspaceId => Boolean(value)));
    this.workspace = workspaces.size === 1 ? [...workspaces][0] : undefined;
  }

  public execute(context: CommandExecutionContext): void {
    const executed: ApplicationCommand[] = [];
    try {
      for (const command of this.commands) { command.execute(context); executed.push(command); }
    } catch (error) {
      for (const command of executed.reverse()) command.undo(context);
      throw error;
    }
  }

  public undo(context: CommandExecutionContext): void { for (const command of [...this.commands].reverse()) command.undo(context); }
  public redo(context: CommandExecutionContext): void {
    const redone: ApplicationCommand[] = [];
    try { for (const command of this.commands) { (command.redo ?? command.execute).call(command, context); redone.push(command); } }
    catch (error) { for (const command of redone.reverse()) command.undo(context); throw error; }
  }
}
