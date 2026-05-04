# Chrome Extension Tests

This directory contains tests for the Chrome extension.

## Structure

- Unit tests for individual components
- Integration tests for message passing
- End-to-end tests for extension functionality

## Running Tests

```bash
npm test
```

## Test Framework

To add testing, install a test framework like Jest or Vitest:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Then update package.json scripts:

```json
"scripts": {
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```
