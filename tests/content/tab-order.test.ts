import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderTabOrder, clearTabOrder } from '../../src/content/tab-order';

const OVERLAY_ID = 'a11y-inspector-tab-overlay';
const BADGE_CLASS = 'a11y-inspector-tab-badge';
const HIGHLIGHT_CLASS = 'a11y-inspector-tab-highlight';
const MISMATCH_ATTR = 'data-a11y-order-mismatch';

const makeFocusable = (tag: string, attrs: Record<string, string> = {}): HTMLElement => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  document.body.appendChild(el);
  Object.defineProperty(el, 'offsetParent', { get: () => document.body, configurable: true });
  el.getBoundingClientRect = vi.fn(() => ({
    top: 0,
    left: 0,
    right: 100,
    bottom: 20,
    width: 100,
    height: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  return el;
};

beforeEach(() => {
  document.body.innerHTML = '';
  clearTabOrder();
});

afterEach(() => {
  clearTabOrder();
  document.body.innerHTML = '';
});

describe('Tab Order', () => {
  // Test 1.1 — no focusable elements → no overlay
  it('renders no overlay when no focusable elements exist', () => {
    document.body.innerHTML = '<div>hello</div>';
    renderTabOrder();
    expect(document.getElementById(OVERLAY_ID)).toBeNull();
  });

  // Test 1.2 — renders overlay with correct count of badges
  it('renders one badge per focusable element', () => {
    makeFocusable('button');
    makeFocusable('button');
    makeFocusable('button');

    renderTabOrder();

    const overlay = document.getElementById(OVERLAY_ID);
    expect(overlay).not.toBeNull();
    const badges = overlay!.querySelectorAll(`.${BADGE_CLASS}`);
    expect(badges).toHaveLength(3);
  });

  // Test 1.3 — badges are sequentially numbered starting at 1
  it('numbers badges sequentially starting from 1', () => {
    makeFocusable('button');
    makeFocusable('button');

    renderTabOrder();

    const badges = document.querySelectorAll(`.${BADGE_CLASS}`);
    const texts = Array.from(badges).map((b) => b.textContent);
    expect(texts).toEqual(['1', '2']);
  });

  // Test 1.4 — positive tabindex elements get the ! suffix badge
  it('marks positive tabindex elements with ! suffix', () => {
    makeFocusable('button', { tabindex: '2' });
    makeFocusable('button');

    renderTabOrder();

    const badges = document.querySelectorAll(`.${BADGE_CLASS}`);
    const positiveTabBadge = Array.from(badges).find((b) => b.textContent?.includes('!'));
    expect(positiveTabBadge).not.toBeUndefined();
    expect(positiveTabBadge!.textContent).toMatch(/!/);
  });

  // Test 1.5 — elements get the highlight class applied
  it('adds highlight class to each focusable element', () => {
    const btn = makeFocusable('button');
    renderTabOrder();
    expect(btn.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
  });

  // Test 1.6 — calling renderTabOrder twice still produces only ONE overlay
  it('calling renderTabOrder twice results in only one overlay', () => {
    makeFocusable('button');
    renderTabOrder();
    renderTabOrder();

    const overlays = document.querySelectorAll(`#${OVERLAY_ID}`);
    expect(overlays).toHaveLength(1);
  });

  // Test 1.7 — clearTabOrder removes overlay and highlight classes
  it('clearTabOrder removes overlay and highlight classes', () => {
    const btn = makeFocusable('button');
    renderTabOrder();

    expect(document.getElementById(OVERLAY_ID)).not.toBeNull();
    expect(btn.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    clearTabOrder();

    expect(document.getElementById(OVERLAY_ID)).toBeNull();
    expect(btn.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
  });

  // Test 1.8 — clearTabOrder also removes mismatch attributes
  it('clearTabOrder removes data-a11y-order-mismatch attributes', () => {
    const btn = makeFocusable('button');
    btn.setAttribute(MISMATCH_ATTR, 'true');

    clearTabOrder();

    expect(btn.hasAttribute(MISMATCH_ATTR)).toBe(false);
  });
});
