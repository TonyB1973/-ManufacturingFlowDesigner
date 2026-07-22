import { RIBBON_TABS } from '../../core/constants/commands';
import { dispatchCanvasCommand, reportPlaceholder, type CanvasCommand } from '../../core/events/uiEvents';
import { actionButton, element } from '../../ui/dom';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import type { ProjectFileCommands } from '../../services/project/ProjectFileController';
import type { HistoryCommands } from '../../services/history/HistoryController';
import type { GeometryEditingService, GeometryCommand } from '../../services/geometry/GeometryEditingService';

export interface RibbonController { readonly element: HTMLElement; setFileCommands(commands: ProjectFileCommands): void; setHistoryCommands(commands: HistoryCommands): void; setFileBusy(busy: boolean): void; dispose(): void; }

export function createRibbon(workspaceStore?: WorkspaceStore, geometryEditing?: GeometryEditingService): RibbonController {
  const ribbon = element('section', 'ribbon');
  ribbon.setAttribute('aria-label', 'Application ribbon');
  const tabs = element('div', 'ribbon__tabs');
  tabs.setAttribute('role', 'tablist');
  const content = element('div', 'ribbon__content');
  let fileCommands: ProjectFileCommands | null = null;
  let historyCommands: HistoryCommands | null = null;
  let unsubscribeHistory: (() => void) | null = null;
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
        button.title = command;
        button.addEventListener('click', () => {
          const canvasCommand = canvasCommands.get(command);
          const fileCommand = fileCommandNames.get(command);
          const historyCommand = historyCommandNames.get(command);
          if (fileCommand && fileCommands) void fileCommands[fileCommand]();
          else if (historyCommand && historyCommands) historyCommands[historyCommand]();
          else if (command === 'Standard Work') workspaceStore?.activate('standardWork');
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

  const updateWorkspaceCommands = (): void => { const workspace = workspaceStore?.getActive() ?? 'processFlow'; const history = historyCommands?.getState(); content.querySelectorAll<HTMLButtonElement>('[data-command-name]').forEach((button) => { const command = button.dataset.commandName; const geometryCommand = command ? geometryCommandNames.get(command) : undefined; const factoryOnly = ['Add Resource', 'Rotate Left', 'Rotate Right', 'Reset Rotation', 'Clearance Envelopes', 'Fit Layout', 'Fit Including Clearance'].includes(command ?? ''); const canvasOnly = Boolean(command && canvasCommands.has(command)); button.disabled = (fileBusy && Boolean(command && fileCommandNames.has(command))) || (command === 'Undo' && !history?.canUndo) || (command === 'Redo' && !history?.canRedo) || (workspace === 'standardWork' && canvasOnly) || Boolean(geometryCommand && !geometryEditing?.isAvailable(geometryCommand)) || ((command === 'Add Operation' || command === 'Connect' || command === 'Delete Link') && workspace !== 'processFlow') || (factoryOnly && workspace !== 'factoryLayout'); if (command === 'Undo') { const label = history?.undoDescription ? `Undo ${history.undoDescription}` : 'Nothing to undo'; button.title = `${label} (Ctrl+Z)`; button.setAttribute('aria-label', label); } else if (command === 'Redo') { const label = history?.redoDescription ? `Redo ${history.redoDescription}` : 'Nothing to redo'; button.title = `${label} (Ctrl+Y or Ctrl+Shift+Z)`; button.setAttribute('aria-label', label); } }); };

  RIBBON_TABS.forEach((tab, index) => {
    const button = actionButton(tab.name, 'ribbon-tab');
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => activate(index));
    tabs.append(button);
  });
  ribbon.append(tabs, content);
  activate(4);
  const unsubscribe = workspaceStore?.subscribe(updateWorkspaceCommands);
  const unsubscribeGeometry = geometryEditing?.subscribe(updateWorkspaceCommands);
  return { element: ribbon, setFileCommands: (commands) => { fileCommands = commands; }, setHistoryCommands: (commands) => { unsubscribeHistory?.(); historyCommands = commands; unsubscribeHistory = commands.subscribe(updateWorkspaceCommands); updateWorkspaceCommands(); }, setFileBusy: (busy) => { fileBusy = busy; updateWorkspaceCommands(); }, dispose: () => { unsubscribe?.(); unsubscribeGeometry?.(); unsubscribeHistory?.(); } };
}

const fileCommandNames = new Map<string, keyof ProjectFileCommands>([['New', 'newProject'], ['Open', 'open'], ['Save', 'save'], ['Save As', 'saveAs'], ['Load Demo', 'loadDemo']]);
const historyCommandNames = new Map<string, 'undo' | 'redo'>([['Undo', 'undo'], ['Redo', 'redo']]);

const canvasCommands = new Map<string, CanvasCommand>([
  ['Zoom In', 'zoom-in'],
  ['Zoom Out', 'zoom-out'],
  ['Fit View', 'fit'],
  ['Fit Layout', 'fit-layout'],
  ['Fit Including Clearance', 'fit-clearance'],
  ['Clearance Envelopes', 'toggle-clearance'],
  ['Rotate Left', 'rotate-left'],
  ['Rotate Right', 'rotate-right'],
  ['Reset Rotation', 'rotation-reset'],
  ['Grid', 'grid'],
  ['Canvas Focus', 'focus'],
  ['Delete', 'delete-selection'],
  ['Cut', 'cut'],
  ['Copy', 'copy'],
  ['Paste', 'paste'],
  ['Duplicate', 'duplicate'],
  ['Select All', 'select-all'],
  ['Clear Selection', 'clear-selection'],
  ['Add Operation', 'add-operation'],
  ['Connect', 'connect'],
  ['Add Resource', 'add-resource'],
  ['Align Left', 'align-left'],
  ['Align Horizontal Centre', 'align-centre-x'],
  ['Align Right', 'align-right'],
  ['Align Top', 'align-top'],
  ['Align Vertical Centre', 'align-centre-y'],
  ['Align Bottom', 'align-bottom'],
  ['Distribute Horizontally', 'distribute-x'],
  ['Distribute Vertically', 'distribute-y'],
  ['Equal Horizontal Gaps', 'equal-gaps-x'],
  ['Equal Vertical Gaps', 'equal-gaps-y'],
  ['Match Width', 'match-width'],
  ['Match Height', 'match-height'],
  ['Match Size', 'match-size'],
]);

const geometryCommandNames = new Map<string, GeometryCommand>([
  ['Align Left', 'align-left'], ['Align Horizontal Centre', 'align-centre-x'], ['Align Right', 'align-right'],
  ['Align Top', 'align-top'], ['Align Vertical Centre', 'align-centre-y'], ['Align Bottom', 'align-bottom'],
  ['Distribute Horizontally', 'distribute-x'], ['Distribute Vertically', 'distribute-y'],
  ['Equal Horizontal Gaps', 'equal-gaps-x'], ['Equal Vertical Gaps', 'equal-gaps-y'],
  ['Match Width', 'match-width'], ['Match Height', 'match-height'], ['Match Size', 'match-size'],
]);

