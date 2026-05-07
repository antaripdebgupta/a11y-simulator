interface ComputedAccessibility {
  name: string;
  role: string;
  level?: number;
  states: string[];
}

type RoleMap = Record<string, string>;
type InputTypeRoleMap = Record<string, string>;

const SPEECH_RATE = 1.4; // Screen readers are fast by default
const MAX_TEXT_CONTENT_LENGTH = 100;
const UNLABELLED_FALLBACK = 'unlabelled element';

const HTML_ROLE_MAP: RoleMap = {
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

const INPUT_TYPE_ROLE_MAP: InputTypeRoleMap = {
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

const HEADING_LEVEL_MAP: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

let focusListener: ((event: Event) => void) | null = null;
let lastAnnouncement = '';
let isInitialized = false;

const getNameFromAriaLabelledBy = (element: HTMLElement): string | null => {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (!labelledBy) {
    return null;
  }

  const ids = labelledBy.trim().split(/\s+/);
  const texts: string[] = [];

  for (const id of ids) {
    const referencedElement = document.getElementById(id);
    if (referencedElement) {
      const text = referencedElement.textContent?.trim() ?? '';
      if (text) {
        texts.push(text);
      }
    }
  }

  return texts.length > 0 ? texts.join(' ') : null;
};

const getNameFromAriaLabel = (element: HTMLElement): string | null => {
  const ariaLabel = element.getAttribute('aria-label');
  return ariaLabel?.trim() || null;
};

const getNameFromLabel = (element: HTMLElement): string | null => {
  const elementId = element.id;
  if (!elementId) {
    return null;
  }

  const labelableElements = [
    'INPUT',
    'BUTTON',
    'SELECT',
    'TEXTAREA',
    'METER',
    'OUTPUT',
    'PROGRESS',
  ];
  if (!labelableElements.includes(element.tagName)) {
    return null;
  }

  const label = document.querySelector<HTMLLabelElement>(`label[for="${elementId}"]`);
  if (label) {
    return label.textContent?.trim() || null;
  }

  const parentLabel = element.closest('label');
  if (parentLabel) {
    return parentLabel.textContent?.trim() || null;
  }

  return null;
};

const getNameFromAlt = (element: HTMLElement): string | null => {
  if (element.tagName !== 'IMG') {
    return null;
  }

  const alt = element.getAttribute('alt');
  return alt?.trim() || null;
};

const getNameFromTitle = (element: HTMLElement): string | null => {
  const title = element.getAttribute('title');
  return title?.trim() || null;
};

const getNameFromTextContent = (element: HTMLElement): string | null => {
  const text = element.textContent?.trim() ?? '';
  if (!text) {
    return null;
  }

  return text.length > MAX_TEXT_CONTENT_LENGTH
    ? text.substring(0, MAX_TEXT_CONTENT_LENGTH) + '…'
    : text;
};

const computeAccessibleName = (element: HTMLElement): string => {
  const labelledByName = getNameFromAriaLabelledBy(element);
  if (labelledByName) {
    return labelledByName;
  }
  const ariaLabelName = getNameFromAriaLabel(element);
  if (ariaLabelName) {
    return ariaLabelName;
  }
  const labelName = getNameFromLabel(element);
  if (labelName) {
    return labelName;
  }
  const altName = getNameFromAlt(element);
  if (altName) {
    return altName;
  }
  const titleName = getNameFromTitle(element);
  if (titleName) {
    return titleName;
  }
  const textContentName = getNameFromTextContent(element);
  if (textContentName) {
    return textContentName;
  }
  return UNLABELLED_FALLBACK;
};

const computeRole = (element: HTMLElement): string => {
  const explicitRole = element.getAttribute('role');
  if (explicitRole) {
    return explicitRole.trim();
  }

  const tagName = element.tagName;
  if (tagName === 'INPUT') {
    const inputElement = element as HTMLInputElement;
    const inputType = (inputElement.type || 'text').toLowerCase();
    return INPUT_TYPE_ROLE_MAP[inputType] || 'textbox';
  }
  return HTML_ROLE_MAP[tagName] || 'generic';
};

const getHeadingLevel = (element: HTMLElement): number | undefined => {
  const tagName = element.tagName;
  const role = element.getAttribute('role');
  if (role === 'heading') {
    const ariaLevel = element.getAttribute('aria-level');
    if (ariaLevel) {
      const level = parseInt(ariaLevel, 10);
      if (!isNaN(level) && level > 0) {
        return level;
      }
    }
  }
  return HEADING_LEVEL_MAP[tagName];
};

const computeStates = (element: HTMLElement): string[] => {
  const states: string[] = [];

  if (element.getAttribute('aria-required') === 'true' || (element as HTMLInputElement).required) {
    states.push('required');
  }
  if (element.getAttribute('aria-invalid') === 'true') {
    states.push('invalid');
  }
  if (
    element.getAttribute('aria-disabled') === 'true' ||
    (element as HTMLInputElement | HTMLButtonElement).disabled
  ) {
    states.push('disabled');
  }
  const ariaChecked = element.getAttribute('aria-checked');
  if (ariaChecked === 'true') {
    states.push('checked');
  } else if (ariaChecked === 'false') {
    states.push('not checked');
  } else if ((element as HTMLInputElement).checked !== undefined) {
    const inputElement = element as HTMLInputElement;
    if (inputElement.type === 'checkbox' || inputElement.type === 'radio') {
      states.push(inputElement.checked ? 'checked' : 'not checked');
    }
  }

  const ariaExpanded = element.getAttribute('aria-expanded');
  if (ariaExpanded === 'true') {
    states.push('expanded');
  } else if (ariaExpanded === 'false') {
    states.push('collapsed');
  }

  if (element.getAttribute('aria-pressed') === 'true') {
    states.push('pressed');
  }

  const ariaSelected = element.getAttribute('aria-selected');
  if (ariaSelected === 'true') {
    states.push('selected');
  } else if (ariaSelected === 'false') {
    states.push('not selected');
  }

  return states;
};

const computeAccessibility = (element: HTMLElement): ComputedAccessibility => {
  const name = computeAccessibleName(element);
  const role = computeRole(element);
  const level = getHeadingLevel(element);
  const states = computeStates(element);

  const result: ComputedAccessibility = { name, role, states };

  if (level !== undefined) {
    result.level = level;
  }

  return result;
};

const formatAnnouncement = (computed: ComputedAccessibility): string => {
  const parts: string[] = [];

  if (computed.name) {
    parts.push(computed.name);
  }
  if (computed.role && computed.role !== 'generic') {
    parts.push(computed.role);
  }
  if (computed.level !== undefined) {
    parts.push(`level ${computed.level}`);
  }
  if (computed.states.length > 0) {
    parts.push(...computed.states);
  }

  return parts.join(', ');
};

const speak = (text: string): void => {
  if (!text) {
    return;
  }

  if (text === lastAnnouncement) {
    console.debug('[Screen Reader] Skipping duplicate announcement:', text);
    return;
  }

  lastAnnouncement = text;

  try {
    if (!window.speechSynthesis) {
      console.warn('[Screen Reader] Web Speech API not available');
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = SPEECH_RATE;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;

    console.debug('[Screen Reader] Speaking:', text);
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('[Screen Reader] Speech synthesis error:', error);
  }
};

const handleFocusIn = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target === document.body || target === document.documentElement) {
    return;
  }

  try {
    const computed = computeAccessibility(target);
    const announcement = formatAnnouncement(computed);

    if (announcement) {
      speak(announcement);
    }
  } catch (error) {
    console.error('[Screen Reader] Error computing accessibility:', error);
  }
};

export const initScreenReader = (): void => {
  if (isInitialized) {
    console.debug('[Screen Reader] Already initialized');
    return;
  }

  console.info('[Screen Reader] Initializing');
  focusListener = handleFocusIn;
  document.addEventListener('focusin', focusListener, { capture: true });

  isInitialized = true;
  lastAnnouncement = '';
  console.info('[Screen Reader] Initialized successfully');
};

export const destroyScreenReader = (): void => {
  if (!isInitialized) {
    console.debug('[Screen Reader] Not initialized, nothing to destroy');
    return;
  }

  console.info('[Screen Reader] Destroying');
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  if (focusListener) {
    document.removeEventListener('focusin', focusListener, { capture: true });
    focusListener = null;
  }

  isInitialized = false;
  lastAnnouncement = '';
  console.info('[Screen Reader] Destroyed successfully');
};

export const isScreenReaderActive = (): boolean => {
  return isInitialized;
};
