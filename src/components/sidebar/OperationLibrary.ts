import {
  OPERATION_DRAG_ENDED_EVENT, OPERATION_DRAG_MOVED_EVENT, OPERATION_DRAG_STARTED_EVENT,
  dispatchOperationDrag, requestKeyboardOperationPlacement,
} from '../../core/events/operationEvents';
import type { OperationCategory, OperationTemplate } from '../../models/operations/OperationTemplate';
import type { OperationStore } from '../../services/OperationStore';
import { element } from '../../ui/dom';
import { CANCEL_ACTIVE_INTERACTIONS_EVENT } from '../../core/events/uiEvents';

interface DragState {
  readonly pointerId: number; readonly template: OperationTemplate; readonly startX: number;
  readonly startY: number; readonly captureElement: HTMLElement; active: boolean; ghost: HTMLElement | null;
}

export interface OperationLibraryController { readonly element: HTMLElement; dispose(): void; }

export function createOperationLibrary(store: OperationStore): OperationLibraryController {
  const library = element('section', 'operation-library');
  const heading = element('div', 'panel-heading-row');
  const count = element('span', 'count-badge');
  heading.append(element('h2', 'panel-heading', 'Operation Library'), count);
  const search = element('input', 'search-input');
  search.type = 'search'; search.placeholder = 'Search operations'; search.setAttribute('aria-label', 'Search operation library');
  const category = element('select', 'category-select'); category.setAttribute('aria-label', 'Operation category');
  const all = element('option', '', 'All categories'); all.value = 'All'; category.append(all);
  const categories = [...new Set(store.getTemplates().map((template) => template.category))];
  categories.forEach((name) => { const option = element('option', '', name); option.value = name; category.append(option); });
  const results = element('div', 'resource-results operation-results');
  library.append(heading, search, category, results);
  let selectedCategory: OperationCategory | 'All' = 'All';
  let drag: DragState | null = null;

  const filtered = (): readonly OperationTemplate[] => {
    const query = search.value.trim().toLocaleLowerCase();
    return store.getTemplates().filter((template) => (selectedCategory === 'All' || template.category === selectedCategory)
      && (!query || `${template.name} ${template.operationType} ${template.timingCategory} ${template.tags.join(' ')}`.toLocaleLowerCase().includes(query)));
  };
  const card = (template: OperationTemplate): HTMLElement => {
    const node = element('article', 'operation-template-card');
    node.tabIndex = 0; node.setAttribute('role', 'button'); node.dataset.operationTemplateId = template.id;
    node.setAttribute('aria-label', `${template.name}, ${template.operationType}. Drag to place or press Enter to place at canvas centre.`);
    const timingClass = template.timingCategory === 'Value Added' ? 'va' : template.timingCategory === 'Non-Value Added' ? 'nva' : 'rnva';
    node.append(element('span', 'drag-handle', '⠿'), element('span', 'operation-template-card__icon', template.icon),
      element('strong', '', template.name), element('span', 'operation-template-card__type', template.operationType),
      element('span', `timing-badge timing-badge--${timingClass}`, template.timingCategory));
    return node;
  };
  const render = (): void => {
    const templates = filtered(); count.textContent = String(templates.length); results.replaceChildren();
    if (!templates.length) { results.append(element('div', 'resource-library__empty', 'No operations found')); return; }
    for (const groupName of categories) {
      const group = templates.filter((template) => template.category === groupName); if (!group.length) continue;
      const details = element('details', 'resource-section'); details.open = true; details.append(element('summary', '', `${groupName} (${group.length})`));
      const content = element('div', 'resource-section__content'); group.forEach((template) => content.append(card(template)));
      details.append(content); results.append(details);
    }
  };
  const detail = (event: PointerEvent, cancelled = false) => ({ templateId: drag?.template.id ?? '', clientX: event.clientX, clientY: event.clientY, altKey: event.altKey, cancelled });
  const pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const node = (event.target as Element).closest<HTMLElement>('[data-operation-template-id]');
    const template = store.getTemplates().find((item) => item.id === node?.dataset.operationTemplateId);
    if (!node || !template) return;
    drag = { pointerId: event.pointerId, template, startX: event.clientX, startY: event.clientY, captureElement: node, active: false, ghost: null };
    node.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 5) {
      drag.active = true; drag.ghost = element('div', 'resource-drag-ghost', drag.template.name); document.body.append(drag.ghost);
      document.body.classList.add('resource-template-dragging'); dispatchOperationDrag(OPERATION_DRAG_STARTED_EVENT, detail(event));
    }
    if (!drag.active) return;
    event.preventDefault(); if (drag.ghost) drag.ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
    dispatchOperationDrag(OPERATION_DRAG_MOVED_EVENT, detail(event));
  };
  const finish = (event: PointerEvent, cancelled: boolean): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.captureElement.hasPointerCapture(event.pointerId)) drag.captureElement.releasePointerCapture(event.pointerId);
    if (drag.active) dispatchOperationDrag(OPERATION_DRAG_ENDED_EVENT, detail(event, cancelled));
    drag.ghost?.remove(); document.body.classList.remove('resource-template-dragging'); drag = null;
  };
  const pointerUp = (event: PointerEvent): void => finish(event, false);
  const pointerCancel = (event: PointerEvent): void => finish(event, true);
  const cancelActiveDrag = (): void => {
    if (!drag) return; if (drag.captureElement.hasPointerCapture(drag.pointerId)) drag.captureElement.releasePointerCapture(drag.pointerId);
    if (drag.active) dispatchOperationDrag(OPERATION_DRAG_ENDED_EVENT, { templateId: drag.template.id, clientX: drag.startX, clientY: drag.startY, altKey: false, cancelled: true });
    drag.ghost?.remove(); document.body.classList.remove('resource-template-dragging'); drag = null;
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const templateId = (event.target as Element).closest<HTMLElement>('[data-operation-template-id]')?.dataset.operationTemplateId;
    if (!templateId) return; event.preventDefault(); requestKeyboardOperationPlacement(templateId);
  };
  search.addEventListener('input', render); category.addEventListener('change', () => { selectedCategory = category.value as OperationCategory | 'All'; render(); });
  results.addEventListener('pointerdown', pointerDown); results.addEventListener('keydown', keyDown);
  document.addEventListener('pointermove', pointerMove); document.addEventListener('pointerup', pointerUp); document.addEventListener('pointercancel', pointerCancel);
  document.addEventListener(CANCEL_ACTIVE_INTERACTIONS_EVENT, cancelActiveDrag);
  render();
  return { element: library, dispose: () => { document.removeEventListener('pointermove', pointerMove); document.removeEventListener('pointerup', pointerUp); document.removeEventListener('pointercancel', pointerCancel); document.removeEventListener(CANCEL_ACTIVE_INTERACTIONS_EVENT, cancelActiveDrag); drag?.ghost?.remove(); document.body.classList.remove('resource-template-dragging'); } };
}
