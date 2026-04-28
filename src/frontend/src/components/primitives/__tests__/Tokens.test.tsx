import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
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

/*
 * Font-family tokens are declared on :root (= <html>). jsdom does not
 * propagate :root custom properties to descendants through
 * getPropertyValue, so we read from document.documentElement directly.
 */
describe('typography tokens', () => {
  it('--font-sans declares Mona Sans Variable as the primary family', () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
    expect(value.toLowerCase()).toContain('mona sans variable');
  });

  it('--font-mono declares JetBrains Mono Variable as the primary family', () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
    expect(value.toLowerCase()).toContain('jetbrains mono variable');
  });

  it('--font-display declares DM Serif Display as the primary family', () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
    expect(value.toLowerCase()).toContain('dm serif display');
  });
});

/*
 * Cascade regression: index.css used to declare body { font-family: 'Space
 * Grotesk', ... } AFTER the tokens.css import, silently overriding the new
 * --font-sans body rule. This test injects both stylesheets in their
 * production order and verifies the typed body rule resolves to our token,
 * not the legacy literal.
 */
describe('typography cascade integration', () => {
  let indexStyle: HTMLStyleElement;

  beforeAll(() => {
    const indexPath = path.resolve(__dirname, '../../../index.css');
    let css = fs.readFileSync(indexPath, 'utf8');
    css = css.replace(/@tailwind[^;]+;\s*/g, '');
    css = css.replace(/@import\s+'[^']+';\s*/g, '');
    indexStyle = document.createElement('style');
    indexStyle.id = 'index-css-under-test';
    indexStyle.textContent = css;
    document.head.appendChild(indexStyle);
  });

  afterAll(() => {
    indexStyle?.remove();
  });

  it('body.font-family resolves to var(--font-sans), not a stale literal', () => {
    const family = getComputedStyle(document.body).fontFamily;
    expect(family).toContain('var(--font-sans)');
    expect(family).not.toContain('Space Grotesk');
  });
});

/*
 * Plan 2 retired the bespoke utility classes (.btn, .card, .input,
 * .glass, .markdown-body) but Plan 3's a11y sweep surfaced 588 JSX
 * call sites still consuming the legacy --color-* / --gradient-* vars
 * via arbitrary-value Tailwind classes. The shim stays alive until
 * Plan 4 migrates them. This describe asserts the shim is INTACT so
 * a future "let's clean this up" doesn't repeat Plan 2's mistake.
 */
describe('legacy shim still alive (Plan 4 migration pending)', () => {
  const shimVars = [
    '--color-bg-primary',
    '--color-text-primary',
    '--color-border-default',
    '--color-primary',
    '--color-success',
    '--color-error',
    '--shadow-sm',
    '--shadow-lg',
    '--gradient-primary',
    '--glass-bg',
    '--space-4',
    '--transition-fast',
    '--radius-full',
    '--blur-md',
  ];
  shimVars.forEach((name) => {
    it(`legacy shim variable ${name} is still defined`, () => {
      const declared = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      expect(declared).not.toBe('');
    });
  });
});
