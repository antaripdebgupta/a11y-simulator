import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageType,
  type Message,
  type ViolationCountPayload,
  type ColourBlindMode,
  type SetColourBlindModePayload,
} from '../shared/messages';
import { ToggleSwitch } from './components/ToggleSwitch';
import { ViolationBadge } from './components/ViolationBadge';
import { ColourBlindPicker } from './components/ColourBlindPicker';

const SK = {
  AXE: 'axeEnabled',
  TAB_ORDER: 'tabOrderEnabled',
  SCREEN_READER: 'screenReaderEnabled',
  KEYBOARD_ONLY: 'keyboardOnlyEnabled',
  COLOUR_BLIND: 'colourBlindMode',
} as const;

interface FeatureState {
  axeEnabled: boolean;
  tabOrderEnabled: boolean;
  screenReaderEnabled: boolean;
  keyboardOnlyEnabled: boolean;
  colourBlindMode: ColourBlindMode;
}

const DEFAULT_FEATURE_STATE: FeatureState = {
  axeEnabled: false,
  tabOrderEnabled: false,
  screenReaderEnabled: false,
  keyboardOnlyEnabled: false,
  colourBlindMode: 'none',
};

const tryTabMessage = async (message: Message): Promise<boolean> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.id < 0) return false;
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {
    return false;
  }
};

const LogoIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect width="28" height="28" rx="6" fill="#1d4ed8" />
    <circle cx="14" cy="9" r="2.5" fill="white" />
    <path
      d="M8 15.5c0-3.3 2.7-6 6-6s6 2.7 6 6"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M14 15.5v-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M11.5 19.5h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ScanIcon: React.FC = () => (
  <svg className="feature-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Checkmark inside lens */}
    <path
      d="M6.5 8.5l1.5 1.5 2.5-2.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TabOrderIcon: React.FC = () => (
  <svg className="feature-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M11.5 7.5L14 10l-2.5 2.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M4.5 10V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ScreenReaderIcon: React.FC = () => (
  <svg className="feature-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    {/* Speaker cone */}
    <path
      d="M4 7.5H2.5v5H4l3.5 2.5v-10L4 7.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Sound waves */}
    <path d="M12 7a4 4 0 010 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M14.5 5a7 7 0 010 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const KeyboardIcon: React.FC = () => (
  <svg className="feature-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="5.5" width="16" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    {/* Key caps */}
    <path
      d="M5.5 9h1M9 9h1M12.5 9h1M7.5 12h5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

interface FeatureConfig {
  key: keyof Omit<FeatureState, 'colourBlindMode'>;
  storageKey: string;
  messageType: MessageType;
  Icon: React.FC;
  name: string;
  description: string;
}

const FEATURES: FeatureConfig[] = [
  {
    key: 'axeEnabled',
    storageKey: SK.AXE,
    messageType: MessageType.TOGGLE_AXE,
    Icon: ScanIcon,
    name: 'WCAG Scanner',
    description: 'Live violation count on badge',
  },
  {
    key: 'tabOrderEnabled',
    storageKey: SK.TAB_ORDER,
    messageType: MessageType.TOGGLE_TAB_ORDER,
    Icon: TabOrderIcon,
    name: 'Tab Order',
    description: 'Visualise keyboard focus sequence',
  },
  {
    key: 'screenReaderEnabled',
    storageKey: SK.SCREEN_READER,
    messageType: MessageType.TOGGLE_SCREEN_READER,
    Icon: ScreenReaderIcon,
    name: 'Screen Reader',
    description: 'Announce elements via speech',
  },
  {
    key: 'keyboardOnlyEnabled',
    storageKey: SK.KEYBOARD_ONLY,
    messageType: MessageType.TOGGLE_KEYBOARD_ONLY,
    Icon: KeyboardIcon,
    name: 'Keyboard Only',
    description: 'Block mouse, enforce keys',
  },
];

export const Popup: React.FC = () => {
  const [featureState, setFeatureState] = useState<FeatureState>(DEFAULT_FEATURE_STATE);
  const [violationCount, setViolationCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [contentScriptMissing, setContentScriptMissing] = useState(false);

  useEffect(() => {
    const init = async (): Promise<void> => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTabId = typeof tab?.id === 'number' && tab.id > 0 ? tab.id : null;

      const storageKeys: string[] = [
        SK.AXE,
        SK.TAB_ORDER,
        SK.SCREEN_READER,
        SK.KEYBOARD_ONLY,
        SK.COLOUR_BLIND,
      ];
      if (activeTabId !== null) {
        storageKeys.push(`violationCount_${activeTabId}`);
      }

      const stored = await chrome.storage.local.get(storageKeys);

      setFeatureState({
        axeEnabled: stored[SK.AXE] === true,
        tabOrderEnabled: stored[SK.TAB_ORDER] === true,
        screenReaderEnabled: stored[SK.SCREEN_READER] === true,
        keyboardOnlyEnabled: stored[SK.KEYBOARD_ONLY] === true,
        colourBlindMode: (stored[SK.COLOUR_BLIND] as ColourBlindMode | undefined) ?? 'none',
      });

      // Populate the count immediately from the last persisted scan result
      if (activeTabId !== null) {
        const cached = stored[`violationCount_${activeTabId}`];
        if (typeof cached === 'number' && Number.isFinite(cached)) {
          setViolationCount(Math.max(0, Math.trunc(cached)));
        }
      }

      // Confirm background service worker is reachable
      chrome.runtime.sendMessage({ type: MessageType.POPUP_OPENED } as Message, () => {
        setConnected(!chrome.runtime.lastError);
      });
    };

    void init();

    const handleMessage = (message: Message): void => {
      if (message.type === MessageType.VIOLATION_COUNT) {
        const payload = message.payload as ViolationCountPayload | undefined;
        if (typeof payload?.count === 'number' && Number.isFinite(payload.count)) {
          setViolationCount(Math.max(0, Math.trunc(payload.count)));
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const handleToggle = useCallback(
    async (feature: FeatureConfig, currentValue: boolean): Promise<void> => {
      const newValue = !currentValue;

      await chrome.storage.local.set({ [feature.storageKey]: newValue });

      setFeatureState((prev) => {
        const next: FeatureState = { ...prev };
        next[feature.key] = newValue;
        return next;
      });

      const sent = await tryTabMessage({
        type: feature.messageType,
        payload: { enabled: newValue },
      } as Message);

      setContentScriptMissing(!sent);
    },
    []
  );

  const handleColourBlindChange = useCallback(async (mode: ColourBlindMode): Promise<void> => {
    await chrome.storage.local.set({ [SK.COLOUR_BLIND]: mode });
    setFeatureState((prev) => ({ ...prev, colourBlindMode: mode }));

    const payload: SetColourBlindModePayload = { mode };
    const sent = await tryTabMessage({
      type: MessageType.SET_COLOUR_BLIND_MODE,
      payload,
    } as Message);

    setContentScriptMissing(!sent);
  }, []);

  const handleOpenReport = useCallback(async (): Promise<void> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId !== undefined) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (error) {
      console.warn('[Popup] Failed to open side panel:', error);
      chrome.runtime.sendMessage({ type: MessageType.SIDEPANEL_OPENED } as Message, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            '[Popup] Background fallback also failed:',
            chrome.runtime.lastError.message
          );
        }
      });
    }
  }, []);

  const severityClass =
    violationCount === 0
      ? 'violation-bar--green'
      : violationCount < 5
        ? 'violation-bar--amber'
        : 'violation-bar--red';

  return (
    <div className="popup-root">
      <header className="popup-header">
        <div className="popup-logo">
          <LogoIcon />
          <span className="popup-logo-name">A11y Simulator</span>
        </div>
        <div
          className="popup-status"
          aria-live="polite"
          aria-label={connected ? 'Connected' : 'Disconnected'}
        >
          <span className={`status-dot${connected ? '' : ' status-dot--off'}`} aria-hidden="true" />
          <span className="status-label">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <div className={`violation-bar ${severityClass}`}>
        <ViolationBadge count={violationCount} />
      </div>

      <section className="features-section" aria-label="Accessibility feature toggles">
        {FEATURES.map((feature) => {
          const isOn = featureState[feature.key];
          return (
            <div key={feature.key} className="feature-row">
              <div className="feature-info">
                <feature.Icon />
                <div className="feature-text">
                  <span className="feature-name">{feature.name}</span>
                  <span className="feature-desc">{feature.description}</span>
                </div>
              </div>
              <div className="feature-toggle">
                <ToggleSwitch
                  checked={isOn}
                  onChange={() => void handleToggle(feature, isOn)}
                  label={`Toggle ${feature.name}`}
                />
              </div>
            </div>
          );
        })}
      </section>

      <div className="colour-blind-section">
        <ColourBlindPicker
          value={featureState.colourBlindMode}
          onChange={(mode) => void handleColourBlindChange(mode)}
        />
      </div>

      {contentScriptMissing && (
        <div className="reload-warning" role="alert">
          Reload the page to activate features
        </div>
      )}

      <footer className="popup-footer">
        <button type="button" className="open-report-btn" onClick={() => void handleOpenReport()}>
          Open Full Report
        </button>
      </footer>
    </div>
  );
};
