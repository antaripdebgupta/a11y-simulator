import type { Message } from '../shared/messages';

const handleMessage = (
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): void => {
  try {
    switch (message.type) {
      case 'CONTENT_ACTION':
        console.log('Content action received:', message.payload);
        sendResponse({ success: true });
        break;
      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: String(error) });
  }
};

const setupMessageListener = (): void => {
  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true;
  });
};

const notifyBackground = (): void => {
  chrome.runtime.sendMessage({ type: 'CONTENT_LOADED' } as Message, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error notifying background:', chrome.runtime.lastError);
      return;
    }
    console.log('Background notified:', response);
  });
};

const init = (): void => {
  console.log('Content script loaded');
  setupMessageListener();
  notifyBackground();
};

init();
