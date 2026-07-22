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
  readonly selectedHandoverId?: string | null;
  readonly viewportWidth: number;
  readonly onSelect: (entryId: string) => void;
  readonly onReassign?: (entryId: string, operatorId: string) => void;
  readonly onContextMenu: (event: MouseEvent, entryId: string) => void;
  readonly onSelectHandover?: (handoverId: string) => void;
}

export interface StandardWorkChartRenderResult {
  readonly labels: HTMLElement;
  readonly drawing: SVGSVGElement;
  readonly width: number;
  readonly height: number;
  readonly blockElements: ReadonlyMap<string, SVGGElement>;
}

export function renderStandardWorkChart(options: StandardWorkChartRenderOptions): StandardWorkChartRenderResult {
  const { schedule, settings } = options; const padding = 24; const axisHeight = 36; const baseLaneHeight = settings.laneDensity === 'compact' ? 38 : 52; const operatorLaneHeight = settings.operatorLaneDensity === 'compact' ? 38 : 52; const stackGap = 5;
  const renderBlockLabels = schedule.operatorBlocks.length + schedule.automaticBlocks.length <= 2_000;
  const visibleLanes = settings.showAutomaticLanes ? schedule.resourceLanes : [];
  const laneHeights = [...schedule.operatorLanes.map(() => operatorLaneHeight), ...visibleLanes.map((lane) => Math.max(baseLaneHeight, lane.stackCount * baseLaneHeight))];
  const height = axisHeight + laneHeights.reduce((sum, value) => sum + value, 0) + (settings.showDisabledEntries && schedule.disabledEntryIds.length ? baseLaneHeight : 0);
  const width = Math.max(options.viewportWidth, padding * 2 + Math.max(1, schedule.chartCycleSpanSeconds) * options.pixelsPerSecond);
  const labels = element('div', 'standard-work-chart-labels'); labels.style.paddingTop = `${axisHeight}px`;
  const label = (title: string, detail: string, laneHeight: number, warning = false): void => { const row = element('div', `standard-work-chart-lane-label${warning ? ' standard-work-chart-lane-label--warning' : ''}`); row.style.height = `${laneHeight}px`; row.append(element('strong', undefined, title), element('small', undefined, detail)); labels.append(row); };
  schedule.operatorLanes.forEach((lane, index) => { const identity = [lane.name, settings.showOperatorIds ? lane.operatorId : '', settings.showOperatorRoles ? lane.role : ''].filter(Boolean).join(' · '); const totals = settings.showOperatorTotals ? `Occupied ${formatDuration(lane.workload.occupiedSeconds, options.timeFormat)} · productive ${formatDuration(lane.workload.productiveSeconds, options.timeFormat)} · end ${formatDuration(lane.workload.endSeconds, options.timeFormat)}` : 'Manual · Walking · Waiting'; label(identity || lane.operatorId, `${totals}${lane.active ? '' : ' · Inactive'}`, laneHeights[index], !lane.active); });
  visibleLanes.forEach((lane, index) => label(lane.label, settings.showLaneIds ? lane.id : 'Automatic process', laneHeights[schedule.operatorLanes.length + index], lane.resourceActive === false || lane.blocks.some((block) => block.overlapsSameResource)));
  if (settings.showDisabledEntries && schedule.disabledEntryIds.length) label('Excluded', `${schedule.disabledEntryIds.length} disabled entries`, baseLaneHeight);

  const drawing = svg('svg'); drawing.classList.add('standard-work-chart-svg'); drawing.setAttribute('width', String(width)); drawing.setAttribute('height', String(height)); drawing.setAttribute('viewBox', `0 0 ${width} ${height}`); drawing.setAttribute('role', 'list'); drawing.setAttribute('aria-label', 'Standard Work Combination Chart timeline');
  const major = resolveStandardWorkMajorInterval(settings, Math.max(schedule.chartCycleSpanSeconds, 1), Math.max(options.viewportWidth, 1));
  const ticks = buildStandardWorkTicks(0, Math.max(schedule.chartCycleSpanSeconds, major), major, settings.minorSubdivisions, settings.showMinorGrid);
  for (const tick of ticks) {
    const x = padding + tick.seconds * options.pixelsPerSecond; const line = svg('line'); line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x)); line.setAttribute('y1', String(axisHeight)); line.setAttribute('y2', String(height)); line.classList.add(tick.major ? 'standard-work-grid-major' : 'standard-work-grid-minor'); drawing.append(line);
    if (tick.major) { const text = svg('text'); text.setAttribute('x', String(x)); text.setAttribute('y', '22'); text.classList.add('standard-work-axis-label'); text.textContent = formatDuration(tick.seconds, options.timeFormat); drawing.append(text); }
  }
  const baseline = svg('line'); baseline.setAttribute('x1', '0'); baseline.setAttribute('x2', String(width)); baseline.setAttribute('y1', String(axisHeight)); baseline.setAttribute('y2', String(axisHeight)); baseline.classList.add('standard-work-axis-line'); drawing.append(baseline);
  let laneY = axisHeight; const blockElements = new Map<string, SVGGElement>(); const blockPositions = new Map<string, { x1: number; x2: number; y: number }>(); const operatorY = new Map<string, number>();
  const renderBlock = (block: StandardWorkChartBlock, y: number, laneHeight: number): void => {
    const group = svg('g'); group.classList.add('standard-work-chart-block', `standard-work-chart-block--${block.timingCategory}`); if (block.entryId === options.selectedEntryId) group.classList.add('standard-work-chart-block--selected'); if (block.overlapsSameResource) group.classList.add('standard-work-chart-block--overlap'); group.dataset.entryId = block.entryId; group.setAttribute('tabindex', '0'); group.setAttribute('role', 'listitem');
    const operation = options.operations.getOperation(block.operationId); const x = padding + block.startSeconds * options.pixelsPerSecond; const accurateWidth = block.durationSeconds * options.pixelsPerSecond; const visualWidth = Math.max(accurateWidth, block.durationSeconds === 0 ? 3 : 8); const blockHeight = Math.max(24, laneHeight - stackGap * 2);
    const hit = svg('rect'); hit.setAttribute('x', String(x - Math.max(0, (12 - visualWidth) / 2))); hit.setAttribute('y', String(y + stackGap)); hit.setAttribute('width', String(Math.max(12, visualWidth))); hit.setAttribute('height', String(blockHeight)); hit.classList.add('standard-work-chart-hit');
    const rect = svg('rect'); rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y + stackGap)); rect.setAttribute('width', String(visualWidth)); rect.setAttribute('height', String(blockHeight)); rect.classList.add('standard-work-chart-geometry');
    if (block.durationSeconds === 0) rect.classList.add('standard-work-chart-zero');
    const details = `${block.entryId}; ${block.operationId}; ${operation?.name ?? 'Missing operation'}; ${block.timingCategory}; start ${formatDuration(block.startSeconds, options.timeFormat)}; end ${formatDuration(block.endSeconds, options.timeFormat)}; duration ${formatDuration(block.durationSeconds, options.timeFormat)}; occurrences ${block.occurrences}; resource ${block.assignedResourceId ?? 'Unassigned'}${block.overlapsSameResource ? '; potential same-resource overlap' : ''}`;
    group.setAttribute('aria-label', `${details}; drag vertically to reassign operator`); const title = svg('title'); title.textContent = `${details}. Drag vertically to another operator lane to reassign.`; group.append(hit, rect, title);
    const parts = [settings.showOperationIds ? block.operationId : '', settings.showOperationNames ? operation?.name ?? '' : '', settings.showDurations ? formatDuration(block.durationSeconds, options.timeFormat) : '', block.occurrences > 1 ? `×${block.occurrences}` : ''].filter(Boolean); const available = accurateWidth - 10;
    if (renderBlockLabels && (settings.showOperationIds || settings.showOperationNames || settings.showDurations)) { const text = svg('text'); text.setAttribute('x', String(x + 5)); text.setAttribute('y', String(y + stackGap + blockHeight / 2 + 4)); text.classList.add('standard-work-block-label'); const full = available >= 70 ? parts.join(' · ') : available >= 24 ? block.operationId : ''; const maximumCharacters = Math.max(0, Math.floor(available / 6)); text.textContent = full.length > maximumCharacters ? `${full.slice(0, Math.max(0, maximumCharacters - 1))}…` : full; group.append(text); }
    if (renderBlockLabels && settings.showStartEndValues && accurateWidth >= 90) { const values = svg('text'); values.setAttribute('x', String(x + 4)); values.setAttribute('y', String(y + stackGap + blockHeight - 4)); values.classList.add('standard-work-block-values'); values.textContent = `${formatDuration(block.startSeconds, options.timeFormat)} → ${formatDuration(block.endSeconds, options.timeFormat)}`; group.append(values); }
    let drag: { pointerId: number; startY: number } | null = null;
    group.addEventListener('pointerdown', (event) => { if (event.button !== 0 || !options.onReassign) return; drag = { pointerId: event.pointerId, startY: event.clientY }; group.setPointerCapture(event.pointerId); group.setAttribute('aria-grabbed', 'true'); });
    group.addEventListener('pointerup', (event) => { if (!drag || drag.pointerId !== event.pointerId) return; const moved = Math.abs(event.clientY - drag.startY); drag = null; group.releasePointerCapture(event.pointerId); group.setAttribute('aria-grabbed', 'false'); if (moved < 8) return; const bounds = drawing.getBoundingClientRect(); const chartY = (event.clientY - bounds.top) * height / Math.max(1, bounds.height); const target = schedule.operatorLanes.find((lane, index) => { const top = operatorY.get(lane.operatorId) ?? axisHeight; return chartY >= top && chartY < top + laneHeights[index]; }); if (target && target.operatorId !== block.assignedOperatorId) options.onReassign?.(block.entryId, target.operatorId); });
    group.addEventListener('pointercancel', () => { drag = null; group.setAttribute('aria-grabbed', 'false'); });
    group.addEventListener('keydown', (event) => { if (event.key === 'Escape' && drag) { const pointerId = drag.pointerId; drag = null; group.setAttribute('aria-grabbed', 'false'); if (group.hasPointerCapture(pointerId)) group.releasePointerCapture(pointerId); } });
    group.addEventListener('click', () => options.onSelect(block.entryId)); group.addEventListener('focus', () => options.onSelect(block.entryId)); group.addEventListener('contextmenu', (event) => options.onContextMenu(event, block.entryId)); drawing.append(group); blockElements.set(block.entryId, group); blockPositions.set(block.entryId, { x1: x, x2: x + visualWidth, y: y + stackGap + blockHeight / 2 });
  };
  schedule.operatorLanes.forEach((lane, laneIndex) => { const laneHeight = laneHeights[laneIndex]; operatorY.set(lane.operatorId, laneY); if (settings.showDependencyIdle) for (const block of lane.blocks.filter((item) => item.dependencyIdleSeconds > 0)) { const idle = svg('rect'); idle.setAttribute('x', String(padding + (block.startSeconds - block.dependencyIdleSeconds) * options.pixelsPerSecond)); idle.setAttribute('y', String(laneY + 6)); idle.setAttribute('width', String(Math.max(2, block.dependencyIdleSeconds * options.pixelsPerSecond))); idle.setAttribute('height', String(Math.max(16, laneHeight - 12))); idle.classList.add('standard-work-dependency-idle'); const title = svg('title'); title.textContent = `Dependency idle ${formatDuration(block.dependencyIdleSeconds, options.timeFormat)}`; idle.append(title); drawing.append(idle); } lane.blocks.forEach((block) => renderBlock(block, laneY, laneHeight)); laneY += laneHeight; });
  if (settings.showAutomaticLaunchMarkers) for (const block of schedule.automaticBlocks) { const launchY = operatorY.get(block.launchOperatorId) ?? axisHeight; const x = padding + block.startSeconds * options.pixelsPerSecond; const marker = svg('path'); marker.setAttribute('d', `M ${x - 4} ${launchY + 2} L ${x + 4} ${launchY + 2} L ${x} ${launchY + 9} Z`); marker.classList.add('standard-work-launch-marker'); const title = svg('title'); title.textContent = `${block.operationId} automatic launch by ${block.launchOperatorId} at ${formatDuration(block.startSeconds, options.timeFormat)}`; marker.append(title); drawing.append(marker); }
  visibleLanes.forEach((lane, laneIndex) => { const laneHeight = laneHeights[schedule.operatorLanes.length + laneIndex]; lane.blocks.forEach((block) => renderBlock(block, laneY + block.stackIndex * baseLaneHeight, baseLaneHeight)); laneY += laneHeight; });
  if (settings.showHandoverLinks) for (const link of schedule.handoverLinks.filter((item) => item.enabled || settings.showDisabledHandovers)) { const from = blockPositions.get(link.fromEntryId); const to = blockPositions.get(link.toEntryId); if (!from || !to) continue; const path = svg('path'); const middleX = Math.max(from.x2 + 8, Math.min(to.x1 - 8, (from.x2 + to.x1) / 2)); path.setAttribute('d', settings.handoverRoutingStyle === 'curved' ? `M ${from.x2} ${from.y} C ${middleX} ${from.y}, ${middleX} ${to.y}, ${to.x1} ${to.y}` : `M ${from.x2} ${from.y} H ${middleX} V ${to.y} H ${to.x1}`); path.classList.add('standard-work-handover-link'); if (!link.enabled) path.classList.add('standard-work-handover-link--disabled'); if (link.sameOperator) path.classList.add('standard-work-handover-link--same-operator'); if (link.id === options.selectedHandoverId) path.classList.add('standard-work-handover-link--selected'); path.dataset.handoverId = link.id; path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button'); path.setAttribute('aria-label', `${link.id}: ${link.fromEntryId} to ${link.toEntryId}${link.enabled ? '' : ', disabled'}`); const title = svg('title'); title.textContent = `${link.id}: ${link.fromEntryId} → ${link.toEntryId}${link.enabled ? '' : ' (disabled)'}`; path.append(title); path.addEventListener('click', () => options.onSelectHandover?.(link.id)); path.addEventListener('focus', () => options.onSelectHandover?.(link.id)); drawing.append(path); const arrow = svg('path'); arrow.setAttribute('d', `M ${to.x1} ${to.y} L ${to.x1 - 8} ${to.y - 4} L ${to.x1 - 8} ${to.y + 4} Z`); arrow.classList.add('standard-work-handover-arrow'); if (!link.enabled) arrow.classList.add('standard-work-handover-link--disabled'); drawing.append(arrow); }
  if (settings.showDisabledEntries && schedule.disabledEntryIds.length) { const text = svg('text'); text.setAttribute('x', String(padding)); text.setAttribute('y', String(laneY + baseLaneHeight / 2)); text.classList.add('standard-work-disabled-label'); text.textContent = `Excluded from schedule: ${schedule.disabledEntryIds.join(', ')}`; drawing.append(text); }
  return { labels, drawing, width, height, blockElements };
}
