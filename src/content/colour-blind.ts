export type ColourBlindMode =
  | 'none'
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'
  | 'achromatopsia';

const SVG_CONTAINER_ID = 'a11y-inspector-svg-filters';
const STYLE_ELEMENT_ID = 'a11y-inspector-colour-blind-style';
const INDICATOR_ID = 'a11y-inspector-colour-blind-indicator';

const COLOUR_BLIND_MATRICES = {
  deuteranopia: [
    0.625, 0.375, 0.0, 0.0, 0.0, 0.7, 0.3, 0.0, 0.0, 0.0, 0.0, 0.3, 0.7, 0.0, 0.0, 0.0, 0.0, 0.0,
    1.0, 0.0,
  ].join(' '),

  protanopia: [
    0.567, 0.433, 0.0, 0.0, 0.0, 0.558, 0.442, 0.0, 0.0, 0.0, 0.0, 0.242, 0.758, 0.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
  ].join(' '),

  tritanopia: [
    0.95, 0.05, 0.0, 0.0, 0.0, 0.0, 0.433, 0.567, 0.0, 0.0, 0.0, 0.475, 0.525, 0.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
  ].join(' '),

  achromatopsia: null,
} as const;

const MODE_LABELS: Record<Exclude<ColourBlindMode, 'none'>, string> = {
  deuteranopia: 'Deuteranopia (Green-Blind)',
  protanopia: 'Protanopia (Red-Blind)',
  tritanopia: 'Tritanopia (Blue-Blind)',
  achromatopsia: 'Achromatopsia (No Colour)',
};

const createFilter = (mode: Exclude<ColourBlindMode, 'none'>): SVGFilterElement => {
  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', `a11y-${mode}`);
  filter.setAttribute('color-interpolation-filters', 'linearRGB');

  const colorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');

  if (mode === 'achromatopsia') {
    colorMatrix.setAttribute('type', 'saturate');
    colorMatrix.setAttribute('values', '0');
  } else {
    colorMatrix.setAttribute('type', 'matrix');
    colorMatrix.setAttribute('values', COLOUR_BLIND_MATRICES[mode]);
  }

  filter.appendChild(colorMatrix);
  return filter;
};

const createSvgContainer = (): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', SVG_CONTAINER_ID);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute; width:0; height:0; overflow:hidden;');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const modes: Array<Exclude<ColourBlindMode, 'none'>> = [
    'deuteranopia',
    'protanopia',
    'tritanopia',
    'achromatopsia',
  ];

  for (const mode of modes) {
    defs.appendChild(createFilter(mode));
  }

  svg.appendChild(defs);
  return svg;
};

const createStyleElement = (mode: Exclude<ColourBlindMode, 'none'>): HTMLStyleElement => {
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `html { filter: url(#a11y-${mode}) !important; }`;
  return style;
};

const createIndicator = (mode: Exclude<ColourBlindMode, 'none'>): HTMLDivElement => {
  const indicator = document.createElement('div');
  indicator.id = INDICATOR_ID;
  indicator.className = 'a11y-colour-blind-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.textContent = MODE_LABELS[mode];
  return indicator;
};

export const removeColourBlindFilter = (): void => {
  const svg = document.getElementById(SVG_CONTAINER_ID);
  if (svg) {
    svg.remove();
  }

  const style = document.getElementById(STYLE_ELEMENT_ID);
  if (style) {
    style.remove();
  }

  const indicator = document.getElementById(INDICATOR_ID);
  if (indicator) {
    indicator.remove();
  }
};

export const applyColourBlindFilter = (mode: ColourBlindMode): void => {
  removeColourBlindFilter();
  if (mode === 'none') {
    return;
  }
  if (!document.body) {
    console.error('[Colour Blind] document.body not available');
    return;
  }
  if (!document.head) {
    console.error('[Colour Blind] document.head not available');
    return;
  }

  try {
    const svg = createSvgContainer();
    document.body.appendChild(svg);
    const style = createStyleElement(mode);
    document.head.appendChild(style);
    const indicator = createIndicator(mode);
    document.body.appendChild(indicator);

    console.debug(`[Colour Blind] Applied filter: ${mode}`);
  } catch (error) {
    console.error('[Colour Blind] Failed to apply filter:', error);
    removeColourBlindFilter();
  }
};
