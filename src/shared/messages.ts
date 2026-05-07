export enum MessageType {
  POPUP_OPENED = 'POPUP_OPENED',
  SIDEPANEL_OPENED = 'SIDEPANEL_OPENED',
  CONTENT_LOADED = 'CONTENT_LOADED',
  CONTENT_ACTION = 'CONTENT_ACTION',
  REQUEST_AXE_SCAN = 'REQUEST_AXE_SCAN',
  VIOLATION_COUNT = 'VIOLATION_COUNT',
  TOGGLE_TAB_ORDER = 'TOGGLE_TAB_ORDER',
  TOGGLE_SCREEN_READER = 'TOGGLE_SCREEN_READER',
}

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface ViolationCountPayload {
  count: number;
}

export interface RequestAxeScanPayload {
  tabId?: number;
}

export interface ToggleTabOrderPayload {
  enabled: boolean;
}

export interface ToggleScreenReaderPayload {
  enabled: boolean;
}
