import type { Message } from '../shared/messages';

const onFirstInstall = (): void => {
  console.log('First install - setting up defaults');
};

const onUpdate = (previousVersion?: string): void => {
  console.log('Updated from version:', previousVersion);
};

const handleInstalled = (details: chrome.runtime.InstalledDetails): void => {
  console.log('Extension installed:', details.reason);

  if (details.reason === 'install') {
    onFirstInstall();
  } else if (details.reason === 'update') {
    onUpdate(details.previousVersion);
  }
};

const processMessage = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): void => {
  switch (message.type) {
    case 'POPUP_OPENED':
      console.log('Popup opened');
      sendResponse({ success: true });
      break;

    case 'SIDEPANEL_OPENED':
      console.log('Side panel opened');
      sendResponse({ success: true });
      break;

    case 'CONTENT_LOADED':
      console.log('Content script loaded in tab:', sender.tab?.id);
      sendResponse({ success: true });
      break;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
};

const handleMessage = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean => {
  try {
    processMessage(message, sender, sendResponse);
  } catch (error) {
    console.error('Error processing message:', error);
    sendResponse({ success: false, error: String(error) });
  }
  return true;
};

const handleActionClick = async (tab: chrome.tabs.Tab): Promise<void> => {
  try {
    if (!tab.id) {
      console.error('No tab ID available');
      return;
    }

    await chrome.sidePanel.open({ tabId: tab.id });
    console.log('Side panel opened for tab:', tab.id);
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
};

const setupListeners = (): void => {
  chrome.runtime.onInstalled.addListener(handleInstalled);
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.action.onClicked.addListener(handleActionClick);
};

const init = (): void => {
  console.log('Background service initialized');
  setupListeners();
};

init();
