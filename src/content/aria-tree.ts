import type { AriaTreeNode } from '../shared/messages';

const MAX_DEPTH = 6;
const MAX_NODES = 300;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'HEAD', 'META', 'LINK', 'TITLE']);
const HTML_ROLE_MAP: Record<string, string> = {
  A: 'link',
  BUTTON: 'button',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  NAV: 'navigation',
  MAIN: 'main',
  HEADER: 'banner',
  FOOTER: 'contentinfo',
  FORM: 'form',
  TABLE: 'table',
  UL: 'list',
  OL: 'list',
  LI: 'listitem',
  IMG: 'img',
  DIALOG: 'dialog',
  ASIDE: 'complementary',
  SECTION: 'region',
  ARTICLE: 'article',
  TEXTAREA: 'textbox',
  SELECT: 'combobox',
};

const INPUT_TYPE_ROLE_MAP: Record<string, string> = {
  button: 'button',
  submit: 'button',
  reset: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  search: 'searchbox',
  range: 'slider',
  email: 'textbox',
  tel: 'textbox',
  url: 'textbox',
  text: 'textbox',
  password: 'textbox',
  number: 'spinbutton',
  date: 'textbox',
  time: 'textbox',
  file: 'textbox',
};

const getRole = (element: Element): string => {
  const explicit = element.getAttribute('role')?.trim();
  if (explicit) return explicit;

  if (element.tagName === 'INPUT') {
    const type = ((element as HTMLInputElement).type ?? 'text').toLowerCase();
    return INPUT_TYPE_ROLE_MAP[type] ?? 'textbox';
  }

  return HTML_ROLE_MAP[element.tagName] ?? 'generic';
};

const getAccessibleName = (element: Element): string => {
  const el = element as HTMLElement;

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .trim()
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  if (el.tagName === 'IMG') {
    const alt = el.getAttribute('alt')?.trim();
    // Explicit empty alt means decorative — still show something meaningful.
    return alt !== null ? alt || '(decorative)' : '';
  }

  const title = el.getAttribute('title')?.trim();
  if (title) return title;

  const text = el.textContent?.trim() ?? '';
  if (text) {
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  return '';
};

const getCssPath = (element: Element): string => {
  if (element.id) {
    // Sanitise id to a valid CSS selector fragment.
    try {
      return `#${CSS.escape(element.id)}`;
    } catch {
      // CSS.escape unavailable (very old runtime) — fall through
    }
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current !== null && current.tagName !== 'HTML') {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;

    if (!parent) break;

    const currentTag = current.tagName;
    const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === currentTag);

    if (siblings.length > 1) {
      const idx = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${idx})`);
    } else {
      parts.unshift(tag);
    }

    current = parent;
    // Stop once we have a stable ancestor id to keep selectors short.
    if (current !== null && current.id) {
      try {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      } catch {
        // continue
      }
    }
  }

  return parts.join(' > ') || element.tagName.toLowerCase();
};

// Tree builder
let nodeCount = 0;

const buildNode = (
  element: Element,
  depth: number,
  issueSelectors: Set<string>
): AriaTreeNode | null => {
  if (nodeCount >= MAX_NODES || depth > MAX_DEPTH) return null;
  if (SKIP_TAGS.has(element.tagName)) return null;

  nodeCount++;

  const tagName = element.tagName.toLowerCase();
  const role = getRole(element);
  const name = getAccessibleName(element);
  const selector = getCssPath(element);

  let hasIssue = false;
  for (const sel of issueSelectors) {
    try {
      if (element.matches(sel)) {
        hasIssue = true;
        break;
      }
    } catch {
      // Malformed selector from axe — skip silently.
    }
  }

  const children: AriaTreeNode[] = [];

  for (const child of Array.from(element.children)) {
    if (nodeCount >= MAX_NODES) {
      // Append a sentinel leaf so the UI can indicate truncation.
      children.push({
        tagName: '…',
        role: 'note',
        name: 'Tree truncated — too many nodes (limit 300)',
        depth: depth + 1,
        hasIssue: false,
        selector: '',
        children: [],
      });
      break;
    }

    const childNode = buildNode(child, depth + 1, issueSelectors);
    if (childNode) {
      children.push(childNode);
    }
  }

  return { tagName, role, name, depth, hasIssue, selector, children };
};

export const buildAriaTree = (violationSelectors: string[] = []): AriaTreeNode[] => {
  if (!document.body) return [];

  nodeCount = 0;
  const issueSelectors = new Set(violationSelectors.filter(Boolean));
  const root = buildNode(document.body, 0, issueSelectors);
  return root ? [root] : [];
};
