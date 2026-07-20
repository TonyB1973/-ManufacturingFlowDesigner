import type { PlacedResource, PlacedResourcePatch } from '../../models/resources/PlacedResource';
import { MIN_RESOURCE_HEIGHT, MIN_RESOURCE_WIDTH, type ResourceStore } from '../../services/ResourceStore';
import { reportStatus } from '../../core/events/uiEvents';
import { element } from '../../ui/dom';

export interface RightSidebarController {
  readonly element: HTMLElement;
  dispose(): void;
}

interface PropertyFields {
  readonly name: HTMLInputElement;
  readonly type: HTMLOutputElement;
  readonly worldX: HTMLInputElement;
  readonly worldY: HTMLInputElement;
  readonly width: HTMLInputElement;
  readonly height: HTMLInputElement;
  readonly locked: HTMLInputElement;
  readonly visible: HTMLInputElement;
}

function section(title: string, content: HTMLElement, open = true): HTMLDetailsElement {
  const details = element('details', 'inspector-section');
  details.open = open;
  details.append(element('summary', '', title), content);
  return details;
}

function labelledInput(labelText: string, input: HTMLInputElement | HTMLOutputElement): HTMLLabelElement {
  const label = element('label', 'property-field');
  label.append(element('span', '', labelText), input);
  return label;
}

function textInput(): HTMLInputElement {
  const input = element('input', 'property-input');
  input.type = 'text';
  return input;
}

function numberInput(minimum?: number): HTMLInputElement {
  const input = element('input', 'property-input');
  input.type = 'number';
  input.step = '0.001';
  if (minimum !== undefined) input.min = String(minimum);
  return input;
}

function checkboxInput(label: string): HTMLInputElement {
  const input = element('input', 'property-checkbox');
  input.type = 'checkbox';
  input.setAttribute('aria-label', label);
  return input;
}

function summaryRow(container: HTMLElement, label: string, value: string): void {
  container.append(element('span', '', label), element('strong', '', value));
}

export function createRightSidebar(store: ResourceStore): RightSidebarController {
  const sidebar = element('aside', 'sidebar sidebar--right');
  sidebar.setAttribute('aria-label', 'Inspector panels');
  const properties = element('div', 'properties-content');
  const selection = element('div', 'summary-grid');
  const validation = element('div', 'validation-summary');
  validation.append(element('div', 'validation-healthy', '● Project healthy'));
  const metrics = element('div', 'validation-metrics');
  metrics.append(element('span', '', '0 Errors'), element('span', '', '0 Warnings'));
  validation.append(metrics);
  sidebar.append(section('Properties', properties), section('Selection Summary', selection), section('Validation Summary', validation));

  let fields: PropertyFields | null = null;
  let fieldsResourceId: string | null = null;

  const update = (patch: PlacedResourcePatch, label: string): void => {
    const selected = store.getSelectedResource();
    if (!selected) return;
    if (store.updateResource(selected.id, patch)) reportStatus(`${label} updated`);
    else reportStatus(`Invalid ${label.toLocaleLowerCase()} value`);
  };

  const bindNumber = (input: HTMLInputElement, property: 'worldX' | 'worldY' | 'width' | 'height', label: string): void => {
    input.addEventListener('input', () => {
      const value = Number(input.value);
      const minimumValid = property === 'width'
        ? value >= MIN_RESOURCE_WIDTH
        : property === 'height' ? value >= MIN_RESOURCE_HEIGHT : true;
      const valid = Number.isFinite(value) && minimumValid;
      input.setAttribute('aria-invalid', String(!valid));
      if (valid) update({ [property]: value }, label);
      else reportStatus(`Invalid ${label.toLocaleLowerCase()} value`);
    });
  };

  const buildFields = (resource: PlacedResource): PropertyFields => {
    const form = element('form', 'properties-form');
    form.addEventListener('submit', (event) => event.preventDefault());
    const name = textInput();
    const type = element('output', 'property-output');
    const worldX = numberInput();
    const worldY = numberInput();
    const width = numberInput(MIN_RESOURCE_WIDTH);
    const height = numberInput(MIN_RESOURCE_HEIGHT);
    const locked = checkboxInput('Locked');
    const visible = checkboxInput('Visible');
    name.addEventListener('input', () => update({ name: name.value.trim() }, 'Resource name'));
    bindNumber(worldX, 'worldX', 'X position');
    bindNumber(worldY, 'worldY', 'Y position');
    bindNumber(width, 'width', 'Width');
    bindNumber(height, 'height', 'Height');
    locked.addEventListener('change', () => update({ locked: locked.checked }, 'Lock state'));
    visible.addEventListener('change', () => update({ visible: visible.checked }, 'Visibility'));
    const lockField = element('label', 'property-toggle');
    lockField.append(locked, element('span', '', 'Locked'));
    const visibleField = element('label', 'property-toggle');
    visibleField.append(visible, element('span', '', 'Visible'));
    const toggles = element('div', 'property-toggles');
    toggles.append(lockField, visibleField);
    form.append(
      labelledInput('Resource name', name),
      labelledInput('Resource type', type),
      labelledInput('X position', worldX),
      labelledInput('Y position', worldY),
      labelledInput('Width', width),
      labelledInput('Height', height),
      toggles,
    );
    properties.replaceChildren(form);
    fieldsResourceId = resource.id;
    return { name, type, worldX, worldY, width, height, locked, visible };
  };

  const syncField = (input: HTMLInputElement, value: string): void => {
    if (document.activeElement !== input) {
      input.value = value;
      input.setAttribute('aria-invalid', 'false');
    }
  };

  const renderProperties = (resource: PlacedResource | null): void => {
    if (!resource) {
      fields = null;
      fieldsResourceId = null;
      const empty = element('div', 'empty-inspector');
      empty.append(element('strong', '', 'No selection'), element('p', '', 'Select a resource to view and edit its properties.'));
      properties.replaceChildren(empty);
      return;
    }
    if (!fields || fieldsResourceId !== resource.id) fields = buildFields(resource);
    syncField(fields.name, resource.name);
    fields.type.textContent = resource.resourceType;
    syncField(fields.worldX, resource.worldX.toFixed(3));
    syncField(fields.worldY, resource.worldY.toFixed(3));
    syncField(fields.width, resource.width.toFixed(3));
    syncField(fields.height, resource.height.toFixed(3));
    fields.worldX.disabled = resource.locked;
    fields.worldY.disabled = resource.locked;
    fields.locked.checked = resource.locked;
    fields.visible.checked = resource.visible;
  };

  const renderSelection = (resource: PlacedResource | null): void => {
    selection.replaceChildren();
    if (!resource) {
      summaryRow(selection, 'Selected items', '0');
      summaryRow(selection, 'Object type', '—');
      return;
    }
    summaryRow(selection, 'Selected resource', resource.id);
    summaryRow(selection, 'Template ID', resource.templateId);
    summaryRow(selection, 'Name', resource.name);
    summaryRow(selection, 'Type', resource.resourceType);
    summaryRow(selection, 'Position', `${resource.worldX.toFixed(3)}, ${resource.worldY.toFixed(3)}`);
    summaryRow(selection, 'Size', `${resource.width.toFixed(3)} × ${resource.height.toFixed(3)}`);
    summaryRow(selection, 'Locked', resource.locked ? 'Yes' : 'No');
  };

  const render = (): void => {
    const selected = store.getSelectedResource();
    renderProperties(selected);
    renderSelection(selected);
  };
  const unsubscribe = store.subscribe(render);
  render();
  return { element: sidebar, dispose: unsubscribe };
}
