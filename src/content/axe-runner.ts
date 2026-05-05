import type { Result } from 'axe-core';
import { MessageType, type Message, type RequestAxeScanPayload } from '../shared/messages';

interface AxeScanResponse {
  violations?: Result[];
}

const toResultArray = (value: unknown): Result[] =>
  Array.isArray(value) ? (value as Result[]) : [];

export const requestAxeScanForCurrentTab = async (): Promise<Result[]> => {
  try {
    console.debug('[Content/Axe] Requesting scan from background');
    const message: Message<RequestAxeScanPayload> = {
      type: MessageType.REQUEST_AXE_SCAN,
    };

    const response = (await chrome.runtime.sendMessage(message)) as AxeScanResponse | undefined;
    const violations = toResultArray(response?.violations);
    console.debug(`[Content/Axe] Received ${violations.length} violations`);
    return violations;
  } catch (error) {
    console.error('[Content/Axe] Failed to request scan from background:', error);
    return [];
  }
};
