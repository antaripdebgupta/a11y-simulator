import { vi, describe, it, expect } from 'vitest';

vi.mock('../../src/background/axe-runner', () => ({
  runAxeScanForTab: vi.fn().mockResolvedValue([]),
}));

import { getBadgeState } from '../../src/background/service-worker';

describe('getBadgeState', () => {
  // Test 3.1 — 0 violations → empty text + green
  it('returns empty text and green color for 0 violations', () => {
    const { text, color } = getBadgeState(0);
    expect(text).toBe('');
    expect(color).toBe('#1f7a1f');
  });

  // Test 3.2 — 1 violation → amber
  it('returns amber color for 1 violation', () => {
    const { text, color } = getBadgeState(1);
    expect(text).toBe('1');
    expect(color).toBe('#b9770e');
  });

  // Test 3.3 — 4 violations → still amber (boundary)
  it('returns amber color for 4 violations', () => {
    const { text, color } = getBadgeState(4);
    expect(text).toBe('4');
    expect(color).toBe('#b9770e');
  });

  // Test 3.4 — 5 violations → red
  it('returns red color for 5 violations', () => {
    const { text, color } = getBadgeState(5);
    expect(text).toBe('5');
    expect(color).toBe('#b42318');
  });

  // Test 3.5 — large count → capped at "99+"
  it('caps count text at "99+" for values above 99', () => {
    const { text, color } = getBadgeState(150);
    expect(text).toBe('99+');
    expect(color).toBe('#b42318');
  });

  // Test 3.6 — negative / NaN → treated as 0
  it('treats negative numbers as 0', () => {
    const { text, color } = getBadgeState(-1);
    expect(text).toBe('');
    expect(color).toBe('#1f7a1f');
  });

  it('treats NaN as 0', () => {
    const { text, color } = getBadgeState(NaN);
    expect(text).toBe('');
    expect(color).toBe('#1f7a1f');
  });

  // Test 3.7 — float is truncated (3.7 → 3)
  it('truncates float values', () => {
    const { text } = getBadgeState(3.7);
    expect(text).toBe('3');
  });
});
