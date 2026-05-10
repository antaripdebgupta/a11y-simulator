import { MessageType, type Message, type HighlightElementPayload } from '../shared/messages';

const HIGHLIGHT_DURATION_MS = 2000;
const OUTLINE_STYLE = '3px solid #DC2626';
const OUTLINE_OFFSET = '3px';

const isValidSelector = (selector: string): boolean => {
  if (!selector.trim()) return false;
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

const createOverlay = (rect: DOMRect): HTMLDivElement => {
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = [
    'position:fixed',
    `top:${rect.top}px`,
    `left:${rect.left}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'background:rgba(220,38,38,0.18)',
    'border:2px solid #DC2626',
    'border-radius:2px',
    'pointer-events:none',
    'z-index:2147483647',
    'transition:opacity 0.4s ease',
  ].join(';');
  return overlay;
};

const highlightElement = (selector: string): void => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    console.warn(`[Highlighter] No element found for selector: "${selector}"`);
    return;
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const savedOutline = element.style.outline;
  const savedOutlineOffset = element.style.outlineOffset;

  element.style.outline = OUTLINE_STYLE;
  element.style.outlineOffset = OUTLINE_OFFSET;

  const attachOverlay = (): HTMLDivElement => {
    const rect = element.getBoundingClientRect();
    const overlay = createOverlay(rect);
    document.body.appendChild(overlay);
    return overlay;
  };

  const overlay = attachOverlay();

  const cleanup = (): void => {
    element.style.outline = savedOutline;
    element.style.outlineOffset = savedOutlineOffset;
    overlay.remove();
  };

  setTimeout(cleanup, HIGHLIGHT_DURATION_MS);
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

      if (typeof selector !== 'string' || !isValidSelector(selector)) {
        console.warn('[Highlighter] HIGHLIGHT_ELEMENT received invalid selector:', selector);
        sendResponse({ success: false, error: 'Invalid or empty selector' });
        return true;
      }

      highlightElement(selector);
      sendResponse({ success: true });
      return true;
    }
  );
};
