import { createRibbon } from '../components/ribbon/Ribbon';
import { createLeftSidebar } from '../components/sidebar/LeftSidebar';
import { createRightSidebar } from '../components/sidebar/RightSidebar';
import { createStatusBar, type StatusBarController } from '../components/statusbar/StatusBar';
import { createTitleBar } from '../components/titlebar/TitleBar';
import { createWorkspace } from '../components/workspace/Workspace';
import { actionButton, element } from '../ui/dom';
import { RESOURCE_TEMPLATES } from '../core/constants/resourceTemplates';
import { ResourceStore } from '../services/ResourceStore';
import { ResourceIdGenerator } from '../utilities/ResourceIdGenerator';

export interface AppShellResult {
  readonly element: HTMLElement;
  readonly statusBar: StatusBarController;
  dispose(): void;
}

export function createAppShell(): AppShellResult {
  const shell = element('div', 'app-shell');
  const body = element('div', 'app-body');
  const resourceStore = new ResourceStore(RESOURCE_TEMPLATES, new ResourceIdGenerator());
  const left = createLeftSidebar(resourceStore);
  const right = createRightSidebar(resourceStore);
  const statusBar = createStatusBar();
  const leftToggle = actionButton('Hide project and resource panels', 'panel-toggle panel-toggle--left');
  const rightToggle = actionButton('Hide inspector panels', 'panel-toggle panel-toggle--right');

  leftToggle.textContent = '‹';
  rightToggle.textContent = '›';
  leftToggle.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('app-shell--left-collapsed');
    leftToggle.textContent = collapsed ? '›' : '‹';
    leftToggle.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} project and resource panels`);
  });
  rightToggle.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('app-shell--right-collapsed');
    rightToggle.textContent = collapsed ? '‹' : '›';
    rightToggle.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} inspector panels`);
  });
  const workspace = createWorkspace({
    application: shell,
    statusBar,
    resourceStore,
    onFocusModeChange: (active) => shell.classList.toggle('app-shell--canvas-focus', active),
  });
  body.append(left.element, leftToggle, workspace.element, rightToggle, right.element);
  shell.append(createTitleBar(), createRibbon(), body, statusBar.element);
  const unsubscribeStatus = resourceStore.subscribe(() => {
    statusBar.setSelectionCount(resourceStore.getSelectedResource() ? 1 : 0);
    statusBar.setResourceCount(resourceStore.getResourceCount());
  });
  return {
    element: shell,
    statusBar,
    dispose: () => {
      unsubscribeStatus();
      left.dispose();
      right.dispose();
      workspace.dispose();
    },
  };
}

