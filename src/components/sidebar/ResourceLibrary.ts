import {
  RESOURCE_DRAG_ENDED_EVENT,
  RESOURCE_DRAG_MOVED_EVENT,
  RESOURCE_DRAG_STARTED_EVENT,
  dispatchResourceDrag,
  requestKeyboardResourcePlacement,
} from '../../core/events/resourceEvents';
import { RESOURCE_CATEGORIES, type ResourceCategory, type ResourceTemplate } from '../../models/resources/ResourceTemplate';
import type { ResourceStore } from '../../services/ResourceStore';
import { actionButton, element } from '../../ui/dom';
import { createResourceIcon } from '../../ui/resourceIcons';

export interface ResourceLibraryController {
  readonly element: HTMLElement;
  dispose(): void;
}

interface DragState {
  readonly pointerId: number;
  readonly template: ResourceTemplate;
  readonly startX: number;
  readonly startY: number;
  readonly captureElement: HTMLElement;
  active: boolean;
  ghost: HTMLElement | null;
}

export function createResourceLibrary(store: ResourceStore): ResourceLibraryController {
  const library = element('section', 'panel-section resource-library');
  const titleRow = element('div', 'panel-heading-row');
  const count = element('span', 'count-badge');
  titleRow.append(element('h2', 'panel-heading', 'Resource Library'), count);

  const search = element('input', 'search-input');
  search.type = 'search';
  search.placeholder = 'Search resources';
  search.setAttribute('aria-label', 'Search resource library');

  const filters = element('div', 'resource-filters');
  const categorySelect = element('select', 'category-select');
  categorySelect.setAttribute('aria-label', 'Resource category');
  const allOption = element('option', '', 'All categories');
  allOption.value = 'All';
  categorySelect.append(allOption);
  for (const category of RESOURCE_CATEGORIES) {
    const option = element('option', '', category);
    option.value = category;
    categorySelect.append(option);
  }
  const favourites = actionButton('Show favourites only', 'favourites-filter');
  favourites.textContent = '★ Favourites';
  favourites.title = 'Show favourites only';
  favourites.setAttribute('aria-pressed', 'false');
  filters.append(categorySelect, favourites);

  const results = element('div', 'resource-results');
  library.append(titleRow, search, filters, results);

  let selectedCategory: ResourceCategory | 'All' = 'All';
  let favouritesOnly = false;
  let drag: DragState | null = null;

  const filteredTemplates = (): readonly ResourceTemplate[] => {
    const query = search.value.trim().toLocaleLowerCase();
    return store.getTemplates().filter((template) => {
      const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
      const matchesFavourite = !favouritesOnly || template.isFavourite;
      const haystack = `${template.name} ${template.description} ${template.resourceType} ${template.tags.join(' ')}`.toLocaleLowerCase();
      return matchesCategory && matchesFavourite && (!query || haystack.includes(query));
    });
  };

  const createCard = (template: ResourceTemplate): HTMLElement => {
    const card = element('article', 'resource-card');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${template.name}, ${template.resourceType}. Drag to place or press Enter to place at canvas centre.`);
    card.dataset.templateId = template.id;
    const handle = element('span', 'drag-handle', '⠿');
    handle.setAttribute('aria-hidden', 'true');
    const icon = createResourceIcon(template.icon, 'resource-card__icon');
    const copy = element('span', 'resource-card__copy');
    copy.append(element('strong', '', template.name), element('span', 'resource-card__type', template.resourceType), element('span', 'resource-card__description', template.description));
    const favourite = actionButton(`${template.isFavourite ? 'Remove' : 'Add'} ${template.name} ${template.isFavourite ? 'from' : 'to'} favourites`, 'resource-favourite');
    favourite.textContent = template.isFavourite ? '★' : '☆';
    favourite.title = template.isFavourite ? 'Remove from favourites' : 'Add to favourites';
    favourite.dataset.favouriteTemplateId = template.id;
    favourite.setAttribute('aria-pressed', String(template.isFavourite));
    card.append(handle, icon, copy, favourite);
    return card;
  };

  const render = (): void => {
    const templates = filteredTemplates();
    count.textContent = String(templates.length);
    results.replaceChildren();
    if (templates.length === 0) {
      const empty = element('div', 'resource-library__empty');
      empty.append(element('strong', '', 'No resources found'), element('span', '', 'Adjust the search or resource filters.'));
      results.append(empty);
      return;
    }
    const groups = new Map<ResourceCategory, ResourceTemplate[]>();
    for (const template of templates) {
      const group = groups.get(template.category) ?? [];
      group.push(template);
      groups.set(template.category, group);
    }
    for (const category of RESOURCE_CATEGORIES) {
      const group = groups.get(category);
      if (!group) continue;
      const details = element('details', 'resource-section');
      details.open = true;
      details.append(element('summary', '', `${category} (${group.length})`));
      const cards = element('div', 'resource-section__content');
      group.forEach((template) => cards.append(createCard(template)));
      details.append(cards);
      results.append(details);
    }
  };

  const dragDetail = (event: PointerEvent, cancelled = false) => ({
    templateId: drag?.template.id ?? '',
    clientX: event.clientX,
    clientY: event.clientY,
    altKey: event.altKey,
    cancelled,
  });

  const beginVisualDrag = (event: PointerEvent): void => {
    if (!drag || drag.active) return;
    drag.active = true;
    drag.ghost = element('div', 'resource-drag-ghost', drag.template.name);
    document.body.append(drag.ghost);
    document.body.classList.add('resource-template-dragging');
    dispatchResourceDrag(RESOURCE_DRAG_STARTED_EVENT, dragDetail(event));
  };

  const positionGhost = (clientX: number, clientY: number): void => {
    if (drag?.ghost) drag.ghost.style.transform = `translate(${clientX + 14}px, ${clientY + 14}px)`;
  };

  const finishDrag = (event: PointerEvent, cancelled: boolean): void => {
    if (!drag) return;
    if (drag.captureElement.hasPointerCapture(event.pointerId)) drag.captureElement.releasePointerCapture(event.pointerId);
    if (drag.active) dispatchResourceDrag(RESOURCE_DRAG_ENDED_EVENT, dragDetail(event, cancelled));
    drag.ghost?.remove();
    document.body.classList.remove('resource-template-dragging');
    drag = null;
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || (event.target as Element).closest('[data-favourite-template-id]')) return;
    const card = (event.target as Element).closest<HTMLElement>('[data-template-id]');
    const templateId = card?.dataset.templateId;
    const template = templateId ? store.getTemplates().find((item) => item.id === templateId) : undefined;
    if (!card || !template) return;
    drag = { pointerId: event.pointerId, template, startX: event.clientX, startY: event.clientY, captureElement: card, active: false, ghost: null };
    card.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (moved >= 5) beginVisualDrag(event);
    if (!drag.active) return;
    event.preventDefault();
    positionGhost(event.clientX, event.clientY);
    dispatchResourceDrag(RESOURCE_DRAG_MOVED_EVENT, dragDetail(event));
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (drag?.pointerId === event.pointerId) finishDrag(event, false);
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    if (drag?.pointerId === event.pointerId) finishDrag(event, true);
  };

  const handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element).closest<HTMLElement>('[data-favourite-template-id]');
    const templateId = button?.dataset.favouriteTemplateId;
    if (templateId) store.toggleFavourite(templateId);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = (event.target as Element).closest<HTMLElement>('[data-template-id]');
    const templateId = card?.dataset.templateId;
    if (!templateId || (event.target as Element).closest('[data-favourite-template-id]')) return;
    event.preventDefault();
    requestKeyboardResourcePlacement(templateId);
  };

  search.addEventListener('input', render);
  categorySelect.addEventListener('change', () => {
    selectedCategory = categorySelect.value as ResourceCategory | 'All';
    render();
  });
  favourites.addEventListener('click', () => {
    favouritesOnly = !favouritesOnly;
    favourites.setAttribute('aria-pressed', String(favouritesOnly));
    favourites.classList.toggle('favourites-filter--active', favouritesOnly);
    render();
  });
  results.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerCancel);
  results.addEventListener('click', handleClick);
  results.addEventListener('keydown', handleKeyDown);
  const unsubscribe = store.subscribe((change) => { if (change.kind === 'template') render(); });
  render();

  return {
    element: library,
    dispose: () => {
      unsubscribe();
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      drag?.ghost?.remove();
      document.body.classList.remove('resource-template-dragging');
    },
  };
}
