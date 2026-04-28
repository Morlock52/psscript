import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Token resolution tests.
 *
 * Note on environment: jsdom's getComputedStyle does NOT resolve `var()`
 * references at the consumer site (it returns the literal "var(--name)"
 * string). It DOES however correctly resolve and inherit CSS custom
 * properties declared in stylesheet rules — getComputedStyle(el)
 * .getPropertyValue('--name') returns the resolved hex.
 *
 * We therefore inject tokens.css into the jsdom document, set the
 * data-surface / data-theme attributes on <body>, and read the resolved
 * --variable directly. The hex values are converted to rgb(...) form so
 * the assertions in this file match the spec verbatim.
 */

const cases: Array<{
  surface: 'brand' | 'operator';
  theme?: 'dark' | 'light';
  variable: string;
  expected: string;
}> = [
  { surface: 'brand',    variable: '--surface-base',  expected: 'rgb(14, 21, 37)'   },
  { surface: 'brand',    variable: '--accent',         expected: 'rgb(252, 165, 165)'},
  { surface: 'brand',    variable: '--ink-primary',    expected: 'rgb(245, 241, 232)'},
  { surface: 'operator', theme: 'dark', variable: '--surface-base', expected: 'rgb(14, 17, 22)'  },
  { surface: 'operator', theme: 'dark', variable: '--accent',        expected: 'rgb(200, 242, 92)'},
  { surface: 'operator', theme: 'light',variable: '--surface-base',  expected: 'rgb(251, 248, 241)'},
  { surface: 'operator', theme: 'light',variable: '--accent',        expected: 'rgb(107, 143, 46)'},
];

function hexToRgbString(hex: string): string {
  const cleaned = hex.trim().replace(/^#/, '');
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe('design tokens', () => {
  beforeAll(() => {
    const tokensPath = path.resolve(__dirname, '../../../styles/tokens.css');
    const css = fs.readFileSync(tokensPath, 'utf8');
    const style = document.createElement('style');
    style.id = 'tokens-css-under-test';
    style.textContent = css;
    document.head.appendChild(style);
  });

  beforeEach(() => {
    document.body.removeAttribute('data-surface');
    document.body.removeAttribute('data-theme');
  });
  afterEach(() => {
    document.body.removeAttribute('data-surface');
    document.body.removeAttribute('data-theme');
  });

  cases.forEach(({ surface, theme, variable, expected }) => {
    it(`${surface}${theme ? '/' + theme : ''} resolves ${variable} to ${expected}`, () => {
      document.body.setAttribute('data-surface', surface);
      if (theme) document.body.setAttribute('data-theme', theme);
      const raw = getComputedStyle(document.body).getPropertyValue(variable).trim();
      const computed = hexToRgbString(raw);
      expect(computed).toBe(expected);
    });
  });
});
