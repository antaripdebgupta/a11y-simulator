import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enableKeyboardOnly,
  disableKeyboardOnly,
  isKeyboardOnlyActive,
} from '../../src/content/keyboard-mode';

const KEYBOARD_STYLE_ID = 'a11y-inspector-keyboard-style';
const SKIP_LINK_ID = 'a11y-inspector-skip-link';
const TAB_PRESSED_ATTR = 'data-a11y-tab-pressed';

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.body.style.cursor = '';
  disableKeyboardOnly();
});

afterEach(() => {
  disableKeyboardOnly();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.body.style.cursor = '';
  vi.useRealTimers();
});

describe('Keyboard-Only Mode', () => {
  // Test 1: style element injection
  it('injects <style> with id a11y-inspector-keyboard-style on enable', () => {
    enableKeyboardOnly();

    const style = document.getElementById(KEYBOARD_STYLE_ID) as HTMLStyleElement | null;
    expect(style).not.toBeNull();
    expect(style?.tagName.toLowerCase()).toBe('style');
    expect(style?.parentElement).toBe(document.body);
    expect(style?.textContent).toContain('*:focus');
    expect(style?.textContent).toContain('#1D4ED8');
    expect(style?.textContent).toContain('!important');
  });

  it('injected style enforces focus ring on :focus with !important', () => {
    enableKeyboardOnly();

    const style = document.getElementById(KEYBOARD_STYLE_ID) as HTMLStyleElement | null;
    expect(style?.textContent).toContain('outline: 3px solid #1D4ED8 !important');
    expect(style?.textContent).toContain('outline-offset: 3px !important');
    expect(style?.textContent).toContain(
      'box-shadow: 0 0 0 5px rgba(29, 78, 216, 0.25) !important'
    );
  });

  it('injected style flags outline:none elements with a red ring (WCAG 2.4.7 failure)', () => {
    enableKeyboardOnly();

    const style = document.getElementById(KEYBOARD_STYLE_ID) as HTMLStyleElement | null;
    expect(style?.textContent).toContain('#DC2626');
    expect(style?.textContent).toContain('[style*="outline: none"]:focus');
    expect(style?.textContent).toContain('[style*="outline:none"]:focus');
  });

  // Test 2: disableKeyboardOnly restores state

  it('removes the style element and restores cursor on disable', () => {
    document.body.style.cursor = 'auto';

    enableKeyboardOnly();
    expect(document.body.style.cursor).toBe('not-allowed');
    expect(document.getElementById(KEYBOARD_STYLE_ID)).not.toBeNull();

    disableKeyboardOnly();
    expect(document.getElementById(KEYBOARD_STYLE_ID)).toBeNull();
    expect(document.body.style.cursor).toBe('auto');
  });

  it('isKeyboardOnlyActive returns true after enable and false after disable', () => {
    expect(isKeyboardOnlyActive()).toBe(false);
    enableKeyboardOnly();
    expect(isKeyboardOnlyActive()).toBe(true);
    disableKeyboardOnly();
    expect(isKeyboardOnlyActive()).toBe(false);
  });

  // Test 3: mouse click is blocked

  it('blocks click events via preventDefault after enable', () => {
    enableKeyboardOnly();

    const target = document.createElement('button');
    target.textContent = 'Click me';
    document.body.appendChild(target);

    // detail:1 = real mouse click (detail===0 would be keyboard/programmatic)
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    target.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('blocks mousedown, mouseup, mouseover, mouseenter, contextmenu events', () => {
    enableKeyboardOnly();

    const target = document.createElement('div');
    document.body.appendChild(target);

    const eventTypes = ['mousedown', 'mouseup', 'mouseover', 'mouseenter', 'contextmenu'] as const;

    for (const type of eventTypes) {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it('does NOT block click events on the tab-order overlay', () => {
    enableKeyboardOnly();

    // Create a fake overlay with the exact id the blocker checks
    const overlay = document.createElement('div');
    overlay.id = 'a11y-inspector-tab-overlay';
    document.body.appendChild(overlay);

    const badge = document.createElement('span');
    overlay.appendChild(badge);

    // detail:1 ensures we test the overlay-exemption path (not the detail===0 shortcut)
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    badge.dispatchEvent(clickEvent);

    // Must NOT be blocked — badge is inside the overlay
    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it('does NOT block mouse events after disable', () => {
    enableKeyboardOnly();
    disableKeyboardOnly();

    const target = document.createElement('button');
    document.body.appendChild(target);

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    target.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
  });

  // Test 4: skip link injected when none exists

  it('injects skip link when page has no existing skip link', () => {
    enableKeyboardOnly();

    const skipLink = document.getElementById(SKIP_LINK_ID) as HTMLAnchorElement | null;
    expect(skipLink).not.toBeNull();
    expect(skipLink?.tagName.toLowerCase()).toBe('a');
    expect(skipLink?.getAttribute('href')).toBe('#main');
    expect(skipLink?.textContent).toBe('Skip to main content');
    expect(document.body.firstElementChild?.id).toBe(SKIP_LINK_ID);
  });

  it('sets id="main" on <main> element when injecting skip link and main has no id', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);

    enableKeyboardOnly();

    expect(main.id).toBe('main');
  });

  it('does not overwrite existing id on <main> element', () => {
    const main = document.createElement('main');
    main.id = 'my-main';
    document.body.appendChild(main);

    enableKeyboardOnly();
    expect(main.id).toBe('my-main');
  });

  // Test 5: skip link NOT injected when page already has one

  it('does NOT inject skip link when page already has a[href="#main"]', () => {
    const existing = document.createElement('a');
    existing.href = '#main';
    existing.textContent = 'Skip navigation';
    document.body.appendChild(existing);

    enableKeyboardOnly();

    // Our skip link must NOT be present
    expect(document.getElementById(SKIP_LINK_ID)).toBeNull();
    // The original link must still be there
    expect(document.querySelector('a[href="#main"]')).toBe(existing);
  });

  it('does NOT inject skip link when page already has a[href="#content"]', () => {
    const existing = document.createElement('a');
    existing.href = '#content';
    document.body.appendChild(existing);

    enableKeyboardOnly();

    expect(document.getElementById(SKIP_LINK_ID)).toBeNull();
  });

  it('does NOT inject skip link when page already has [id="skip-to-content"]', () => {
    const existing = document.createElement('a');
    existing.id = 'skip-to-content';
    document.body.appendChild(existing);

    enableKeyboardOnly();

    expect(document.getElementById(SKIP_LINK_ID)).toBeNull();
  });

  // Test 6: disableKeyboardOnly removes injected skip link

  it('removes the injected skip link on disable', () => {
    enableKeyboardOnly();
    expect(document.getElementById(SKIP_LINK_ID)).not.toBeNull();

    disableKeyboardOnly();
    expect(document.getElementById(SKIP_LINK_ID)).toBeNull();
  });

  it('does NOT remove a pre-existing skip link on disable', () => {
    const existing = document.createElement('a');
    existing.href = '#main';
    existing.textContent = 'Skip navigation';
    document.body.appendChild(existing);

    enableKeyboardOnly();
    disableKeyboardOnly();

    // Pre-existing link must still be present
    expect(document.querySelector('a[href="#main"]')).toBe(existing);
  });

  // Test 7: disableKeyboardOnly when not enabled does not throw

  it('calling disableKeyboardOnly when not enabled does not throw', () => {
    expect(isKeyboardOnlyActive()).toBe(false);
    expect(() => disableKeyboardOnly()).not.toThrow();
  });

  it('calling disableKeyboardOnly multiple times does not throw', () => {
    enableKeyboardOnly();
    expect(() => {
      disableKeyboardOnly();
      disableKeyboardOnly();
      disableKeyboardOnly();
    }).not.toThrow();
  });

  // Tab-pressed attribute

  it('sets data-a11y-tab-pressed on body when Tab key is pressed', () => {
    vi.useFakeTimers();
    enableKeyboardOnly();

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);

    expect(document.body.getAttribute(TAB_PRESSED_ATTR)).toBe('true');
  });

  it('removes data-a11y-tab-pressed after 200 ms', () => {
    vi.useFakeTimers();
    enableKeyboardOnly();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    );
    expect(document.body.getAttribute(TAB_PRESSED_ATTR)).toBe('true');

    vi.advanceTimersByTime(200);
    expect(document.body.getAttribute(TAB_PRESSED_ATTR)).toBeNull();
  });

  it('removes data-a11y-tab-pressed attribute on disable', () => {
    vi.useFakeTimers();
    enableKeyboardOnly();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    );
    expect(document.body.getAttribute(TAB_PRESSED_ATTR)).toBe('true');

    disableKeyboardOnly();
    expect(document.body.getAttribute(TAB_PRESSED_ATTR)).toBeNull();
  });

  // Focus trap detection

  it('logs WCAG 2.1.2 warning when Escape is pressed inside a dialog with no close button', () => {
    enableKeyboardOnly();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a dialog with no close mechanism
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Trapped!';
    paragraph.tabIndex = -1;
    dialog.appendChild(paragraph);
    document.body.appendChild(dialog);

    // Simulate focus inside the dialog
    paragraph.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Focus trap detected'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('WCAG 2.1.2'));

    warnSpy.mockRestore();
  });

  it('does NOT log a warning when dialog has a close button', () => {
    enableKeyboardOnly();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const para = document.createElement('p');
    para.tabIndex = -1;
    dialog.appendChild(para);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    dialog.appendChild(closeBtn);

    document.body.appendChild(dialog);
    para.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // No double-registration on repeated enable

  it('calling enableKeyboardOnly twice only registers one set of listeners', () => {
    enableKeyboardOnly();
    enableKeyboardOnly(); // second call must no-op

    const target = document.createElement('button');
    document.body.appendChild(target);

    let callCount = 0;
    target.addEventListener('click', () => {
      callCount++;
    });

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    target.dispatchEvent(clickEvent);

    // Event was blocked so callCount stays 0 — just confirm no double-handler crash
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(callCount).toBe(0);
  });

  it('style element is only injected once even when enable is called twice', () => {
    enableKeyboardOnly();
    enableKeyboardOnly();

    expect(document.querySelectorAll(`#${KEYBOARD_STYLE_ID}`).length).toBe(1);
  });

  // Enter key
  it('Enter activates a focused button via click()', () => {
    enableKeyboardOnly();

    const btn = document.createElement('button');
    let clicked = false;
    btn.addEventListener('click', () => {
      clicked = true;
    });
    document.body.appendChild(btn);
    btn.focus();

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(clicked).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('Enter on a link does NOT call preventDefault and lets native navigation run', () => {
    enableKeyboardOnly();

    const link = document.createElement('a');
    link.href = 'https://example.com';
    document.body.appendChild(link);
    link.focus();

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
  });

  // Space key
  it('Space activates a focused button and prevents scroll', () => {
    enableKeyboardOnly();

    const btn = document.createElement('button');
    let clicked = false;
    btn.addEventListener('click', () => {
      clicked = true;
    });
    document.body.appendChild(btn);
    btn.focus();

    const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(clicked).toBe(true);
  });

  it('Space on a native checkbox toggles it and prevents scroll', () => {
    enableKeyboardOnly();

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = false;
    document.body.appendChild(cb);
    cb.focus();

    const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(cb.checked).toBe(true);
  });

  it('Space on role="checkbox" toggles aria-checked and prevents scroll', () => {
    enableKeyboardOnly();

    const el = document.createElement('div');
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', 'false');
    el.tabIndex = 0;
    document.body.appendChild(el);
    el.focus();

    const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(el.getAttribute('aria-checked')).toBe('true');
  });

  it('Space toggles aria-checked back to false when already true', () => {
    enableKeyboardOnly();

    const el = document.createElement('div');
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', 'true');
    el.tabIndex = 0;
    document.body.appendChild(el);
    el.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    );

    expect(el.getAttribute('aria-checked')).toBe('false');
  });

  // Arrow keys
  it('ArrowDown moves focus to the next menuitem', () => {
    enableKeyboardOnly();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const items = ['One', 'Two', 'Three'].map((label) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.textContent = label;
      menu.appendChild(item);
      return item;
    });
    document.body.appendChild(menu);
    items[0]!.focus();

    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[1]);
  });

  it('ArrowUp moves focus to the previous menuitem', () => {
    enableKeyboardOnly();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const items = ['A', 'B', 'C'].map((label) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.textContent = label;
      menu.appendChild(item);
      return item;
    });
    document.body.appendChild(menu);
    items[2]!.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    );

    expect(document.activeElement).toBe(items[1]);
  });

  it('ArrowDown wraps focus from last to first menuitem', () => {
    enableKeyboardOnly();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const items = ['X', 'Y'].map((label) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.textContent = label;
      menu.appendChild(item);
      return item;
    });
    document.body.appendChild(menu);
    items[1]!.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );

    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowDown inside a listbox moves focus to next option', () => {
    enableKeyboardOnly();

    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const opts = ['Alpha', 'Beta'].map((label) => {
      const opt = document.createElement('div');
      opt.setAttribute('role', 'option');
      opt.tabIndex = -1;
      opt.textContent = label;
      listbox.appendChild(opt);
      return opt;
    });
    document.body.appendChild(listbox);
    opts[0]!.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );

    expect(document.activeElement).toBe(opts[1]);
  });

  it('Arrow keys do NOT intercept a native <select> element', () => {
    enableKeyboardOnly();

    const sel = document.createElement('select');
    sel.appendChild(
      Object.assign(document.createElement('option'), { value: '1', textContent: 'One' })
    );
    sel.appendChild(
      Object.assign(document.createElement('option'), { value: '2', textContent: 'Two' })
    );
    document.body.appendChild(sel);
    sel.focus();

    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    // We must NOT call preventDefault — native <select> should handle this
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Arrow keys outside a composite widget do not call preventDefault', () => {
    enableKeyboardOnly();

    const div = document.createElement('div');
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();

    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
  });

  // Escape key

  it('Escape collapses an expanded ancestor (aria-expanded="true")', () => {
    enableKeyboardOnly();

    const trigger = document.createElement('button');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.tabIndex = 0;
    document.body.appendChild(trigger);

    const item = document.createElement('div');
    item.tabIndex = -1;
    trigger.appendChild(item);
    item.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape collapses the focused element itself when it has aria-expanded="true"', () => {
    enableKeyboardOnly();

    const trigger = document.createElement('button');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.tabIndex = 0;
    document.body.appendChild(trigger);
    trigger.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  // Home / End keys

  it('Home moves focus to the first menuitem', () => {
    enableKeyboardOnly();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const items = ['P', 'Q', 'R'].map((label) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.textContent = label;
      menu.appendChild(item);
      return item;
    });
    document.body.appendChild(menu);
    items[2]!.focus();

    const ev = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it('End moves focus to the last menuitem', () => {
    enableKeyboardOnly();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const items = ['P', 'Q', 'R'].map((label) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.textContent = label;
      menu.appendChild(item);
      return item;
    });
    document.body.appendChild(menu);
    items[0]!.focus();

    const ev = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[2]);
  });

  it('Home / End outside a composite widget do not call preventDefault', () => {
    enableKeyboardOnly();

    const div = document.createElement('div');
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();

    const ev = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
  });
});
