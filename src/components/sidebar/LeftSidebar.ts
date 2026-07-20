import type { OperationStore } from '../../services/OperationStore';
import type { ConnectionStore } from '../../services/ConnectionStore';
import type { ResourceStore } from '../../services/ResourceStore';
import { actionButton, element } from '../../ui/dom';
import { createOperationLibrary } from './OperationLibrary';
import { createProjectExplorer } from './ProjectExplorer';
import { createResourceLibrary } from './ResourceLibrary';

export interface LeftSidebarController { readonly element: HTMLElement; dispose(): void; }

export function createLeftSidebar(resourceStore: ResourceStore, operationStore: OperationStore, connectionStore: ConnectionStore): LeftSidebarController {
  const sidebar = element('aside', 'sidebar sidebar--left'); sidebar.setAttribute('aria-label', 'Project and object libraries');
  const explorer = createProjectExplorer(operationStore, connectionStore);
  const switcher = element('div', 'library-switcher'); switcher.setAttribute('role', 'tablist'); switcher.setAttribute('aria-label', 'Object library');
  const resourcesTab = actionButton('Resources', 'library-switcher__tab'); resourcesTab.setAttribute('role', 'tab');
  const operationsTab = actionButton('Operations', 'library-switcher__tab'); operationsTab.setAttribute('role', 'tab');
  const resourceLibrary = createResourceLibrary(resourceStore); const operationLibrary = createOperationLibrary(operationStore);
  const panels = element('div', 'library-panels'); const resourcePanel = element('div'); const operationPanel = element('div');
  resourcePanel.append(resourceLibrary.element); operationPanel.append(operationLibrary.element); panels.append(resourcePanel, operationPanel);
  const activate = (operationsActive: boolean): void => {
    resourcesTab.setAttribute('aria-selected', String(!operationsActive)); operationsTab.setAttribute('aria-selected', String(operationsActive));
    resourcesTab.tabIndex = operationsActive ? -1 : 0; operationsTab.tabIndex = operationsActive ? 0 : -1;
    resourcePanel.hidden = operationsActive; operationPanel.hidden = !operationsActive;
  };
  resourcesTab.addEventListener('click', () => activate(false)); operationsTab.addEventListener('click', () => activate(true));
  switcher.append(resourcesTab, operationsTab); activate(false); sidebar.append(explorer.element, switcher, panels);
  return { element: sidebar, dispose: () => { explorer.dispose(); resourceLibrary.dispose(); operationLibrary.dispose(); } };
}
