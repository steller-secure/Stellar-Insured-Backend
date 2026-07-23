import { computeReputationFromHistory } from './reputation-score.calculator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const entry = (scoreChange: number) => ({ scoreChange });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeReputationFromHistory', () => {
  it('returns the base score (50) when history is empty', () => {
    expect(computeReputationFromHistory([])).toBe(50);
  });

  it('adds positive deltas to the base score', () => {
    // 50 + 10 + 15 = 75
    expect(computeReputationFromHistory([entry(10), entry(15)])).toBe(75);
  });

  it('subtracts negative deltas from the base score', () => {
    // 50 - 5 - 20 = 25
    expect(computeReputationFromHistory([entry(-5), entry(-20)])).toBe(25);
  });

  it('clamps to 0 when deltas would make the score negative', () => {
    // 50 - 200 = -150 → clamped to 0
    expect(computeReputationFromHistory([entry(-200)])).toBe(0);
  });

  it('clamps to 1000 when deltas exceed the maximum', () => {
    // 50 + 2000 = 2050 → clamped to 1000
    expect(computeReputationFromHistory([entry(2000)])).toBe(1000);
  });

  it('is order-independent (deterministic regardless of insertion order)', () => {
    const a = [entry(10), entry(-5), entry(15)];
    const b = [entry(15), entry(10), entry(-5)];
    expect(computeReputationFromHistory(a)).toBe(
      computeReputationFromHistory(b),
    );
  });

  it('returns the same value on repeated calls with the same input', () => {
    const history = [entry(10), entry(-5), entry(20)];
    expect(computeReputationFromHistory(history)).toBe(
      computeReputationFromHistory(history),
    );
  });

  it('handles a realistic claim approve → fraud detected sequence', () => {
    // CLAIM_APPROVED = +10, FRAUD_DETECTED = -20  → 50 + 10 - 20 = 40
    expect(computeReputationFromHistory([entry(10), entry(-20)])).toBe(40);
  });

  it('handles a sequence that reaches exactly 1000', () => {
    expect(computeReputationFromHistory([entry(950)])).toBe(1000);
  });

  it('handles a sequence that reaches exactly 0', () => {
    expect(computeReputationFromHistory([entry(-50)])).toBe(0);
  });
});
