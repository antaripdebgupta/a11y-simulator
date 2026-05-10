import type { Result } from 'axe-core';
import axeCoreFileUrl from 'axe-core/axe.min.js?url';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] as const;

const toExtensionFilePath = (value: string): string => {
  if (!value) {
    return '';
  }

  try {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) {
      return new URL(value).pathname.replace(/^\//, '');
    }
  } catch (error) {
    console.warn('[Axe Runner] Failed to parse axe-core asset URL, using raw path:', error);
  }

  return value.replace(/^\//, '');
};

const axeCoreFilePath = toExtensionFilePath(axeCoreFileUrl);

const isValidTabId = (tabId: number): boolean => Number.isInteger(tabId) && tabId > 0;

const toResultArray = (value: unknown): Result[] =>
  Array.isArray(value) ? (value as Result[]) : [];

const logViolationRules = (violations: Result[]): void => {
  if (violations.length === 0) {
    console.debug('[Axe Runner] No WCAG violations detected');
    return;
  }

  console.groupCollapsed(`[Axe Runner] Violated rules (${violations.length})`);
  violations.forEach((violation, index) => {
    const ruleId = violation.id || 'unknown-rule';
    const impact = violation.impact || 'unknown-impact';
    const nodeCount = Array.isArray(violation.nodes) ? violation.nodes.length : 0;
    const help = violation.help || 'No help text';
    const helpUrl = violation.helpUrl || 'No help URL';

    console.log(
      `${index + 1}. [${ruleId}] impact=${impact}, affectedNodes=${nodeCount} | ${help} | ${helpUrl}`
    );
  });
  console.groupEnd();
};

// Injects axe-core into the ISOLATED world of the given tab then runs a WCAG scan.

export const runAxeScanForTab = async (tabId: number): Promise<Result[]> => {
  if (!isValidTabId(tabId) || !chrome.scripting?.executeScript) {
    console.error('[Axe Runner] Invalid tab ID or missing scripting API');
    return [];
  }

  if (!axeCoreFilePath) {
    console.error('[Axe Runner] axe-core asset path not resolved');
    return [];
  }

  try {
    // Verify tab exists and is accessible
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      console.warn(`[Axe Runner] Tab ${tabId} is not accessible or is a protected page`);
      return [];
    }

    console.debug(`[Axe Runner] Injecting ${axeCoreFilePath} into ISOLATED world of tab ${tabId}`);
    // Step 1 — inject the axe library as a web-accessible extension asset.
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      files: [axeCoreFilePath],
    });

    console.debug('[Axe Runner] Running scan with tags:', WCAG_TAGS);
    // Step 2 — run the scan inside page context and return the raw violation objects.
    const scanResult = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      args: [WCAG_TAGS],
      func: async (tags) => {
        try {
          const maybeAxe = (globalThis as unknown as { axe?: { run?: Function } }).axe;
          if (typeof maybeAxe?.run !== 'function') {
            console.error('[Axe] axe.run not available after injection');
            return [];
          }

          const results = await (
            maybeAxe as {
              run: (
                context?: unknown,
                options?: {
                  runOnly?: { type: 'tag'; values: string[] };
                  preload?: boolean;
                }
              ) => Promise<{ violations?: unknown[] }>;
            }
          ).run(document, {
            runOnly: { type: 'tag', values: [...tags] },
            preload: false,
          });

          const count = Array.isArray(results.violations) ? results.violations.length : 0;
          console.debug(`[Axe] Scan complete — ${count} violations`);
          return Array.isArray(results.violations) ? results.violations : [];
        } catch (err) {
          console.error('[Axe] Scan execution error:', err);
          return [];
        }
      },
    });

    const violations = toResultArray(scanResult[0]?.result);
    console.debug(`[Axe Runner] Returning ${violations.length} violations`);
    logViolationRules(violations);
    return violations;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Don't spam console with common transient errors
    if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
      console.debug('[Axe Runner] Frame removed during scan (tab navigated or closed)');
    } else if (errorMsg.includes('No tab with id')) {
      console.debug('[Axe Runner] Tab no longer exists');
    } else {
      console.error('[Axe Runner] Injection or scan failed:', error);
    }

    return [];
  }
};
