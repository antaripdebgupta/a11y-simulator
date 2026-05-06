const OVERLAY_CONTAINER_ID = 'a11y-inspector-tab-overlay';
const BADGE_CLASS = 'a11y-inspector-tab-badge';
const BADGE_POSITIVE_TABINDEX_CLASS = 'a11y-inspector-tab-badge--positive-tabindex';
const HIGHLIGHT_CLASS = 'a11y-inspector-tab-highlight';
const ORDER_MISMATCH_ATTRIBUTE = 'data-a11y-order-mismatch';
const VISUAL_ORDER_THRESHOLD_PX = 40;

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
  'audio[controls]',
  'video[controls]',
] as const;

interface FocusableElement {
  element: HTMLElement;
  tabIndex: number;
  rect: DOMRect;
}

const isElementVisible = (element: HTMLElement): boolean => {
  if (element.id === OVERLAY_CONTAINER_ID || element.closest(`#${OVERLAY_CONTAINER_ID}`)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  let current: HTMLElement | null = element;
  while (current) {
    if (current.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    current = current.parentElement;
  }

  if (element.offsetParent === null && style.position !== 'fixed') {
    return false;
  }

  return true;
};

const getFocusableElements = (): HTMLElement[] => {
  const selector = FOCUSABLE_SELECTORS.join(',');
  const allElements = Array.from(document.querySelectorAll<HTMLElement>(selector));

  return allElements.filter(isElementVisible);
};

const getTabIndex = (element: HTMLElement): number => {
  const tabIndexAttr = element.getAttribute('tabindex');

  if (tabIndexAttr === null) {
    return 0;
  }

  const parsed = parseInt(tabIndexAttr, 10);
  return isNaN(parsed) ? 0 : parsed;
};

const compareDocumentPosition = (a: HTMLElement, b: HTMLElement): number => {
  const position = a.compareDocumentPosition(b);

  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1; // a comes before b
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1; // b comes before a
  }

  return 0;
};

const sortByTabOrder = (elements: FocusableElement[]): FocusableElement[] => {
  return elements.sort((a, b) => {
    const aIndex = a.tabIndex;
    const bIndex = b.tabIndex;

    if (aIndex > 0 && bIndex > 0) {
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return compareDocumentPosition(a.element, b.element);
    }

    if (aIndex > 0) {
      return -1;
    }

    if (bIndex > 0) {
      return 1;
    }

    return compareDocumentPosition(a.element, b.element);
  });
};

const createBadge = (
  index: number,
  rect: DOMRect,
  hasPositiveTabIndex: boolean
): HTMLDivElement => {
  const badge = document.createElement('div');
  badge.className = BADGE_CLASS;

  if (hasPositiveTabIndex) {
    badge.className += ` ${BADGE_POSITIVE_TABINDEX_CLASS}`;
  }

  const displayNumber = index + 1;
  const suffix = hasPositiveTabIndex ? '!' : '';
  badge.textContent = `${displayNumber}${suffix}`;

  const top = rect.top + window.scrollY;
  const left = rect.left + window.scrollX;

  badge.style.position = 'absolute';
  badge.style.top = `${Math.max(0, top)}px`;
  badge.style.left = `${Math.max(0, left)}px`;

  return badge;
};

const detectOrderMismatches = (elements: FocusableElement[]): void => {
  for (let i = 1; i < elements.length; i++) {
    const prev = elements[i - 1];
    const current = elements[i];

    if (!prev || !current) {
      continue;
    }

    const verticalDifference = prev.rect.top - current.rect.top;

    if (verticalDifference > VISUAL_ORDER_THRESHOLD_PX) {
      prev.element.setAttribute(ORDER_MISMATCH_ATTRIBUTE, 'true');
      current.element.setAttribute(ORDER_MISMATCH_ATTRIBUTE, 'true');
    }
  }
};

const createOverlayContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.id = OVERLAY_CONTAINER_ID;
  container.setAttribute('aria-hidden', 'true');

  container.style.pointerEvents = 'none';
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.zIndex = '2147483647'; // Maximum z-index

  return container;
};

export const renderTabOrder = (): void => {
  try {
    clearTabOrder();

    const rawElements = getFocusableElements();

    if (rawElements.length === 0) {
      console.warn('[Tab Order] No focusable elements found on page');
      return;
    }

    const elementsWithData: FocusableElement[] = rawElements.map((element) => ({
      element,
      tabIndex: getTabIndex(element),
      rect: element.getBoundingClientRect(),
    }));

    const sortedElements = sortByTabOrder(elementsWithData);
    detectOrderMismatches(sortedElements);
    const container = createOverlayContainer();
    sortedElements.forEach((item, index) => {
      const { element, tabIndex, rect } = item;
      element.classList.add(HIGHLIGHT_CLASS);
      const badge = createBadge(index, rect, tabIndex > 0);
      container.appendChild(badge);
    });

    if (!document.body) {
      console.error('[Tab Order] document.body not available');
      return;
    }

    document.body.appendChild(container);

    console.info(`[Tab Order] Rendered ${sortedElements.length} focusable elements`, {
      positiveTabIndex: sortedElements.filter((e) => e.tabIndex > 0).length,
      orderMismatches: sortedElements.filter((e) =>
        e.element.hasAttribute(ORDER_MISMATCH_ATTRIBUTE)
      ).length,
    });
  } catch (error) {
    console.error('[Tab Order] Error rendering tab order:', error);
    clearTabOrder();
  }
};

export const clearTabOrder = (): void => {
  try {
    const container = document.getElementById(OVERLAY_CONTAINER_ID);
    if (container) {
      container.remove();
    }

    const highlightedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    highlightedElements.forEach((element) => {
      element.classList.remove(HIGHLIGHT_CLASS);
    });

    const mismatchElements = document.querySelectorAll(`[${ORDER_MISMATCH_ATTRIBUTE}]`);
    mismatchElements.forEach((element) => {
      element.removeAttribute(ORDER_MISMATCH_ATTRIBUTE);
    });

    console.debug('[Tab Order] Cleared tab order visualization');
  } catch (error) {
    console.error('[Tab Order] Error clearing tab order:', error);
  }
};
