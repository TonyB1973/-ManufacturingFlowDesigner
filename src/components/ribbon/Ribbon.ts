import { RIBBON_TABS } from '../../core/constants/commands';
import { dispatchCanvasCommand, reportPlaceholder, type CanvasCommand } from '../../core/events/uiEvents';
import { actionButton, element } from '../../ui/dom';
import type { WorkspaceStore } from '../../services/WorkspaceStore';

export function createRibbon(workspaceStore?: WorkspaceStore): HTMLElement {
  const ribbon = element('section', 'ribbon');
  ribbon.setAttribute('aria-label', 'Application ribbon');
  const tabs = element('div', 'ribbon__tabs');
  tabs.setAttribute('role', 'tablist');
  const content = element('div', 'ribbon__content');

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
          if (canvasCommand) dispatchCanvasCommand(canvasCommand);
          else reportPlaceholder(command);
        });
        commands.append(button);
      }
      groupNode.append(commands, element('span', 'ribbon-group__label', group.name));
      content.append(groupNode);
    }
    updateWorkspaceCommands();
  };

  const updateWorkspaceCommands = (): void => { const workspace = workspaceStore?.getActive() ?? 'processFlow'; content.querySelectorAll<HTMLButtonElement>('[data-command-name]').forEach((button) => { const command = button.dataset.commandName; button.disabled = (command === 'Add Operation' && workspace !== 'processFlow') || (command === 'Add Resource' && workspace !== 'factoryLayout'); }); };

  RIBBON_TABS.forEach((tab, index) => {
    const button = actionButton(tab.name, 'ribbon-tab');
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => activate(index));
    tabs.append(button);
  });
  ribbon.append(tabs, content);
  activate(3);
  workspaceStore?.subscribe(updateWorkspaceCommands);
  return ribbon;
}

const canvasCommands = new Map<string, CanvasCommand>([
  ['Zoom In', 'zoom-in'],
  ['Zoom Out', 'zoom-out'],
  ['Fit View', 'fit'],
  ['Grid', 'grid'],
  ['Canvas Focus', 'focus'],
  ['Delete', 'delete-selection'],
  ['Add Operation', 'add-operation'],
  ['Add Resource', 'add-resource'],
]);

