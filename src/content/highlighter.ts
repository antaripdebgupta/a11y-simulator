import { MessageType, type Message, type HighlightElementPayload } from '../shared/messages';

const HIGHLIGHT_DURATION_MS = 2000;
const OUTLINE_STYLE = '3px solid #DC2626';
const OUTLINE_OFFSET = '3px';

const activeHighlights = new Set<HTMLElement>();
let highlightTimeout: ReturnType<typeof setTimeout> | null = null;

const isValidSelector = (selector: string): boolean => {
  if (!selector.trim()) return false;
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

const createOverlay = (): HTMLDivElement => {
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('data-a11y-overlay', 'true');
  overlay.style.cssText = [
    'position:absolute',
    'background:rgba(220,38,38,0.18)',
    'border:2px solid #DC2626',
    'border-radius:2px',
    'pointer-events:none',
    'z-index:2147483647',
    'transition:opacity 0.4s ease',
  ].join(';');
  return overlay;
};

const clearAllHighlights = (): void => {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }

  activeHighlights.forEach((element) => {
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.removeAttribute('data-a11y-highlighted');
  });

  document.querySelectorAll('[data-a11y-overlay]').forEach((el) => el.remove());

  activeHighlights.clear();
};

const highlightElements = (elements: HTMLElement[]): void => {
  elements.forEach((element) => {
    // Store the outline value as a single element.style.outline assignment — never accumulate
    element.style.outline = OUTLINE_STYLE;
    element.style.outlineOffset = OUTLINE_OFFSET;

    // Set data-a11y-highlighted="true" on the element when highlighting, remove it in clearAllHighlights()
    element.setAttribute('data-a11y-highlighted', 'true');
    activeHighlights.add(element);

    // Create and position overlay relative to the document
    const rect = element.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    const overlay = createOverlay();
    overlay.style.top = `${rect.top + scrollTop}px`;
    overlay.style.left = `${rect.left + scrollLeft}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    document.body.appendChild(overlay);
  });

  // Call scrollIntoView AFTER positioning the overlay — not before
  const firstElement = elements[0];
  if (firstElement) {
    firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  highlightTimeout = setTimeout(clearAllHighlights, HIGHLIGHT_DURATION_MS);
};

export const initHighlighter = (): void => {
  chrome.runtime.onMessage.addListener(
    (
      message: Message,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ): boolean | undefined => {
      if (message.type !== MessageType.HIGHLIGHT_ELEMENT) {
        return false;
      }

      const payload = message.payload as HighlightElementPayload | undefined;
      const selector = payload?.selector;
      const selectors = payload?.selectors;

      let validSelectors: string[] = [];
      if (selectors && Array.isArray(selectors)) {
        validSelectors = selectors.filter(isValidSelector);
      } else if (typeof selector === 'string' && isValidSelector(selector)) {
        validSelectors = [selector];
      }

      if (validSelectors.length === 0) {
        console.warn('[Highlighter] HIGHLIGHT_ELEMENT received no valid selectors');
        sendResponse({ success: false, error: 'No valid selectors' });
        return true;
      }

      const targetElements = validSelectors
        .map((sel) => document.querySelector<HTMLElement>(sel))
        .filter((el): el is HTMLElement => el !== null);

      // Determine alreadyHighlighted state
      const alreadyHighlighted = targetElements.some(
        (el) => el.getAttribute('data-a11y-highlighted') === 'true'
      );

      // At the start of every HIGHLIGHT_ELEMENT message handler call a clearAllHighlights() function first — before applying any new highlight
      clearAllHighlights();

      // If alreadyHighlighted was true — call clearAllHighlights() then return early, do not re-highlight
      if (alreadyHighlighted) {
        sendResponse({ success: true });
        return true;
      }

      if (targetElements.length === 0) {
        console.warn(`[Highlighter] No elements found for selectors:`, validSelectors);
        sendResponse({ success: false, error: 'No elements found' });
        return true;
      }

      highlightElements(targetElements);
      sendResponse({ success: true });
      return true;
    }
  );
};
