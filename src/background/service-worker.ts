import { runAxeScanForTab } from './axe-runner';
import {
  MessageType,
  type Message,
  type RequestAxeScanPayload,
  type ViolationCountPayload,
} from '../shared/messages';

const BADGE_COLORS = {
  safe: '#1f7a1f',
  warning: '#b9770e',
  danger: '#b42318',
  idle: '#6b7280',
} as const;

const normalizeCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
};

const toBadgeText = (count: number): string => {
  if (count > 99) {
    return '99+';
  }

  return String(count);
};

const updateBadge = async (tabId: number | undefined, count: number): Promise<void> => {
  const normalizedCount = normalizeCount(count);
  const text = toBadgeText(normalizedCount);

  let color: string = BADGE_COLORS.safe;
  if (normalizedCount >= 5) {
    color = BADGE_COLORS.danger;
  } else if (normalizedCount > 0) {
    color = BADGE_COLORS.warning;
  }

  const badgeScope = typeof tabId === 'number' && tabId > 0 ? { tabId } : {};
  console.debug(
    `[Service Worker] Updating badge for tab ${tabId}: count=${normalizedCount}, text="${text}", color=${color}`
  );
  await chrome.action.setBadgeBackgroundColor({ color, ...badgeScope });
  await chrome.action.setBadgeText({ text, ...badgeScope });
};

const resetBadge = async (tabId: number): Promise<void> => {
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.idle, tabId });
  await chrome.action.setBadgeText({ text: '...', tabId });
};

const handleViolationMessage = async (
  message: Message<ViolationCountPayload>,
  sender: chrome.runtime.MessageSender
): Promise<void> => {
  const count = normalizeCount(message.payload?.count);
  console.debug(
    `[Service Worker] Received VIOLATION_COUNT from tab ${sender.tab?.id}: ${count} violations`
  );
  await updateBadge(sender.tab?.id, count);
};

const handleAxeScanRequest = async (
  message: Message<RequestAxeScanPayload>,
  sender: chrome.runtime.MessageSender
): Promise<{ violations: unknown[] }> => {
  const requestedTabId = message.payload?.tabId;
  const tabId =
    typeof requestedTabId === 'number' && requestedTabId > 0 ? requestedTabId : sender.tab?.id;

  console.debug(
    `[Service Worker] REQUEST_AXE_SCAN received from tab ${sender.tab?.id}, executing on tab ${tabId}`
  );

  if (!tabId) {
    console.warn('[Service Worker] No valid tab ID found for scan request');
    return { violations: [] };
  }

  await resetBadge(tabId);

  const violations = await runAxeScanForTab(tabId);
  await updateBadge(tabId, violations.length);
  console.debug(`[Service Worker] Axe scan complete: ${violations.length} violations found`);
  return { violations };
};

const processMessage = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean => {
  console.debug(
    `[Service Worker] Message received: type=${message.type}, sender tab=${sender.tab?.id}`
  );

  if (message.type === MessageType.REQUEST_AXE_SCAN) {
    void handleAxeScanRequest(message as Message<RequestAxeScanPayload>, sender)
      .then((response) => {
        console.debug('[Service Worker] Sending axe scan response');
        sendResponse(response);
      })
      .catch((error) => {
        console.error('[Service Worker] Failed to run axe scan:', error);
        sendResponse({ violations: [] });
      });
    return true;
  }

  if (message.type === MessageType.VIOLATION_COUNT) {
    void handleViolationMessage(message as Message<ViolationCountPayload>, sender)
      .then(() => {
        console.debug('[Service Worker] Badge updated successfully');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('[Service Worker] Failed to update badge:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true;
  }

  if (message.type === MessageType.POPUP_OPENED || message.type === MessageType.SIDEPANEL_OPENED) {
    sendResponse({ success: true });
    return false;
  }

  console.warn('[Service Worker] Unsupported message type:', message.type);
  sendResponse({ success: false, error: 'Unsupported message type' });
  return false;
};

const setupListeners = (): void => {
  console.debug('[Service Worker] Setting up message and tab listeners');
  chrome.runtime.onMessage.addListener(processMessage);

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      console.debug(`[Service Worker] Tab ${tabId} loading, resetting badge`);
      void resetBadge(tabId).catch((error) => {
        console.error('[Service Worker] Failed to reset badge:', error);
      });
    }
  });
};

console.debug('[Service Worker] Service worker initialized');
setupListeners();
