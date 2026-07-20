import { RIBBON_TABS } from '../../core/constants/commands';
import { dispatchCanvasCommand, reportPlaceholder, type CanvasCommand } from '../../core/events/uiEvents';
import { actionButton, element } from '../../ui/dom';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import type { ProjectFileCommands } from '../../services/project/ProjectFileController';

export interface RibbonController { readonly element: HTMLElement; setFileCommands(commands: ProjectFileCommands): void; setFileBusy(busy: boolean): void; dispose(): void; }

export function createRibbon(workspaceStore?: WorkspaceStore): RibbonController {
  const ribbon = element('section', 'ribbon');
  ribbon.setAttribute('aria-label', 'Application ribbon');
  const tabs = element('div', 'ribbon__tabs');
  tabs.setAttribute('role', 'tablist');
  const content = element('div', 'ribbon__content');
  let fileCommands: ProjectFileCommands | null = null;
  let fileBusy = false;

  const activate = (index: number): void => {
    tabs.querySelectorAll('[role="tab"]').forEach((tab, tabIndex) => {
      tab.setAttribute('aria-selected', String(tabIndex === index));
      tab.setAttribute('tabindex', tabIndex === index ? '0' : '-1');
    });
    content.replaceChildren();
    for (const group of RIBBON_TABS[index].groups) {
      const groupNode = element('div', 'ribbon-group');
      const commands = element('div', 'ribbon-group__commands');
      for (const command of group.commands) {
        const button = actionButton(command);
        button.dataset.commandName = command;
        button.addEventListener('click', () => {
          const canvasCommand = canvasCommands.get(command);
          const fileCommand = fileCommandNames.get(command);
          if (fileCommand && fileCommands) void fileCommands[fileCommand]();
          else if (canvasCommand) dispatchCanvasCommand(canvasCommand);
          else reportPlaceholder(command);
        });
        commands.append(button);
      }
      groupNode.append(commands, element('span', 'ribbon-group__label', group.name));
      content.append(groupNode);
    }
    updateWorkspaceCommands();
  };

  const updateWorkspaceCommands = (): void => { const workspace = workspaceStore?.getActive() ?? 'processFlow'; content.querySelectorAll<HTMLButtonElement>('[data-command-name]').forEach((button) => { const command = button.dataset.commandName; button.disabled = (fileBusy && Boolean(command && fileCommandNames.has(command))) || ((command === 'Add Operation' || command === 'Connect' || command === 'Delete Link') && workspace !== 'processFlow') || (command === 'Add Resource' && workspace !== 'factoryLayout'); }); };

  RIBBON_TABS.forEach((tab, index) => {
    const button = actionButton(tab.name, 'ribbon-tab');
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => activate(index));
    tabs.append(button);
  });
  ribbon.append(tabs, content);
  activate(3);
  const unsubscribe = workspaceStore?.subscribe(updateWorkspaceCommands);
  return { element: ribbon, setFileCommands: (commands) => { fileCommands = commands; }, setFileBusy: (busy) => { fileBusy = busy; updateWorkspaceCommands(); }, dispose: () => unsubscribe?.() };
}

const fileCommandNames = new Map<string, keyof ProjectFileCommands>([['New', 'newProject'], ['Open', 'open'], ['Save', 'save'], ['Save As', 'saveAs']]);

const canvasCommands = new Map<string, CanvasCommand>([
  ['Zoom In', 'zoom-in'],
  ['Zoom Out', 'zoom-out'],
  ['Fit View', 'fit'],
  ['Grid', 'grid'],
  ['Canvas Focus', 'focus'],
  ['Delete', 'delete-selection'],
  ['Add Operation', 'add-operation'],
  ['Connect', 'connect'],
  ['Add Resource', 'add-resource'],
]);

