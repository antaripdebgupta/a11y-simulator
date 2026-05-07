import { describe, it, expect, beforeEach, afterEach } from 'vitest';

interface MockSpeechSynthesisUtterance {
  text: string;
  rate: number;
  volume: number;
  pitch: number;
}

interface MockSpeechSynthesis {
  speaking: boolean;
  cancelled: boolean;
  lastUtterance: MockSpeechSynthesisUtterance | null;
  speak: (utterance: MockSpeechSynthesisUtterance) => void;
  cancel: () => void;
}

// Global test setup
const setupSpeechSynthesisMock = (): MockSpeechSynthesis => {
  const mock: MockSpeechSynthesis = {
    speaking: false,
    cancelled: false,
    lastUtterance: null,
    speak(utterance: MockSpeechSynthesisUtterance) {
      this.speaking = true;
      this.cancelled = false;
      this.lastUtterance = utterance;
    },
    cancel() {
      this.speaking = false;
      this.cancelled = true;
      this.lastUtterance = null;
    },
  };

  global.window = global.window || {};
  global.window.speechSynthesis = mock as unknown as SpeechSynthesis;
  // @ts-expect-error - Mocking global
  global.SpeechSynthesisUtterance = class {
    text: string;
    rate = 1.0;
    volume = 1.0;
    pitch = 1.0;

    constructor(text: string) {
      this.text = text;
    }
  };

  return mock;
};

describe('Screen Reader Simulator', () => {
  let mockSpeech: MockSpeechSynthesis;

  beforeEach(() => {
    // Set up clean DOM
    document.body.innerHTML = '';

    // Mock speech synthesis
    mockSpeech = setupSpeechSynthesisMock();
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });

  // Test 1: aria-label
  it('element with aria-label returns the aria-label as name', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create button with aria-label
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Submit form');
    document.body.appendChild(button);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech to be called
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('Submit form');
    expect(mockSpeech.lastUtterance?.text).toContain('button');
    expect(mockSpeech.lastUtterance?.rate).toBe(1.4);

    // Clean up
    destroyScreenReader();
  });

  // Test 2: aria-labelledby
  it('element with aria-labelledby pointing to another element returns that element text', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create label element
    const label = document.createElement('div');
    label.id = 'custom-label';
    label.textContent = 'Accept terms and conditions';
    document.body.appendChild(label);

    // Create checkbox with aria-labelledby
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-labelledby', 'custom-label');
    document.body.appendChild(checkbox);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    checkbox.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement contains the referenced element's text
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('Accept terms and conditions');
    expect(mockSpeech.lastUtterance?.text).toContain('checkbox');

    // Clean up
    destroyScreenReader();
  });

  // Test 3: unlabelled input
  it('<input> with no label returns "unlabelled element"', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create input with no label
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement contains "unlabelled element"
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('unlabelled element');
    expect(mockSpeech.lastUtterance?.text).toContain('textbox');

    // Clean up
    destroyScreenReader();
  });

  // Test 4: disabled button
  it('<button disabled> announcement includes "disabled" in the string', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create disabled button
    const button = document.createElement('button');
    button.textContent = 'Submit';
    button.disabled = true;
    document.body.appendChild(button);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement includes "disabled"
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('Submit');
    expect(mockSpeech.lastUtterance?.text).toContain('button');
    expect(mockSpeech.lastUtterance?.text).toContain('disabled');

    // Clean up
    destroyScreenReader();
  });

  // Test 5: heading with level
  it('<h2> announcement includes "heading" and "level 2"', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create h2 element
    const heading = document.createElement('h2');
    heading.textContent = 'Welcome';
    heading.tabIndex = -1; // Make it focusable for testing
    document.body.appendChild(heading);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    heading.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement includes heading and level
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('Welcome');
    expect(mockSpeech.lastUtterance?.text).toContain('heading');
    expect(mockSpeech.lastUtterance?.text).toContain('level 2');

    // Clean up
    destroyScreenReader();
  });

  // Additional Test: Deduplication
  it('duplicate announcements are skipped', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create button
    const button = document.createElement('button');
    button.textContent = 'Click me';
    document.body.appendChild(button);

    // Initialize screen reader
    initScreenReader();

    // First focus
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const firstAnnouncement = mockSpeech.lastUtterance?.text;
    expect(firstAnnouncement).toContain('Click me');

    // Reset mock
    mockSpeech.lastUtterance = null;

    // Focus same element again immediately
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should NOT announce again (deduplication)
    expect(mockSpeech.lastUtterance).toBeNull();

    // Clean up
    destroyScreenReader();
  });

  // Additional Test: Required and checked states
  it('checkbox with required and not checked states', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create required checkbox (not checked)
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', 'Accept terms');
    checkbox.required = true;
    document.body.appendChild(checkbox);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    checkbox.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement includes states
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('Accept terms');
    expect(mockSpeech.lastUtterance?.text).toContain('checkbox');
    expect(mockSpeech.lastUtterance?.text).toContain('required');
    expect(mockSpeech.lastUtterance?.text).toContain('not checked');

    // Clean up
    destroyScreenReader();
  });

  // Additional Test: aria-expanded state
  it('element with aria-expanded="true" includes "expanded"', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create button with aria-expanded
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Navigation menu');
    button.setAttribute('aria-expanded', 'true');
    document.body.appendChild(button);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement includes "expanded"
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('Navigation menu');
    expect(mockSpeech.lastUtterance?.text).toContain('expanded');

    // Clean up
    destroyScreenReader();
  });

  // Additional Test: Form label association
  it('input with <label for> association', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    // Create label and input
    const label = document.createElement('label');
    label.setAttribute('for', 'email-input');
    label.textContent = 'Email address';
    document.body.appendChild(label);

    const input = document.createElement('input');
    input.id = 'email-input';
    input.type = 'email';
    document.body.appendChild(input);

    // Initialize screen reader
    initScreenReader();

    // Simulate focus
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // Wait for speech
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify announcement uses label text
    expect(mockSpeech.lastUtterance).not.toBeNull();
    expect(mockSpeech.lastUtterance?.text).toContain('Email address');
    expect(mockSpeech.lastUtterance?.text).toContain('textbox');

    // Clean up
    destroyScreenReader();
  });

  // Additional Test: speechSynthesis.cancel() called
  it('speechSynthesis.cancel() is called before new utterance', async () => {
    const { initScreenReader, destroyScreenReader } =
      await import('../../src/content/screen-reader');

    const button1 = document.createElement('button');
    button1.textContent = 'First';
    document.body.appendChild(button1);

    const button2 = document.createElement('button');
    button2.textContent = 'Second';
    document.body.appendChild(button2);

    // Initialize screen reader
    initScreenReader();

    // Focus first button
    button1.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSpeech.lastUtterance?.text).toContain('First');
    expect(mockSpeech.cancelled).toBe(true); // cancel called before speak

    // Focus second button
    button2.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSpeech.lastUtterance?.text).toContain('Second');
    expect(mockSpeech.cancelled).toBe(true); // cancel called again

    // Clean up
    destroyScreenReader();
  });

  // Additional Test: destroyScreenReader cleanup
  it('destroyScreenReader cancels speech and removes listeners', async () => {
    const { initScreenReader, destroyScreenReader, isScreenReaderActive } =
      await import('../../src/content/screen-reader');

    const button = document.createElement('button');
    button.textContent = 'Test';
    document.body.appendChild(button);

    // Initialize
    initScreenReader();
    expect(isScreenReaderActive()).toBe(true);

    // Focus to trigger speech
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSpeech.lastUtterance).not.toBeNull();

    // Destroy
    destroyScreenReader();
    expect(isScreenReaderActive()).toBe(false);
    expect(mockSpeech.cancelled).toBe(true);

    // Reset mock
    mockSpeech.lastUtterance = null;

    // Focus again should NOT announce (listener removed)
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSpeech.lastUtterance).toBeNull();
  });
});
