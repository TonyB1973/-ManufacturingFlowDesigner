export interface MinuteInterval { readonly start: number; readonly end: number; }

export function mergeIntervals(values: readonly MinuteInterval[]): MinuteInterval[] {
  const sorted = values.filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start)
    .map((item) => ({ ...item })).sort((a, b) => a.start - b.start || a.end - b.end);
  const result: MinuteInterval[] = [];
  for (const current of sorted) {
    const previous = result.at(-1);
    if (!previous || current.start > previous.end) result.push(current);
    else if (current.end > previous.end) result[result.length - 1] = { start: previous.start, end: current.end };
  }
  return result;
}

export function intersectIntervals(left: readonly MinuteInterval[], right: readonly MinuteInterval[]): MinuteInterval[] {
  const result: MinuteInterval[] = [];
  const a = mergeIntervals(left); const b = mergeIntervals(right);
  let leftIndex = 0; let rightIndex = 0;
  while (leftIndex < a.length && rightIndex < b.length) {
    const start = Math.max(a[leftIndex].start, b[rightIndex].start);
    const end = Math.min(a[leftIndex].end, b[rightIndex].end);
    if (end > start) result.push({ start, end });
    if (a[leftIndex].end < b[rightIndex].end) leftIndex += 1; else rightIndex += 1;
  }
  return result;
}

export function subtractIntervals(source: readonly MinuteInterval[], deductions: readonly MinuteInterval[]): MinuteInterval[] {
  const result: MinuteInterval[] = [];
  const mergedSource = mergeIntervals(source); const mergedDeductions = mergeIntervals(deductions);
  for (const base of mergedSource) {
    let cursor = base.start;
    for (const deduction of mergedDeductions) {
      if (deduction.end <= cursor) continue;
      if (deduction.start >= base.end) break;
      if (deduction.start > cursor) result.push({ start: cursor, end: Math.min(deduction.start, base.end) });
      cursor = Math.max(cursor, deduction.end);
      if (cursor >= base.end) break;
    }
    if (cursor < base.end) result.push({ start: cursor, end: base.end });
  }
  return result;
}

export function intervalDuration(values: readonly MinuteInterval[]): number {
  return mergeIntervals(values).reduce((total, item) => total + item.end - item.start, 0);
}
