import type { GeometryChange, GeometryValue } from '../geometry/GeometryBounds';
import { sameGeometry } from '../geometry/GeometryBounds';
import type { CommandExecutionContext } from './ApplicationCommand';
import { ReversibleCommand } from './ApplicationCommand';
import type { CommandHistoryService } from './CommandHistoryService';

export class GeometryCommandFactory {
  public constructor(private readonly history: CommandHistoryService) {}
  public commit(description: string, changes: readonly GeometryChange[]): boolean { const changed = changes.filter((item) => !sameGeometry(item.before, item.after)); if (!changed.length) return false; const workspace = changed[0].kind === 'operation' ? 'processFlow' : 'factoryLayout'; const apply = (where: 'before' | 'after', context: CommandExecutionContext): void => { for (const item of changed) this.apply(item.kind, item.id, item[where], context); if (workspace === 'processFlow') context.connections.recalculateAll(); };
    try { return this.history.execute(new ReversibleCommand(description, changed.map((item) => item.id), workspace, (context) => apply('after', context), (context) => apply('before', context))); } catch { return false; }
  }
  private apply(kind: GeometryChange['kind'], id: string, value: GeometryValue, context: CommandExecutionContext): void { const accepted = kind === 'operation' ? context.operations.updateOperation(id, { worldX: value.x, worldY: value.y, width: value.width, height: value.height }) : context.resources.updateResource(id, { worldX: value.x, worldY: value.y, width: value.width, height: value.height }); if (!accepted) throw new Error(`Geometry update rejected for ${id}.`); }
}
