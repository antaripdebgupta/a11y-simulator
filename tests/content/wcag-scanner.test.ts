import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

let mutationCallback: MutationCallback | null = null;

class MockMutationObserver implements MutationObserver {
  constructor(callback: MutationCallback) {
    mutationCallback = callback;
  }
  observe() {}
  disconnect() {}
  takeRecords(): MutationRecord[] {
    return [];
  }
}

Object.defineProperty(global, 'MutationObserver', {
  writable: true,
  configurable: true,
  value: MockMutationObserver,
});

const fireMutations = (records: Partial<MutationRecord>[]): void => {
  mutationCallback?.(records as MutationRecord[], {} as MutationObserver);
};

const makeMutation = (overrides: Partial<MutationRecord>): Partial<MutationRecord> => ({
  addedNodes: [] as unknown as NodeList,
  removedNodes: [] as unknown as NodeList,
  attributeName: null,
  attributeNamespace: null,
  oldValue: null,
  nextSibling: null,
  previousSibling: null,
  target: document.body,
  ...overrides,
});

const loadModule = async (): Promise<Mock> => {
  vi.resetModules();
  mutationCallback = null;

  vi.doMock('../../src/content/axe-runner', () => ({
    requestAxeScanForCurrentTab: vi.fn().mockResolvedValue([]),
  }));
  vi.doMock('../../src/shared/storage', () => ({
    getFromStorage: vi.fn().mockResolvedValue(null),
    setInStorage: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('../../src/content/screen-reader', () => ({
    initScreenReader: vi.fn(),
    destroyScreenReader: vi.fn(),
    isScreenReaderActive: vi.fn(() => false),
  }));
  vi.doMock('../../src/content/highlighter', () => ({ initHighlighter: vi.fn() }));
  vi.doMock('../../src/content/aria-tree', () => ({ buildAriaTree: vi.fn(() => []) }));

  await import('../../src/content/index');
  const { requestAxeScanForCurrentTab } = await import('../../src/content/axe-runner');
  return requestAxeScanForCurrentTab as Mock;
};

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('WCAG Scanner (content/index)', () => {
  // Test 4.1 — initial scan runs on import
  it('runs an initial axe scan on module load', async () => {
    const mockScan = await loadModule();
    await Promise.resolve();
    expect(mockScan).toHaveBeenCalledTimes(1);
  });

  // Test 4.2 — childList mutations schedule a rescan
  it('schedules rescan when childList mutation fires', async () => {
    const mockScan = await loadModule();
    await Promise.resolve();
    mockScan.mockClear();

    fireMutations([
      makeMutation({ type: 'childList', addedNodes: [document.createElement('div')] as unknown as NodeList }),
    ]);

    vi.advanceTimersByTime(800);
    await Promise.resolve();

    expect(mockScan).toHaveBeenCalledTimes(1);
  });

  // Test 4.3 — debounce is exactly 800 ms
  it('debounces rescan: does not fire before 800 ms, fires at 800 ms', async () => {
    const mockScan = await loadModule();
    await Promise.resolve();
    mockScan.mockClear();

    fireMutations([
      makeMutation({ type: 'childList', addedNodes: [document.createElement('div')] as unknown as NodeList }),
    ]);

    vi.advanceTimersByTime(799);
    await Promise.resolve();
    expect(mockScan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(mockScan).toHaveBeenCalledTimes(1);
  });

  // Test 4.4 — aria- attribute mutation triggers rescan
  it('schedules rescan when an aria- attribute changes', async () => {
    const mockScan = await loadModule();
    await Promise.resolve();
    mockScan.mockClear();

    fireMutations([makeMutation({ type: 'attributes', attributeName: 'aria-label' })]);

    vi.advanceTimersByTime(800);
    await Promise.resolve();

    expect(mockScan).toHaveBeenCalledTimes(1);
  });

  // Test 4.5 — non-ARIA attribute mutation does NOT trigger rescan
  it('does NOT schedule rescan for non-ARIA attribute changes', async () => {
    const mockScan = await loadModule();
    await Promise.resolve();
    mockScan.mockClear();

    fireMutations([makeMutation({ type: 'attributes', attributeName: 'data-custom' })]);

    vi.advanceTimersByTime(800);
    await Promise.resolve();

    expect(mockScan).not.toHaveBeenCalled();
  });

  // Test 4.6 — role attribute mutation triggers rescan
  it('schedules rescan when role attribute changes', async () => {
    const mockScan = await loadModule();
    await Promise.resolve();
    mockScan.mockClear();

    fireMutations([makeMutation({ type: 'attributes', attributeName: 'role' })]);

    vi.advanceTimersByTime(800);
    await Promise.resolve();

    expect(mockScan).toHaveBeenCalledTimes(1);
  });
});

