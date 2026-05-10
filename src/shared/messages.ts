export enum MessageType {
  POPUP_OPENED = 'POPUP_OPENED',
  SIDEPANEL_OPENED = 'SIDEPANEL_OPENED',
  CONTENT_LOADED = 'CONTENT_LOADED',
  CONTENT_ACTION = 'CONTENT_ACTION',
  REQUEST_AXE_SCAN = 'REQUEST_AXE_SCAN',
  VIOLATION_COUNT = 'VIOLATION_COUNT',
  TOGGLE_AXE = 'TOGGLE_AXE',
  TOGGLE_TAB_ORDER = 'TOGGLE_TAB_ORDER',
  TOGGLE_SCREEN_READER = 'TOGGLE_SCREEN_READER',
  SET_COLOUR_BLIND_MODE = 'SET_COLOUR_BLIND_MODE',
  TOGGLE_KEYBOARD_ONLY = 'TOGGLE_KEYBOARD_ONLY',
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

export interface ToggleAxePayload {
  enabled: boolean;
}

export interface ToggleTabOrderPayload {
  enabled: boolean;
}

export interface ToggleScreenReaderPayload {
  enabled: boolean;
}

export interface ToggleKeyboardOnlyPayload {
  enabled: boolean;
}

export interface SetColourBlindModePayload {
  mode: ColourBlindMode;
}

export type ColourBlindMode =
  | 'none'
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'
  | 'achromatopsia';
