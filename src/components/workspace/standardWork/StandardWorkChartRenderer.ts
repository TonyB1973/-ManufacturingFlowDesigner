import type { StandardWorkTimeFormat } from '../../../models/standardWork/StandardWork';
import type { StandardWorkChartBlock, StandardWorkChartSchedule } from '../../../models/standardWork/StandardWorkChartModels';
import type { StandardWorkChartSettings } from '../../../models/standardWork/StandardWorkChartSettings';
import type { OperationStore } from '../../../services/OperationStore';
import { buildStandardWorkTicks, resolveStandardWorkMajorInterval } from '../../../services/standardWork/StandardWorkChartScale';
import { formatDuration } from '../../../services/standardWork/DurationFormatter';
import { element } from '../../../ui/dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] => document.createElementNS(SVG_NS, tag);

export interface StandardWorkChartRenderOptions {
  readonly schedule: StandardWorkChartSchedule;
  readonly operations: Pick<OperationStore, 'getOperation'>;
  readonly settings: StandardWorkChartSettings;
  readonly timeFormat: StandardWorkTimeFormat;
  readonly pixelsPerSecond: number;
  readonly selectedEntryId: string | null;
  readonly viewportWidth: number;
  readonly onSelect: (entryId: string) => void;
  readonly onContextMenu: (event: MouseEvent, entryId: string) => void;
}

export interface StandardWorkChartRenderResult {
  readonly labels: HTMLElement;
  readonly drawing: SVGSVGElement;
  readonly width: number;
  readonly height: number;
  readonly blockElements: ReadonlyMap<string, SVGGElement>;
}

export function renderStandardWorkChart(options: StandardWorkChartRenderOptions): StandardWorkChartRenderResult {
  const { schedule, settings } = options; const padding = 24; const axisHeight = 36; const baseLaneHeight = settings.laneDensity === 'compact' ? 38 : 52; const stackGap = 5;
  const renderBlockLabels = schedule.operatorBlocks.length + schedule.automaticBlocks.length <= 2_000;
  const visibleLanes = settings.showAutomaticLanes ? schedule.resourceLanes : [];
  const laneHeights = [baseLaneHeight, ...visibleLanes.map((lane) => Math.max(baseLaneHeight, lane.stackCount * baseLaneHeight))];
  const height = axisHeight + laneHeights.reduce((sum, value) => sum + value, 0) + (settings.showDisabledEntries && schedule.disabledEntryIds.length ? baseLaneHeight : 0);
  const width = Math.max(options.viewportWidth, padding * 2 + Math.max(1, schedule.chartCycleSpanSeconds) * options.pixelsPerSecond);
  const labels = element('div', 'standard-work-chart-labels'); labels.style.paddingTop = `${axisHeight}px`;
  const label = (title: string, detail: string, laneHeight: number, warning = false): void => { const row = element('div', `standard-work-chart-lane-label${warning ? ' standard-work-chart-lane-label--warning' : ''}`); row.style.height = `${laneHeight}px`; row.append(element('strong', undefined, title), element('small', undefined, detail)); labels.append(row); };
  label('Operator', 'Manual · Walking · Waiting', laneHeights[0]);
  visibleLanes.forEach((lane, index) => label(lane.label, settings.showLaneIds ? lane.id : 'Automatic process', laneHeights[index + 1], lane.resourceActive === false || lane.blocks.some((block) => block.overlapsSameResource)));
  if (settings.showDisabledEntries && schedule.disabledEntryIds.length) label('Excluded', `${schedule.disabledEntryIds.length} disabled entries`, baseLaneHeight);

  const drawing = svg('svg'); drawing.classList.add('standard-work-chart-svg'); drawing.setAttribute('width', String(width)); drawing.setAttribute('height', String(height)); drawing.setAttribute('viewBox', `0 0 ${width} ${height}`); drawing.setAttribute('role', 'list'); drawing.setAttribute('aria-label', 'Standard Work Combination Chart timeline');
  const major = resolveStandardWorkMajorInterval(settings, Math.max(schedule.chartCycleSpanSeconds, 1), Math.max(options.viewportWidth, 1));
  const ticks = buildStandardWorkTicks(0, Math.max(schedule.chartCycleSpanSeconds, major), major, settings.minorSubdivisions, settings.showMinorGrid);
  for (const tick of ticks) {
    const x = padding + tick.seconds * options.pixelsPerSecond; const line = svg('line'); line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x)); line.setAttribute('y1', String(axisHeight)); line.setAttribute('y2', String(height)); line.classList.add(tick.major ? 'standard-work-grid-major' : 'standard-work-grid-minor'); drawing.append(line);
    if (tick.major) { const text = svg('text'); text.setAttribute('x', String(x)); text.setAttribute('y', '22'); text.classList.add('standard-work-axis-label'); text.textContent = formatDuration(tick.seconds, options.timeFormat); drawing.append(text); }
  }
  const baseline = svg('line'); baseline.setAttribute('x1', '0'); baseline.setAttribute('x2', String(width)); baseline.setAttribute('y1', String(axisHeight)); baseline.setAttribute('y2', String(axisHeight)); baseline.classList.add('standard-work-axis-line'); drawing.append(baseline);
  let laneY = axisHeight; const blockElements = new Map<string, SVGGElement>();
  const renderBlock = (block: StandardWorkChartBlock, y: number, laneHeight: number): void => {
    const group = svg('g'); group.classList.add('standard-work-chart-block', `standard-work-chart-block--${block.timingCategory}`); if (block.entryId === options.selectedEntryId) group.classList.add('standard-work-chart-block--selected'); if (block.overlapsSameResource) group.classList.add('standard-work-chart-block--overlap'); group.dataset.entryId = block.entryId; group.setAttribute('tabindex', '0'); group.setAttribute('role', 'listitem');
    const operation = options.operations.getOperation(block.operationId); const x = padding + block.startSeconds * options.pixelsPerSecond; const accurateWidth = block.durationSeconds * options.pixelsPerSecond; const visualWidth = Math.max(accurateWidth, block.durationSeconds === 0 ? 3 : 8); const blockHeight = Math.max(24, laneHeight - stackGap * 2);
    const hit = svg('rect'); hit.setAttribute('x', String(x - Math.max(0, (12 - visualWidth) / 2))); hit.setAttribute('y', String(y + stackGap)); hit.setAttribute('width', String(Math.max(12, visualWidth))); hit.setAttribute('height', String(blockHeight)); hit.classList.add('standard-work-chart-hit');
    const rect = svg('rect'); rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y + stackGap)); rect.setAttribute('width', String(visualWidth)); rect.setAttribute('height', String(blockHeight)); rect.classList.add('standard-work-chart-geometry');
    if (block.durationSeconds === 0) rect.classList.add('standard-work-chart-zero');
    const details = `${block.entryId}; ${block.operationId}; ${operation?.name ?? 'Missing operation'}; ${block.timingCategory}; start ${formatDuration(block.startSeconds, options.timeFormat)}; end ${formatDuration(block.endSeconds, options.timeFormat)}; duration ${formatDuration(block.durationSeconds, options.timeFormat)}; occurrences ${block.occurrences}; resource ${block.assignedResourceId ?? 'Unassigned'}${block.overlapsSameResource ? '; potential same-resource overlap' : ''}`;
    group.setAttribute('aria-label', details); const title = svg('title'); title.textContent = details; group.append(hit, rect, title);
    const parts = [settings.showOperationIds ? block.operationId : '', settings.showOperationNames ? operation?.name ?? '' : '', settings.showDurations ? formatDuration(block.durationSeconds, options.timeFormat) : '', block.occurrences > 1 ? `×${block.occurrences}` : ''].filter(Boolean); const available = accurateWidth - 10;
    if (renderBlockLabels && (settings.showOperationIds || settings.showOperationNames || settings.showDurations)) { const text = svg('text'); text.setAttribute('x', String(x + 5)); text.setAttribute('y', String(y + stackGap + blockHeight / 2 + 4)); text.classList.add('standard-work-block-label'); const full = available >= 70 ? parts.join(' · ') : available >= 24 ? block.operationId : ''; const maximumCharacters = Math.max(0, Math.floor(available / 6)); text.textContent = full.length > maximumCharacters ? `${full.slice(0, Math.max(0, maximumCharacters - 1))}…` : full; group.append(text); }
    if (renderBlockLabels && settings.showStartEndValues && accurateWidth >= 90) { const values = svg('text'); values.setAttribute('x', String(x + 4)); values.setAttribute('y', String(y + stackGap + blockHeight - 4)); values.classList.add('standard-work-block-values'); values.textContent = `${formatDuration(block.startSeconds, options.timeFormat)} → ${formatDuration(block.endSeconds, options.timeFormat)}`; group.append(values); }
    group.addEventListener('click', () => options.onSelect(block.entryId)); group.addEventListener('focus', () => options.onSelect(block.entryId)); group.addEventListener('contextmenu', (event) => options.onContextMenu(event, block.entryId)); drawing.append(group); blockElements.set(block.entryId, group);
  };
  const operatorHeight = laneHeights[0]; schedule.operatorBlocks.forEach((block) => renderBlock(block, laneY, operatorHeight));
  if (settings.showAutomaticLaunchMarkers) for (const block of schedule.automaticBlocks) { const x = padding + block.startSeconds * options.pixelsPerSecond; const marker = svg('path'); marker.setAttribute('d', `M ${x - 4} ${laneY + 2} L ${x + 4} ${laneY + 2} L ${x} ${laneY + 9} Z`); marker.classList.add('standard-work-launch-marker'); const title = svg('title'); title.textContent = `${block.operationId} automatic launch at ${formatDuration(block.startSeconds, options.timeFormat)}`; marker.append(title); drawing.append(marker); }
  laneY += operatorHeight;
  visibleLanes.forEach((lane, laneIndex) => { const laneHeight = laneHeights[laneIndex + 1]; lane.blocks.forEach((block) => renderBlock(block, laneY + block.stackIndex * baseLaneHeight, baseLaneHeight)); laneY += laneHeight; });
  if (settings.showDisabledEntries && schedule.disabledEntryIds.length) { const text = svg('text'); text.setAttribute('x', String(padding)); text.setAttribute('y', String(laneY + baseLaneHeight / 2)); text.classList.add('standard-work-disabled-label'); text.textContent = `Excluded from schedule: ${schedule.disabledEntryIds.join(', ')}`; drawing.append(text); }
  return { labels, drawing, width, height, blockElements };
}
