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
  /** Scroll to and flash a red outline on an element by CSS selector */
  HIGHLIGHT_ELEMENT = 'HIGHLIGHT_ELEMENT',
  /** Request a serialised ARIA/accessibility tree of the active page */
  REQUEST_ARIA_TREE = 'REQUEST_ARIA_TREE',
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

export interface HighlightElementPayload {
  /** Valid CSS selector string for the element to highlight */
  selector: string;
}

export interface RequestAriaTreePayload {
  /**
   * CSS selectors of violation nodes already known to the caller.
   * The content script uses these to mark hasIssue on tree nodes.
   */
  violationSelectors?: string[];
}

/**
 * A single node in the serialised accessibility tree.
 * Built by the content script and sent back to the side panel.
 */
export interface AriaTreeNode {
  tagName: string;
  role: string;
  /** Computed accessible name (aria-label / text content / alt …) */
  name: string;
  depth: number;
  hasIssue: boolean;
  /** CSS selector path usable to re-locate this element for highlighting */
  selector: string;
  children: AriaTreeNode[];
}
