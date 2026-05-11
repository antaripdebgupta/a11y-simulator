import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { requestAxeScanForCurrentTab } from '../../src/content/axe-runner';
import type { Result } from 'axe-core';

describe('Content Axe Runner', () => {
  // Test 2.1 — sends a REQUEST_AXE_SCAN message
  it('sends REQUEST_AXE_SCAN message to background', async () => {
    (chrome.runtime.sendMessage as Mock).mockResolvedValue({ violations: [] });

    await requestAxeScanForCurrentTab();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    const [msg] = (chrome.runtime.sendMessage as Mock).mock.calls[0] as [
      { type: string; payload?: unknown },
    ];
    expect(msg.type).toBe('REQUEST_AXE_SCAN');
  });

  // Test 2.2 — returns violations array from response
  it('returns violations array from the response', async () => {
    const fakeViolations: Partial<Result>[] = [
      { id: 'color-contrast', impact: 'serious', description: 'Contrast too low' },
    ];
    (chrome.runtime.sendMessage as Mock).mockResolvedValue({ violations: fakeViolations });

    const result = await requestAxeScanForCurrentTab();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('color-contrast');
  });

  // Test 2.3 — returns empty array on runtime.lastError
  it('returns empty array when sendMessage rejects', async () => {
    (chrome.runtime.sendMessage as Mock).mockRejectedValue(new Error('Extension context'));

    const result = await requestAxeScanForCurrentTab();

    expect(result).toEqual([]);
  });

  // Test 2.4 — returns empty array when response is null/undefined
  it('returns empty array when response is undefined', async () => {
    (chrome.runtime.sendMessage as Mock).mockResolvedValue(undefined);

    const result = await requestAxeScanForCurrentTab();

    expect(result).toEqual([]);
  });

  // Test 2.5 — non-array violations field treated as empty
  it('returns empty array when violations field is not an array', async () => {
    (chrome.runtime.sendMessage as Mock).mockResolvedValue({ violations: null });

    const result = await requestAxeScanForCurrentTab();

    expect(result).toEqual([]);
  });
});
