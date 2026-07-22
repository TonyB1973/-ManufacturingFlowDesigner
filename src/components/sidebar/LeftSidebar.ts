import type { OperationStore } from '../../services/OperationStore';
import type { ConnectionStore } from '../../services/ConnectionStore';
import type { ResourceStore } from '../../services/ResourceStore';
import { element } from '../../ui/dom';
import { createOperationLibrary } from './OperationLibrary';
import { createProjectExplorer } from './ProjectExplorer';
import { createResourceLibrary } from './ResourceLibrary';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import type { ProjectSessionService } from '../../services/project/ProjectSessionService';
import type { SelectionController } from '../../models/selection/Selection';
import type { CommandFactory } from '../../services/history/CommandFactory';
import type { FactoryStructureStore } from '../../services/FactoryStructureStore';

export interface LeftSidebarController { readonly element: HTMLElement; dispose(): void; }

export function createLeftSidebar(resourceStore: ResourceStore, operationStore: OperationStore, connectionStore: ConnectionStore, structureStore: FactoryStructureStore, workspaceStore: WorkspaceStore, project: ProjectSessionService, selection: SelectionController, commands: CommandFactory): LeftSidebarController {
  const sidebar = element('aside', 'sidebar sidebar--left'); sidebar.setAttribute('aria-label', 'Project and object libraries');
  const explorer = createProjectExplorer(operationStore, connectionStore, resourceStore, structureStore, workspaceStore, project, selection, commands);
  const resourceLibrary = createResourceLibrary(resourceStore, commands); const operationLibrary = createOperationLibrary(operationStore);
  const panels = element('div', 'library-panels'); const resourcePanel = element('div'); const operationPanel = element('div');
  resourcePanel.append(resourceLibrary.element); operationPanel.append(operationLibrary.element); panels.append(resourcePanel, operationPanel);
  const renderWorkspace = (): void => { const process = workspaceStore.getActive() === 'processFlow'; resourcePanel.hidden = process; operationPanel.hidden = !process; };
  const unsubscribeWorkspace = workspaceStore.subscribe(renderWorkspace); renderWorkspace(); sidebar.append(explorer.element, panels);
  return { element: sidebar, dispose: () => { unsubscribeWorkspace(); explorer.dispose(); resourceLibrary.dispose(); operationLibrary.dispose(); } };
}
