import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyColourBlindFilter, removeColourBlindFilter } from '../../src/content/colour-blind';

describe('Colour Blindness Simulator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    // Clean up after each test
    removeColourBlindFilter();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  // TEST 1: SVG injection with correct filter ID
  it('should inject SVG with correct filter id for deuteranopia', () => {
    applyColourBlindFilter('deuteranopia');

    // Check SVG element exists
    const svg = document.getElementById('a11y-inspector-svg-filters');
    expect(svg).toBeTruthy();
    expect(svg?.tagName.toLowerCase()).toBe('svg');

    // Check SVG attributes
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.style.position).toBe('absolute');

    // Check filter exists with correct ID
    const filter = svg?.querySelector('#a11y-deuteranopia');
    expect(filter).toBeTruthy();
    expect(filter?.tagName.toLowerCase()).toBe('filter');

    // Check filter has color matrix
    const colorMatrix = filter?.querySelector('feColorMatrix');
    expect(colorMatrix).toBeTruthy();
    expect(colorMatrix?.getAttribute('type')).toBe('matrix');
    expect(colorMatrix?.getAttribute('values')).toBeTruthy();
    expect(colorMatrix?.getAttribute('values')?.split(' ').length).toBeGreaterThan(10);
  });

  it('should inject SVG with correct filter id for protanopia', () => {
    applyColourBlindFilter('protanopia');

    const svg = document.getElementById('a11y-inspector-svg-filters');
    expect(svg).toBeTruthy();

    const filter = svg?.querySelector('#a11y-protanopia');
    expect(filter).toBeTruthy();

    const colorMatrix = filter?.querySelector('feColorMatrix');
    expect(colorMatrix?.getAttribute('type')).toBe('matrix');
  });

  it('should inject SVG with correct filter id for tritanopia', () => {
    applyColourBlindFilter('tritanopia');

    const svg = document.getElementById('a11y-inspector-svg-filters');
    expect(svg).toBeTruthy();

    const filter = svg?.querySelector('#a11y-tritanopia');
    expect(filter).toBeTruthy();

    const colorMatrix = filter?.querySelector('feColorMatrix');
    expect(colorMatrix?.getAttribute('type')).toBe('matrix');
  });

  it('should inject SVG with saturate filter for achromatopsia', () => {
    applyColourBlindFilter('achromatopsia');

    const svg = document.getElementById('a11y-inspector-svg-filters');
    expect(svg).toBeTruthy();

    const filter = svg?.querySelector('#a11y-achromatopsia');
    expect(filter).toBeTruthy();

    const colorMatrix = filter?.querySelector('feColorMatrix');
    expect(colorMatrix?.getAttribute('type')).toBe('saturate');
    expect(colorMatrix?.getAttribute('values')).toBe('0');
  });

  // TEST 2: 'none' mode removes both SVG and style elements
  it('should remove both SVG and style elements when mode is none', () => {
    // First apply a filter
    applyColourBlindFilter('deuteranopia');

    // Verify elements exist
    expect(document.getElementById('a11y-inspector-svg-filters')).toBeTruthy();
    expect(document.getElementById('a11y-inspector-colour-blind-style')).toBeTruthy();
    expect(document.getElementById('a11y-inspector-colour-blind-indicator')).toBeTruthy();

    // Apply 'none' mode
    applyColourBlindFilter('none');

    // Verify elements are removed
    expect(document.getElementById('a11y-inspector-svg-filters')).toBeNull();
    expect(document.getElementById('a11y-inspector-colour-blind-style')).toBeNull();
    expect(document.getElementById('a11y-inspector-colour-blind-indicator')).toBeNull();
  });

  // TEST 3: Calling applyColourBlindFilter twice does not stack elements

  it('should not stack SVG elements when called twice', () => {
    // Apply first filter
    applyColourBlindFilter('deuteranopia');

    // Count elements
    const svgCount1 = document.querySelectorAll('#a11y-inspector-svg-filters').length;
    const styleCount1 = document.querySelectorAll('#a11y-inspector-colour-blind-style').length;
    const indicatorCount1 = document.querySelectorAll(
      '#a11y-inspector-colour-blind-indicator'
    ).length;

    expect(svgCount1).toBe(1);
    expect(styleCount1).toBe(1);
    expect(indicatorCount1).toBe(1);

    // Apply second filter (different mode)
    applyColourBlindFilter('protanopia');

    // Count elements again
    const svgCount2 = document.querySelectorAll('#a11y-inspector-svg-filters').length;
    const styleCount2 = document.querySelectorAll('#a11y-inspector-colour-blind-style').length;
    const indicatorCount2 = document.querySelectorAll(
      '#a11y-inspector-colour-blind-indicator'
    ).length;

    // Should still be exactly one of each
    expect(svgCount2).toBe(1);
    expect(styleCount2).toBe(1);
    expect(indicatorCount2).toBe(1);

    // Verify it's the new filter
    const svg = document.getElementById('a11y-inspector-svg-filters');
    const filter = svg?.querySelector('#a11y-protanopia');
    expect(filter).toBeTruthy();
  });

  it('should not stack SVG elements when called twice with same mode', () => {
    applyColourBlindFilter('deuteranopia');
    applyColourBlindFilter('deuteranopia');

    const svgCount = document.querySelectorAll('#a11y-inspector-svg-filters').length;
    const styleCount = document.querySelectorAll('#a11y-inspector-colour-blind-style').length;

    expect(svgCount).toBe(1);
    expect(styleCount).toBe(1);
  });

  // TEST 4: removeColourBlindFilter on page with no filter does not throw

  it('should not throw when removeColourBlindFilter is called on clean page', () => {
    // Ensure page is clean
    expect(document.getElementById('a11y-inspector-svg-filters')).toBeNull();

    // Should not throw
    expect(() => {
      removeColourBlindFilter();
    }).not.toThrow();
  });

  it('should not throw when removeColourBlindFilter is called multiple times', () => {
    applyColourBlindFilter('deuteranopia');
    removeColourBlindFilter();

    // Call again on already clean page
    expect(() => {
      removeColourBlindFilter();
    }).not.toThrow();

    // Call a third time
    expect(() => {
      removeColourBlindFilter();
    }).not.toThrow();
  });

  // TEST 5: Style element applies filter to HTML element with !important

  it('should apply filter to html element with !important', () => {
    applyColourBlindFilter('deuteranopia');

    const style = document.getElementById('a11y-inspector-colour-blind-style') as HTMLStyleElement;
    expect(style).toBeTruthy();

    // Check style content
    const styleContent = style.textContent;
    expect(styleContent).toContain('html');
    expect(styleContent).toContain('filter:');
    expect(styleContent).toContain('url(#a11y-deuteranopia)');
    expect(styleContent).toContain('!important');
  });

  it('should update filter URL when mode changes', () => {
    // Apply deuteranopia
    applyColourBlindFilter('deuteranopia');
    let style = document.getElementById('a11y-inspector-colour-blind-style') as HTMLStyleElement;
    expect(style?.textContent).toContain('url(#a11y-deuteranopia)');

    // Change to protanopia
    applyColourBlindFilter('protanopia');
    style = document.getElementById('a11y-inspector-colour-blind-style') as HTMLStyleElement;
    expect(style?.textContent).toContain('url(#a11y-protanopia)');
    expect(style?.textContent).not.toContain('deuteranopia');

    // Change to achromatopsia
    applyColourBlindFilter('achromatopsia');
    style = document.getElementById('a11y-inspector-colour-blind-style') as HTMLStyleElement;
    expect(style?.textContent).toContain('url(#a11y-achromatopsia)');
  });

  // ADDITIONAL TESTS: Indicator badge

  it('should create indicator badge with correct text for each mode', () => {
    // Test deuteranopia
    applyColourBlindFilter('deuteranopia');
    let indicator = document.getElementById('a11y-inspector-colour-blind-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.getAttribute('aria-hidden')).toBe('true');
    expect(indicator?.className).toContain('a11y-colour-blind-indicator');
    expect(indicator?.textContent).toContain('Deuteranopia');

    // Test protanopia
    applyColourBlindFilter('protanopia');
    indicator = document.getElementById('a11y-inspector-colour-blind-indicator');
    expect(indicator?.textContent).toContain('Protanopia');

    // Test tritanopia
    applyColourBlindFilter('tritanopia');
    indicator = document.getElementById('a11y-inspector-colour-blind-indicator');
    expect(indicator?.textContent).toContain('Tritanopia');

    // Test achromatopsia
    applyColourBlindFilter('achromatopsia');
    indicator = document.getElementById('a11y-inspector-colour-blind-indicator');
    expect(indicator?.textContent).toContain('Achromatopsia');
  });

  it('should remove indicator badge when mode is none', () => {
    applyColourBlindFilter('deuteranopia');
    expect(document.getElementById('a11y-inspector-colour-blind-indicator')).toBeTruthy();

    applyColourBlindFilter('none');
    expect(document.getElementById('a11y-inspector-colour-blind-indicator')).toBeNull();
  });

  // EDGE CASES

  it('should create all filter definitions in SVG container', () => {
    applyColourBlindFilter('deuteranopia');

    const svg = document.getElementById('a11y-inspector-svg-filters');
    expect(svg).toBeTruthy();

    // All filters should be defined even if only one is active
    expect(svg?.querySelector('#a11y-deuteranopia')).toBeTruthy();
    expect(svg?.querySelector('#a11y-protanopia')).toBeTruthy();
    expect(svg?.querySelector('#a11y-tritanopia')).toBeTruthy();
    expect(svg?.querySelector('#a11y-achromatopsia')).toBeTruthy();
  });

  it('should inject SVG into body and style into head', () => {
    applyColourBlindFilter('deuteranopia');

    const svg = document.getElementById('a11y-inspector-svg-filters');
    expect(svg?.parentElement).toBe(document.body);

    const style = document.getElementById('a11y-inspector-colour-blind-style');
    expect(style?.parentElement).toBe(document.head);

    const indicator = document.getElementById('a11y-inspector-colour-blind-indicator');
    expect(indicator?.parentElement).toBe(document.body);
  });
});

/*
// 1. Activate Deuteranopia (green-blind, most common - 8% of males)
window.postMessage({
  __a11ySimulator: true,
  feature: 'colourBlind',
  action: 'set',
  mode: 'deuteranopia'
}, '*');

// 2. Activate Protanopia (red-blind - 2% of males)
window.postMessage({
  __a11ySimulator: true,
  feature: 'colourBlind',
  action: 'set',
  mode: 'protanopia'
}, '*');

// 3. Activate Tritanopia (blue-blind - very rare)
window.postMessage({
  __a11ySimulator: true,
  feature: 'colourBlind',
  action: 'set',
  mode: 'tritanopia'
}, '*');

// 4. Activate Achromatopsia (complete colour blindness - extremely rare)
window.postMessage({
  __a11ySimulator: true,
  feature: 'colourBlind',
  action: 'set',
  mode: 'achromatopsia'
}, '*');

// 5. Reset to normal vision
window.postMessage({
  __a11ySimulator: true,
  feature: 'colourBlind',
  action: 'set',
  mode: 'none'
}, '*');

// 6. Check current mode
window.postMessage({
  __a11ySimulator: true,
  feature: 'colourBlind',
  action: 'get'
}, '*');
*/

/*
['deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia', 'none'].forEach((mode, i) => {
  setTimeout(() => {
    window.postMessage({ __a11ySimulator: true, feature: 'colourBlind', action: 'set', mode }, '*');
  }, i * 3000);
});
*/
