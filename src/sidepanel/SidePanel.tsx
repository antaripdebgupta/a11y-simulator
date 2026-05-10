/**
 * SidePanel.tsx
 *
 * Main side-panel UI.  Two tabs:
 *   1. Violations Report — grouped axe-core results with filtering
 *   2. ARIA Tree         — collapsible accessibility tree of the page
 *
 * Communication pattern:
 *   - REQUEST_AXE_SCAN  → sent to the content script, which relays to background
 *   - REQUEST_ARIA_TREE → sent to the content script (DOM access required)
 *   - VIOLATION_COUNT   → received live from content script via runtime.onMessage
 *   - HIGHLIGHT_ELEMENT → sent from child components (ViolationCard / AriaTreeNodeItem)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Result } from 'axe-core';
import {
  MessageType,
  type Message,
  type ViolationCountPayload,
  type AriaTreeNode,
  type RequestAriaTreePayload,
} from '../shared/messages';
import { sendToActiveTab } from '../shared/messaging';
import { ViolationCard } from './components/ViolationCard';
import { AriaTreeNodeItem } from './components/AriaTreeNode';
import { FilterBar } from './components/FilterBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActiveTab = 'violations' | 'aria-tree';
type ImpactFilter = 'All' | 'Critical' | 'Serious' | 'Moderate' | 'Minor';

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

const WCAG_TAG_RE = /^wcag\d{3,4}$/;
const IMPACT_ORDER: string[] = ['critical', 'serious', 'moderate', 'minor'];

/** Prefer the first tag that matches wcag\d{3,4}, else 'other'. */
const extractWcagTag = (tags: string[]): string => tags.find((t) => WCAG_TAG_RE.test(t)) ?? 'other';

/** Convert "wcag111" → "WCAG 1.1.1", "wcag143" → "WCAG 1.4.3", etc. */
const formatWcagCriterion = (tag: string): string => {
  if (tag === 'other') return 'Other';
  const d = tag.replace('wcag', '');
  if (d.length === 3) return `WCAG ${d[0]}.${d[1]}.${d[2]}`;
  if (d.length === 4) return `WCAG ${d[0]}.${d[1]}.${d[2]}${d[3]}`;
  return tag.toUpperCase();
};

const sortByImpact = (a: Result, b: Result): number =>
  IMPACT_ORDER.indexOf(a.impact ?? 'minor') - IMPACT_ORDER.indexOf(b.impact ?? 'minor');

const truncateUrl = (url: string, maxLen = 40): string =>
  url.length <= maxLen ? url : `${url.slice(0, maxLen - 1)}…`;

/** Colour the violation-count badge by severity. */
const badgeColor = (count: number): string => {
  if (count === 0) return '#166534';
  if (count < 5) return '#b45309';
  return '#b42318';
};

/** Extract a flat list of CSS selectors from all violation nodes. */
const extractViolationSelectors = (violations: Result[]): string[] =>
  violations.flatMap((v) =>
    v.nodes.flatMap((n) =>
      n.target.map((t) => (Array.isArray(t) ? (t[0] as string) : t)).filter(Boolean)
    )
  );

// ---------------------------------------------------------------------------
// Static SVG assets
// ---------------------------------------------------------------------------

const LogoIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false">
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

const EmptyStateIcon: React.FC = () => (
  <svg
    className="empty-state__icon"
    width="56"
    height="56"
    viewBox="0 0 56 56"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="28" cy="28" r="26" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
    <path
      d="M16 29l8 8 16-17"
      stroke="#16a34a"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// SidePanel component
// ---------------------------------------------------------------------------

export const SidePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('violations');
  const [violations, setViolations] = useState<Result[]>([]);
  const [ariaTree, setAriaTree] = useState<AriaTreeNode[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  /** True only after the first ARIA tree load attempt has completed. */
  const [treeHasLoaded, setTreeHasLoaded] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  /** Live violation count pushed by the content script mutation observer. */
  const [liveCount, setLiveCount] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Page URL
  // -------------------------------------------------------------------------

  useEffect(() => {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.url) setPageUrl(tab.url);
      })
      .catch(console.error);
  }, []);

  // -------------------------------------------------------------------------
  // Axe scan
  // -------------------------------------------------------------------------

  const runScan = useCallback(async (): Promise<void> => {
    setIsScanning(true);
    try {
      const response = await sendToActiveTab<{ violations?: Result[] }>({
        type: MessageType.REQUEST_AXE_SCAN,
      });
      setViolations(response?.violations ?? []);
      setLiveCount(null); // reset live counter after a fresh scan
    } catch (err) {
      console.error('[SidePanel] Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Initial scan on mount.
  useEffect(() => {
    void runScan();
  }, [runScan]);

  // -------------------------------------------------------------------------
  // Live violation count from content script mutation observer
  // -------------------------------------------------------------------------

  useEffect(() => {
    const listener = (message: Message): void => {
      if (message.type === MessageType.VIOLATION_COUNT) {
        const payload = message.payload as ViolationCountPayload | undefined;
        if (typeof payload?.count === 'number') {
          setLiveCount(payload.count);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  // -------------------------------------------------------------------------
  // ARIA tree — lazy-loaded when the tree tab is first activated
  // -------------------------------------------------------------------------

  const loadAriaTree = useCallback(async (): Promise<void> => {
    setIsLoadingTree(true);
    try {
      const payload: RequestAriaTreePayload = {
        violationSelectors: extractViolationSelectors(violations),
      };
      const response = await sendToActiveTab<{ tree?: AriaTreeNode[] }>({
        type: MessageType.REQUEST_ARIA_TREE,
        payload,
      });
      setAriaTree(response?.tree ?? []);
    } catch (err) {
      console.error('[SidePanel] ARIA tree load failed:', err);
    } finally {
      setIsLoadingTree(false);
      setTreeHasLoaded(true);
    }
  }, [violations]);

  useEffect(() => {
    if (activeTab === 'aria-tree') {
      void loadAriaTree();
    }
    // Intentionally re-run when the tab is switched; violations list is stable.
  }, [activeTab]);

  // -------------------------------------------------------------------------
  // Filtering & grouping
  // -------------------------------------------------------------------------

  const filteredViolations = useMemo((): Result[] => {
    const lc = searchQuery.toLowerCase();
    return violations.filter((v) => {
      const matchImpact =
        impactFilter === 'All' || (v.impact ?? '').toLowerCase() === impactFilter.toLowerCase();
      const matchSearch =
        !lc || v.id.toLowerCase().includes(lc) || v.help.toLowerCase().includes(lc);
      return matchImpact && matchSearch;
    });
  }, [violations, impactFilter, searchQuery]);

  /** Violations grouped by WCAG criterion tag, each group sorted by impact. */
  const groupedViolations = useMemo((): Map<string, Result[]> => {
    const map = new Map<string, Result[]>();
    for (const v of [...filteredViolations].sort(sortByImpact)) {
      const tag = extractWcagTag(v.tags);
      const bucket = map.get(tag) ?? [];
      bucket.push(v);
      map.set(tag, bucket);
    }
    // Sort map keys: known wcag tags alphabetically, 'other' last.
    return new Map(
      [...map.entries()].sort(([a], [b]) => {
        if (a === 'other') return 1;
        if (b === 'other') return -1;
        return a.localeCompare(b);
      })
    );
  }, [filteredViolations]);

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------

  const totalCount = violations.length;
  // liveCount reflects DOM mutations; fall back to scan result count.
  const displayCount = liveCount ?? totalCount;
  const countBadgeColor = badgeColor(displayCount);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="sidepanel">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="sidepanel__header">
        <div className="sidepanel__header-row">
          <div className="sidepanel__brand">
            <LogoIcon />
            <span className="sidepanel__title">A11y Simulator</span>
          </div>

          <div className="sidepanel__controls">
            <span
              className="sidepanel__badge"
              style={{ backgroundColor: countBadgeColor }}
              aria-label={`${displayCount} violations detected`}
            >
              {displayCount}
            </span>
            <button
              className="sidepanel__rescan-btn"
              onClick={() => void runScan()}
              disabled={isScanning}
              type="button"
              aria-label="Re-scan page for accessibility violations"
            >
              {isScanning ? 'Scanning…' : 'Re-scan'}
            </button>
          </div>
        </div>

        {pageUrl && (
          <p className="sidepanel__url" title={pageUrl} aria-label={`Current page: ${pageUrl}`}>
            {truncateUrl(pageUrl)}
          </p>
        )}
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Tab bar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <nav className="sidepanel__tabbar" role="tablist" aria-label="Side panel sections">
        <button
          className={`sidepanel__tab${activeTab === 'violations' ? ' sidepanel__tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'violations'}
          aria-controls="panel-violations"
          id="tab-violations"
          onClick={() => setActiveTab('violations')}
          type="button"
        >
          Violations Report
        </button>
        <button
          className={`sidepanel__tab${activeTab === 'aria-tree' ? ' sidepanel__tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'aria-tree'}
          aria-controls="panel-aria-tree"
          id="tab-aria-tree"
          onClick={() => setActiveTab('aria-tree')}
          type="button"
        >
          ARIA Tree
        </button>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Violations panel                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="panel-violations"
        role="tabpanel"
        aria-labelledby="tab-violations"
        hidden={activeTab !== 'violations'}
        className="sidepanel__panel"
      >
        {/* Sticky filter bar */}
        <FilterBar
          impact={impactFilter}
          search={searchQuery}
          total={totalCount}
          filtered={filteredViolations.length}
          onImpactChange={(v) => setImpactFilter(v as ImpactFilter)}
          onSearchChange={setSearchQuery}
        />

        {/* Scrollable violations list */}
        <div className="violations-list">
          {/* Scanning state */}
          {isScanning && (
            <p className="status-msg" role="status" aria-live="polite">
              Scanning page for accessibility issues…
            </p>
          )}

          {/* Zero violations — green pass state */}
          {!isScanning && totalCount === 0 && (
            <div className="empty-state" role="status">
              <EmptyStateIcon />
              <p className="empty-state__title">No violations found</p>
              <p className="empty-state__subtitle">This page passes WCAG 2.2 AA automated checks</p>
              <p className="empty-state__note">
                Automated checks catch ~30% of issues. Manual testing is still required.
              </p>
            </div>
          )}

          {/* Active filters returned nothing */}
          {!isScanning && totalCount > 0 && filteredViolations.length === 0 && (
            <p className="status-msg">No violations match the current filter.</p>
          )}

          {/* Grouped violation cards */}
          {!isScanning &&
            [...groupedViolations.entries()].map(([tag, group]) => (
              <section
                key={tag}
                className="violation-group"
                aria-label={`${formatWcagCriterion(tag)} violations`}
              >
                <h2 className="violation-group__header">
                  <span className="violation-group__criterion">{formatWcagCriterion(tag)}</span>
                  <span
                    className="violation-group__count"
                    aria-label={`${group.length} violations in this group`}
                  >
                    {group.length}
                  </span>
                </h2>

                {group.map((v) => (
                  <ViolationCard key={v.id} violation={v} />
                ))}
              </section>
            ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* ARIA Tree panel                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="panel-aria-tree"
        role="tabpanel"
        aria-labelledby="tab-aria-tree"
        hidden={activeTab !== 'aria-tree'}
        className="sidepanel__panel sidepanel__panel--tree"
      >
        {isLoadingTree && (
          <p className="status-msg" role="status" aria-live="polite">
            Building accessibility tree…
          </p>
        )}

        {!isLoadingTree && treeHasLoaded && ariaTree.length === 0 && (
          <p className="status-msg">No accessible elements found on this page.</p>
        )}

        {!isLoadingTree && ariaTree.length > 0 && (
          <div
            className="aria-tree-container"
            role="tree"
            aria-label="Accessibility tree of page elements"
          >
            {ariaTree.map((node, i) => (
              <AriaTreeNodeItem key={`root-${node.tagName}-${i}`} node={node} depth={0} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
