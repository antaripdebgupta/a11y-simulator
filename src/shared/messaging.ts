import type { Message } from './messages';

export const sendToBackground = async <T = unknown>(message: Message): Promise<T | null> => {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response as T;
  } catch (error) {
    console.error('Error sending message to background:', error);
    return null;
  }
};

export const sendToTab = async <T = unknown>(
  tabId: number,
  message: Message
): Promise<T | null> => {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as T;
  } catch (error) {
    console.error('Error sending message to tab:', error);
    return null;
  }
};

export const sendToActiveTab = async <T = unknown>(message: Message): Promise<T | null> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }
    return await sendToTab<T>(tab.id, message);
  } catch (error) {
    console.error('Error sending message to active tab:', error);
    return null;
  }
};

export const onMessage = (
  callback: (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => void | boolean
): void => {
  chrome.runtime.onMessage.addListener(callback);
};
