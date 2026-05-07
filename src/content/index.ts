import { requestAxeScanForCurrentTab } from './axe-runner';
import { renderTabOrder, clearTabOrder } from './tab-order';
import { initScreenReader, destroyScreenReader, isScreenReaderActive } from './screen-reader';
import {
  MessageType,
  type Message,
  type ViolationCountPayload,
  type RequestAxeScanPayload,
  type ToggleTabOrderPayload,
  type ToggleScreenReaderPayload,
} from '../shared/messages';
import { getFromStorage, setInStorage } from '../shared/storage';

type TabOrderBridgeAction = 'enable' | 'disable' | 'status' | 'verify';

interface TabOrderBridgeRequest {
  __a11ySimulator: true;
  feature: 'tabOrder';
  action: TabOrderBridgeAction;
  requestId?: string;
}

interface TabOrderBridgeResponse {
  __a11ySimulator: true;
  feature: 'tabOrder';
  requestId?: string;
  success: boolean;
  error?: string;
  active?: boolean;
  badges?: number;
  highlights?: number;
  mismatches?: number;
  results?: Array<{ name: string; pass: boolean; detail?: string }>;
}

type ScreenReaderBridgeAction = 'enable' | 'disable' | 'status' | 'test';

interface ScreenReaderBridgeRequest {
  __a11ySimulator: true;
  feature: 'screenReader';
  action: ScreenReaderBridgeAction;
  requestId?: string;
}

interface ScreenReaderBridgeResponse {
  __a11ySimulator: true;
  feature: 'screenReader';
  requestId?: string;
  success: boolean;
  error?: string;
  active?: boolean;
  message?: string;
}

const RESCAN_DEBOUNCE_MS = 800;
const OBSERVED_ATTRIBUTES = [
  'role',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-hidden',
  'aria-live',
  'aria-busy',
  'aria-controls',
  'aria-current',
  'aria-expanded',
  'aria-invalid',
  'aria-required',
  'aria-pressed',
  'aria-selected',
  'aria-checked',
] as const;

let rescanTimeout: ReturnType<typeof setTimeout> | undefined;

const sendViolationCount = (count: number): void => {
  const payload: ViolationCountPayload = { count: Math.max(0, Math.trunc(count)) };
  const message: Message<ViolationCountPayload> = {
    type: MessageType.VIOLATION_COUNT,
    payload,
  };

  console.debug('[Content Script] Sending VIOLATION_COUNT:', payload.count);
  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {
      console.error(
        '[Content Script] Failed sending violation count:',
        chrome.runtime.lastError.message
      );
    } else {
      console.debug('[Content Script] Violation count sent successfully');
    }
  });
};

const runAndReportScan = async (): Promise<void> => {
  console.debug('[Content Script] Starting axe scan');
  const violations = await requestAxeScanForCurrentTab();
  console.debug(`[Content Script] Scan complete: ${violations.length} violations`);
  sendViolationCount(violations.length);
};

const scheduleRescan = (): void => {
  if (rescanTimeout) {
    clearTimeout(rescanTimeout);
  }

  rescanTimeout = setTimeout(() => {
    console.debug('[Content Script] Debounce timer fired, running scan');
    void runAndReportScan();
  }, RESCAN_DEBOUNCE_MS);
};

const shouldTriggerRescan = (mutations: MutationRecord[]): boolean => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
        return true;
      }
      continue;
    }

    if (mutation.type === 'attributes') {
      const attributeName = mutation.attributeName;
      if (!attributeName) {
        continue;
      }

      if (attributeName === 'role' || attributeName.startsWith('aria-')) {
        return true;
      }
    }
  }

  return false;
};

const setupMutationObserver = (): void => {
  if (!document.body) {
    console.warn('[Content Script] document.body not available, skipping observer setup');
    return;
  }

  const observer = new MutationObserver((mutations) => {
    if (shouldTriggerRescan(mutations)) {
      console.debug(`[Content Script] Detected ${mutations.length} mutations, scheduling rescan`);
      scheduleRescan();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [...OBSERVED_ATTRIBUTES],
  });
  console.debug('[Content Script] Mutation observer set up');
};

const handleMessage = (
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): void => {
  if (message.type === MessageType.TOGGLE_TAB_ORDER) {
    const payload = message.payload as ToggleTabOrderPayload;

    if (payload.enabled) {
      renderTabOrder();
      void setInStorage('tabOrderEnabled', true);
    } else {
      clearTabOrder();
      void setInStorage('tabOrderEnabled', false);
    }

    sendResponse({ success: true });
    return;
  }

  if (message.type === MessageType.TOGGLE_SCREEN_READER) {
    const payload = message.payload as ToggleScreenReaderPayload;

    if (payload.enabled) {
      initScreenReader();
      void setInStorage('screenReaderEnabled', true);
    } else {
      destroyScreenReader();
      void setInStorage('screenReaderEnabled', false);
    }

    sendResponse({ success: true });
    return;
  }

  if (message.type !== MessageType.CONTENT_ACTION) {
    sendResponse({ success: false, error: 'Unsupported message type' });
    return;
  }

  const payload = (message.payload ?? {}) as RequestAxeScanPayload;
  if (payload.tabId !== undefined && payload.tabId <= 0) {
    sendResponse({ success: false, error: 'Invalid tab id' });
    return;
  }

  scheduleRescan();
  sendResponse({ success: true });
};

const setupMessageListener = (): void => {
  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true;
  });
};

const getTabOrderDomStats = (): {
  active: boolean;
  badges: number;
  highlights: number;
  mismatches: number;
} => {
  const overlay = document.getElementById('a11y-inspector-tab-overlay');
  return {
    active: Boolean(overlay),
    badges: document.querySelectorAll('.a11y-inspector-tab-badge').length,
    highlights: document.querySelectorAll('.a11y-inspector-tab-highlight').length,
    mismatches: document.querySelectorAll('[data-a11y-order-mismatch="true"]').length,
  };
};

const setupTabOrderPostMessageBridge = (): void => {
  // Allows testing from the page's DevTools console on *any normal webpage*
  // without relying on chrome.runtime or inline script injection (CSP-safe).
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data as unknown;
    if (!data || typeof data !== 'object') {
      return;
    }

    const maybeRequest = data as Partial<TabOrderBridgeRequest>;
    if (maybeRequest.__a11ySimulator !== true || maybeRequest.feature !== 'tabOrder') {
      return;
    }

    const response: TabOrderBridgeResponse = {
      __a11ySimulator: true,
      feature: 'tabOrder',
      ...(typeof maybeRequest.requestId === 'string' ? { requestId: maybeRequest.requestId } : {}),
      success: true,
    };

    try {
      switch (maybeRequest.action) {
        case 'enable':
          renderTabOrder();
          break;
        case 'disable':
          clearTabOrder();
          break;
        case 'status':
          // no-op
          break;
        case 'verify': {
          // Render -> validate key invariants -> clear
          clearTabOrder();
          renderTabOrder();

          const afterRender = getTabOrderDomStats();
          const badges = Array.from(document.querySelectorAll('.a11y-inspector-tab-badge'));
          const positiveBadges = document.querySelectorAll(
            '.a11y-inspector-tab-badge--positive-tabindex'
          );

          const results: TabOrderBridgeResponse['results'] = [];

          results.push({
            name: 'overlay exists',
            pass: document.getElementById('a11y-inspector-tab-overlay') !== null,
          });

          results.push({
            name: 'badges match highlights',
            pass: afterRender.badges > 0 && afterRender.badges === afterRender.highlights,
            detail: `badges=${afterRender.badges}, highlights=${afterRender.highlights}`,
          });

          const sequential = badges.every((badge, i) => {
            const text = (badge.textContent ?? '').replace('!', '');
            return parseInt(text, 10) === i + 1;
          });
          results.push({ name: 'badge numbering sequential', pass: sequential });

          // If there are amber badges, they should all have ! suffix
          const amberSuffixOk = Array.from(positiveBadges).every((b) =>
            (b.textContent ?? '').endsWith('!')
          );
          results.push({
            name: 'positive tabindex badges have !',
            pass: positiveBadges.length === 0 ? true : amberSuffixOk,
            detail: `positiveBadges=${positiveBadges.length}`,
          });

          // Clear and validate cleanup
          clearTabOrder();
          const afterClear = getTabOrderDomStats();
          results.push({
            name: 'clear removes overlay',
            pass: document.getElementById('a11y-inspector-tab-overlay') === null,
          });
          results.push({
            name: 'clear removes highlight classes',
            pass: afterClear.highlights === 0,
            detail: `highlights=${afterClear.highlights}`,
          });
          results.push({
            name: 'clear removes mismatch attrs',
            pass: document.querySelectorAll('[data-a11y-order-mismatch]').length === 0,
          });

          response.results = results;

          // Restore rendered state after verification for convenience
          renderTabOrder();
          break;
        }
        default:
          response.success = false;
          response.error = 'Unsupported action';
      }

      Object.assign(response, getTabOrderDomStats());
    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : String(error);
    }

    window.postMessage(response, '*');
  });
};

const setupScreenReaderPostMessageBridge = (): void => {
  // Allows testing from the page's DevTools console on *any normal webpage*
  // without relying on chrome.runtime or inline script injection (CSP-safe).
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data as unknown;
    if (!data || typeof data !== 'object') {
      return;
    }

    const maybeRequest = data as Partial<ScreenReaderBridgeRequest>;
    if (maybeRequest.__a11ySimulator !== true || maybeRequest.feature !== 'screenReader') {
      return;
    }

    const response: ScreenReaderBridgeResponse = {
      __a11ySimulator: true,
      feature: 'screenReader',
      ...(typeof maybeRequest.requestId === 'string' ? { requestId: maybeRequest.requestId } : {}),
      success: true,
      active: false,
    };

    try {
      switch (maybeRequest.action) {
        case 'enable':
          initScreenReader();
          response.active = true;
          response.message = 'Screen reader enabled. Press Tab to navigate and hear announcements.';
          break;
        case 'disable':
          destroyScreenReader();
          response.active = false;
          response.message = 'Screen reader disabled.';
          break;
        case 'status':
          // Check if screen reader is active by checking for the listener
          response.active = isScreenReaderActive();
          response.message = response.active
            ? 'Screen reader is enabled'
            : 'Screen reader is disabled';
          break;
        case 'test': {
          // Create test elements and focus them to verify announcements
          const testContainer = document.createElement('div');
          testContainer.id = 'a11y-sr-test';
          testContainer.style.cssText =
            'position:fixed;top:10px;right:10px;z-index:999999;opacity:0;pointer-events:none';

          // Test 1: Button with aria-label
          const btn = document.createElement('button');
          btn.setAttribute('aria-label', 'Test button');
          testContainer.appendChild(btn);

          // Test 2: Required checkbox
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.setAttribute('aria-label', 'Accept terms');
          cb.required = true;
          testContainer.appendChild(cb);

          // Test 3: Heading
          const h2 = document.createElement('h2');
          h2.textContent = 'Test heading';
          h2.tabIndex = -1;
          testContainer.appendChild(h2);

          document.body.appendChild(testContainer);

          // Focus elements in sequence
          setTimeout(() => btn.focus(), 100);
          setTimeout(() => cb.focus(), 1500);
          setTimeout(() => h2.focus(), 3000);
          setTimeout(() => {
            testContainer.remove();
          }, 5000);

          response.active = true;
          response.message =
            'Test started. You should hear 3 announcements over 5 seconds. Check DevTools console for [Screen Reader] logs.';
          break;
        }
        default:
          response.success = false;
          response.error = 'Unsupported action';
      }
    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : String(error);
    }

    window.postMessage(response, '*');
  });
};

const init = (): void => {
  console.debug('[Content Script] Initializing');
  setupMessageListener();
  setupMutationObserver();
  setupTabOrderPostMessageBridge();
  setupScreenReaderPostMessageBridge();
  void runAndReportScan();

  void (async () => {
    const tabOrderEnabled = await getFromStorage<boolean>('tabOrderEnabled');
    if (tabOrderEnabled) {
      renderTabOrder();
    }

    const screenReaderEnabled = await getFromStorage<boolean>('screenReaderEnabled');
    if (screenReaderEnabled) {
      initScreenReader();
    }
  })();

  console.debug('[Content Script] Initialization complete');
};

if (document.readyState === 'loading') {
  console.debug('[Content Script] DOM still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  console.debug('[Content Script] DOM already loaded, initializing immediately');
  init();
}
