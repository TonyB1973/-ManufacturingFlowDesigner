import { RIBBON_TABS } from '../../core/constants/commands';
import { dispatchCanvasCommand, reportPlaceholder, type CanvasCommand } from '../../core/events/uiEvents';
import { actionButton, element } from '../../ui/dom';

export function createRibbon(): HTMLElement {
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
  };

  RIBBON_TABS.forEach((tab, index) => {
    const button = actionButton(tab.name, 'ribbon-tab');
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => activate(index));
    tabs.append(button);
  });
  ribbon.append(tabs, content);
  activate(3);
  return ribbon;
}

const canvasCommands = new Map<string, CanvasCommand>([
  ['Zoom In', 'zoom-in'],
  ['Zoom Out', 'zoom-out'],
  ['Fit View', 'fit'],
  ['Grid', 'grid'],
  ['Canvas Focus', 'focus'],
]);

