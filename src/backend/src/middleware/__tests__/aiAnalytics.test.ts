import { calculateCost } from '../aiAnalytics';

describe('ai analytics cost calculation', () => {
  it('uses the current gpt-5.4-mini pricing', () => {
    expect(calculateCost('gpt-5.4-mini', 1_000_000, 1_000_000)).toBe(5.25);
  });

  it('uses the current gpt-5.4-nano pricing', () => {
    expect(calculateCost('gpt-5.4-nano', 1_000_000, 1_000_000)).toBe(1.45);
  });

  it('falls back to the longest matching model key for variants', () => {
    expect(calculateCost('gpt-5.4-mini-2026-04-01', 1_000_000, 0)).toBe(0.75);
  });
});
