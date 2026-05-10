const KEYBOARD_STYLE_ID = 'a11y-inspector-keyboard-style';
const SKIP_LINK_ID = 'a11y-inspector-skip-link';
const TAB_OVERLAY_ID = 'a11y-inspector-tab-overlay';
const TAB_PRESSED_ATTR = 'data-a11y-tab-pressed';
const TAB_PRESSED_DURATION_MS = 200;

const EXISTING_SKIP_LINK_SELECTORS = [
  'a[href="#main"]',
  'a[href="#content"]',
  '[id="skip-to-content"]',
] as const;

const BLOCKED_MOUSE_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'mouseover',
  'mouseenter',
  'contextmenu',
] as const;

type BlockedMouseEventType = (typeof BLOCKED_MOUSE_EVENTS)[number];

const KEYBOARD_MODE_CSS = `
  /* Force visible focus ring on all elements (WCAG 2.4.7).
   * Uses :focus (not :focus-visible) because keyboard-only mode blocks all
   * mouse input, so every focus event is effectively keyboard-triggered.
   * :focus also wins over page CSS that uses :focus-visible to hide outlines. */
  *:focus {
    outline: 3px solid #1D4ED8 !important;
    outline-offset: 3px !important;
    box-shadow: 0 0 0 5px rgba(29, 78, 216, 0.25) !important;
  }

  /* Red ring flags elements that hide their outline — WCAG 2.4.7 failure */
  [style*="outline: none"]:focus,
  [style*="outline:none"]:focus {
    outline: 3px solid #DC2626 !important;
    outline-offset: 3px !important;
    box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.25) !important;
  }

  /* Smooth transition on the focus ring when Tab is pressed */
  [data-a11y-tab-pressed] *:focus {
    transition: outline 0.1s ease !important;
  }
`.trim();

let isActive = false;
let originalCursor = '';
let tabPressedTimeout: ReturnType<typeof setTimeout> | undefined;

const mouseHandlerMap = new Map<BlockedMouseEventType, EventListener>();

let activeKeydownHandler: EventListener | null = null;

//Internal helpers
const createMouseBlocker = (eventType: BlockedMouseEventType): EventListener => {
  return (event: Event): void => {
    if (eventType === 'click' && event instanceof MouseEvent && event.detail === 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest(`#${TAB_OVERLAY_ID}`)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    console.debug(`[Keyboard Mode] Blocked ${eventType}`);
  };
};

const checkFocusTrap = (): void => {
  const active = document.activeElement;
  if (!active) return;

  const dialog = active.closest('[role="dialog"]');
  if (!dialog) return;

  const closeSelector =
    '[data-dismiss], button, [aria-label*="close" i], [aria-label*="dismiss" i]';

  const hasCloseButton = dialog.querySelector(closeSelector) !== null;
  if (!hasCloseButton) {
    console.warn(
      '[A11y Simulator] Focus trap detected: dialog has no keyboard-accessible close button — WCAG 2.1.2 failure'
    );
  }
};

// Key-action helpers

const isCheckboxEl = (el: HTMLElement): boolean => {
  const tag = el.tagName.toLowerCase();
  const type = (el as HTMLInputElement).type?.toLowerCase();
  return (tag === 'input' && type === 'checkbox') || el.getAttribute('role') === 'checkbox';
};

const isLinkEl = (el: HTMLElement): boolean =>
  el.tagName.toLowerCase() === 'a' && !!(el as HTMLAnchorElement).href;

const COMPOSITE_ITEM_SELECTORS: Readonly<Record<string, string>> = {
  menu: '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
  listbox: '[role="option"]',
  radiogroup: '[role="radio"], input[type="radio"]',
};

const getCompositeItems = (el: HTMLElement): HTMLElement[] | null => {
  const composite = el.closest<HTMLElement>('[role="menu"], [role="listbox"], [role="radiogroup"]');
  if (!composite) return null;

  const role = composite.getAttribute('role') ?? '';
  const sel = COMPOSITE_ITEM_SELECTORS[role];
  if (!sel) return null;

  return Array.from(composite.querySelectorAll<HTMLElement>(sel)).filter(
    (item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true'
  );
};

const handleEnter = (keyEvent: KeyboardEvent, active: HTMLElement | null): void => {
  if (!active) return;
  if (isLinkEl(active)) return; // let native link activation pass through
  keyEvent.preventDefault();
  active.click(); // fires detail === 0 → passes through the mouse blocker
};

const handleSpace = (keyEvent: KeyboardEvent, active: HTMLElement | null): void => {
  if (!active) return;
  keyEvent.preventDefault(); // always stop scroll

  if (isCheckboxEl(active)) {
    if (active.getAttribute('role') === 'checkbox') {
      const checked = active.getAttribute('aria-checked') === 'true';
      active.setAttribute('aria-checked', checked ? 'false' : 'true');
    }
    active.click();
    return;
  }

  active.click();
};

const handleArrow = (keyEvent: KeyboardEvent, active: HTMLElement | null): void => {
  if (!active) return;
  if (active.tagName.toLowerCase() === 'select') return; // native behaviour is correct

  const items = getCompositeItems(active);
  if (!items || items.length === 0) return;

  keyEvent.preventDefault(); // stop page from scrolling

  const current = items.indexOf(active);
  const key = keyEvent.key;
  let next: number;

  if (key === 'ArrowDown' || key === 'ArrowRight') {
    next = current < items.length - 1 ? current + 1 : 0;
  } else {
    // ArrowUp / ArrowLeft
    next = current > 0 ? current - 1 : items.length - 1;
  }

  items[next]?.focus();
};

const handleEscape = (active: HTMLElement | null): void => {
  if (!active) return;

  const expandedAncestor = active.closest<HTMLElement>('[aria-expanded="true"]');
  if (expandedAncestor) {
    expandedAncestor.setAttribute('aria-expanded', 'false');
    expandedAncestor.focus();
    return;
  }

  if (active.getAttribute('aria-expanded') === 'true') {
    active.setAttribute('aria-expanded', 'false');
    return;
  }

  checkFocusTrap();
};

const handleHomeEnd = (keyEvent: KeyboardEvent, active: HTMLElement | null): void => {
  if (!active) return;

  const composite = active.closest<HTMLElement>('[role="menu"], [role="listbox"]');
  if (!composite) return;

  const role = composite.getAttribute('role') ?? '';
  const sel = COMPOSITE_ITEM_SELECTORS[role];
  if (!sel) return;

  const items = Array.from(composite.querySelectorAll<HTMLElement>(sel)).filter(
    (item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true'
  );
  if (items.length === 0) return;

  keyEvent.preventDefault();
  if (keyEvent.key === 'Home') {
    items[0]?.focus();
  } else {
    items[items.length - 1]?.focus();
  }
};

const pageHasSkipLink = (): boolean =>
  EXISTING_SKIP_LINK_SELECTORS.some((sel) => document.querySelector(sel) !== null);

const injectSkipLink = (): void => {
  if (pageHasSkipLink()) {
    console.debug('[Keyboard Mode] Skip link already present, skipping injection');
    return;
  }

  const mainEl = document.querySelector<HTMLElement>('main, [role="main"]');
  if (mainEl && !mainEl.id) {
    mainEl.id = 'main';
  }

  const link = document.createElement('a');
  link.id = SKIP_LINK_ID;
  link.href = '#main';
  link.textContent = 'Skip to main content';

  document.body.insertBefore(link, document.body.firstChild);
  console.debug('[Keyboard Mode] Skip link injected');
};

const onKeydown: EventListener = (event: Event): void => {
  const keyEvent = event as KeyboardEvent;
  const active = document.activeElement as HTMLElement | null;

  switch (keyEvent.key) {
    case 'Tab': {
      document.body.setAttribute(TAB_PRESSED_ATTR, 'true');
      if (tabPressedTimeout !== undefined) {
        clearTimeout(tabPressedTimeout);
      }
      tabPressedTimeout = setTimeout(() => {
        document.body.removeAttribute(TAB_PRESSED_ATTR);
        tabPressedTimeout = undefined;
      }, TAB_PRESSED_DURATION_MS);
      break;
    }
    case 'Enter':
      handleEnter(keyEvent, active);
      break;
    case ' ':
      handleSpace(keyEvent, active);
      break;
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
      handleArrow(keyEvent, active);
      break;
    case 'Escape':
      handleEscape(active);
      break;
    case 'Home':
    case 'End':
      handleHomeEnd(keyEvent, active);
      break;
  }
};

export const isKeyboardOnlyActive = (): boolean => isActive;
export const enableKeyboardOnly = (): void => {
  if (isActive) {
    console.debug('[Keyboard Mode] Already active');
    return;
  }

  if (!document.body || !document.head) {
    console.error('[Keyboard Mode] DOM not ready');
    return;
  }

  isActive = true;
  originalCursor = document.body.style.cursor;
  document.body.style.cursor = 'not-allowed';
  const style = document.createElement('style');
  style.id = KEYBOARD_STYLE_ID;
  style.textContent = KEYBOARD_MODE_CSS;
  document.body.appendChild(style);
  for (const eventType of BLOCKED_MOUSE_EVENTS) {
    const handler = createMouseBlocker(eventType);
    mouseHandlerMap.set(eventType, handler);
    document.addEventListener(eventType, handler, { capture: true });
  }
  activeKeydownHandler = onKeydown;
  document.addEventListener('keydown', onKeydown, { capture: true });
  injectSkipLink();

  console.debug('[Keyboard Mode] Enabled');
};

export const disableKeyboardOnly = (): void => {
  isActive = false;
  for (const [eventType, handler] of mouseHandlerMap) {
    document.removeEventListener(eventType, handler, { capture: true });
  }
  mouseHandlerMap.clear();
  if (activeKeydownHandler !== null) {
    document.removeEventListener('keydown', activeKeydownHandler, { capture: true });
    activeKeydownHandler = null;
  }
  if (tabPressedTimeout !== undefined) {
    clearTimeout(tabPressedTimeout);
    tabPressedTimeout = undefined;
  }
  document.body?.removeAttribute(TAB_PRESSED_ATTR);
  document.getElementById(KEYBOARD_STYLE_ID)?.remove();
  document.getElementById(SKIP_LINK_ID)?.remove();
  if (document.body) {
    document.body.style.cursor = originalCursor;
  }

  console.debug('[Keyboard Mode] Disabled');
};
