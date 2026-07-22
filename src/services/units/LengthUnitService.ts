export const LENGTH_UNITS = ['mm', 'm', 'in', 'ft'] as const;
export type LengthUnit = typeof LENGTH_UNITS[number];

const MILLIMETRES: Record<LengthUnit, number> = { mm: 1, m: 1000, in: 25.4, ft: 304.8 };
export const lengthUnitSymbol = (unit: LengthUnit): string => unit;

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (!Number.isFinite(value)) throw new Error('Length must be finite.');
  return value * MILLIMETRES[from] / MILLIMETRES[to];
}

export function formatLengthNumber(value: number, precision: number, showTrailingZeros: boolean): string {
  if (!Number.isFinite(value)) throw new Error('Length must be finite.');
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) throw new Error('Precision must be an integer from 0 to 6.');
  const rounded = Math.abs(value) < 0.5 * 10 ** -precision ? 0 : value;
  const fixed = rounded.toFixed(precision);
  return showTrailingZeros || precision === 0 ? fixed : fixed.replace(/\.?0+$/, '');
}

export interface LengthFormatOptions { readonly modelUnit: LengthUnit; readonly displayUnit: LengthUnit; readonly precision: number; readonly showTrailingZeros: boolean; readonly showUnit?: boolean; readonly prefix?: string; readonly suffix?: string; readonly textOverride?: string; }
export function formatLength(value: number, options: LengthFormatOptions): string {
  const numeric = options.textOverride?.length ? options.textOverride : formatLengthNumber(convertLength(Math.abs(value), options.modelUnit, options.displayUnit), options.precision, options.showTrailingZeros);
  return [options.prefix ?? '', numeric, options.suffix ?? '', options.showUnit === false ? '' : lengthUnitSymbol(options.displayUnit)].filter((part) => part.length).join(' ');
}
