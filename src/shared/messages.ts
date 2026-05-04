export enum MessageType {
  POPUP_OPENED = 'POPUP_OPENED',
  SIDEPANEL_OPENED = 'SIDEPANEL_OPENED',
  CONTENT_LOADED = 'CONTENT_LOADED',
  CONTENT_ACTION = 'CONTENT_ACTION',
}

export interface Message<T = unknown> {
  type: MessageType | string;
  payload?: T;
}
