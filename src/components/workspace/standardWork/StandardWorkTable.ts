import type { StandardWorkEntry } from '../../../models/standardWork/StandardWork';
import type { StandardWorkOperationResolver } from '../../../services/standardWork/StandardWorkOperationResolver';
import type { StandardWorkSelectionStore } from '../../../services/standardWork/StandardWorkSelectionStore';
import { formatDuration } from '../../../services/standardWork/DurationFormatter';
import type { StandardWorkTimeFormat } from '../../../models/standardWork/StandardWork';
import { element } from '../../../ui/dom';

export interface StandardWorkTableController { readonly element: HTMLElement; render(entries: readonly StandardWorkEntry[], format: StandardWorkTimeFormat): void; reveal(id: string): void; dispose(): void; }

export function createStandardWorkTable(resolver: StandardWorkOperationResolver, selection: StandardWorkSelectionStore, onDropBefore: (id: string, beforeId: string) => void): StandardWorkTableController {
  const region = element('section', 'standard-work-table-region'); region.setAttribute('aria-label', 'Ordered Standard Work entries');
  const table = element('table', 'standard-work-table'); const head = element('thead'); const header = element('tr');
  for (const label of ['Order', 'Enabled', 'Operation ID', 'Operation name', 'Type', 'Timing', 'Base time', 'Occurrences', 'Effective duration', 'Assigned resource', 'Entry notes', 'Validation']) header.append(element('th', undefined, label));
  head.append(header); const body = element('tbody'); table.append(head, body); region.append(table); let dragged: string | null = null;
  const render = (entries: readonly StandardWorkEntry[], format: StandardWorkTimeFormat): void => {
    const selected = selection.get(); body.replaceChildren();
    for (const entry of entries) {
      const value = resolver.resolve(entry); const row = element('tr', `standard-work-row${entry.enabled ? '' : ' standard-work-row--disabled'}`); row.dataset.entryId = entry.id; row.tabIndex = 0; row.draggable = true; row.setAttribute('aria-selected', String(selected.kind === 'standardWorkEntry' && selected.id === entry.id)); row.title = `${entry.operationId}: ${value.operationName}`;
      const cells = [String(entry.order), entry.enabled ? 'Enabled' : 'Disabled', entry.operationId, value.operationName, value.operationType, value.timingCategory ? value.timingCategory[0].toUpperCase() + value.timingCategory.slice(1) : 'Invalid', value.baseCycleTimeSeconds === null ? 'Invalid' : formatDuration(value.baseCycleTimeSeconds, format), String(entry.occurrences), value.effectiveDurationSeconds === null ? 'Invalid' : formatDuration(value.effectiveDurationSeconds, format), value.assignedResource, entry.notes || '—', value.operation ? value.operation.cycleTimeSeconds === 0 ? 'Warning: zero cycle time' : 'OK' : 'Error: missing operation'];
      cells.forEach((text) => { const cell = element('td', undefined, text); cell.title = text; row.append(cell); });
      row.addEventListener('click', () => selection.select({ kind: 'standardWorkEntry', id: entry.id }));
      row.addEventListener('dragstart', () => { dragged = entry.id; row.classList.add('standard-work-row--dragging'); });
      row.addEventListener('dragend', () => { dragged = null; row.classList.remove('standard-work-row--dragging'); });
      row.addEventListener('dragover', (event) => { if (dragged && dragged !== entry.id) event.preventDefault(); });
      row.addEventListener('drop', (event) => { event.preventDefault(); if (dragged && dragged !== entry.id) onDropBefore(dragged, entry.id); dragged = null; });
      body.append(row);
    }
    if (!entries.length) { const row = element('tr'); const cell = element('td', 'standard-work-table__empty', 'No entries. Add an operation or populate from Process Flow.'); cell.colSpan = 12; row.append(cell); body.append(row); }
  };
  const reveal = (id: string): void => body.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  return { element: region, render, reveal, dispose: () => { dragged = null; } };
}
