import React, { useState, useCallback } from 'react';
import type { AriaTreeNode } from '../../shared/messages';
import { MessageType } from '../../shared/messages';
import { sendToActiveTab } from '../../shared/messaging';

interface AriaTreeNodeItemProps {
  node: AriaTreeNode;
  depth: number;
  showAll: boolean;
}

const WARNING_ICON = (
  <span
    className="aria-tree__issue-icon"
    aria-label="Has accessibility issue"
    title="Has accessibility issue"
    role="img"
  >
    ⚠
  </span>
);

export const AriaTreeNodeItem: React.FC<AriaTreeNodeItemProps> = ({ node, depth, showAll }) => {
  // Nodes at depth 0-1 start expanded; deeper nodes start collapsed.
  const [expanded, setExpanded] = useState(depth < 2);

  const hasChildren = node.children.length > 0;
  const isTruncated = node.tagName === '…';

  const toggleExpand = useCallback((): void => {
    if (hasChildren) setExpanded((prev) => !prev);
  }, [hasChildren]);

  const handleHighlight = useCallback(async (): Promise<void> => {
    if (!node.selector || isTruncated) return;
    try {
      await sendToActiveTab({
        type: MessageType.HIGHLIGHT_ELEMENT,
        payload: { selector: node.selector },
      });
    } catch (err) {
      console.error('[AriaTreeNodeItem] Highlight failed:', err);
    }
  }, [node.selector, isTruncated]);

  const handleClick = useCallback((): void => {
    if (hasChildren) {
      toggleExpand();
    } else {
      void handleHighlight();
    }
  }, [hasChildren, toggleExpand, handleHighlight]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const indentStyle: React.CSSProperties = {
    paddingLeft: `${depth * 16 + 8}px`,
  };

  const rowClasses = [
    'aria-tree__row',
    node.hasIssue ? 'aria-tree__row--has-issue' : '',
    isTruncated ? 'aria-tree__row--truncated' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="aria-tree__subtree">
      <div
        className={rowClasses}
        style={indentStyle}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={false}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${node.role} ${node.name || node.tagName}`}
      >
        {/* Expand/collapse chevron */}
        <span className="aria-tree__toggle" aria-hidden="true">
          {hasChildren ? (expanded ? '▾' : '▸') : ' '}
        </span>

        {/* Role pill */}
        <span className="aria-tree__role-pill" aria-hidden="true">
          {node.role}
        </span>

        {node.name && <span className="aria-tree__name">{node.name}</span>}

        {!isTruncated && (
          <code className="aria-tree__tag" aria-hidden="true">
            {`<${node.tagName}>`}
          </code>
        )}

        {node.hasIssue && WARNING_ICON}
      </div>

      {hasChildren && expanded && (
        <div role="group">
          {node.children.map((child, index) => (
            <AriaTreeNodeItem
              key={`${child.tagName}-${child.role}-${depth}-${index}`}
              node={child}
              depth={depth + 1}
              showAll={showAll}
            />
          ))}
        </div>
      )}
    </div>
  );
};
