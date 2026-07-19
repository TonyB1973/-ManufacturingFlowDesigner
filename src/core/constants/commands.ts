export interface RibbonGroup {
  readonly name: string;
  readonly commands: readonly string[];
}

export interface RibbonTab {
  readonly name: string;
  readonly groups: readonly RibbonGroup[];
}

export const RIBBON_TABS: readonly RibbonTab[] = [
  { name: 'File', groups: [{ name: 'Project', commands: ['New', 'Open', 'Save', 'Save As'] }] },
  { name: 'Edit', groups: [{ name: 'History', commands: ['Undo', 'Redo'] }, { name: 'Modify', commands: ['Delete'] }] },
  { name: 'View', groups: [{ name: 'Viewport', commands: ['Zoom In', 'Zoom Out', 'Fit View'] }, { name: 'Display', commands: ['Grid', 'Canvas Focus'] }] },
  { name: 'Process', groups: [{ name: 'Flow', commands: ['Add Operation', 'Select', 'Connect'] }] },
  { name: 'Resources', groups: [{ name: 'Library', commands: ['Resource Library', 'Add Resource', 'Manage Library'] }] },
  { name: 'Engineering', groups: [{ name: 'Analysis', commands: ['Validate', 'Standard Work', 'Factory Layout'] }] },
  { name: 'Simulation', groups: [{ name: 'Controls', commands: ['Run', 'Pause', 'Reset'] }] },
];

