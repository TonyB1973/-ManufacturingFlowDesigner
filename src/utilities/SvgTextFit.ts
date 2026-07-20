const ELLIPSIS = '…';
export type SvgTextMeasure = (text: string, fontSize: number) => number;

function glyphWidthFactor(character: string): number {
  if (/\s/.test(character)) return 0.34;
  if (/[ilI1.,'|:;!]/.test(character)) return 0.38;
  if (/[MW@%&#QO]/.test(character)) return 0.96;
  if (/[A-Z]/.test(character)) return 0.76;
  if (/[0-9]/.test(character)) return 0.68;
  if (/[\-/\\()[\]]/.test(character)) return 0.5;
  if (character === ELLIPSIS) return 0.9;
  return 0.64;
}

export function estimateSvgTextWidth(text: string, fontSize: number): number {
  if (!Number.isFinite(fontSize) || fontSize <= 0) return 0;
  return [...text].reduce((width, character) => width + glyphWidthFactor(character) * fontSize, 0);
}

export function fitSvgText(
  text: string,
  availableWidth: number,
  fontSize: number,
  measureText: SvgTextMeasure = estimateSvgTextWidth,
): string {
  if (!text || !Number.isFinite(availableWidth) || availableWidth <= 0 || fontSize <= 0) return '';
  const measuredWidth = (value: string): number => {
    const measured = measureText(value, fontSize);
    return Number.isFinite(measured) && measured >= 0 ? measured : estimateSvgTextWidth(value, fontSize);
  };
  if (measuredWidth(text) <= availableWidth) return text;
  if (measuredWidth(ELLIPSIS) > availableWidth) return '';

  let fitted = '';
  for (const character of text) {
    const candidate = `${fitted}${character}${ELLIPSIS}`;
    if (measuredWidth(candidate) > availableWidth) break;
    fitted += character;
  }
  return `${fitted.trimEnd()}${ELLIPSIS}`;
}
