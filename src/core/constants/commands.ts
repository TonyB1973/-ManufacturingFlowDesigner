export interface RibbonGroup {
  readonly name: string;
  readonly commands: readonly string[];
}

export interface RibbonTab {
  readonly name: string;
  readonly groups: readonly RibbonGroup[];
}

export const RIBBON_TABS: readonly RibbonTab[] = [
  { name: 'File', groups: [{ name: 'Project', commands: ['New', 'Open', 'Save', 'Save As', 'Load Demo'] }] },
  { name: 'Edit', groups: [{ name: 'History', commands: ['Undo', 'Redo'] }, { name: 'Clipboard', commands: ['Cut', 'Copy', 'Paste', 'Duplicate'] }, { name: 'Selection', commands: ['Select All', 'Delete'] }] },
  { name: 'View', groups: [{ name: 'Viewport', commands: ['Zoom In', 'Zoom Out', 'Fit View', 'Fit Layout', 'Fit Including Clearance'] }, { name: 'Display', commands: ['Grid', 'Clearance Envelopes', 'Canvas Focus'] }] },
  { name: 'Arrange', groups: [{ name: 'Align', commands: ['Align Left', 'Align Horizontal Centre', 'Align Right', 'Align Top', 'Align Vertical Centre', 'Align Bottom'] }, { name: 'Distribute', commands: ['Distribute Horizontally', 'Distribute Vertically', 'Equal Horizontal Gaps', 'Equal Vertical Gaps'] }, { name: 'Size', commands: ['Match Width', 'Match Height', 'Match Size'] }, { name: 'Selection', commands: ['Select All', 'Clear Selection'] }] },
  { name: 'Process', groups: [{ name: 'Flow', commands: ['Add Operation', 'Select', 'Connect'] }] },
  { name: 'Resources', groups: [{ name: 'Library', commands: ['Resource Library', 'Add Resource', 'Manage Library'] }, { name: 'Orientation', commands: ['Rotate Left', 'Rotate Right', 'Reset Rotation'] }] },
  { name: 'Engineering', groups: [{ name: 'Factory Layout', commands: ['Clearance Envelopes', 'Fit Layout', 'Fit Including Clearance'] }, { name: 'Analysis', commands: ['Validate', 'Standard Work', 'Availability'] }] },
  { name: 'Simulation', groups: [{ name: 'Controls', commands: ['Run', 'Pause', 'Reset'] }] },
];

