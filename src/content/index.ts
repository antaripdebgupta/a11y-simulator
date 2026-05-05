import { requestAxeScanForCurrentTab } from './axe-runner';
import {
  MessageType,
  type Message,
  type ViolationCountPayload,
  type RequestAxeScanPayload,
} from '../shared/messages';

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

const init = (): void => {
  console.debug('[Content Script] Initializing');
  setupMessageListener();
  setupMutationObserver();
  void runAndReportScan();
  console.debug('[Content Script] Initialization complete');
};

if (document.readyState === 'loading') {
  console.debug('[Content Script] DOM still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  console.debug('[Content Script] DOM already loaded, initializing immediately');
  init();
}
