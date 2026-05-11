import { vi, beforeEach } from 'vitest';

const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    lastError: undefined as { message?: string } | undefined,
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
    },
  },
  action: {
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setBadgeText: vi.fn().mockResolvedValue(undefined),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([]),
  },
};

Object.defineProperty(globalThis, 'chrome', {
  writable: true,
  configurable: true,
  value: chromeMock,
});

Object.defineProperty(window, 'scrollX', { writable: true, configurable: true, value: 0 });
Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 });

beforeEach(() => {
  vi.clearAllMocks();
});
