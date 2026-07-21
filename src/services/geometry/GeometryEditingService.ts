import type { ProjectSessionService } from '../project/ProjectSessionService';
import type { GeometryCommandFactory } from '../history/GeometryCommandFactory';
import { calculateArrangement, type ArrangementCommand } from './ArrangementService';
import { geometryValue, type GeometryChange } from './GeometryBounds';
import type { GeometrySelectionService } from './GeometrySelectionService';

export type GeometryCommand = ArrangementCommand;
export interface GeometryActionResult { readonly ok: boolean; readonly message: string; readonly changed: number; readonly skipped: number; }

const label = (kind: 'operation' | 'resource', count: number): string => `${count} ${kind}${count === 1 ? '' : 's'}`;
const descriptions: Record<ArrangementCommand, string> = { 'align-left': 'left', 'align-centre-x': 'by horizontal centre', 'align-right': 'right', 'align-top': 'top', 'align-centre-y': 'by vertical centre', 'align-bottom': 'bottom', 'distribute-x': 'horizontally', 'distribute-y': 'vertically', 'equal-gaps-x': 'with equal horizontal gaps', 'equal-gaps-y': 'with equal vertical gaps', 'match-width': 'width', 'match-height': 'height', 'match-size': 'size' };

export class GeometryEditingService {
  private readonly listeners = new Set<() => void>();
  public constructor(private readonly selected: GeometrySelectionService, private readonly commands: GeometryCommandFactory, private readonly project: ProjectSessionService) {}
  public isAvailable(command: GeometryCommand): boolean { const selection = this.selected.getSelection(); const count = selection.unlocked.length; return count >= (command.startsWith('distribute') || command.startsWith('equal-gaps') ? 3 : 2); }
  public run(command: GeometryCommand): GeometryActionResult { const selection = this.selected.getSelection(); const minimum = command.startsWith('distribute') || command.startsWith('equal-gaps') ? 3 : 2; if (selection.unlocked.length < minimum) return { ok: false, message: `Select at least ${minimum} unlocked ${selection.workspace === 'processFlow' ? 'operations' : 'resources'} to ${command.startsWith('match') ? 'match size' : command.startsWith('align') ? 'align' : 'distribute'}`, changed: 0, skipped: selection.lockedCount };
    const calculation = calculateArrangement(command, selection.unlocked, selection.primary); if (calculation.error === 'negative-space') return { ok: false, message: 'Equal non-negative gaps are not possible in the current span', changed: 0, skipped: selection.lockedCount }; if (!calculation.changes.length) return { ok: false, message: 'Objects already satisfy that arrangement', changed: 0, skipped: selection.lockedCount };
    const kind = selection.unlocked[0].kind; const noun = label(kind, calculation.changes.length); const action = command.startsWith('align') ? `Align ${noun} ${descriptions[command]}` : command.startsWith('match') ? `Match ${descriptions[command]} of ${noun}` : command.startsWith('equal') ? `Apply ${descriptions[command]} to ${noun}` : `Distribute ${noun} ${descriptions[command]}`; const ok = this.commands.commit(action, calculation.changes); const unchanged = selection.ignoredCount ? `; ${selection.ignoredCount} connection${selection.ignoredCount === 1 ? '' : 's'} unchanged` : ''; const skipped = selection.lockedCount ? `; ${selection.lockedCount} locked skipped` : ''; return { ok, message: ok ? `${action}${unchanged}${skipped}` : 'Arrangement could not be applied', changed: ok ? calculation.changes.length : 0, skipped: selection.lockedCount };
  }
  public nudge(dx: number, dy: number): GeometryActionResult { const selection = this.selected.getSelection(); if (!selection.unlocked.length) return { ok: false, message: 'No movable objects selected', changed: 0, skipped: selection.lockedCount }; const changes: GeometryChange[] = selection.unlocked.map((node) => ({ id: node.id, kind: node.kind, before: geometryValue(node), after: { ...geometryValue(node), x: node.x + dx, y: node.y + dy } })); const step = Math.max(Math.abs(dx), Math.abs(dy)); const action = `Nudge ${label(selection.unlocked[0].kind, changes.length)} by ${step} unit${step === 1 ? '' : 's'}`; const ok = this.commands.commit(action, changes); return { ok, message: `${action}${selection.lockedCount ? `; ${selection.lockedCount} locked skipped` : ''}`, changed: ok ? changes.length : 0, skipped: selection.lockedCount };
  }
  public gridInterval(): number { return this.project.getSettings().gridBaseInterval; }
  public subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  public notify(): void { for (const listener of this.listeners) listener(); }
}
