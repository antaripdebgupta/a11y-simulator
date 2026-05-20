import React, { useCallback, useMemo } from 'react';
import type { Result } from 'axe-core';
import { MessageType } from '../../shared/messages';
import { sendToActiveTab } from '../../shared/messaging';

interface ViolationCardProps {
  violation: Result;
}

interface ImpactStyle {
  bg: string;
  text: string;
  label: string;
}

const IMPACT_STYLES: Record<string, ImpactStyle> = {
  critical: { bg: '#FCEBEB', text: '#A32D2D', label: 'Critical' },
  serious: { bg: '#FAECE7', text: '#993C1D', label: 'Serious' },
  moderate: { bg: '#FAEEDA', text: '#854F0B', label: 'Moderate' },
  minor: { bg: '#F1EFE8', text: '#5F5E5A', label: 'Minor' },
};

const FALLBACK_IMPACT_STYLE: ImpactStyle = IMPACT_STYLES['minor'] as ImpactStyle;

const resolveSelector = (raw: unknown): string | undefined => {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0] as string;
  return undefined;
};

export const ViolationCard: React.FC<ViolationCardProps> = ({ violation }) => {
  const impact = violation.impact ?? 'minor';
  const impactStyle: ImpactStyle = IMPACT_STYLES[impact] ?? FALLBACK_IMPACT_STYLE;

  const allSelectors = useMemo((): string[] => {
    return violation.nodes
      .flatMap((node) => node.target.map(resolveSelector))
      .filter((sel): sel is string => typeof sel === 'string');
  }, [violation.nodes]);

  const firstSelector = allSelectors[0];
  const nodeCount = violation.nodes.length;

  const handleHighlight = useCallback(async (): Promise<void> => {
    if (allSelectors.length === 0) return;
    try {
      await sendToActiveTab({
        type: MessageType.HIGHLIGHT_ELEMENT,
        payload: {
          selector: firstSelector,
          selectors: allSelectors,
        },
      });
    } catch (err) {
      console.error('[ViolationCard] Highlight failed:', err);
    }
  }, [firstSelector, allSelectors]);

  return (
    <article
      className="violation-card"
      aria-label={`${impactStyle.label} violation: ${violation.id}`}
    >
      <header className="violation-card__header">
        <span
          className="impact-pill"
          style={{ backgroundColor: impactStyle.bg, color: impactStyle.text }}
          aria-label={`Impact: ${impactStyle.label}`}
        >
          {impactStyle.label}
        </span>
        <code className="violation-card__id">{violation.id}</code>
      </header>

      <p className="violation-card__help">{violation.help}</p>

      {firstSelector && (
        <div className="violation-card__selector">
          <span className="violation-card__selector-label">Element:</span>
          <code className="violation-card__selector-code" title={firstSelector}>
            {firstSelector}
          </code>
          {nodeCount > 1 && (
            <span className="violation-card__node-count">{nodeCount} elements affected</span>
          )}
        </div>
      )}

      <footer className="violation-card__footer">
        <a
          href={violation.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="violation-card__learn-more"
          aria-label={`Learn more about ${violation.id} violation`}
        >
          Learn more ↗
        </a>

        {firstSelector && (
          <button
            className="violation-card__highlight-btn"
            onClick={() => void handleHighlight()}
            type="button"
            aria-label={`Highlight element: ${firstSelector}`}
          >
            Highlight
          </button>
        )}
      </footer>
    </article>
  );
};
